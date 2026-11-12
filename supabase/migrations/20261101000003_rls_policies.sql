-- =====================================================================
-- ANIMEVERSE · 0003 · Row Level Security и права доступа
-- Уровни ролей: moderator = 50, admin = 80, super_admin = 100.
-- =====================================================================

-- ---------- Включаем RLS на всех таблицах --------------------------------
alter table public.roles              enable row level security;
alter table public.profiles           enable row level security;
alter table public.genres             enable row level security;
alter table public.anime              enable row level security;
alter table public.anime_translations enable row level security;
alter table public.anime_genres       enable row level security;
alter table public.seasons            enable row level security;
alter table public.episodes           enable row level security;
alter table public.episode_sources    enable row level security;
alter table public.episode_subtitles  enable row level security;
alter table public.favorites          enable row level security;
alter table public.watchlist          enable row level security;
alter table public.watch_history      enable row level security;
alter table public.view_events        enable row level security;
alter table public.plans              enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.payments           enable row level security;
alter table public.payment_events     enable row level security;
alter table public.notifications      enable row level security;
alter table public.announcements      enable row level security;
alter table public.banners            enable row level security;
alter table public.admin_logs         enable row level security;
alter table public.site_settings      enable row level security;
alter table public.rate_limits        enable row level security;

-- ---------- Табличные привилегии -----------------------------------------
-- Сначала отзываем всё, затем выдаём минимально необходимое. RLS — второй рубеж.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Публичное чтение каталога
grant select on public.roles, public.genres, public.anime, public.anime_translations, public.anime_genres,
  public.seasons, public.episodes, public.episode_sources, public.episode_subtitles,
  public.plans, public.announcements, public.banners, public.site_settings
  to anon, authenticated;

-- Пользовательские данные
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.favorites, public.watchlist to authenticated;
grant select, insert, update, delete on public.watch_history to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select on public.subscriptions, public.payments to authenticated;

-- Управление контентом (ограничивается политиками по уровню роли)
grant insert, update, delete on public.genres, public.anime, public.anime_translations, public.anime_genres,
  public.seasons, public.episodes, public.episode_sources, public.episode_subtitles,
  public.announcements, public.banners, public.site_settings
  to authenticated;
grant update on public.plans to authenticated;
grant select on public.admin_logs, public.view_events to authenticated;

-- Функции
grant execute on function public.current_role_level() to anon, authenticated;
grant execute on function public.is_active_user() to anon, authenticated;
grant execute on function public.is_premium() to anon, authenticated;
grant execute on function public.can_watch_episode(uuid) to anon, authenticated;
grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.record_view(uuid) to anon, authenticated;
grant execute on function public.get_continue_watching(integer) to authenticated;
grant execute on function public.get_recommendations(integer) to authenticated;
grant execute on function public.log_admin_action(text, text, text, jsonb) to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_set_user_ban(uuid, boolean, text) to authenticated;
grant execute on function public.admin_grant_subscription(uuid, text, integer) to authenticated;
grant execute on function public.admin_revoke_subscription(uuid) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_daily_stats(integer) to authenticated;
-- has_active_subscription, expire_subscriptions, rate_limit_hit — только service_role.

-- Новые объекты не должны автоматически становиться доступными через API.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------- roles --------------------------------------------------------
create policy roles_select_all on public.roles
  for select to anon, authenticated using (true);

-- ---------- profiles -----------------------------------------------------
create policy profiles_select_own_or_staff on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.current_role_level()) >= 50);

-- Обновление только своего профиля; служебные поля защищает триггер protect_profile_columns.
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and not is_banned)
  with check (id = (select auth.uid()));

-- ---------- genres -------------------------------------------------------
create policy genres_select_all on public.genres
  for select to anon, authenticated using (true);
create policy genres_insert_staff on public.genres
  for insert to authenticated with check ((select public.current_role_level()) >= 50);
create policy genres_update_staff on public.genres
  for update to authenticated
  using ((select public.current_role_level()) >= 50)
  with check ((select public.current_role_level()) >= 50);
