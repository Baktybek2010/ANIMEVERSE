-- =====================================================================
-- ANIMEVERSE · 0002 · Функции и триггеры
-- Все SECURITY DEFINER-функции используют пустой search_path.
-- =====================================================================

-- ---------- Общие помощники ---------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Уровень роли текущего пользователя (0 — гость, обычный или заблокированный пользователь).
create or replace function public.current_role_level()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select r.level
       from public.profiles p
       join public.roles r on r.name = p.role
      where p.id = (select auth.uid()) and not p.is_banned),
    0
  )::smallint;
$$;

-- Авторизованный и не заблокированный пользователь.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid()) and not p.is_banned
  );
$$;

-- Есть ли у пользователя действующая подписка (проверка срока — на стороне БД).
-- Для автопродлеваемых подписок даётся 12 часов на доставку webhook о продлении.
create or replace function public.has_active_subscription(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and exists (
    select 1
      from public.subscriptions s
     where s.user_id = p_user
       and s.status in ('active', 'trialing')
       and s.current_period_end
           + case when s.provider = 'manual' or s.cancel_at_period_end
                  then interval '0' else interval '12 hours' end > now()
  );
$$;

create or replace function public.is_premium()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and public.has_active_subscription((select auth.uid()));
$$;

-- Может ли текущий пользователь смотреть эпизод (учитывает публикацию и Premium).
create or replace function public.can_watch_episode(p_episode uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.episodes e
      join public.anime a on a.id = e.anime_id
     where e.id = p_episode
       and (
         (e.is_published and a.is_published and (not e.is_premium or public.is_premium()))
         or public.current_role_level() >= 50
       )
  );
$$;

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_username ~ '^[A-Za-z0-9_]{3,24}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

-- ---------- Профили ------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  v_locale   text := coalesce(new.raw_user_meta_data ->> 'locale', 'ru');
begin
  if v_username is null
     or v_username !~ '^[A-Za-z0-9_]{3,24}$'
     or exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;
  if v_locale not in ('ru', 'en', 'ja') then
    v_locale := 'ru';
  end if;

  insert into public.profiles (id, email, username, display_name, locale)
  values (new.id, new.email, v_username, v_username, v_locale)
  on conflict (id) do nothing;

  insert into public.notifications (user_id, type)
  values (new.id, 'welcome');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Защита служебных полей профиля. Прямой запрос от имени anon/authenticated
-- не может менять роль, блокировку и e-mail — только SECURITY DEFINER-функции
-- (current_user = владелец) и service_role.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.is_banned is distinct from old.is_banned
       or new.banned_reason is distinct from old.banned_reason
       or new.banned_at is distinct from old.banned_at
       or new.email is distinct from old.email
       or new.created_at is distinct from old.created_at then
      raise exception 'protected_profile_field' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------- Аниме: поисковая строка, жанры, updated_at -------------------
create or replace function public.anime_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Счётчик просмотров меняется часто и не должен трогать updated_at.
  if tg_op = 'UPDATE'
     and new.views_count is distinct from old.views_count
     and (to_jsonb(new) - 'views_count') = (to_jsonb(old) - 'views_count') then
    return new;
  end if;

  new.search_text := lower(concat_ws(' ',
    new.title_romaji,
    new.title_english,
    new.title_native,
    array_to_string(new.synonyms, ' '),
    (select string_agg(t.title, ' ') from public.anime_translations t where t.anime_id = new.id)
  ));
  new.updated_at := now();
  return new;
end;
$$;

create trigger anime_before_write
  before insert or update on public.anime
  for each row execute function public.anime_before_write();

create or replace function public.anime_translations_touch_anime()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Пустая search_text заставляет триггер anime_before_write пересчитать её.
  update public.anime set search_text = '' where id = coalesce(new.anime_id, old.anime_id);
  return null;
end;
$$;

create trigger anime_translations_touch_anime
  after insert or update of title or delete on public.anime_translations
  for each row execute function public.anime_translations_touch_anime();

create trigger anime_translations_set_updated_at
  before update on public.anime_translations
  for each row execute function public.set_updated_at();

create or replace function public.sync_anime_genre_slugs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anime uuid := coalesce(new.anime_id, old.anime_id);
begin
  update public.anime a
     set genre_slugs = coalesce(
       (select array_agg(g.slug order by g.slug)
          from public.anime_genres ag
          join public.genres g on g.id = ag.genre_id
         where ag.anime_id = v_anime),
       '{}')
   where a.id = v_anime;
  return null;
end;
$$;

create trigger anime_genres_sync_slugs
  after insert or delete on public.anime_genres
  for each row execute function public.sync_anime_genre_slugs();

create or replace function public.sync_genre_slug_rename()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.anime a
     set genre_slugs = array_replace(a.genre_slugs, old.slug, new.slug)
   where a.genre_slugs @> array[old.slug];
  return null;
end;
$$;

create trigger genres_slug_rename
  after update of slug on public.genres
  for each row when (old.slug is distinct from new.slug)
  execute function public.sync_genre_slug_rename();

-- ---------- updated_at для остальных таблиц ------------------------------
create trigger episodes_set_updated_at before update on public.episodes
  for each row when (to_jsonb(new) - 'views_count' is distinct from to_jsonb(old) - 'views_count')
  execute function public.set_updated_at();
create trigger plans_set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger announcements_set_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();
create trigger banners_set_updated_at before update on public.banners
  for each row execute function public.set_updated_at();
create trigger site_settings_set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ---------- Эпизоды ------------------------------------------------------
-- anime_id эпизода всегда соответствует сезону.
create or replace function public.episodes_sync_anime_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select s.anime_id into strict new.anime_id from public.seasons s where s.id = new.season_id;
  return new;
end;
$$;

create trigger episodes_sync_anime_id
  before insert or update of season_id, anime_id on public.episodes
  for each row execute function public.episodes_sync_anime_id();

-- Уведомление подписанным пользователям о новой опубликованной серии.
create or replace function public.notify_new_episode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anime  record;
  v_season integer;
begin
  if not new.is_published or (tg_op = 'UPDATE' and old.is_published) then
    return null;
  end if;

  select a.id, a.slug, a.title_romaji, a.is_published into v_anime
    from public.anime a where a.id = new.anime_id;
  if not v_anime.is_published then
    return null;
  end if;
  select s.number into v_season from public.seasons s where s.id = new.season_id;

  insert into public.notifications (user_id, type, link, data)
  select u.user_id,
         'new_episode',
         format('/watch/%s/%s/%s', v_anime.slug, v_season, new.number),
         jsonb_build_object(
           'anime_id', v_anime.id,
           'anime_title', v_anime.title_romaji,
           'season', v_season,
           'episode', new.number
         )
    from (
      select user_id from public.favorites where anime_id = new.anime_id
      union
      select user_id from public.watchlist where anime_id = new.anime_id
    ) u;
  return null;
end;
$$;

create trigger episodes_notify_published
  after insert or update of is_published on public.episodes
  for each row execute function public.notify_new_episode();

-- ---------- История просмотра -------------------------------------------
create or replace function public.watch_history_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select e.anime_id into strict new.anime_id from public.episodes e where e.id = new.episode_id;
  if new.duration_seconds > 0 and new.position_seconds > new.duration_seconds then
    new.position_seconds := new.duration_seconds;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger watch_history_before_write
  before insert or update on public.watch_history
  for each row execute function public.watch_history_before_write();

-- Учёт просмотра: не чаще одного события на пользователя и эпизод за 6 часов.
create or replace function public.record_view(p_episode uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_anime uuid;
begin
  if not public.can_watch_episode(p_episode) then
    return false;
  end if;
  select e.anime_id into v_anime from public.episodes e where e.id = p_episode;

  if v_user is not null and exists (
    select 1 from public.view_events v
     where v.user_id = v_user and v.episode_id = p_episode
       and v.created_at > now() - interval '6 hours'
  ) then
    return false;
  end if;

  insert into public.view_events (anime_id, episode_id, user_id) values (v_anime, p_episode, v_user);
  update public.episodes set views_count = views_count + 1 where id = p_episode;
  update public.anime set views_count = views_count + 1 where id = v_anime;
  return true;
end;
$$;

-- «Продолжить просмотр»: последняя серия по каждому аниме; если она досмотрена —
-- следующая опубликованная серия.
create or replace function public.get_continue_watching(p_limit integer default 12)
returns table (
  anime_id uuid,
  episode_id uuid,
  position_seconds integer,
  duration_seconds integer,
  updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  with latest as (
    select distinct on (h.anime_id) h.*
      from public.watch_history h
     where h.user_id = (select auth.uid())
     order by h.anime_id, h.updated_at desc
  ),
  resolved as (
    select l.anime_id,
           l.updated_at,
           case when l.completed then nxt.id else l.episode_id end as episode_id,
           case when l.completed then 0 else l.position_seconds end as position_seconds,
           case when l.completed then coalesce(nxt.duration_seconds, 0) else l.duration_seconds end as duration_seconds
      from latest l
      join public.episodes cur on cur.id = l.episode_id
      join public.seasons cs on cs.id = cur.season_id
      left join lateral (
        select e.id, e.duration_seconds
          from public.episodes e
          join public.seasons s on s.id = e.season_id
         where e.anime_id = l.anime_id
           and e.is_published
           and (s.number, e.number) > (cs.number, cur.number)
         order by s.number, e.number
         limit 1
      ) nxt on l.completed
  )
  select r.anime_id, r.episode_id, r.position_seconds, r.duration_seconds, r.updated_at
    from resolved r
    join public.anime a on a.id = r.anime_id and a.is_published
   where r.episode_id is not null
   order by r.updated_at desc
   limit least(greatest(p_limit, 1), 50);
$$;

-- Персональные рекомендации по жанрам из избранного, списка и истории.
create or replace function public.get_recommendations(p_limit integer default 18)
returns table (anime_id uuid, relevance numeric)
language sql
stable
set search_path = ''
as $$
  with mine as (
    select f.anime_id from public.favorites f where f.user_id = (select auth.uid())
    union
    select w.anime_id from public.watchlist w where w.user_id = (select auth.uid())
    union
    select h.anime_id from public.watch_history h where h.user_id = (select auth.uid())
  ),
  prefs as (
    select g.slug, count(*)::numeric as weight
      from mine m
      join public.anime a on a.id = m.anime_id
      cross join lateral unnest(a.genre_slugs) as g(slug)
     group by g.slug
     order by count(*) desc
     limit 6
  )
  select a.id, sum(p.weight) * coalesce(a.score, 5) as relevance
    from public.anime a
    join prefs p on a.genre_slugs @> array[p.slug]
   where a.is_published
     and not a.is_adult
     and not exists (select 1 from mine m where m.anime_id = a.id)
   group by a.id, a.score, a.popularity
   order by relevance desc, a.popularity desc
   limit least(greatest(p_limit, 1), 50);
$$;

-- ---------- Журнал действий администраторов ------------------------------
create or replace function public.log_admin_action(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_role_level() < 50 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.admin_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- ---------- Управление пользователями ------------------------------------
-- Правила иерархии:
--   * менять роли могут admin (80) и super_admin (100);
--   * нельзя менять собственную роль;
--   * нельзя трогать пользователя с ролью своего уровня или выше;
--   * назначить можно только роль ниже собственной (super_admin — любую).
create or replace function public.admin_set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor        uuid := (select auth.uid());
  v_actor_level  smallint := public.current_role_level();
  v_target_role  text;
  v_target_level smallint;
  v_new_level    smallint;
begin
  if v_actor is null or v_actor_level < 80 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = v_actor then
    raise exception 'cannot_change_own_role' using errcode = '42501';
  end if;

  select p.role, r.level into v_target_role, v_target_level
    from public.profiles p join public.roles r on r.name = p.role
   where p.id = p_user
     for update of p;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  select r.level into v_new_level from public.roles r where r.name = p_role;
  if not found then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  if v_actor_level < 100 and (v_target_level >= v_actor_level or v_new_level >= v_actor_level) then
    raise exception 'insufficient_privileges' using errcode = '42501';
  end if;

  if v_target_role = p_role then
    return;
  end if;

  update public.profiles set role = p_role where id = p_user;

  insert into public.admin_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'user.role_change', 'user', p_user::text,
          jsonb_build_object('from', v_target_role, 'to', p_role));

  insert into public.notifications (user_id, type, data)
  values (p_user, 'role_changed', jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_set_user_ban(p_user uuid, p_banned boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor        uuid := (select auth.uid());
  v_actor_level  smallint := public.current_role_level();
  v_target_level smallint;
begin
  if v_actor is null or v_actor_level < 80 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = v_actor then
    raise exception 'cannot_ban_self' using errcode = '42501';
  end if;

  select r.level into v_target_level
    from public.profiles p join public.roles r on r.name = p.role
   where p.id = p_user
     for update of p;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if v_target_level >= v_actor_level then
    raise exception 'insufficient_privileges' using errcode = '42501';
  end if;

  update public.profiles
     set is_banned = p_banned,
         banned_reason = case when p_banned then nullif(left(trim(coalesce(p_reason, '')), 500), '') else null end,
         banned_at = case when p_banned then now() else null end
   where id = p_user;

  insert into public.admin_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, case when p_banned then 'user.ban' else 'user.unban' end, 'user', p_user::text,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- ---------- Подписки -----------------------------------------------------
-- Ручная выдача Premium администратором (компенсации, партнёры). Платёж не создаётся.
create or replace function public.admin_grant_subscription(p_user uuid, p_plan text, p_days integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_id    uuid;
begin
  if v_actor is null or public.current_role_level() < 80 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  if not exists (select 1 from public.plans where id = p_plan) then
    raise exception 'invalid_plan' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.subscriptions
     where user_id = p_user and status in ('trialing', 'active', 'past_due')
  ) then
    raise exception 'subscription_already_active' using errcode = '23505';
  end if;

  insert into public.subscriptions (user_id, plan_id, status, provider, current_period_start, current_period_end, granted_by)
  values (p_user, p_plan, 'active', 'manual', now(), now() + make_interval(days => p_days), v_actor)
  returning id into v_id;

  insert into public.admin_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'subscription.grant', 'subscription', v_id::text,
          jsonb_build_object('user_id', p_user, 'plan', p_plan, 'days', p_days));

  insert into public.notifications (user_id, type, link, data)
  values (p_user, 'premium_granted', '/account/subscription', jsonb_build_object('days', p_days));

  return v_id;
end;
$$;

-- Отзыв выданной вручную подписки. Оплаченные подписки отменяются через платёжного провайдера.
create or replace function public.admin_revoke_subscription(p_subscription uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_sub   public.subscriptions%rowtype;
begin
  if v_actor is null or public.current_role_level() < 80 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_sub from public.subscriptions where id = p_subscription for update;
  if not found then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;
  if v_sub.provider <> 'manual' then
    raise exception 'provider_managed_subscription' using errcode = '22023';
  end if;

  update public.subscriptions
     set status = 'canceled', canceled_at = now(), current_period_end = least(current_period_end, now())
   where id = p_subscription;

  insert into public.admin_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'subscription.revoke', 'subscription', p_subscription::text,
          jsonb_build_object('user_id', v_sub.user_id));
end;
$$;

-- Автоматическое истечение подписок (вызывается по расписанию).
create or replace function public.expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.subscriptions s
       set status = 'expired'
     where s.status in ('trialing', 'active', 'past_due')
       and s.current_period_end
           + case when s.provider = 'manual' or s.cancel_at_period_end
                  then interval '0' else interval '12 hours' end < now()
    returning s.user_id
  ),
  notified as (
    insert into public.notifications (user_id, type, link)
    select user_id, 'premium_expired', '/premium' from expired
    returning 1
  )
  select count(*) into v_count from notified;
  return v_count;
end;
$$;

-- ---------- Статистика админ-панели -------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_role_level() < 50 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users_total',       (select count(*) from public.profiles),
    'users_new_7d',      (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'users_banned',      (select count(*) from public.profiles where is_banned),
    'premium_active',    (select count(*) from public.subscriptions
                           where status in ('active', 'trialing') and current_period_end > now()),
    'anime_total',       (select count(*) from public.anime),
    'anime_published',   (select count(*) from public.anime where is_published),
    'episodes_total',    (select count(*) from public.episodes),
    'episodes_published',(select count(*) from public.episodes where is_published),
    'views_total',       (select coalesce(sum(views_count), 0) from public.anime),
    'views_24h',         (select count(*) from public.view_events where created_at > now() - interval '24 hours'),
    'views_7d',          (select count(*) from public.view_events where created_at > now() - interval '7 days'),
    'revenue_30d_cents', (select coalesce(sum(amount_cents), 0) from public.payments
                           where status = 'succeeded' and created_at > now() - interval '30 days')
  );
end;
$$;

create or replace function public.admin_daily_stats(p_days integer default 30)
returns table (day date, views bigint, signups bigint, active_users bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_role_level() < 50 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  with days as (
    select generate_series(
      (current_date - (least(greatest(p_days, 1), 365) - 1))::timestamp,
      current_date::timestamp,
      interval '1 day'
    )::date as day
  )
  select d.day,
         (select count(*) from public.view_events v
           where v.created_at >= d.day and v.created_at < d.day + 1),
         (select count(*) from public.profiles p
           where p.created_at >= d.day and p.created_at < d.day + 1),
         (select count(distinct v.user_id) from public.view_events v
           where v.created_at >= d.day and v.created_at < d.day + 1 and v.user_id is not null)
    from days d
   order by d.day;
end;
$$;

-- ---------- Ограничение частоты запросов ---------------------------------
-- Фиксированное окно. Возвращает true, если запрос разрешён.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as rl (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when rl.window_start < now() - make_interval(secs => p_window_seconds)
                    then 1 else rl.hits + 1 end,
        window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds)
                            then now() else rl.window_start end
  returning hits into v_hits;

  -- Попутная очистка устаревших записей.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;
