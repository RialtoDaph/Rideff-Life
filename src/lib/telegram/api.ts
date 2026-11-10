// Server only. The Telegram Bot API (https://core.telegram.org/bots/api), with the
// token from Vercel (TELEGRAM_BOT_TOKEN). The token never reaches a phone or the database.

import { createHmac, timingSafeEqual } from "node:crypto";

export type Button = { text: string; callback_data?: string; url?: string };
export type Keyboard = Button[][];

const token = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
export const telegramReady = () => /^\d+:[\w-]{30,}$/.test(token());

/**
 * Secrets made from the bot token, so nothing extra has to be set up: one Telegram
 * sends with every update, one the reminder function sends to /api/telegram/notify.
 */
export const derivedSecret = (purpose: "webhook" | "notify") => createHmac("sha256", token()).update(`rideff-telegram-${purpose}`).digest("hex");

export function secretMatches(given: string | null | undefined, purpose: "webhook" | "notify") {
  const want = Buffer.from(derivedSecret(purpose));
  const got = Buffer.from(given ?? "");
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
    if (!json?.ok) {
      console.error("telegram", method, res.status, json?.description ?? "");
      return null;
    }
    return json.result ?? null;
  } catch (e) {
    console.error("telegram", method, String(e));
    return null;
  }
}

type Sent = { message_id: number };

/** HTML text (see escapeHtml). Long text is split at Telegram's 4096-character limit. */
export async function send(chatId: number | string, html: string, keyboard?: Keyboard): Promise<Sent | null> {
  const parts = html.match(/[\s\S]{1,4000}(?=\n|$)|[\s\S]{1,4000}/g) ?? [html];
  let last: Sent | null = null;
  for (const [i, part] of parts.entries()) {
    last = await tg<Sent>("sendMessage", {
      chat_id: chatId,
      text: part,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(keyboard && i === parts.length - 1 ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
  }
  return last;
}

export const typing = (chatId: number | string) => tg("sendChatAction", { chat_id: chatId, action: "typing" });

export const setButtons = (chatId: number | string, messageId: number, keyboard: Keyboard) =>
  tg("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: keyboard } });

export const answerButton = (id: string, text?: string) => tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });

/** Downloads a file someone sent. Bots may fetch files up to 20 MB. */
export async function download(fileId: string): Promise<Uint8Array | null> {
  const file = await tg<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file?.file_path) return null;
  const res = await fetch(`https://api.telegram.org/file/bot${token()}/${file.file_path}`, { signal: AbortSignal.timeout(30000) }).catch(() => null);
  return res?.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
