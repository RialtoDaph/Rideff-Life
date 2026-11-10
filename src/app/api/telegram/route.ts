// Telegram sends every message and button tap for the bot here (README → Telegram).
// The secret header proves it is Telegram. We answer at once and do the work after,
// so Telegram never waits for the AI and does not send the update again.

import { after } from "next/server";
import { secretMatches, telegramReady } from "@/lib/telegram/api";
import { handleUpdate, type Update } from "@/lib/telegram/bot";
import { tgAdmin } from "@/lib/telegram/session";

export const maxDuration = 300;

export async function POST(req: Request) {
  if (!telegramReady()) return new Response("not configured", { status: 503 });
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), "webhook")) return new Response("forbidden", { status: 401 });

  const update = (await req.json().catch(() => null)) as Update | null;
  if (!update || typeof update.update_id !== "number") return Response.json({ ok: true });

  const admin = tgAdmin();
  if (admin) {
    const { data: fresh } = await admin.rpc("telegram_seen", { p_update: update.update_id });
    if (fresh === false) return Response.json({ ok: true });
  }

  const origin = new URL(req.url).origin;
  after(() => handleUpdate(update, origin));
  return Response.json({ ok: true });
}
