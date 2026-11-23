// Subscriptions are recurring rows with is_subscription (DATA_MODEL.md). Pure helpers for the
// assistant: what is unused, and which one a name means. Nothing here touches data.

import { norm } from "./show";
import type { Recurring } from "./money";

/** A subscription not used for this many days counts as unused. */
export const UNUSED_DAYS = 45;
const r2 = (n: number) => Math.round(n * 100) / 100;

export type SubRow = Pick<Recurring, "id" | "name" | "amount" | "active" | "is_subscription" | "last_used_at">;

const DAY = 86_400_000;
/** Whole days since the last use, or null when it was never recorded. */
export function daysUnused(r: Pick<Recurring, "last_used_at">, todayIso: string): number | null {
  if (!r.last_used_at) return null;
  const last = Date.parse(r.last_used_at.slice(0, 10));
  const now = Date.parse(todayIso);
  return Number.isFinite(last) && Number.isFinite(now) ? Math.max(0, Math.round((now - last) / DAY)) : null;
}

export const isUnused = (r: SubRow, todayIso: string) => r.active && (daysUnused(r, todayIso) ?? 0) > UNUSED_DAYS;

/** Active money-out subscriptions: the only rows the assistant may propose to cancel. */
export const cancellable = (rows: SubRow[]) => rows.filter((r) => r.is_subscription && r.active && r.amount < 0);

export function subscriptionSummary(rows: SubRow[], todayIso: string) {
  const subs = rows.filter((r) => r.is_subscription);
  return {
    subscriptions: subs.map((r) => ({ name: r.name, monthly: r2(-r.amount), active: r.active, last_used: r.last_used_at?.slice(0, 10) ?? null, days_unused: daysUnused(r, todayIso) })),
    unused_per_month: r2(subs.filter((r) => r.amount < 0 && isUnused(r, todayIso)).reduce((s, r) => s - r.amount, 0)),
    unused_after_days: UNUSED_DAYS,
  };
}

/** The one item a name means: exact beats starts-with beats contains. Several equal matches, or none, give null. */
export function uniqueMatch<T>(items: T[], name: string, label: (t: T) => string): T | null {
  const q = norm(name);
  if (!q) return null;
  for (const test of [(l: string) => l === q, (l: string) => l.startsWith(q), (l: string) => l.includes(q)]) {
    const hits = items.filter((i) => test(norm(label(i))));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return null;
  }
  return null;
}
