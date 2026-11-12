import { expect, test } from "@playwright/test";
import { readState } from "./fixtures";

test.describe("публичная часть", () => {
  test("корень перенаправляет на язык пользователя, главная показывает подборки", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/ru$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru-RU");
    await expect(page.getByRole("heading", { name: "Популярное" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Жанры" })).toBeVisible();
    await expect(page.locator('a[href^="/ru/anime/"]').first()).toBeVisible();
  });

  test("выбранный язык сохраняется между посещениями", async ({ page, isMobile }) => {
    await page.goto("/ru/catalog");
    await page.getByRole("button", { name: /Язык/ }).click();
    await page.getByRole("menuitemradio", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/catalog/);
    await expect(page.getByRole("heading", { level: 1, name: "Anime catalog" })).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    if (!isMobile) await expect(page.getByRole("link", { name: "Catalog", exact: true }).first()).toBeVisible();
    await page.goto("/ja/catalog");
    await expect(page.getByRole("heading", { level: 1, name: "アニメカタログ" })).toBeVisible();
  });

  test("каталог: поиск, фильтры и сортировка меняют выдачу и адрес", async ({ page, isMobile }) => {
    const { anime } = readState();
    await page.goto("/ru/catalog");
    await expect(page.getByRole("status").filter({ hasText: /тайтл/ })).toBeVisible();

    await page.getByRole("searchbox", { name: "Поиск аниме" }).last().fill(anime.title);
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole("link", { name: anime.title })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "1 тайтл" })).toBeVisible();

    if (isMobile) await page.getByRole("button", { name: "Фильтры" }).click();
    await page.getByRole("button", { name: "Меха", exact: true }).click();
    await expect(page).toHaveURL(/genre=mecha/);
    await expect(page.getByRole("link", { name: anime.title })).toBeVisible();

    await page.getByRole("button", { name: "Романтика", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ничего не нашлось" })).toBeVisible();

    await page.getByRole("button", { name: "Сбросить фильтры" }).first().click();
    await expect(page).toHaveURL(/\/ru\/catalog$/);

    await page.getByLabel("Сортировка").selectOption("score");
    await expect(page).toHaveURL(/sort=score/);
    await expect(page.getByRole("link", { name: anime.title })).toBeVisible();

    await page.getByLabel("Статус").selectOption("finished");
    await expect(page).toHaveURL(/status=finished/);
    await expect(page.getByRole("link", { name: anime.title })).toHaveCount(0);
  });

  test("каталог: постраничная навигация", async ({ page }) => {
    await page.goto("/ru/catalog");
    const first = await page.locator("main ul li a h3").first().textContent();
    await page.getByRole("link", { name: "2", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("main ul li a h3").first()).not.toHaveText(first ?? "");
  });

  test("подсказки поиска в шапке ведут на страницу аниме", async ({ page }) => {
    const { anime } = readState();
    await page.goto("/ru");
    await page.getByRole("button", { name: "Поиск аниме" }).click();
    await page.getByRole("searchbox", { name: "Поиск аниме" }).fill(anime.title.slice(0, 12));
    await page.getByRole("link", { name: new RegExp(anime.title) }).first().click();
    await expect(page).toHaveURL(new RegExp(`/ru/anime/${anime.slug}$`));
  });

  test("страница аниме: названия, описание, серии и метаданные SEO", async ({ page }) => {
    const { anime } = readState();
    await page.goto(`/ru/anime/${anime.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: anime.title })).toBeVisible();
    await expect(page.getByText("Тестовое описание на русском.")).toBeVisible();
    await expect(page.getByText("Русское название")).toBeVisible();
    await expect(page.getByRole("link", { name: /Серия 1/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Меха" })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(anime.title));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/ru/anime/${anime.slug}$`));
    await expect(page.locator('link[rel="alternate"][hreflang="ja-JP"]')).toHaveAttribute("href", new RegExp(`/ja/anime/${anime.slug}$`));
    await expect(page.locator('script[type="application/ld+json"]').first()).toContainText("TVSeries");
  });

  test("неизвестный адрес показывает страницу 404", async ({ page }) => {
    await page.goto("/ru/anime/net-takogo-anime-zdes");
    await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
    await page.goto("/ru/kakaya-to/stranica");
    await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
    await expect(page.getByRole("link", { name: "На главную" })).toBeVisible();
  });

  test("закрытые разделы требуют входа", async ({ page }) => {
    await page.goto("/ru/account/favorites");
    await expect(page).toHaveURL(/\/ru\/login\?next=/);
    await page.goto("/ru/admin");
    await expect(page).toHaveURL(/\/ru\/login\?next=/);
  });

  test("Premium: страница тарифов не активирует подписку без оплаты", async ({ page }) => {
    await page.goto("/ru/premium");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Premium");
    await expect(page.getByText("в месяц")).toBeVisible();
    await expect(page.getByText("Эксклюзивные Premium-серии")).toBeVisible();
    // Платёжные ключи в тестовом окружении не заданы: вместо кнопки оплаты — честное сообщение.
    await expect(page.getByText("Приём платежей ещё не подключён").first()).toBeVisible();
  });

  test("служебные файлы SEO и PWA доступны", async ({ request }) => {
    const { anime } = readState();
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Sitemap:");
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("/ru/catalog");
    const manifest = await request.get("/manifest.webmanifest");
    expect((await manifest.json()).name).toBe("ANIMEVERSE");
    expect((await request.get("/sw.js")).ok()).toBe(true);
    expect((await request.get("/api/health")).ok()).toBe(true);
    const search = await request.get(`/api/search?q=${encodeURIComponent(anime.title)}&lang=ru`);
    expect((await search.json()).items[0].slug).toBe(anime.slug);
  });

  test("защита API: cron и webhook закрыты, заголовки безопасности выставлены", async ({ request }) => {
    expect((await request.get("/api/cron/subscriptions")).status()).toBe(401);
    expect((await request.get("/api/cron/anilist-sync", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
    expect([400, 503]).toContain((await request.post("/api/payments/webhook", { data: "{}", headers: { "stripe-signature": "t=1,v1=00" } })).status());
    expect((await request.post("/api/progress", { data: { episodeId: "x", position: 1, duration: 2 } })).status()).toBe(400);
    expect((await request.post("/api/progress", { data: { episodeId: "8c6f1f0e-6a55-4d5b-9d3a-0d1d6f8f0c11", position: 1, duration: 2 }, headers: { Origin: "https://evil.example" } })).status()).toBe(403);
    const home = await request.get("/ru");
    expect(home.headers()["x-content-type-options"]).toBe("nosniff");
    expect(home.headers()["x-frame-options"]).toBe("DENY");
    expect(home.headers()["x-powered-by"]).toBeUndefined();
  });

  test("мобильная версия: нижняя навигация и отсутствие горизонтальной прокрутки", async ({ page, isMobile }) => {
    test.skip(!isMobile, "только для мобильного профиля");
    await page.goto("/ru");
    const nav = page.getByRole("navigation", { name: "Меню" }).last();
    await expect(nav.getByRole("link", { name: "Каталог" })).toBeVisible();
    await nav.getByRole("link", { name: "Каталог" }).click();
    await expect(page).toHaveURL(/\/ru\/catalog/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
