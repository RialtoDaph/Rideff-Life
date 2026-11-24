// The assistant's tools (AI_ASSISTANT.md §3). The model never gets bulk data: it
// calls a tool, and the server runs it as the signed-in person, so Row Level
// Security and the share settings decide what comes back. Tools that would change
// data write nothing here. They only leave a card waiting for the person's Save.

import type { SupabaseClient } from "@supabase/supabase-js";
import { visibleTo } from "./ask-context";
import { assetEur, DEFAULT_IDR_PER_EUR, netWorth, type Asset, type Debt } from "./finance";
import { berlinToday, budgetSummary, nextMonthStart, todayInMonth, type Category, type Goal, type Income, type Recurring, type Transaction } from "./money";
import { goalChanges, monthsTo, unplannedPerMonth } from "./plan";
import { cancellable, subscriptionSummary, uniqueMatch, type SubRow } from "./subscriptions";
import { addDays, type CalEvent } from "./time";

const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: "function",
  name,
  description,
  parameters: { type: "object", additionalProperties: false, properties, required },
});
const visibility = { type: "string", enum: ["family", "private"], description: "family for household matters; private only when the person says so or it is clearly personal." };
const iso = (description: string) => ({ type: "string", description: `${description} As YYYY-MM-DD.` });

export const TOOLS = [
  fn("get_budget", "Categories, spent and left for a month of shared money.", { month: { type: "string", description: "YYYY-MM. Leave out for this month." } }),
  fn("get_goals", "Shared goals, plus the caller's own private goals.", { scope: { type: "string", enum: ["all", "shared", "mine"] } }),
  fn("get_week", "Events and shifts the caller may see.", { from: iso("First day."), to: iso("Last day.") }),
  fn("get_net_worth", "Family net worth (the number Home shows), plus each account and debt; the caller's private ones are marked private and totalled apart in private_net."),
  fn("get_subscriptions", "Subscriptions with their monthly cost and days since last use, and what the unused ones cost per month."),
  fn(
    "simulate",
    "What if the monthly money changes: the result on goal dates.",
    { freed_per_month: { type: "number", description: "Extra euro per month, negative if less." }, goal: { type: "string", description: "The goal that gets it, by name." } },
    ["freed_per_month"],
  ),
  fn(
    "propose_transaction",
    "Suggest booking money in or out. Saves nothing: the person gets a card with Save, Edit and Undo.",
    {
      payee: { type: "string" },
      amount: { type: "number", description: "Negative for money out, positive for money in." },
      date: iso("The day."),
      category: { type: "string", description: "Category name, if one fits." },
      visibility,
    },
    ["payee", "amount", "visibility"],
  ),
  fn(
    "propose_event",
    "Suggest a calendar event. Saves nothing: the person gets a card with Save, Edit and Undo.",
    { title: { type: "string" }, date: iso("The day."), time: { type: "string", description: "HH:MM, if known." }, visibility },
    ["title", "date", "visibility"],
  ),
  fn(
    "propose_goal",
    "Suggest a savings goal. Saves nothing: the person gets a card with Save, Edit and Undo.",
    { name: { type: "string" }, target: { type: "number" }, monthly: { type: "number" }, visibility },
    ["name", "target", "visibility"],
  ),
  fn(
    "propose_cancel_subscriptions",
    "Suggest cancelling subscriptions the person no longer uses, and optionally moving the freed money into a goal. Saves nothing: the person gets one card with Save and Undo. Call once with all the names.",
    { names: { type: "array", items: { type: "string" }, description: "Subscription names, at most five." }, move_to_goal: { type: "string", description: "A goal, by name, that gets the freed money each month." } },
    ["names"],
  ),
  fn(
    "remember",
    "Suggest one short durable fact to keep. Saves nothing until the person agrees on the card. Use scope shared only when it concerns shared money or goals and the person asked for it.",
    { text: { type: "string" }, scope: { type: "string", enum: ["private", "shared"] } },
    ["text", "scope"],
  ),
  fn("forget", "Suggest deleting a memory the caller owns, by its id. Deletes nothing until the person agrees on the card.", { memory_id: { type: "string" } }, ["memory_id"]),
];

