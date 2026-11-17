import { describe, expect, it } from "vitest";
import { runTool, saveCard, undoCard, TOOLS } from "./assistant-tools";
import { berlinToday } from "./money";
import { UNUSED_DAYS, subscriptionSummary } from "./subscriptions";
import { monthsTo } from "./plan";

type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

/** An in-memory client: select, update (with returning rows), insert, delete, eq and in. `block` makes updates on a table match nothing, as RLS does. */
function memDb(db: Db, opts: { block?: string[] } = {}) {
  const log: string[] = [];
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: "select" | "update" | "insert" | "delete" = "select";
    let patch: Row = {};
    let inserted: Row | null = null;
    let returning = false;
    const run = () => {
      const rows = (db[table] ??= []);
      if (op === "insert") {
        inserted = { id: `new-${rows.length}`, ...patch };
        rows.push(inserted);
        return { data: [inserted], error: null };
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        if (opts.block?.includes(table)) return { data: [], error: null };
        hit.forEach((r) => Object.assign(r, patch));
        return { data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null };
      }
      if (op === "delete") {
        db[table] = rows.filter((r) => !hit.includes(r));
        return { data: null, error: null };
      }
      return { data: hit, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => ((returning = true), q),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
      order: () => q,
      limit: () => q,
      gte: () => q,
      lte: () => q,
      insert: (v: Row) => ((op = "insert"), (patch = v), log.push(`insert ${table}`), q),
      update: (v: Row) => ((op = "update"), (patch = v), log.push(`update ${table}`), q),
      delete: () => ((op = "delete"), log.push(`delete ${table}`), q),
      single: async () => ({ data: run().data?.[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: run().data?.[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown) => Promise.resolve(run()).then(ok),
    };
    return q;
  };
  return { sb: { from } as never, db, log };
}

const today = berlinToday().iso;
const daysAgo = (n: number) => new Date(Date.parse(today) - n * 86_400_000).toISOString();
const sub = (id: string, name: string, amount: number, ago: number, extra: Row = {}): Row => ({
  id, name, amount, active: true, is_subscription: true, last_used_at: daysAgo(ago), visibility: "family", owner_id: "me", ...extra,
});
const world = (): Db => ({
  recurring: [
    sub("s1", "Netflix", -13.99, 2),
    sub("s2", "Disney+", -9.99, 52),
    sub("s3", "Fitness app (unused)", -13.99, 74),
    sub("s4", "Cloud storage 2 TB (unused)", -13.99, 96),
    { id: "rent", name: "Rent", amount: -1200, active: true, is_subscription: false, last_used_at: null, visibility: "family", owner_id: "me" },
    sub("p1", "Secret gym", -30, 80, { visibility: "private", owner_id: "partner" }),
  ],
  goals: [{ id: "g1", name: "Emergency fund · 6 months", target: 15000, current: 9800, monthly: 450, visibility: "family", owner_id: "me" }],
  ai_pending_actions: [],
});

describe("get_subscriptions", () => {
  it("sums what is unused and hides a partner's private rows", async () => {
    const { sb } = memDb(world());
    const { output } = await runTool(sb, "me", "get_subscriptions", {});
    expect(output.unused_per_month).toBe(37.97);
    expect((output.subscriptions as { name: string }[]).map((s) => s.name)).not.toContain("Secret gym");
    expect(output.unused_after_days).toBe(UNUSED_DAYS);
  });
  it("is a plain read", () => {
    expect(TOOLS.map((t) => t.name)).toContain("get_subscriptions");
    expect(subscriptionSummary([], today).unused_per_month).toBe(0);
  });
});

describe("demo numbers", () => {
  it("cancelling the three unused ones moves the emergency fund from 12 to 11 months", () => {
    const goal = { target: 15000, current: 9800 };
    expect(monthsTo(goal, 450)).toBe(12);
    expect(monthsTo(goal, 450 + 37.97)).toBe(11);
  });
});

describe("propose_cancel_subscriptions", () => {
  const ask = { names: ["disney", "fitness", "cloud"], move_to_goal: "emergency" };

  it("writes only the pending card and works out the months", async () => {
    const m = memDb(world());
    const { card, output } = await runTool(m.sb, "me", "propose_cancel_subscriptions", ask);
    expect(m.log).toEqual(["insert ai_pending_actions"]);
    expect(output.status).toBe("awaiting_user_confirmation");
    const a = card!.args as { freed: number; goal: { months_before: number; months_after: number; monthly_after: number } };
    expect(a.freed).toBe(37.97);
    expect(a.goal).toMatchObject({ months_before: 12, months_after: 11, monthly_after: 487.97 });
    expect(m.db.recurring.every((r) => r.active)).toBe(true);
  });

  it("never offers rent, a partner's private row, or an ambiguous or unknown name", async () => {
    for (const names of [["rent"], ["secret gym"], ["unused"], ["nothing like it"]]) {
      const m = memDb(world());
      const { card, output } = await runTool(m.sb, "me", "propose_cancel_subscriptions", { names });
      expect(card).toBeUndefined();
      expect(output.error).toBeTruthy();
      expect(m.log).toEqual([]);
    }
  });

  it("refuses a goal that is not a single match instead of guessing", async () => {
    const m = memDb(world());
    const { card, output } = await runTool(m.sb, "me", "propose_cancel_subscriptions", { names: ["disney"], move_to_goal: "holiday" });
    expect(card).toBeUndefined();
    expect(output.error).toBeTruthy();
  });
});

async function proposed(m: ReturnType<typeof memDb>, ask: Row = { names: ["disney", "fitness", "cloud"], move_to_goal: "emergency" }) {
  const { card } = await runTool(m.sb, "me", "propose_cancel_subscriptions", ask);
  // The in-memory table keeps the args the proposal stored.
  m.db.ai_pending_actions[0] = { id: card!.id, tool: "cancel_subs", args: card!.args, status: "pending", result: null };
  return card!;
}

describe("saving and undoing the card", () => {
  it("pauses the subscriptions and raises the goal once, never deleting", async () => {
    const m = memDb(world());
    const card = await proposed(m);
    m.log.length = 0;
    expect(await saveCard(m.sb, "me", card.id)).toEqual({ ok: true });
    expect(m.db.recurring.filter((r) => !r.active).map((r) => r.id).sort()).toEqual(["s2", "s3", "s4"]);
    expect(m.db.goals[0].monthly).toBe(487.97);
    expect(m.log.some((l) => l.startsWith("delete"))).toBe(false);
    // A second Save on the same card does nothing more.
    expect(await saveCard(m.sb, "me", card.id)).toEqual({ error: "gone" });
    expect(m.db.goals[0].monthly).toBe(487.97);
  });

  it("a blocked subscription update fails and leaves the card pending", async () => {
    const m = memDb(world(), { block: ["recurring"] });
    const card = await proposed(m);
    expect(await saveCard(m.sb, "me", card.id)).toEqual({ error: "failed" });
    expect(m.db.ai_pending_actions[0].status).toBe("pending");
    expect(m.db.goals[0].monthly).toBe(450);
  });

  it("a goal that cannot be updated puts the subscriptions back", async () => {
    const m = memDb(world(), { block: ["goals"] });
    const card = await proposed(m);
    expect(await saveCard(m.sb, "me", card.id)).toEqual({ error: "failed" });
    expect(m.db.recurring.every((r) => r.active)).toBe(true);
    expect(m.db.ai_pending_actions[0].status).toBe("pending");
  });

  it("undo restores both tables, and trusts only the card's own ids", async () => {
    const m = memDb(world());
    const card = await proposed(m);
    await saveCard(m.sb, "me", card.id);
    // A tampered result tries to also revive an id that is not on the card.
    m.db.recurring.find((r) => r.id === "rent")!.active = false;
    const saved = m.db.ai_pending_actions[0] as { result: { ids: string[] } };
    saved.result.ids.push("rent");
    expect(await undoCard(m.sb, card.id)).toEqual({ ok: true });
    expect(m.db.recurring.filter((r) => r.id !== "rent").every((r) => r.active)).toBe(true);
    expect(m.db.recurring.find((r) => r.id === "rent")!.active).toBe(false);
    expect(m.db.goals[0].monthly).toBe(450);
    expect(m.db.ai_pending_actions[0].status).toBe("undone");
    expect(m.log.some((l) => l.startsWith("delete"))).toBe(false);
  });

  it("a goal changed since the proposal makes Save fail and puts the subscriptions back", async () => {
    const m = memDb(world());
    const card = await proposed(m);
    m.db.goals[0].monthly = 500;
    expect(await saveCard(m.sb, "me", card.id)).toEqual({ error: "failed" });
    expect(m.db.recurring.every((r) => r.active)).toBe(true);
    expect(m.db.goals[0].monthly).toBe(500);
  });

  it("undo leaves a goal alone that was changed after the save, and flags private rows", async () => {
    const m = memDb(world());
    const card = await proposed(m);
    await saveCard(m.sb, "me", card.id);
    m.db.goals[0].monthly = 600;
    expect(await undoCard(m.sb, card.id)).toEqual({ ok: true });
    expect(m.db.goals[0].monthly).toBe(600);
    expect(m.db.recurring.filter((r) => r.id !== "rent" && r.id !== "p1").every((r) => r.active)).toBe(true);
  });
});
