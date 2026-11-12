-- =====================================================================
-- ANIMEVERSE · 0005 · Справочные данные: жанры, тарифы, настройки, расписание
-- =====================================================================

insert into public.genres (slug, name_en, name_ru, name_ja) values
  ('action',        'Action',        'Экшен',            'アクション'),
  ('adventure',     'Adventure',     'Приключения',      'アドベンチャー'),
  ('comedy',        'Comedy',        'Комедия',          'コメディ'),
  ('drama',         'Drama',         'Драма',            'ドラマ'),
  ('ecchi',         'Ecchi',         'Этти',             'エッチ'),
  ('fantasy',       'Fantasy',       'Фэнтези',          'ファンタジー'),
  ('horror',        'Horror',        'Ужасы',            'ホラー'),
  ('mahou-shoujo',  'Mahou Shoujo',  'Махо-сёдзё',       '魔法少女'),
  ('mecha',         'Mecha',         'Меха',             'メカ'),
  ('music',         'Music',         'Музыка',           '音楽'),
  ('mystery',       'Mystery',       'Детектив',         'ミステリー'),
  ('psychological', 'Psychological', 'Психологическое',  'サイコロジカル'),
  ('romance',       'Romance',       'Романтика',        'ロマンス'),
  ('sci-fi',        'Sci-Fi',        'Фантастика',       'SF'),
  ('slice-of-life', 'Slice of Life', 'Повседневность',   '日常'),
  ('sports',        'Sports',        'Спорт',            'スポーツ'),
  ('supernatural',  'Supernatural',  'Сверхъестественное', '超常現象'),
  ('thriller',      'Thriller',      'Триллер',          'スリラー')
on conflict (slug) do nothing;

-- Тарифы. Цена здесь — для отображения; списание выполняет платёжный провайдер
-- по идентификаторам цен из переменных окружения (STRIPE_PRICE_*).
insert into public.plans (id, name_ru, name_en, name_ja, price_cents, currency, billing_period, sort_order) values
  ('premium_monthly', 'Premium · месяц', 'Premium · Monthly', 'プレミアム・月額', 499,  'usd', 'month', 1),
  ('premium_yearly',  'Premium · год',   'Premium · Yearly',  'プレミアム・年額', 4990, 'usd', 'year',  2)
on conflict (id) do nothing;

insert into public.site_settings (key, value, is_public) values
  ('site_name',            '"ANIMEVERSE"'::jsonb, true),
  ('site_tagline',         '{"ru": "Вселенная аниме в одном месте", "en": "The anime universe in one place", "ja": "アニメの世界をひとつに"}'::jsonb, true),
  ('contact_email',        '""'::jsonb, true),
  ('registration_enabled', 'true'::jsonb, true),
  ('maintenance_mode',     'false'::jsonb, true),
  ('show_adult_content',   'false'::jsonb, true),
  ('anilist_auto_sync',    'true'::jsonb, false),
  ('anilist_sync_batch',   '20'::jsonb, false)
on conflict (key) do nothing;

-- Автоматическое истечение подписок через pg_cron, если расширение доступно.
-- Если нет — ту же функцию вызывает /api/cron/subscriptions.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('animeverse-expire-subscriptions', '*/15 * * * *', 'select public.expire_subscriptions()');
exception when others then
  raise notice 'pg_cron недоступен (%), используйте /api/cron/subscriptions', sqlerrm;
end;
$$;
