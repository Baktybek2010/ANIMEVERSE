-- =====================================================================
-- ANIMEVERSE · 0001 · Базовая схема: типы, таблицы, индексы, ограничения
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------- Перечисления ------------------------------------------------
create type public.anime_status as enum ('announced', 'ongoing', 'finished', 'hiatus', 'cancelled');
create type public.anime_format as enum ('tv', 'tv_short', 'movie', 'ova', 'ona', 'special', 'music');
create type public.anime_season_name as enum ('winter', 'spring', 'summer', 'fall');
create type public.video_kind as enum ('hls', 'mp4', 'webm');
create type public.subscription_status as enum ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'expired');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.billing_interval as enum ('month', 'year');

-- ---------- Роли ---------------------------------------------------------
create table public.roles (
  name        text primary key check (name in ('user', 'moderator', 'admin', 'super_admin')),
  level       smallint not null unique check (level between 0 and 100),
  description text not null default ''
);

insert into public.roles (name, level, description) values
  ('user',        0,   'Обычный пользователь'),
  ('moderator',   50,  'Управление контентом: аниме, эпизоды, жанры, новости, баннеры'),
  ('admin',       80,  'Контент, пользователи, подписки, настройки, журнал действий'),
  ('super_admin', 100, 'Полный доступ, включая назначение администраторов');

-- ---------- Профили ------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  username      text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name  text check (display_name is null or char_length(display_name) between 1 and 50),
  avatar_url    text check (avatar_url is null or avatar_url ~ '^https?://'),
  bio           text check (bio is null or char_length(bio) <= 500),
  locale        text not null default 'ru' check (locale in ('ru', 'en', 'ja')),
  role          text not null default 'user' references public.roles (name) on update cascade,
  is_banned     boolean not null default false,
  banned_reason text check (banned_reason is null or char_length(banned_reason) <= 500),
  banned_at     timestamptz,
  preferences   jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index profiles_username_lower_key on public.profiles (lower(username));
create index profiles_role_idx on public.profiles (role) where role <> 'user';
create index profiles_created_at_idx on public.profiles (created_at desc);
create index profiles_email_trgm_idx on public.profiles using gin (lower(email) extensions.gin_trgm_ops);

-- ---------- Жанры --------------------------------------------------------
create table public.genres (
  id         smallint generated always as identity primary key,
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en    text not null check (char_length(name_en) between 1 and 60),
  name_ru    text not null check (char_length(name_ru) between 1 and 60),
  name_ja    text not null check (char_length(name_ja) between 1 and 60),
  created_at timestamptz not null default now()
);

create unique index genres_name_en_lower_key on public.genres (lower(name_en));

-- ---------- Аниме --------------------------------------------------------
create table public.anime (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  anilist_id          integer unique check (anilist_id > 0),
  mal_id              integer check (mal_id > 0),
  title_romaji        text not null check (char_length(title_romaji) between 1 and 300),
  title_english       text check (title_english is null or char_length(title_english) <= 300),
  title_native        text check (title_native is null or char_length(title_native) <= 300),
  synonyms            text[] not null default '{}',
  description         text,
  format              public.anime_format not null default 'tv',
  status              public.anime_status not null default 'announced',
  season              public.anime_season_name,
  season_year         smallint check (season_year is null or season_year between 1900 and 2100),
  start_date          date,
  end_date            date,
  episodes_total      integer check (episodes_total is null or episodes_total >= 0),
  episode_duration    integer check (episode_duration is null or episode_duration >= 0),
  score               numeric(4, 2) check (score is null or (score >= 0 and score <= 10)),
  popularity          integer not null default 0 check (popularity >= 0),
  trending            integer not null default 0 check (trending >= 0),
  views_count         bigint not null default 0 check (views_count >= 0),
  poster_url          text check (poster_url is null or poster_url ~ '^https?://'),
  poster_color        text check (poster_color is null or poster_color ~ '^#[0-9a-fA-F]{6}$'),
  banner_url          text check (banner_url is null or banner_url ~ '^https?://'),
  trailer_youtube_id  text check (trailer_youtube_id is null or trailer_youtube_id ~ '^[A-Za-z0-9_-]{6,20}$'),
  studio              text,
  source              text,
  country             text check (country is null or char_length(country) = 2),
  is_adult            boolean not null default false,
  is_published        boolean not null default false,
  is_featured         boolean not null default false,
  genre_slugs         text[] not null default '{}',
  search_text         text not null default '',
  -- Поля, изменённые администратором вручную: синхронизация с AniList их не трогает.
  locked_fields       text[] not null default '{}',
  anilist_synced_at   timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index anime_published_popularity_idx on public.anime (popularity desc) where is_published;
create index anime_published_score_idx on public.anime (score desc nulls last) where is_published;
create index anime_published_trending_idx on public.anime (trending desc) where is_published;
create index anime_published_start_date_idx on public.anime (start_date desc nulls last) where is_published;
create index anime_published_created_idx on public.anime (created_at desc) where is_published;
create index anime_season_idx on public.anime (season_year, season);
create index anime_status_idx on public.anime (status);
create index anime_format_idx on public.anime (format);
create index anime_genre_slugs_idx on public.anime using gin (genre_slugs);
create index anime_search_trgm_idx on public.anime using gin (search_text extensions.gin_trgm_ops);
create index anime_anilist_sync_idx on public.anime (anilist_synced_at nulls first) where anilist_id is not null;

-- ---------- Переводы -----------------------------------------------------
create table public.anime_translations (
  anime_id    uuid not null references public.anime (id) on delete cascade,
  locale      text not null check (locale in ('ru', 'en', 'ja')),
  title       text check (title is null or char_length(title) between 1 and 300),
  description text,
  -- true — перевод введён вручную и не перезаписывается импортом.
  is_manual   boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (anime_id, locale)
);

create table public.anime_genres (
  anime_id uuid not null references public.anime (id) on delete cascade,
  genre_id smallint not null references public.genres (id) on delete cascade,
  primary key (anime_id, genre_id)
);

create index anime_genres_genre_idx on public.anime_genres (genre_id);

-- ---------- Сезоны и эпизоды --------------------------------------------
create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  anime_id   uuid not null references public.anime (id) on delete cascade,
  number     integer not null check (number between 0 and 100),
  title_ru   text check (title_ru is null or char_length(title_ru) <= 200),
  title_en   text check (title_en is null or char_length(title_en) <= 200),
  title_ja   text check (title_ja is null or char_length(title_ja) <= 200),
  created_at timestamptz not null default now(),
  unique (anime_id, number)
);

