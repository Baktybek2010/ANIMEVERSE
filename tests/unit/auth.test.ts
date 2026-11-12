import { describe, expect, it } from "vitest";
import { mapDbError } from "@/lib/actions/result";
import { assignableRoles, can, canModerateUser, PERMISSIONS, ROLE_LEVEL, ROLES } from "@/lib/auth/roles";
import { isSubscriptionActive, RENEWAL_GRACE_MS } from "@/lib/auth/subscription";
import { memoryRateLimit } from "@/lib/rate-limit";

describe("роли и права", () => {
  it("уровни ролей строго возрастают", () => {
    const levels = ROLES.map((role) => ROLE_LEVEL[role]);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(levels).size).toBe(levels.length);
  });

  it("обычный пользователь не имеет административных прав", () => {
    for (const permission of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      expect(can("user", permission)).toBe(false);
      expect(can(null, permission)).toBe(false);
    }
  });

  it("модератор управляет контентом, но не пользователями и настройками", () => {
    expect(can("moderator", "content.manage")).toBe(true);
    expect(can("moderator", "import.run")).toBe(true);
    expect(can("moderator", "users.view")).toBe(true);
    expect(can("moderator", "users.manage")).toBe(false);
    expect(can("moderator", "content.delete")).toBe(false);
    expect(can("moderator", "settings.manage")).toBe(false);
    expect(can("moderator", "logs.view")).toBe(false);
    expect(can("moderator", "subscriptions.manage")).toBe(false);
  });

  it("администратор имеет все права панели", () => {
    for (const permission of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      expect(can("admin", permission)).toBe(true);
    }
  });

  it("назначаемые роли подчиняются иерархии", () => {
    expect(assignableRoles("user", "user")).toEqual([]);
    expect(assignableRoles("moderator", "user")).toEqual([]);
    expect(assignableRoles("admin", "user")).toEqual(["user", "moderator"]);
    expect(assignableRoles("admin", "moderator")).toEqual(["user", "moderator"]);
    expect(assignableRoles("admin", "admin")).toEqual([]);
    expect(assignableRoles("admin", "super_admin")).toEqual([]);
    expect(assignableRoles("super_admin", "admin")).toEqual([...ROLES]);
  });

  it("блокировать можно только нижестоящих", () => {
    expect(canModerateUser("admin", "user")).toBe(true);
    expect(canModerateUser("admin", "admin")).toBe(false);
    expect(canModerateUser("admin", "super_admin")).toBe(false);
    expect(canModerateUser("moderator", "user")).toBe(false);
    expect(canModerateUser("super_admin", "admin")).toBe(true);
  });
});

describe("статус подписки", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const sub = (patch: Partial<Parameters<typeof isSubscriptionActive>[0] & object>) => ({
    status: "active" as const,
    provider: "stripe",
    current_period_end: "2026-07-01T00:00:00Z",
    cancel_at_period_end: false,
    ...patch,
  });

  it("активна до конца периода", () => {
    expect(isSubscriptionActive(sub({}), now)).toBe(true);
    expect(isSubscriptionActive(sub({ status: "trialing" }), now)).toBe(true);
  });

  it("нет подписки — нет Premium", () => {
    expect(isSubscriptionActive(null, now)).toBe(false);
    expect(isSubscriptionActive(undefined, now)).toBe(false);
  });

  it.each(["incomplete", "past_due", "canceled", "expired"] as const)("статус %s не даёт Premium", (status) => {
    expect(isSubscriptionActive(sub({ status }), now)).toBe(false);
  });

  it("автоматически истекает после окончания периода", () => {
    const ended = "2026-06-15T11:00:00Z";
    // Автопродлеваемая подписка: короткий запас на доставку webhook о продлении.
    expect(isSubscriptionActive(sub({ current_period_end: ended }), now)).toBe(true);
    expect(isSubscriptionActive(sub({ current_period_end: new Date(now.getTime() - RENEWAL_GRACE_MS - 1000).toISOString() }), now)).toBe(false);
    // Отменённая и выданная вручную — без запаса.
    expect(isSubscriptionActive(sub({ current_period_end: ended, cancel_at_period_end: true }), now)).toBe(false);
    expect(isSubscriptionActive(sub({ current_period_end: ended, provider: "manual" }), now)).toBe(false);
  });

  it("некорректная дата не даёт Premium", () => {
    expect(isSubscriptionActive(sub({ current_period_end: "not a date" }), now)).toBe(false);
  });
});

describe("ограничение частоты (в памяти)", () => {
  it("пропускает запросы в пределах лимита и блокирует сверх него", () => {
    const key = `test:${Math.random()}`;
    const results = Array.from({ length: 5 }, () => memoryRateLimit(key, 3, 60, 1_000_000));
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("сбрасывает счётчик в новом окне", () => {
    const key = `test:${Math.random()}`;
    expect(memoryRateLimit(key, 1, 60, 1_000_000)).toBe(true);
    expect(memoryRateLimit(key, 1, 60, 1_030_000)).toBe(false);
    expect(memoryRateLimit(key, 1, 60, 1_061_000)).toBe(true);
  });
});

describe("ошибки базы данных", () => {
  it("не раскрывает внутренние сообщения", () => {
    expect(mapDbError({ code: "42501", message: 'new row violates row-level security policy for table "anime"' })).toBe("forbidden");
    expect(mapDbError({ code: "23505", message: "duplicate key value" })).toBe("duplicate");
    expect(mapDbError({ code: "P0002", message: "user_not_found" })).toBe("notFound");
    expect(mapDbError({ code: "23514", message: "check constraint" })).toBe("invalidValue");
    expect(mapDbError({ message: "insufficient_privileges" })).toBe("forbidden");
    expect(mapDbError({ code: "XX000", message: "internal" })).toBe("generic");
    expect(mapDbError(null)).toBe("generic");
  });
});
