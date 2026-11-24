// Talks to /api/ask (Clopar, on the server). Today's briefing stays on this phone;
// the chat lives in ai_messages (see components/assistant.tsx).

import type { Answer } from "@/lib/ask-schema";
import { supabase } from "@/lib/supabase";

/** The command palette leaves the question here for the Ask screen. */
export const ASK_HANDOFF = "ef-ask-question";
/** Fired as well, for when the Ask screen is already open. */
export const ASK_EVENT = "ef-ask";

export type ChatTurn = { role: "user"; text: string; at: number } | ({ role: "assistant"; at: number } & Answer);

async function post(body: Record<string, unknown>): Promise<{ answer?: Answer; error?: string }> {
  if (!navigator.onLine) return { error: "Clopar needs the internet." };
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Please sign in again." };
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.text) return { error: json?.error ?? "Clopar could not answer. Try again." };
    return { answer: json as Answer };
  } catch {
    return { error: "Could not reach Clopar. Try again." };
  }
}

export function askClopar(question: string, history: { role: string; text: string }[], locale?: string) {
  return post({
    mode: "ask",
    question,
    locale,
    history: history.slice(-6).map((t) => ({ role: t.role, text: t.text })),
  });
}

export function fetchBriefing(scope: string, locale: string) {
  return post({ mode: "briefing", scope, locale });
}

const briefKey = (userId: string, scope: string, day: string) => `ef-brief-${userId}-${scope}-${day}`;

/** What the briefing was written about: money left and how many alerts. */
export type BriefingFacts = { flexLeft: number; alerts: number };

// A briefing counts against a daily limit, so it is rewritten only when it is clearly out of date: the alert count
// changed or money left moved by a real amount, and at least an hour has passed since it was written. Until then
// the saved one stays on screen, so a few small expenses never burn the limit.
export const REWRITE_AFTER_MS = 60 * 60 * 1000;
const REWRITE_MOVE_EUR = 20;

/** Today's saved briefing for this view, and whether it is out of date enough to be written again. */
export function loadBriefing(userId: string, scope: string, day: string, now: BriefingFacts): { answer: Answer; stale: boolean } | null {
  try {
    const raw = localStorage.getItem(briefKey(userId, scope, day));
    if (!raw) return null;
    const saved = JSON.parse(raw) as { answer?: Answer; flexLeft?: number; alerts?: number; at?: number } & Partial<Answer>;
    // A briefing saved before this check existed is the bare answer: keep showing it, never rewrite it.
    if (!saved.answer) return typeof saved.text === "string" ? { answer: saved as Answer, stale: false } : null;
    const moved = saved.alerts !== now.alerts || Math.abs((saved.flexLeft ?? now.flexLeft) - now.flexLeft) >= REWRITE_MOVE_EUR;
    const old = Date.now() - (saved.at ?? 0) >= REWRITE_AFTER_MS;
    return { answer: saved.answer, stale: moved && old };
  } catch {
    return null;
  }
}

export function saveBriefing(userId: string, scope: string, day: string, facts: BriefingFacts, a: Answer) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(`ef-brief-${userId}-`) && !k.endsWith(day)) localStorage.removeItem(k);
    localStorage.setItem(briefKey(userId, scope, day), JSON.stringify({ answer: a, flexLeft: facts.flexLeft, alerts: facts.alerts, at: Date.now() }));
  } catch {}
}