// "shifts" comes from Telegram only: a roster read from a photo, saved together.
export type CardKind = "transaction" | "event" | "goal" | "remember" | "forget" | "shifts" | "cancel_subs";
export type CardStatus = "pending" | "saved" | "undone" | "skipped";
export type Card = { id: string; kind: CardKind; status: CardStatus; args: Record<string, unknown> };

const PROPOSALS: Record<string, CardKind> = {
  propose_transaction: "transaction",
  propose_event: "event",
  propose_goal: "goal",
  propose_cancel_subscriptions: "cancel_subs",
  remember: "remember",
  forget: "forget",
};

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const vis = (v: unknown) => (v === "private" ? "private" : "family");
const r2 = (n: number) => Math.round(n * 100) / 100;
type Out = Record<string, unknown>;

/** Checks a proposal and returns what the card shows, or a reason for the model. */
async function cleanProposal(sb: SupabaseClient, userId: string, kind: CardKind, a: Out, today: string): Promise<Out | { error: string }> {
  switch (kind) {
    case "transaction": {
      const amount = Number(a.amount);
      const payee = text(a.payee);
      if (!payee || !Number.isFinite(amount) || amount === 0) return { error: "Need a payee and an amount." };
      const { data: cats } = await sb.from("categories").select("id,name");
      const wanted = text(a.category).toLowerCase();
      const cat = ((cats ?? []) as { id: string; name: string }[]).find((c) => c.name.toLowerCase() === wanted);
      return { payee, amount, date: isDay(a.date) ? a.date : today, category_id: cat?.id ?? null, category: cat?.name ?? null, visibility: vis(a.visibility) };
    }
    case "event": {
      const title = text(a.title);
      if (!title || !isDay(a.date)) return { error: "Need a title and a date." };
      const time = typeof a.time === "string" && /^\d{2}:\d{2}$/.test(a.time) ? a.time : null;
      return { title, date: a.date, time, visibility: vis(a.visibility) };
    }
    case "goal": {
      const name = text(a.name);
      const target = Number(a.target);
      if (!name || !(target > 0)) return { error: "Need a name and a target above zero." };
      return { name, target, monthly: Math.max(0, Number(a.monthly) || 0), visibility: vis(a.visibility) };
    }
    case "remember": {
      const fact = text(a.text, 500);
      if (!fact) return { error: "Nothing to remember." };
      return { text: fact, scope: a.scope === "shared" ? "shared" : "private" };
    }
    case "shifts":
      return { error: "Shifts come from a roster photo." };
    case "cancel_subs": {
      const names = (Array.isArray(a.names) ? a.names : []).map((n) => text(n, 80)).filter(Boolean).slice(0, 5);
      if (!names.length) return { error: "Need the names of the subscriptions." };
      const { data } = await sb.from("recurring").select("*");
      const pool = cancellable(visibleTo((data ?? []) as Recurring[], userId));
      const subs: (SubRow & { visibility: string })[] = [];
      for (const n of names) {
        const hit = uniqueMatch(pool, n, (r) => r.name);
        if (!hit) return { error: `No single active subscription matches "${n}".` };
        if (!subs.some((s) => s.id === hit.id)) subs.push(hit as SubRow & { visibility: string });
      }
      const freed = Math.round(subs.reduce((s, r) => s - r.amount, 0) * 100) / 100;
      let goal: Out | null = null;
      const wanted = text(a.move_to_goal);
      if (wanted) {
        const { data: g } = await sb.from("goals").select("*");
        const pick = uniqueMatch(visibleTo((g ?? []) as Goal[], userId).filter((x) => x.target > 0), wanted, (x) => x.name);
        if (!pick) return { error: `No single goal matches "${wanted}".` };
        const before = pick.monthly || 0;
        const after = Math.round((before + freed) * 100) / 100;
        goal = { id: pick.id, name: pick.name, private: pick.visibility === "private", monthly_before: before, monthly_after: after, months_before: monthsTo(pick, before), months_after: monthsTo(pick, after) };
      }
      return { subs: subs.map((r) => ({ id: r.id, name: r.name, monthly: Math.round(-r.amount * 100) / 100, private: r.visibility === "private" })), freed, goal };
    }
    case "forget": {
      const { data } = await sb.from("ai_memories").select("id,text,scope,kind").eq("id", text(a.memory_id, 40)).eq("owner_id", userId).maybeSingle();
      return data ? { memory_id: data.id, text: data.text, scope: data.scope, kind: data.kind } : { error: "No such memory of this person." };
    }
  }
}