create policy genres_delete_admin on public.genres
  for delete to authenticated using ((select public.current_role_level()) >= 80);

-- ---------- anime --------------------------------------------------------
create policy anime_select_published_or_staff on public.anime
  for select to anon, authenticated
  using (is_published or (select public.current_role_level()) >= 50);
create policy anime_insert_staff on public.anime
  for insert to authenticated with check ((select public.current_role_level()) >= 50);
create policy anime_update_staff on public.anime
  for update to authenticated
  using ((select public.current_role_level()) >= 50)
  with check ((select public.current_role_level()) >= 50);
create policy anime_delete_admin on public.anime
  for delete to authenticated using ((select public.current_role_level()) >= 80);

-- ---------- anime_translations / anime_genres / seasons ------------------
create policy anime_translations_select on public.anime_translations
  for select to anon, authenticated
  using (
    (select public.current_role_level()) >= 50
    or exists (select 1 from public.anime a where a.id = anime_id and a.is_published)
  );
create policy anime_translations_insert_staff on public.anime_translations
  for insert to authenticated with check ((select public.current_role_level()) >= 50);
create policy anime_translations_update_staff on public.anime_translations
  for update to authenticated
  using ((select public.current_role_level()) >= 50)
  with check ((select public.current_role_level()) >= 50);
create policy anime_translations_delete_staff on public.anime_translations
  for delete to authenticated using ((select public.current_role_level()) >= 50);

create policy anime_genres_select on public.anime_genres
  for select to anon, authenticated
  using (
    (select public.current_role_level()) >= 50
    or exists (select 1 from public.anime a where a.id = anime_id and a.is_published)
  );
create policy anime_genres_insert_staff on public.anime_genres
  for insert to authenticated with check ((select public.current_role_level()) >= 50);
create policy anime_genres_delete_staff on public.anime_genres
  for delete to authenticated using ((select public.current_role_level()) >= 50);

create policy seasons_select on public.seasons
  for select to anon, authenticated
  using (
    (select public.current_role_level()) >= 50
    or exists (select 1 from public.anime a where a.id = anime_id and a.is_published)
  );
create policy seasons_insert_staff on public.seasons
  for insert to authenticated with check ((select public.current_role_level()) >= 50);
create policy seasons_update_staff on public.seasons
  for update to authenticated
  using ((select public.current_role_level()) >= 50)
  with check ((select public.current_role_level()) >= 50);
create policy seasons_delete_staff on public.seasons
  for delete to authenticated using ((select public.current_role_level()) >= 50);

-- ---------- episodes -----------------------------------------------------
create policy episodes_select on public.episodes
  for select to anon, authenticated
  using (
    (select public.current_role_level()) >= 50
    or (is_published and exists (select 1 from public.anime a where a.id = anime_id and a.is_published))
  );
create policy episodes_insert_staff on public.episodes
  for insert to authenticated with check ((select public.current_role_level()) >= 50);
create policy episodes_update_staff on public.episodes
  for update to authenticated
  using ((select public.current_role_level()) >= 50)
  with check ((select public.current_role_level()) >= 50);
create policy episodes_delete_staff on public.episodes
  for delete to authenticated using ((select public.current_role_level()) >= 50);

-- Видеоисточники и субтитры: метаданные эпизода видны всем, а ссылки на поток —
-- только тем, кто имеет право смотреть (Premium проверяется в БД).
create policy episode_sources_select_watchable on public.episode_sources
  for select to anon, authenticated
  using (public.can_watch_episode(episode_id));
create policy episode_sources_insert_staff on public.episode_sources
  for insert to authenticated with check ((select public.current_role_level()) >= 50);
create policy episode_sources_update_staff on public.episode_sources
  for update to authenticated
  using ((select public.current_role_level()) >= 50)
  with check ((select public.current_role_level()) >= 50);
create policy episode_sources_delete_staff on public.episode_sources
  for delete to authenticated using ((select public.current_role_level()) >= 50);

create policy episode_subtitles_select_watchable on public.episode_subtitles
  for select to anon, authenticated
  using (public.can_watch_episode(episode_id));
