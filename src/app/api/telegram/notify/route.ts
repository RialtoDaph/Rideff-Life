// The reminder function (supabase/functions/push) hands over due reminders of members
// who linked Telegram. Each one was claimed once in private.push_log, so it is sent
// once. The morning summary becomes Clopar's briefing, as on Home.

import { after } from "next/server";
import { askAnswer } from "@/lib/ask-server";
import { escapeHtml as h, secretMatches, send, telegramReady, type Keyboard } from "@/lib/telegram/api";
import { actAs, memberOfChat, tgAdmin } from "@/lib/telegram/session";
import { ACTION_PATH, answerHtml, lang, say } from "@/lib/telegram/text";

export const maxDuration = 300;

type Item = { member_id: string; key: string; title: string; body: string; url: string; chat_id: string };

export async function POST(req: Request) {
  if (!telegramReady()) return new Response("not configured", { status: 503 });
  if (!secretMatches(req.headers.get("authorization")?.replace(/^Bearer /, ""), "notify")) return new Response("forbidden", { status: 401 });
  const body = (await req.json().catch(() => null)) as { items?: Item[] } | null;
  const items = (body?.items ?? []).filter((i) => /^-?\d+$/.test(String(i.chat_id)) && typeof i.title === "string");
  const origin = new URL(req.url).origin;
  after(() => Promise.all(items.map((i) => deliver(i, origin))));
  return Response.json({ accepted: items.length }, { status: 202 });
}

async function deliver(it: Item, origin: string) {
  const chatId = Number(it.chat_id);
  const path = it.url.startsWith("/") ? it.url : "/";
  if (it.key.startsWith("summary:") && process.env.ANTHROPIC_API_KEY) {
    const brief = await briefing(chatId, it.member_id, origin);
    if (brief) return;
  }
  const keyboard: Keyboard | undefined = origin.startsWith("https://") ? [[{ text: "↗", url: `${origin}${path}` }]] : undefined;
  await send(chatId, `🔔 <b>${h(it.title)}</b>\n${h(it.body)}`, keyboard);
}

/** Clopar's briefing for the family, in the person's language. False if it could not be made. */
async function briefing(chatId: number, memberId: string, origin: string) {
  const admin = tgAdmin();
  const m = admin && (await memberOfChat(admin, chatId));
  if (!admin || !m || m.member_id !== memberId) return false;
  const sb = await actAs(admin, m);
  if (!sb) return false;
  const r = await askAnswer(sb, m.member_id, { mode: "briefing", scope: "family", locale: m.lang });
  if ("error" in r) return false;
  const l = lang(m.lang);
  const path = ACTION_PATH[r.answer.action];
  const keyboard: Keyboard | undefined = path && origin.startsWith("https://") ? [[{ text: say("open_app", l), url: `${origin}${path}` }]] : undefined;
  return !!(await send(chatId, `☀️ ${answerHtml(r.answer)}`, keyboard));
}
