import { expect, test } from "@playwright/test";
import { login, readState, waitForEmailLink } from "./fixtures";

test.describe.configure({ mode: "serial" });

test.describe("регистрация и вход", () => {
  const state = readState();
  const username = `e2e_new_${state.runId}`;
  const email = `${username}@test.animeverse.local`;
  const password = "Sup3r-secret-pass";
  const newPassword = "An0ther-secret-pass";

  test("форма регистрации проверяет данные", async ({ page }) => {
    await page.goto("/ru/register");
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page.getByText("Обязательное поле.").first()).toBeVisible();

    await page.getByLabel("Имя пользователя").fill("x");
    await page.getByLabel("Электронная почта").fill("not-an-email");
    await page.getByLabel("Пароль", { exact: true }).fill("short");
    await page.getByLabel("Повторите пароль").fill("different");
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page.getByText("Введите корректный e-mail.")).toBeVisible();
    await expect(page.getByText(/Пароль слишком простой/)).toBeVisible();
    await expect(page.getByText("Пароли не совпадают.")).toBeVisible();
    await expect(page).toHaveURL(/\/ru\/register/);
  });

  test("нельзя занять существующее имя пользователя", async ({ page }) => {
    await page.goto("/ru/register");
    await page.getByLabel("Имя пользователя").fill(state.users.user.username);
    await page.getByLabel("Электронная почта").fill(`other_${state.runId}@test.animeverse.local`);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByLabel("Повторите пароль").fill(password);
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page.getByText("Это имя пользователя уже занято.")).toBeVisible();
  });

  test("регистрация с подтверждением e-mail по ссылке из письма", async ({ page }) => {
    const startedAt = Date.now();
    await page.goto("/ru/register");
    await page.getByLabel("Имя пользователя").fill(username);
    await page.getByLabel("Электронная почта").fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByLabel("Повторите пароль").fill(password);
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();
    await expect(page.getByRole("heading", { name: "Подтвердите e-mail" })).toBeVisible();

    // До подтверждения войти нельзя.
    await page.goto("/ru/login");
    await page.getByLabel("Электронная почта").fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByText(/Подтвердите e-mail/)).toBeVisible();

    const link = await waitForEmailLink(email, startedAt);
    await page.goto(link);
    await expect(page).toHaveURL(/\/ru(\?.*)?$/);
    await expect(page.getByText("E-mail подтверждён. Добро пожаловать!")).toBeVisible();
    await expect(page.getByRole("button", { name: "Меню пользователя" })).toBeVisible();

    await page.goto("/ru/account");
    await expect(page.getByLabel("Имя пользователя")).toHaveValue(username);
    await expect(page.getByLabel("Роль")).toHaveValue("Пользователь");
  });

  test("выход и вход: неверный пароль отклоняется", async ({ page }) => {
    await login(page, email, password);
    await page.getByRole("button", { name: "Меню пользователя" }).click();
    await page.getByRole("menuitem", { name: "Выйти" }).click();
    await expect(page.getByText("Вы вышли из аккаунта")).toBeVisible();
    await expect(page.getByRole("link", { name: "Войти" }).first()).toBeVisible();

    await page.goto("/ru/login");
    await page.getByLabel("Электронная почта").fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill("wrong-password-1");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByText("Неверный e-mail или пароль.")).toBeVisible();
    await expect(page).toHaveURL(/\/ru\/login/);
  });

  test("после входа возвращает на запрошенную страницу, внешние адреса игнорируются", async ({ page }) => {
    await login(page, email, password, "/ru/account/settings");
    await expect(page).toHaveURL(/\/ru\/account\/settings$/);
    await page.context().clearCookies();
    await login(page, email, password, "https://evil.example/phish");
    await expect(page).toHaveURL(/localhost:\d+\/ru$/);
  });

  test("авторизованного пользователя уводит со страницы входа", async ({ page }) => {
    await login(page, email, password);
    await page.goto("/ru/login");
    await expect(page).toHaveURL(/\/ru\/account$/);
  });

  test("восстановление пароля по ссылке из письма", async ({ page }) => {
    const startedAt = Date.now();
    await page.goto("/ru/forgot-password");
    await page.getByLabel("Электронная почта").fill(email);
    await page.getByRole("button", { name: "Отправить ссылку" }).click();
    await expect(page.getByRole("heading", { name: "Проверьте почту" })).toBeVisible();

    const link = await waitForEmailLink(email, startedAt);
    await page.goto(link);
    await expect(page).toHaveURL(/\/ru\/reset-password/);
    await page.getByLabel("Новый пароль").fill(newPassword);
    await page.getByLabel("Повторите пароль").fill(newPassword);
    await page.getByRole("button", { name: "Обновить пароль" }).click();
    await expect(page).toHaveURL(/\/ru\/account/);
    await expect(page.getByText("Пароль обновлён")).toBeVisible();

    await page.context().clearCookies();
    await page.goto("/ru/login");
    await page.getByLabel("Электронная почта").fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByText("Неверный e-mail или пароль.")).toBeVisible();
    await login(page, email, newPassword);
  });

  test("страница сброса пароля без ссылки из письма недоступна", async ({ page }) => {
    await page.goto("/ru/reset-password");
    await expect(page.getByText(/Ссылка для сброса недействительна/)).toBeVisible();
    await expect(page.getByLabel("Новый пароль")).toHaveCount(0);
  });

  test("профиль: изменение данных и проверка имени", async ({ page }) => {
    await login(page, email, newPassword, "/ru/account");
    await page.getByLabel("Отображаемое имя").fill("Новое Имя");
    await page.getByLabel("О себе").fill("Люблю меха и повседневность.");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Изменения сохранены")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Отображаемое имя")).toHaveValue("Новое Имя");

    await page.getByLabel("Имя пользователя").fill(state.users.user.username);
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Это имя пользователя уже занято.").first()).toBeVisible();
  });

  test("настройки: язык интерфейса сохраняется в профиле", async ({ page }) => {
    await login(page, email, newPassword, "/ru/account/settings");
    await page.getByLabel("Язык интерфейса").selectOption("en");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page).toHaveURL(/\/en\/account\/settings/);
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    // Выбор качества по умолчанию — возможность Premium: для бесплатного аккаунта поле отключено.
    await expect(page.getByLabel("Default quality")).toBeDisabled();
  });
});
