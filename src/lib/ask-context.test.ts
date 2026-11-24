import { describe, expect, it } from "vitest";
import { buildContext, type AskRows } from "./ask-context";
import { budgetSummary, emergencyFund, type Today } from "./money";
import { lifeScore } from "./life-score";

const today: Today = { y: 2026, m: 10, d: 10, iso: "2026-10-10", ym: "2026-10", daysInMonth: 31 };
const R = "alex";
const A = "mira";

const tx = (owner: string, visibility: "family" | "private", payee: string, amount: number) =>
  ({ id: payee, owner_id: owner, visibility, date: "2026-10-05", amount, payee, category_id: "g", paid_by: owner, source: "manual", recurring_id: null, note: null, created_at: "" }) as AskRows["transactions"][number];

function rows(): AskRows {
  return {
    members: [
      { id: R, display_name: "Alex" },
      { id: A, display_name: "Mira" },
    ],
    categories: [{ id: "g", name: "Groceries", icon: "x", monthly_limit: 600, is_fixed: false, sort: 0 } as AskRows["categories"][number]],
    transactions: [tx(R, "family", "Rewe", -50), tx(A, "private", "Secret anniversary gift", -120), tx(R, "private", "Alex's own thing", -30)],
    incomes: [],
    recurring: [],
    goals: [
      { id: "g1", owner_id: A, visibility: "private", name: "Surprise trip for Alex", icon: "x", target: 900, current: 100, monthly: 50, deadline: null, is_emergency_fund: false },
      { id: "g2", owner_id: R, visibility: "family", name: "Family car", icon: "x", target: 14000, current: 3200, monthly: 300, deadline: null, is_emergency_fund: false },
    ],
    debts: [],
    subscriptions: [],
    assets: [],
    remittances: [],
    businesses: [],
    businessMonths: [],
    taxDeadlines: [],
    events: [],
    yearlyGoals: [],
    fxRate: 18000,
    warnPct: 80,
    efMonths: 6,
    debtSettings: { strategy: "avalanche", extra_per_month: 0 },
    priorities: [],
    learningMinutes: [],
    gym: [],
    gymGoal: 3,
  };
}

describe("Clopar's context", () => {
  it("never contains the partner's private items, even if the rows were passed in", () => {
    const ctx = JSON.stringify(buildContext(rows(), R, today, R));
    expect(ctx).not.toContain("Secret anniversary gift");
    expect(ctx).not.toContain("Surprise trip");
    expect(ctx).toContain("Family car");
    expect(ctx).toContain("Alex's own thing"); // the asker's own private item is fine
  });

  it("the family view leaves out every private item", () => {
    const ctx = JSON.stringify(buildContext(rows(), R, today, "family"));
    expect(ctx).not.toContain("Alex's own thing");
    expect(ctx).not.toContain("Secret anniversary gift");
  });

  it("budget totals count family spending only", () => {
    const ctx = buildContext(rows(), A, today, A);
    expect(ctx.budget_this_month.flexible_spent).toBe(50);
    expect(ctx.budget_this_month.private_spending_of_asker).toBe(120);
    expect(JSON.stringify(ctx)).not.toContain("Alex's own thing");
  });
});

describe("Clopar matches the screens", () => {
  const debt = (id: string, owner: string, visibility: "family" | "private", balance: number, rate_pct: number, monthly_payment: number) =>
    ({ id, owner_id: owner, visibility, name: id, icon: "x", lender: null, balance, original: balance, rate_pct, monthly_payment, member_id: null }) as AskRows["debts"][number];

  it("gets the Life Map's score, computed by the app's own lifeScore() over the same rows", () => {
    const raw = rows();
    // A gym session last week: the Health area is 0, not empty, exactly as on the map.
    raw.gym = [{ id: "s", owner_id: R, visibility: "family", type: "Strength", icon: "x", date: "2026-10-01", time: null }];
    const ctx = buildContext(raw, R, today, "family");
    const familyTx = raw.transactions.filter((t) => t.visibility === "family");
    const expected = lifeScore({
      today,
      budget: budgetSummary(raw.categories, familyTx, today, 80),
      ef: emergencyFund(raw.goals.filter((g) => g.visibility === "family"), raw.categories, 6),
      goals: raw.goals.filter((g) => g.visibility === "family" || g.owner_id === R),
      yearlyGoals: [],
      events: [],
      people: [R, A],
      viewerId: R,
      priorities: [],
      learningMinutes: [],
      gym: raw.gym,
      gymGoal: 3,
    });
    expect(ctx.life_score.total).toBe(expected.total);
    expect(ctx.life_score.pillars.find((p) => p.area === "health")?.score).toBe(0);
    expect(ctx.life_score.pillars.map((p) => p.score)).toEqual(expected.pillars.map((p) => p.score));
  });

  it("debts and net worth headline the family numbers, with the household's own payoff plan", () => {
    const raw = rows();
    raw.debts = [debt("Loan", R, "family", 1200, 0, 100), debt("Mine", R, "private", 500, 0, 50)];
    raw.debtSettings = { strategy: "snowball", extra_per_month: 100 };
    const ctx = buildContext(raw, R, today, R);
    expect(ctx.debts.total).toBe(1200);
    expect(ctx.debts.private_total).toBe(500);
    expect(ctx.debts.debt_free_in_months).toBe(6); // 1200 at 100 + 100 extra a month, as the Debts screen plans it
    expect(ctx.net_worth.owed).toBe(1200);
    expect(ctx.net_worth.private_net).toBe(-500);
  });

  it("the next shift is the earliest one, and says whose it is", () => {
    const raw = rows();
    const ev = (id: string, owner: string, date: string, start_time: string) =>
      ({ id, owner_id: owner, visibility: "family", date, start_time, end_time: "14:00", title: id, kind: "shift", who: null }) as unknown as AskRows["events"][number];
    raw.events = [ev("late", A, "2026-10-14", "06:00"), ev("soon", A, "2026-10-11", "06:00")];
    expect(buildContext(raw, R, today, "family").next_shift).toEqual({ date: "2026-10-11", who: "Mira", hours: 8 });
  });
});