create policy episode_subtitles_insert_staff on public.episode_subtitles
  for insert to authenticated with check ((select public.current_role_level()) >= 50);
create policy episode_subtitles_update_staff on public.episode_subtitles
  for update to authenticated
  using ((select public.current_role_level()) >= 50)
  with check ((select public.current_role_level()) >= 50);
create policy episode_subtitles_delete_staff on public.episode_subtitles
  for delete to authenticated using ((select public.current_role_level()) >= 50);

-- ---------- favorites / watchlist / watch_history ------------------------
create policy favorites_select_own on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy favorites_delete_own on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

create policy watchlist_select_own on public.watchlist
  for select to authenticated using (user_id = (select auth.uid()));
create policy watchlist_insert_own on public.watchlist
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy watchlist_delete_own on public.watchlist
  for delete to authenticated using (user_id = (select auth.uid()));

create policy watch_history_select_own on public.watch_history
  for select to authenticated using (user_id = (select auth.uid()));
create policy watch_history_insert_own on public.watch_history
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_active_user())
    and public.can_watch_episode(episode_id)
  );
create policy watch_history_update_own on public.watch_history
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_watch_episode(episode_id));
create policy watch_history_delete_own on public.watch_history
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- view_events (только чтение для персонала) --------------------
create policy view_events_select_staff on public.view_events
  for select to authenticated using ((select public.current_role_level()) >= 50);

-- ---------- plans / subscriptions / payments -----------------------------
create policy plans_select on public.plans
  for select to anon, authenticated
  using (is_active or (select public.current_role_level()) >= 80);
create policy plans_update_admin on public.plans
  for update to authenticated
  using ((select public.current_role_level()) >= 80)
  with check ((select public.current_role_level()) >= 80);

-- Подписки и платежи изменяются только сервером (service_role) после подтверждённой оплаты.
create policy subscriptions_select_own_or_admin on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_role_level()) >= 80);

create policy payments_select_own_or_admin on public.payments
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_role_level()) >= 80);

-- payment_events, rate_limits: политик нет — доступ только у service_role.

-- ---------- notifications ------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- Пользователь может менять только отметку о прочтении.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------- announcements / banners --------------------------------------
create policy announcements_select on public.announcements
  for select to anon, authenticated
  using (
    (is_published and (published_at is null or published_at <= now()))
    or (select public.current_role_level()) >= 50
  );
create policy announcements_insert_staff on public.announcements
  for insert to authenticated with check ((select public.current_role_level()) >= 50);
create policy announcements_update_staff on public.announcements
  for update to authenticated
  using ((select public.current_role_level()) >= 50)
  with check ((select public.current_role_level()) >= 50);
create policy announcements_delete_staff on public.announcements
  for delete to authenticated using ((select public.current_role_level()) >= 50);

create policy banners_select on public.banners
  for select to anon, authenticated
  using (
    (is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now()))
    or (select public.current_role_level()) >= 50
  );
create policy banners_insert_staff on public.banners
  for insert to authenticated with check ((select public.current_role_level()) >= 50);
create policy banners_update_staff on public.banners
  for update to authenticated
  using ((select public.current_role_level()) >= 50)
  with check ((select public.current_role_level()) >= 50);
create policy banners_delete_staff on public.banners
  for delete to authenticated using ((select public.current_role_level()) >= 50);

-- ---------- admin_logs ---------------------------------------------------
create policy admin_logs_select_admin on public.admin_logs
  for select to authenticated using ((select public.current_role_level()) >= 80);

-- ---------- site_settings ------------------------------------------------
create policy site_settings_select on public.site_settings
  for select to anon, authenticated
  using (is_public or (select public.current_role_level()) >= 80);
create policy site_settings_insert_admin on public.site_settings
  for insert to authenticated with check ((select public.current_role_level()) >= 80);
create policy site_settings_update_admin on public.site_settings
  for update to authenticated
  using ((select public.current_role_level()) >= 80)
  with check ((select public.current_role_level()) >= 80);
create policy site_settings_delete_admin on public.site_settings
  for delete to authenticated using ((select public.current_role_level()) >= 80);
