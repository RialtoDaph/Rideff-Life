import { describe, expect, it } from "vitest";
import { netWorthOutput, runTool } from "./assistant-tools";
import type { Asset, Debt } from "./finance";

type Call = { table: string; op: string; args: unknown[] };

/** A read-only client that behaves like PostgREST on dates: an impossible day ("2026-11-31") fails the whole query. */
function readDb(tables: Record<string, object[]>) {
  const calls: Call[] = [];
  const chain = (table: string) => {
    let bad = false;
    const q: Record<string, unknown> = {};
    for (const op of ["select", "eq", "order", "limit", "gte", "lte", "lt"]) {
      q[op] = (...args: unknown[]) => {
        calls.push({ table, op, args });
        const v = args[1];
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
          const [y, m, d] = v.split("-").map(Number);
          if (new Date(Date.UTC(y, m - 1, d)).getUTCDate() !== d) bad = true;
        }
        return q;
      };
    }
    q.maybeSingle = async () => ({ data: null, error: null });
    q.then = (ok: (v: unknown) => void) => ok(bad ? { data: null, error: { message: "date/time field value out of range" } } : { data: tables[table] ?? [], error: null });
    return q;
  };
  return { sb: { from: chain } as never, calls };
}

const cats = [
  { id: "g", name: "Groceries", icon: "x", monthly_limit: 600, is_fixed: false, sort: 1 },
  { id: "r", name: "Rent", icon: "x", monthly_limit: 900, is_fixed: true, sort: 2 },
];
const tx = (date: string, amount: number, category_id: string) => ({ id: date + amount, owner_id: "me", visibility: "family", date, amount, payee: "x", category_id });

describe("get_budget", () => {
  it("reads a 30-day month with a valid upper bound, so spending is not lost", async () => {
    const { sb, calls } = readDb({ categories: cats, transactions: [tx("2026-11-03", -120, "g"), tx("2026-11-01", -900, "r")] });
    const { output } = await runTool(sb, "me", "get_budget", { month: "2026-11" });
    const bounds = calls.filter((c) => c.table === "transactions" && (c.op === "lt" || c.op === "lte"));
    expect(bounds).toEqual([{ table: "transactions", op: "lt", args: ["date", "2026-12-01"] }]);
    expect(output.flexible_spent).toBe(120);
    expect(output.flexible_left).toBe(480);
  });

  it("says it could not read rather than reporting nothing spent", async () => {
    // An impossible bound, as the old code sent, must surface as an error.
    const { sb } = readDb({ categories: cats });
    const db = sb as unknown as { from: (t: string) => Record<string, (...a: unknown[]) => unknown> };
    const failing = { from: (t: string) => (t === "transactions" ? db.from(t).lte("date", "2026-11-31") : db.from(t)) } as never;
    const { output } = await runTool(failing, "me", "get_budget", {});
    expect(output.error).toBeTruthy();
  });

  it("a past month counts as finished: one day left, not today's count", async () => {
    const { sb } = readDb({ categories: cats, transactions: [tx("2026-02-10", -100, "g")] });
    const { output } = await runTool(sb, "me", "get_budget", { month: "2026-02" });
    expect(output.days_left).toBe(1);
    expect(output.per_day).toBe(500);
  });
});

describe("get_net_worth output", () => {
  const asset = (name: string, visibility: "family" | "private", orig_value: number, orig_currency: "EUR" | "IDR" = "EUR") =>
    ({ id: name, owner_id: "me", visibility, name, icon: "x", location: null, orig_currency, orig_value, note: null }) as Asset;
  const debt = (name: string, visibility: "family" | "private", balance: number) =>
    ({ id: name, owner_id: "me", visibility, name, icon: "x", lender: null, balance, original: balance, rate_pct: 0, monthly_payment: 10, member_id: null }) as Debt;

  it("headlines the family net worth Home shows, and keeps the caller's private items apart", () => {
    const out = netWorthOutput([asset("ETF", "family", 10000), asset("Rupiah", "family", 18_000_000, "IDR"), asset("Own", "private", 500)], [debt("Loan", "family", 3000), debt("Mine", "private", 200)], 18000);
    expect(out.net_worth).toBe(10000 + 1000 - 3000);
    expect(out.private_net).toBe(300);
    expect(out.assets.find((a) => a.name === "Own")?.private).toBe(true);
  });

  it("has no private total when there is nothing private", () => {
    expect(netWorthOutput([asset("ETF", "family", 100)], [], 18000).private_net).toBeNull();
  });
});