/**
 * get_net_worth's answer. The headline is the family net worth, the same number Home shows
 * (netWorth over family rows); the caller's private items are listed and totalled apart.
 */
export function netWorthOutput(assets: Asset[], debts: Debt[], rate: number) {
  const fam = <T extends { visibility: string }>(xs: T[]) => xs.filter((x) => x.visibility === "family");
  const mine = <T extends { visibility: string }>(xs: T[]) => xs.filter((x) => x.visibility === "private");
  const shared = netWorth(fam(assets), fam(debts), rate);
  const own = netWorth(mine(assets), mine(debts), rate);
  return {
    net_worth: Math.round(shared.net),
    owned: Math.round(shared.assets),
    owed: Math.round(shared.debts),
    private_net: mine(assets).length || mine(debts).length ? Math.round(own.net) : null,
    assets: assets.map((x) => ({ name: x.name, eur: Math.round(assetEur(x, rate)), private: x.visibility === "private" })),
    debts: debts.map((x) => ({ name: x.name, balance: x.balance, private: x.visibility === "private" })),
  };
}

export async function runTool(sb: SupabaseClient, userId: string, name: string, args: Out): Promise<{ output: Out; card?: Card }> {
  const today = berlinToday();

  const kind = PROPOSALS[name];
  if (kind) {
    const clean = await cleanProposal(sb, userId, kind, args, today.iso);
    if ("error" in clean) return { output: clean };
    const { data, error } = await sb.from("ai_pending_actions").insert({ tool: kind, args: clean }).select("id").single();
    if (error) return { output: { error: "Could not prepare this." } };
    return {
      output: { status: "awaiting_user_confirmation", note: "Nothing is saved yet. A card is on screen; ask the person to tap Save." },
      card: { id: data.id, kind, status: "pending", args: clean },
    };
  }

  switch (name) {
    case "get_budget": {
      const month = typeof args.month === "string" && /^\d{4}-\d{2}$/.test(args.month) ? args.month : today.ym;
      // An exclusive bound on the next month's 1st: "2026-11-31" is not a date, and Postgres rejects the whole query.
      const [c, t, s] = await Promise.all([
        sb.from("categories").select("*").order("sort"),
        sb.from("transactions").select("*").gte("date", `${month}-01`).lt("date", nextMonthStart(month)).eq("visibility", "family").limit(5000),
        sb.from("member_settings").select("warn_pct").eq("member_id", userId).maybeSingle(),
      ]);
      // Never report "nothing spent" because a read failed.
      if (c.error || t.error) return { output: { error: "Could not read the budget." } };
      const warnPct = (s.data as { warn_pct: number } | null)?.warn_pct ?? 80;
      const b = budgetSummary((c.data ?? []) as Category[], (t.data ?? []) as Transaction[], todayInMonth(today, month), warnPct);
      return {
        output: {
          month,
          flexible_limit: r2(b.flexLimit),
          flexible_spent: r2(b.flexSpent),
          flexible_left: r2(b.flexLeft),
          per_day: r2(b.perDay),
          days_left: b.daysLeft,
          categories: b.rows.map((r) => ({ name: r.cat.name, limit: r.cat.monthly_limit, spent: r2(r.spent), left: r2(r.cat.monthly_limit - r.spent), status: r.status, fixed: r.cat.is_fixed })),
        },
      };
    }
    case "get_goals": {
      const { data } = await sb.from("goals").select("*");
      const seen = visibleTo((data ?? []) as Goal[], userId).filter((g) =>
        args.scope === "shared" ? g.visibility === "family" : args.scope === "mine" ? g.visibility === "private" : true,
      );
      return { output: { goals: seen.map((g) => ({ name: g.name, target: g.target, saved: g.current, monthly: g.monthly, deadline: g.deadline, private: g.visibility === "private" })) } };
    }
    case "get_week": {
      const from = isDay(args.from) ? args.from : today.iso;
      const to = isDay(args.to) ? args.to : addDays(from, 6);
      const { data } = await sb.from("events").select("*").gte("date", from).lte("date", to).order("date");
      return { output: { events: visibleTo((data ?? []) as CalEvent[], userId).map((e) => ({ title: e.title, date: e.date, start: e.start_time, end: e.end_time, kind: e.kind })) } };
    }
    case "get_net_worth": {
      const [a, d, fx] = await Promise.all([
        sb.from("assets").select("*"),
        sb.from("debts").select("*"),
        sb.from("fx_rates").select("idr_per_eur").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const rate = (fx.data as { idr_per_eur: number } | null)?.idr_per_eur ?? DEFAULT_IDR_PER_EUR;
      if (a.error || d.error) return { output: { error: "Could not read accounts and debts." } };
      const assets = visibleTo((a.data ?? []) as Asset[], userId);
      const debts = visibleTo((d.data ?? []) as Debt[], userId);
      return { output: netWorthOutput(assets, debts, rate) };
    }
    case "get_subscriptions": {
      const { data } = await sb.from("recurring").select("*");
      return { output: subscriptionSummary(visibleTo((data ?? []) as Recurring[], userId), today.iso) };
    }
    case "simulate": {
      const [g, i, c] = await Promise.all([sb.from("goals").select("*"), sb.from("incomes").select("*"), sb.from("categories").select("*")]);
      const goals = visibleTo((g.data ?? []) as Goal[], userId).filter((x) => x.target > 0);
      const incomes = visibleTo((i.data ?? []) as Income[], userId);
      const wanted = text(args.goal).toLowerCase();
      const target = goals.find((x) => x.name.toLowerCase() === wanted) ?? goals[0];
      const freed = Number(args.freed_per_month) || 0;
      return {
        output: {
          unplanned_per_month: unplannedPerMonth(incomes, (c.data ?? []) as Category[], goals),
          freed_per_month: freed,
          goals: goalChanges(goals, target?.id ?? null, freed).map((x) => ({ name: x.goal.name, months_before: x.before, months_after: x.after, monthly_after: x.monthlyAfter })),
        },
      };
    }
  }
  return { output: { error: "Unknown tool." } };
}

type Pending = { id: string; tool: CardKind; args: Out; status: CardStatus; result: { table: string; id: string; ids?: string[]; row?: Out; goal?: { id: string } } | null };

/** The person tapped Save. This is the only place the assistant's suggestions become data. */
export async function saveCard(sb: SupabaseClient, userId: string, id: string, edited?: string, extra?: Out) {
  const { data } = await sb.from("ai_pending_actions").select("id,tool,args,status,result").eq("id", id).maybeSingle();
  const p = data as Pending | null;
  if (!p || p.status !== "pending") return { error: "gone" };
  // extra: what the server added on Save, e.g. the kept receipt photo from Telegram.
  const a = { ...p.args, ...extra };
  let result: Pending["result"];

  if (p.tool === "cancel_subs") {
    // Ids and amounts come from the stored card, never from the request. The client can write that row too,
    // so this is safe only because every update below runs as the person under RLS and column grants.
    const subs = (Array.isArray(p.args.subs) ? p.args.subs : []) as { id: string }[];
    const ids = subs.map((x) => String(x.id));
    const goal = p.args.goal as { id: string; monthly_before: number; monthly_after: number } | null;
    if (!ids.length) return { error: "failed" };
    const { data: done, error } = await sb
      .from("recurring")
      .update({ active: false, cancelled_on: berlinToday().iso })
      .in("id", ids)
      .eq("active", true)
      .eq("is_subscription", true)
      .select("id");
    const changed = ((done ?? []) as { id: string }[]).map((r) => r.id);
    const putBack = async () => {
      if (!changed.length) return;
      const { error: be } = await sb.from("recurring").update({ active: true, cancelled_on: null }).in("id", changed);
      if (be) console.error("cancel_subs: could not put subscriptions back", be.message);
    };
    if (error || changed.length !== ids.length) {
      await putBack();
      return { error: "failed" };
    }
    if (goal) {
      const { data: g, error: ge } = await sb.from("goals").update({ monthly: goal.monthly_after }).eq("id", goal.id).eq("monthly", goal.monthly_before).select("id");
      if (ge || !g?.length) {
        await putBack();
        return { error: "failed" };
      }
    }
    result = { table: "recurring", id: ids[0], ids, ...(goal ? { goal: { id: goal.id } } : {}) };
  } else if (p.tool === "forget") {
    const { data: row } = await sb.from("ai_memories").select("scope,kind,text,source").eq("id", a.memory_id).eq("owner_id", userId).maybeSingle();
    if (!row) return { error: "gone" };
    const { error } = await sb.from("ai_memories").delete().eq("id", a.memory_id).eq("owner_id", userId);
    if (error) return { error: "failed" };
    result = { table: "ai_memories", id: String(a.memory_id), row };
  } else if (p.tool === "shifts") {
    // Saved once per person, date and start time: a shift already there is skipped.
    const ids: string[] = [];
    for (const s of (Array.isArray(a.shifts) ? a.shifts : []) as Out[]) {
      const { data: row, error } = await sb
        .from("events")
        .insert({ kind: "shift", title: a.title, date: s.date, start_time: s.start, end_time: s.end ?? null, who: userId, source: "roster", note: s.note ?? null })
        .select("id")
        .single();
      if (row) ids.push(row.id);
      else if (error?.code !== "23505") return { error: "failed" };
    }
    result = { table: "events", id: ids[0] ?? "", ids };
  } else {
    const insert: [string, Out] =
      p.tool === "transaction"
        ? [
            "transactions",
            {
              payee: a.payee,
              amount: a.amount,
              date: a.date,
              category_id: a.category_id,
              paid_by: userId,
              source: a.receipt_file_id ? "receipt" : "assistant",
              visibility: a.visibility,
              note: typeof a.note === "string" && a.note ? a.note : null,
              receipt_file_id: a.receipt_file_id ?? null,
            },
          ]
        : p.tool === "event"
          ? ["events", { kind: "event", title: a.title, date: a.date, start_time: a.time, who: a.visibility === "private" ? userId : null, visibility: a.visibility }]
          : p.tool === "goal"
            ? ["goals", { name: a.name, target: a.target, monthly: a.monthly, visibility: a.visibility }]
            : ["ai_memories", { text: text(edited, 500) || a.text, scope: a.scope, source: "chat" }];
    const { data: row, error } = await sb.from(insert[0]).insert(insert[1]).select("id").single();
    if (error) return { error: "failed" };
    result = { table: insert[0], id: row.id };
  }
  const { error: se } = await sb.from("ai_pending_actions").update({ status: "saved", result }).eq("id", id);
  if (se) console.error("card saved but its status was not recorded", se.message);
  return { ok: true };
}

const UNDOABLE = ["transactions", "events", "goals", "ai_memories"];

/** Takes back a saved card, or dismisses one that was never saved. */
export async function undoCard(sb: SupabaseClient, id: string) {
  const { data } = await sb.from("ai_pending_actions").select("id,tool,args,status,result").eq("id", id).maybeSingle();
  const p = data as Pending | null;
  if (!p) return { error: "gone" };
  if (p.status === "saved" && p.tool === "cancel_subs" && p.result) {
    // result is writable by the client: trust only ids and amounts on the stored card (which the client can also write, so RLS is the real guard).
    const onCard = new Set(((Array.isArray(p.args.subs) ? p.args.subs : []) as { id: string }[]).map((x) => String(x.id)));
    const ids = (p.result.ids ?? []).filter((x) => onCard.has(x));
    if (ids.length) {
      const { data: back, error } = await sb.from("recurring").update({ active: true, cancelled_on: null }).in("id", ids).select("id");
      if (error || (back?.length ?? 0) !== ids.length) return { error: "failed" };
    }
    const goal = p.args.goal as { id: string; monthly_before: number; monthly_after: number } | null;
    if (goal && p.result.goal?.id === goal.id) {
      // Only if nobody changed the goal since: a newer value is not ours to overwrite.
      const { error } = await sb.from("goals").update({ monthly: goal.monthly_before }).eq("id", goal.id).eq("monthly", goal.monthly_after);
      if (error) return { error: "failed" };
    }
  } else if (p.status === "saved" && p.result && UNDOABLE.includes(p.result.table)) {
    const { error } = p.result.row
      ? await sb.from(p.result.table).insert(p.result.row)
      : p.result.ids
        ? await sb.from(p.result.table).delete().in("id", p.result.ids)
        : await sb.from(p.result.table).delete().eq("id", p.result.id);
    if (error) return { error: "failed" };
  }
  await sb.from("ai_pending_actions").update({ status: "undone" }).eq("id", id);
  return { ok: true };
}