create table public.episodes (
  id               uuid primary key default gen_random_uuid(),
  anime_id         uuid not null references public.anime (id) on delete cascade,
  season_id        uuid not null references public.seasons (id) on delete cascade,
  number           integer not null check (number between 0 and 5000),
  title_ru         text check (title_ru is null or char_length(title_ru) <= 300),
  title_en         text check (title_en is null or char_length(title_en) <= 300),
  title_ja         text check (title_ja is null or char_length(title_ja) <= 300),
  description      text check (description is null or char_length(description) <= 5000),
  thumbnail_url    text check (thumbnail_url is null or thumbnail_url ~ '^https?://'),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 86400),
  air_date         date,
  is_premium       boolean not null default false,
  is_published     boolean not null default false,
  views_count      bigint not null default 0 check (views_count >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (season_id, number)
);

create index episodes_anime_idx on public.episodes (anime_id);
create index episodes_published_created_idx on public.episodes (created_at desc) where is_published;

-- Видеоисточники: только материалы, на которые у платформы есть права.
create table public.episode_sources (
  id          uuid primary key default gen_random_uuid(),
  episode_id  uuid not null references public.episodes (id) on delete cascade,
  kind        public.video_kind not null,
  url         text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  quality     text not null default 'auto' check (quality ~ '^(auto|[0-9]{3,4}p)$'),
  audio_lang  text not null default 'ja' check (audio_lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$'),
  audio_label text check (audio_label is null or char_length(audio_label) <= 80),
  is_default  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (episode_id, audio_lang, quality, kind)
);

create index episode_sources_episode_idx on public.episode_sources (episode_id);

create table public.episode_subtitles (
  id         uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes (id) on delete cascade,
  lang       text not null check (lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$'),
  label      text not null check (char_length(label) between 1 and 80),
  url        text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (episode_id, lang, label)
);

create index episode_subtitles_episode_idx on public.episode_subtitles (episode_id);

-- ---------- Пользовательские списки -------------------------------------
create table public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  anime_id   uuid not null references public.anime (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, anime_id)
);

create index favorites_user_created_idx on public.favorites (user_id, created_at desc);
create index favorites_anime_idx on public.favorites (anime_id);

create table public.watchlist (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  anime_id   uuid not null references public.anime (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, anime_id)
);

create index watchlist_user_created_idx on public.watchlist (user_id, created_at desc);
create index watchlist_anime_idx on public.watchlist (anime_id);

create table public.watch_history (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  episode_id       uuid not null references public.episodes (id) on delete cascade,
  anime_id         uuid not null references public.anime (id) on delete cascade,
  position_seconds integer not null default 0 check (position_seconds >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  completed        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, episode_id)
);

create index watch_history_user_updated_idx on public.watch_history (user_id, updated_at desc);
create index watch_history_anime_idx on public.watch_history (anime_id);
create index watch_history_episode_idx on public.watch_history (episode_id);

-- События просмотра (для статистики админ-панели).
create table public.view_events (
  id         bigint generated always as identity primary key,
  anime_id   uuid not null references public.anime (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index view_events_created_idx on public.view_events (created_at desc);
create index view_events_user_episode_idx on public.view_events (user_id, episode_id, created_at desc);
create index view_events_anime_idx on public.view_events (anime_id);
create index view_events_episode_idx on public.view_events (episode_id);

-- ---------- Подписки и платежи ------------------------------------------
create table public.plans (
  id             text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name_ru        text not null,
  name_en        text not null,
  name_ja        text not null,
  price_cents    integer not null check (price_cents >= 0),
  currency       text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  billing_period public.billing_interval not null,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  plan_id                  text not null references public.plans (id),
  status                   public.subscription_status not null default 'incomplete',
  provider                 text not null check (provider in ('stripe', 'manual')),
  provider_customer_id     text,
  provider_subscription_id text,
  current_period_start     timestamptz not null default now(),
  current_period_end       timestamptz not null,
  cancel_at_period_end     boolean not null default false,
  canceled_at              timestamptz,
  granted_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (current_period_end >= current_period_start),
  unique (provider, provider_subscription_id)
);

-- У пользователя может быть только одна действующая подписка.
create unique index subscriptions_one_live_per_user_idx on public.subscriptions (user_id)
  where status in ('trialing', 'active', 'past_due');
create index subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
create index subscriptions_status_end_idx on public.subscriptions (status, current_period_end);
create index subscriptions_customer_idx on public.subscriptions (provider, provider_customer_id);
create index subscriptions_plan_idx on public.subscriptions (plan_id);
create index subscriptions_granted_by_idx on public.subscriptions (granted_by) where granted_by is not null;

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  subscription_id     uuid references public.subscriptions (id) on delete set null,
  provider            text not null check (provider in ('stripe')),
  provider_payment_id text not null,
  amount_cents        integer not null check (amount_cents >= 0),
  currency            text not null check (currency ~ '^[a-z]{3}$'),
  status              public.payment_status not null,
  description         text,
  receipt_url         text check (receipt_url is null or receipt_url ~ '^https://'),
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_subscription_idx on public.payments (subscription_id);
create index payments_created_idx on public.payments (created_at desc);

-- Идемпотентность платёжных webhook-событий.
create table public.payment_events (
  id           text primary key,
  provider     text not null,
  type         text not null,
  payload      jsonb not null,
  processed_at timestamptz not null default now()
);

-- ---------- Уведомления, новости, баннеры -------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type ~ '^[a-z_]{2,40}$'),
  title      text check (title is null or char_length(title) <= 200),
  body       text check (body is null or char_length(body) <= 2000),
  link       text check (link is null or (link ~ '^/' and char_length(link) <= 500)),
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

create table public.announcements (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title_ru     text not null check (char_length(title_ru) between 1 and 200),
  title_en     text check (title_en is null or char_length(title_en) <= 200),
  title_ja     text check (title_ja is null or char_length(title_ja) <= 200),
  body_ru      text not null check (char_length(body_ru) between 1 and 20000),
  body_en      text check (body_en is null or char_length(body_en) <= 20000),
  body_ja      text check (body_ja is null or char_length(body_ja) <= 20000),
  cover_url    text check (cover_url is null or cover_url ~ '^https?://'),
  is_published boolean not null default false,
  published_at timestamptz,
  author_id    uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index announcements_published_idx on public.announcements (published_at desc) where is_published;
create index announcements_author_idx on public.announcements (author_id) where author_id is not null;

create table public.banners (
  id          uuid primary key default gen_random_uuid(),
  anime_id    uuid references public.anime (id) on delete cascade,
  title_ru    text check (title_ru is null or char_length(title_ru) <= 200),
  title_en    text check (title_en is null or char_length(title_en) <= 200),
  title_ja    text check (title_ja is null or char_length(title_ja) <= 200),
  subtitle_ru text check (subtitle_ru is null or char_length(subtitle_ru) <= 500),
  subtitle_en text check (subtitle_en is null or char_length(subtitle_en) <= 500),
  subtitle_ja text check (subtitle_ja is null or char_length(subtitle_ja) <= 500),
  image_url   text check (image_url is null or image_url ~ '^https?://'),
  link_url    text check (link_url is null or link_url ~ '^(/|https://)'),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (anime_id is not null or (image_url is not null and title_ru is not null)),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index banners_active_order_idx on public.banners (sort_order) where is_active;
create index banners_anime_idx on public.banners (anime_id) where anime_id is not null;

-- ---------- Служебные таблицы -------------------------------------------
create table public.admin_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (action ~ '^[a-z_.]{2,60}$'),
  entity_type text check (entity_type is null or char_length(entity_type) <= 60),
  entity_id   text check (entity_id is null or char_length(entity_id) <= 120),
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index admin_logs_created_idx on public.admin_logs (created_at desc);
create index admin_logs_actor_idx on public.admin_logs (actor_id, created_at desc);

create table public.site_settings (
  key        text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value      jsonb not null,
  is_public  boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);

create index rate_limits_window_idx on public.rate_limits (window_start);
