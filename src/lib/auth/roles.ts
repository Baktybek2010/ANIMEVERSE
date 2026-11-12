/**
 * Роли и права доступа. Числовые уровни совпадают с таблицей public.roles
 * и RLS-политиками — сервер и база проверяют одно и то же.
 */
export const ROLES = ["user", "moderator", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LEVEL: Record<Role, number> = {
  user: 0,
  moderator: 50,
  admin: 80,
  super_admin: 100,
};

export const PERMISSIONS = {
  "admin.access": 50,
  "content.manage": 50,
  "content.delete": 80,
  "import.run": 50,
  "users.view": 50,
  "users.manage": 80,
  "subscriptions.manage": 80,
  "settings.manage": 80,
  "logs.view": 80,
} as const satisfies Record<string, number>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function roleLevel(role: Role | null | undefined): number {
  return role ? ROLE_LEVEL[role] : 0;
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return roleLevel(role) >= PERMISSIONS[permission];
}

/**
 * Какие роли актёр может назначить целевому пользователю.
 * Повторяет правила SQL-функции admin_set_user_role.
 */
export function assignableRoles(actor: Role, target: Role): Role[] {
  const actorLevel = ROLE_LEVEL[actor];
  if (actorLevel < ROLE_LEVEL.admin) return [];
  if (actorLevel >= ROLE_LEVEL.super_admin) return [...ROLES];
  if (ROLE_LEVEL[target] >= actorLevel) return [];
  return ROLES.filter((role) => ROLE_LEVEL[role] < actorLevel);
}

/** Может ли актёр блокировать или изменять целевого пользователя. */
export function canModerateUser(actor: Role, target: Role): boolean {
  return ROLE_LEVEL[actor] >= ROLE_LEVEL.admin && ROLE_LEVEL[target] < ROLE_LEVEL[actor];
}
