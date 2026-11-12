// Server only. Ask Clopar and the Home briefing, for the app (/api/ask) and Telegram.
// The data is read with the asker's own login, so Row Level Security keeps the
// partner's private items out, and buildContext() filters them once more.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTIONS, ASK_PROMPT, BRIEFING_PROMPT, answerSchema, type Answer, type AskAction } from "@/lib/ask-schema";
import { buildContext, type AskRows } from "@/lib/ask-context";
import { DEFAULT_IDR_PER_EUR, asSubscription } from "@/lib/finance";
import { berlinToday, type Recurring } from "@/lib/money";
import { addDays } from "@/lib/time";

export const MODEL = "claude-opus-5-5";
const BRIEFING_LANGUAGE: Record<string, string> = { en: "English", de: "German", id: "Indonesian" };

export type Turn = { role: "user" | "assistant"; text: string };
export type AskResult = { answer: Answer } | { error: string; status: number; code?: string };

/** Everything this person may see (RLS decides), limited to what is useful. */
export async function loadAskRows(sb: SupabaseClient, userId: string): Promise<AskRows | null> {
  const today = berlinToday();
  const since = addDays(today.iso, -62);
  const q = await Promise.all([
    sb.from("members").select("id,display_name").order("sort"),
    sb.from("categories").select("*").order("sort"),
    sb.from("transactions").select("*").gte("date", since).order("date", { ascending: false }).limit(1500),
    sb.from("incomes").select("*"),
    sb.from("recurring").select("*"),
    sb.from("goals").select("*"),
    sb.from("debts").select("*"),
    sb.from("recurring").select("*").eq("is_subscription", true),
    sb.from("assets").select("*"),
    sb.from("remittances").select("*").gte("date", `${today.y}-01-01`),
    sb.from("businesses").select("id,name"),
    sb.from("business_months").select("*").order("month", { ascending: false }).limit(36),
    sb.from("tax_deadlines").select("*"),
    sb.from("events").select("*").gte("date", `${today.ym}-01`).lte("date", addDays(today.iso, 31)),
    sb.from("yearly_goals").select("*").eq("year", today.y),
    sb.from("fx_rates").select("idr_per_eur").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("member_settings").select("warn_pct,ef_months").eq("member_id", userId).maybeSingle(),
  ]);
  if (q.some((r) => r.error)) return null;
  const d = q.map((r) => r.data);
  return {
    members: d[0] as AskRows["members"],
    categories: d[1] as AskRows["categories"],
    transactions: d[2] as AskRows["transactions"],
    incomes: d[3] as AskRows["incomes"],
    recurring: d[4] as AskRows["recurring"],
    goals: d[5] as AskRows["goals"],
    debts: d[6] as AskRows["debts"],
    subscriptions: (d[7] as Recurring[]).map(asSubscription),
    assets: d[8] as AskRows["assets"],
    remittances: d[9] as AskRows["remittances"],
    businesses: d[10] as AskRows["businesses"],
    businessMonths: d[11] as AskRows["businessMonths"],
    taxDeadlines: d[12] as AskRows["taxDeadlines"],
    events: d[13] as AskRows["events"],
    yearlyGoals: d[14] as AskRows["yearlyGoals"],
    fxRate: (d[15] as { idr_per_eur: number } | null)?.idr_per_eur ?? DEFAULT_IDR_PER_EUR,
    warnPct: (d[16] as { warn_pct: number } | null)?.warn_pct ?? 80,
    efMonths: (d[16] as { ef_months: number } | null)?.ef_months ?? 6,
  };
}

/**
 * A question (counts against the plan's messages) or today's briefing (free, a few a day).
 * `scope` is a member id or "family", for the briefing only.
 */
export async function askAnswer(
  sb: SupabaseClient,
  userId: string,
  input: { mode: "ask" | "briefing"; question?: string; history?: Turn[]; scope?: string; locale?: string },
): Promise<AskResult> {
  const { mode } = input;
  const question = String(input.question ?? "").trim().slice(0, 1000);
  if (mode === "ask" && !question) return { error: "Please type a question.", status: 400 };
  const history = (input.history ?? [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .slice(-6)
    .map((t) => ({ role: t.role, content: t.text.slice(0, 2000) }));

  if (mode === "ask") {
    const { error: quota } = await sb.rpc("ai_message_used");
    if (quota?.message.includes("ai_quota")) return { error: "quota", code: "ai_quota", status: 402 };
  } else {
    const { error: quota } = await sb.rpc("ai_use", { p_kind: "briefing" });
    if (quota) return { error: "quota", code: "ai_quota", status: 429 };
  }

  const rows = await loadAskRows(sb, userId);
  if (!rows) return { error: "Could not read your data. Try again.", status: 502 };
  const today = berlinToday();
  const memberIds = rows.members.map((m) => m.id);
  const scope = mode === "briefing" ? (input.scope && memberIds.includes(input.scope) ? input.scope : "family") : userId;
  const context = buildContext(rows, userId, today, scope);

  const client = new Anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: mode === "briefing" ? "low" : "medium", format: { type: "json_schema", schema: answerSchema() } },
      system: mode === "briefing" ? BRIEFING_PROMPT.replace("in English", `in ${BRIEFING_LANGUAGE[input.locale ?? "en"] ?? "English"}`) : ASK_PROMPT,
      messages: [
        { role: "user", content: `DATA (what ${context.asked_by} can see):\n${JSON.stringify(context)}` },
        { role: "assistant", content: "Understood. I will only use this data." },
        ...history,
        {
          role: "user",
          content: mode === "briefing" ? `Write today's briefing for ${context.view === "family" ? "the family" : context.view}.` : question,
        },
      ],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return { error: "Clopar can't help with that one.", status: 422 };
    const text = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
    if (!text) return { error: "Clopar gave no answer. Try again.", status: 502 };
    const a = JSON.parse(text) as { text: string; nums: { label: string; value: string }[]; next: string | null; action: string };
    return {
      answer: {
        text: a.text,
        nums: (a.nums ?? []).slice(0, 3),
        next: a.next || null,
        action: ACTIONS.includes(a.action as AskAction) ? (a.action as AskAction) : "none",
      },
    };
  } catch (e) {
    console.error("ask failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
    if (e instanceof Anthropic.RateLimitError) return { error: "Clopar is busy. Try again in a minute.", status: 429 };
    if (e instanceof Anthropic.AuthenticationError) return { error: "The AI key is not valid. Check it in Vercel.", status: 503 };
    return { error: "Clopar is not reachable right now. Try again.", status: 502 };
  }
}
