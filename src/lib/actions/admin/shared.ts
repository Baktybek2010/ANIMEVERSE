import "server-only";

import { updateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/data/tags";
import type { DbClient } from "@/lib/supabase/types";

/** Запись в журнал действий администраторов (роль проверяет SQL-функция). */
export async function logAdmin(
  db: DbClient,
  action: string,
  entityType: string,
  entityId: string | number | null,
  details: Record<string, string | number | boolean | null | string[]> = {},
) {
  await db.rpc("log_admin_action", {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId === null ? undefined : String(entityId),
    p_details: details,
  });
}

/** Сброс кеша каталога после изменения аниме или эпизодов. */
export function invalidateAnime(slug?: string | null) {
  updateTag(CACHE_TAGS.anime);
  updateTag(CACHE_TAGS.episodes);
  if (slug) updateTag(CACHE_TAGS.animeBySlug(slug));
}
