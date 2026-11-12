/** Tables the household sees change live (Together plan). Row Level Security still decides who receives what. */
export const LIVE_TABLES = ["categories", "transactions", "incomes", "recurring", "goals", "week_priorities", "yearly_goals"] as const;
export type LiveTable = (typeof LIVE_TABLES)[number];

export type LiveChange = {
  table: string;
  type: "INSERT" | "UPDATE" | "DELETE";
  row: Record<string, unknown> | null;
};

/** What to call a row when saying "Mira just added …". */
export function labelOf(table: string, row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const v = table === "transactions" ? row.payee : table === "week_priorities" ? row.title : row.name;
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : null;
}

/**
 * Do the changes need a reload? Our own inserts are already on screen: the save that made
 * them reloaded. Everything else (a partner's edit, any update or delete) is not.
 */
export function needsReload(changes: LiveChange[], me: string) {
  return changes.some((c) => c.type !== "INSERT" || c.row?.owner_id !== me);
}

/** One sentence's worth of news from a burst of changes: who, and what (or how many). */
export function newsOf(changes: LiveChange[], me: string): { owner: string; what: string | null; n: number } | null {
  const added = changes.filter((c) => c.type === "INSERT" && typeof c.row?.owner_id === "string" && c.row.owner_id !== me);
  if (!added.length) return null;
  const owner = added[0].row!.owner_id as string;
  const mine = added.filter((c) => c.row!.owner_id === owner);
  return { owner, n: mine.length, what: mine.length === 1 ? labelOf(mine[0].table, mine[0].row) : null };
}
