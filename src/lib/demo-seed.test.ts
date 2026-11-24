import { describe, expect, it } from "vitest";
import { build } from "../../scripts/demo-seed.mjs";
import { monthsTo } from "./plan";
import { isUnused, type SubRow } from "./subscriptions";

type Seed = { recurring: (Omit<SubRow, "id" | "active"> & { is_subscription: boolean; last_used_at: string | null })[]; goals: { name: string; target: number; current: number; monthly: number }[] };
const today = new Date(Date.UTC(2026, 10, 24));
const d = build(today, {}) as unknown as Seed & Record<string, unknown>;
const todayIso = "2026-11-24";

describe("demo seed", () => {
  it("keeps subscriptions as recurring rows, with no separate table", () => {
    expect("subscriptions" in d).toBe(false);
    expect(d.recurring.filter((r) => r.is_subscription).length).toBeGreaterThanOrEqual(5);
  });

  it("has at least two unused subscriptions, and cancelling them moves the emergency fund 12 to 11 months", () => {
    const rows = d.recurring.filter((r) => r.is_subscription).map((r, i) => ({ ...r, id: String(i), active: true }));
    const unused = rows.filter((r) => isUnused(r, todayIso));
    expect(unused.length).toBeGreaterThanOrEqual(2);
    const freed = -unused.reduce((s, r) => s + r.amount, 0);
    const fund = d.goals.find((g) => g.name.startsWith("Emergency fund"))!;
    expect(monthsTo(fund, fund.monthly)).toBe(12);
    expect(monthsTo(fund, fund.monthly + freed)).toBe(11);
  });
});

describe("demo seed is consistent with the screens Clopar reads", () => {
  type Row = { name: string; amount: number; day_of_month: number; last_posted_month: string; category_id: string | null };
  type Tx = { payee: string; amount: number; date: string; source: string };
  const seed = build(today, {}) as unknown as { recurring: Row[]; transactions: Tx[] };

  it("every recurring row marked as posted this month and already due is booked this month", () => {
    const due = seed.recurring.filter((r) => r.last_posted_month === "2026-11" && r.day_of_month <= 24);
    for (const r of due) {
      expect(seed.transactions.some((t) => t.payee === r.name && t.amount === r.amount && t.date === `2026-11-${String(r.day_of_month).padStart(2, "0")}`)).toBe(true);
    }
    expect(due.length).toBeGreaterThan(0);
  });

  it("books nothing that is not yet due", () => {
    expect(seed.transactions.some((t) => t.payee.startsWith("LVB · salary"))).toBe(false); // day 28
  });
});
