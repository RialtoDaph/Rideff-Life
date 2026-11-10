// Server only. Handles one Telegram update (README → Telegram): linking, typed
// messages, photos and PDFs, and the Save / Cancel / Undo buttons. Nothing reaches
// the app's data before the person taps Save.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReceiptResult, RosterResult, StatementResult } from "@/lib/ai-read-schema";
import { readWithAi, type ReadKind } from "@/lib/ai-read-server";
import { saveCard, undoCard, type Card } from "@/lib/assistant-tools";
import { toEur } from "@/lib/bank-import";
import { DEFAULT_IDR_PER_EUR } from "@/lib/finance";
import { berlinToday } from "@/lib/money";
import { answerButton, download, send, setButtons, typing, type Keyboard } from "./api";
import { chat } from "./chat";
import { actAs, memberOfChat, tgAdmin, type TgMember } from "./session";
import { ACTION_PATH, answerHtml, cardHtml, lang, receiptHtml, rosterHtml, say, statementHtml, T, type Lang } from "./text";

type Chat = { id: number; type: string };
type Msg = {
  message_id: number;
  chat: Chat;
  from?: { username?: string };
  text?: string;
  caption?: string;
  photo?: { file_id: string; file_size?: number }[];
  document?: { file_id: string; mime_type?: string; file_name?: string; file_size?: number };
};
export type Update = {
  update_id: number;
  message?: Msg;
  callback_query?: { id: string; data?: string; message?: { message_id: number; chat: Chat } };
};

const MAX_FILE = 20 * 1024 * 1024; // what bots may download
const IS_ROSTER = /jadwal|shift|schicht|dienstplan|roster/i;
const IS_STATEMENT = /rekening|statement|kontoauszug|auszug|mutasi/i;
const IS_RECEIPT = /struk|nota|receipt|bon\b|kassenbon|quittung/i;
/** Cards the app's Ask screen can show, so the chat there matches this one. */
const APP_CARDS = ["transaction", "event", "goal", "remember", "forget"];

type Ctx = { chatId: number; m: TgMember; l: Lang; sb: SupabaseClient; origin: string };

const saveButtons = (id: string, l: Lang): Keyboard => [
  [
    { text: `✓ ${say("save", l)}`, callback_data: `s:${id}` },
    { text: say("cancel", l), callback_data: `x:${id}` },
  ],
];
const doneButton = (text: string): Keyboard => [[{ text, callback_data: "n" }]];

export async function handleUpdate(update: Update, origin: string) {
  const admin = tgAdmin();
  if (!admin) return console.error("telegram: SUPABASE_SECRET_KEY is missing");

  const msg = update.message;
  const cb = update.callback_query;
  const chat = msg?.chat ?? cb?.message?.chat;
  if (!chat || chat.type !== "private") return;
  const chatId = chat.id;

  // Linking: /start <code> from the Settings button.
  const start = msg?.text?.match(/^\/start(?:\s+(\S+))?/);
  if (start?.[1]) {
    const { data } = await admin.rpc("telegram_claim", { p_code: start[1], p_chat: chatId, p_username: msg?.from?.username ?? "" });
    const who = ((data as { display_name: string; lang: string }[] | null) ?? [])[0];
    await send(chatId, who ? say("linked", lang(who.lang), { name: who.display_name }) : T.bad_code);
    return;
  }

  const m = await memberOfChat(admin, chatId);
  if (!m) {
    if (cb) await answerButton(cb.id);
    await send(chatId, T.not_linked);
    return;
  }
  const l = lang(m.lang);
  if (cb?.data === "n") return void (await answerButton(cb.id));
  if (msg?.text && /^\/(start|help)\b/.test(msg.text)) return void (await send(chatId, say("help", l)));

  const sb = await actAs(admin, m);
  if (!sb) {
    if (cb) await answerButton(cb.id);
    await send(chatId, say("no_session", l));
    return;
  }
  const ctx: Ctx = { chatId, m, l, sb, origin };

  try {
    if (cb) return await onButton(ctx, cb.id, cb.data ?? "", cb.message?.message_id);
    if (msg?.text) return await onText(ctx, msg.text);
    const file = msg && fileOf(msg);
    if (file) return await onFile(ctx, file, msg?.caption ?? "");
    await send(chatId, say("unsupported", l));
  } catch (e) {
    console.error("telegram update failed", String(e));
    await send(chatId, say("failed", l));
  }
}

function fileOf(msg: Msg): { id: string; mime: string; size: number } | null {
  if (msg.photo?.length) {
    const p = msg.photo.at(-1)!; // the largest size
    return { id: p.file_id, mime: "image/jpeg", size: p.file_size ?? 0 };
  }
  const d = msg.document;
  if (d && (d.mime_type === "application/pdf" || d.mime_type?.startsWith("image/"))) return { id: d.file_id, mime: d.mime_type, size: d.file_size ?? 0 };
  return null;
}

async function onText({ chatId, m, l, sb }: Ctx, text: string) {
  await typing(chatId);
  const r = await chat(sb, m, text);
  if ("error" in r) return void (await send(chatId, r.error === "quota" ? say("quota", l) : say("failed", l)));

  const first = r.cards.find((c) => APP_CARDS.includes(c.kind));
  await sb.from("ai_messages").insert([
    { role: "user", text: text.slice(0, 2000) },
    { role: "assistant", text: r.text, cards: { nums: [], next: null, action: "none", ...(first ? { card: first } : {}) } },
  ]);
  if (r.text) await send(chatId, answerHtml({ text: r.text, nums: [], next: null, action: "none" }));
  for (const c of r.cards) await sendCard(chatId, c, l);
}

async function sendCard(chatId: number, c: Card, l: Lang) {
  const body = cardHtml(c.kind, c.args, l);
  if (body) await send(chatId, `${body}\n${say("card_q", l)}`, saveButtons(c.id, l));
}

async function onFile(ctx: Ctx, file: { id: string; mime: string; size: number }, caption: string) {
  const { chatId, l, sb } = ctx;
  if (file.size > MAX_FILE) return void (await send(chatId, say("too_big", l)));
  const pdf = file.mime === "application/pdf";
  const kind: ReadKind | null = IS_ROSTER.test(caption) ? "roster" : IS_STATEMENT.test(caption) && pdf ? "statement" : IS_RECEIPT.test(caption) && !pdf ? "receipt" : null;
  if (kind) return readFile(ctx, kind, file.id, file.mime);

  // Not clear what it is: ask, and keep the file's id until the answer.
  const { data, error } = await sb.from("ai_pending_actions").insert({ tool: "tg_file", args: { file_id: file.id, mime: file.mime } }).select("id").single();
  if (error || !data) return void (await send(chatId, say("failed", l)));
  const row = pdf
    ? [
        { text: say("k_statement", l), callback_data: `k:s:${data.id}` },
        { text: say("k_roster", l), callback_data: `k:o:${data.id}` },
      ]
    : [
        { text: say("k_receipt", l), callback_data: `k:r:${data.id}` },
        { text: say("k_roster", l), callback_data: `k:o:${data.id}` },
      ];
  await send(chatId, say("what_is_it", l), [row]);
}

async function readFile(ctx: Ctx, kind: ReadKind, fileId: string, mime: string) {
  const { chatId, m, l, sb, origin } = ctx;
  await send(chatId, say("reading", l));
  await typing(chatId);
  const bytes = await download(fileId);
  if (!bytes) return void (await send(chatId, say("failed", l)));
  const today = berlinToday().iso;
  const read = await readWithAi(sb, kind, bytes, mime, today);
  if ("error" in read) return void (await send(chatId, read.error));

  if (kind === "statement") {
    const keyboard = [[{ text: say("open_app", l), url: `${origin}${ACTION_PATH.import}` }]];
    return void (await send(chatId, statementHtml(read.result as StatementResult, l), keyboard));
  }

  if (kind === "roster") {
    const r = read.result as RosterResult;
    const shifts = r.shifts.filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^\d{2}:\d{2}$/.test(s.start));
    if (!shifts.length) return void (await send(chatId, say("no_shifts", l)));
    const clean = shifts.map((s) => ({ date: s.date, start: s.start, end: s.end && /^\d{2}:\d{2}$/.test(s.end) ? s.end : null, note: s.note || null }));
    const { data } = await sb.from("ai_pending_actions").insert({ tool: "shifts", args: { title: say("shift_title", l), shifts: clean } }).select("id").single();
    if (!data) return void (await send(chatId, say("failed", l)));
    return void (await send(chatId, rosterHtml({ shifts: clean, warnings: r.warnings }, l), saveButtons(data.id, l)));
  }

  // Receipt: the same rules as Scan receipt in the app.
  const r = read.result as ReceiptResult;
  const [fx, cats, settings] = await Promise.all([
    sb.from("fx_rates").select("idr_per_eur").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("categories").select("id,name"),
    sb.from("member_settings").select("default_visibility").eq("member_id", m.member_id).maybeSingle(),
  ]);
  const rate = (fx.data as { idr_per_eur: number } | null)?.idr_per_eur ?? DEFAULT_IDR_PER_EUR;
  const eur = toEur(-Math.abs(r.total), r.currency.toUpperCase(), rate);
  if (eur == null) return void (await send(chatId, say("foreign", l, { c: r.currency })));
  const date = r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date <= today ? r.date : today;
  const cat = ((cats.data ?? []) as { id: string; name: string }[]).find((c) => c.name === r.category);
  const dv = (settings.data as { default_visibility?: { transactions?: string } } | null)?.default_visibility;
  const items = r.items
    .slice(0, 8)
    .map((i) => `${i.name} ${i.amount.toFixed(2)}`)
    .join(", ");
  const foreign = r.currency.toUpperCase() !== "EUR" ? `${r.currency.toUpperCase()} ${r.total.toLocaleString("en")}` : "";
  const args = {
    payee: r.merchant.slice(0, 200),
    amount: Math.round(eur * 100) / 100,
    date,
    category_id: cat?.id ?? null,
    category: cat?.name ?? null,
    visibility: dv?.transactions === "private" ? "private" : "family",
    note: [foreign, items].filter(Boolean).join(" · ").slice(0, 300),
    tg_file_id: fileId,
    tg_mime: mime,
  };
  const { data } = await sb.from("ai_pending_actions").insert({ tool: "transaction", args }).select("id").single();
  if (!data) return void (await send(chatId, say("failed", l)));
  await send(chatId, receiptHtml({ ...r, category: cat?.name ?? null }, Math.abs(args.amount), date, l), saveButtons(data.id, l));
}

/** Keeps the receipt photo privately, as Scan receipt does. Returns the files row id. */
async function keepPhoto({ sb, m }: Ctx, fileId: string, mime: string, visibility: string): Promise<string | null> {
  const bytes = await download(fileId);
  const { data: me } = await sb.from("members").select("household_id").eq("id", m.member_id).maybeSingle();
  if (!bytes || !me) return null;
  const name = `telegram-${Date.now()}.${mime === "image/png" ? "png" : "jpg"}`;
  const path = `${me.household_id}/${m.member_id}/${name}`;
  const up = await sb.storage.from("files").upload(path, bytes, { contentType: mime, upsert: false });
  if (up.error) return null;
  const { data } = await sb.from("files").insert({ storage_path: path, name, kind: "receipt", mime, size: bytes.length, visibility }).select("id").single();
  return (data?.id as string | undefined) ?? null;
}

async function onButton(ctx: Ctx, cbId: string, data: string, messageId: number | undefined) {
  const { chatId, l, sb, m } = ctx;
  const [op, a, b] = data.split(":");
  const id = op === "k" ? b : a;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return void (await answerButton(cbId));
  const mark = (k: Keyboard) => (messageId ? setButtons(chatId, messageId, k) : null);

  if (op === "k") {
    const kind: ReadKind | undefined = ({ r: "receipt", o: "roster", s: "statement" } as const)[a as "r" | "o" | "s"];
    const { data: row } = await sb.from("ai_pending_actions").update({ status: "skipped" }).eq("id", id).eq("status", "pending").select("args").maybeSingle();
    await answerButton(cbId);
    if (!row || !kind) return void (await mark([]));
    await mark(doneButton(say(kind === "receipt" ? "k_receipt" : kind === "roster" ? "k_roster" : "k_statement", l)));
    const f = row.args as { file_id: string; mime: string };
    return readFile(ctx, kind, f.file_id, f.mime);
  }

  if (op === "s") {
    const { data: p } = await sb.from("ai_pending_actions").select("tool,args,status").eq("id", id).maybeSingle();
    if (!p || p.status !== "pending") {
      await answerButton(cbId, say("gone", l));
      return void (await mark([]));
    }
    const args = p.args as Record<string, unknown>;
    let extra: Record<string, unknown> | undefined;
    if (p.tool === "transaction" && typeof args.tg_file_id === "string") {
      extra = { receipt_file_id: await keepPhoto(ctx, args.tg_file_id, String(args.tg_mime ?? "image/jpeg"), String(args.visibility)) };
    }
    const r = await saveCard(sb, m.member_id, id, undefined, extra);
    await answerButton(cbId, "ok" in r ? say("saved", l) : say(r.error === "gone" ? "gone" : "failed", l));
    if ("ok" in r)
      await mark([
        [
          { text: say("saved", l), callback_data: "n" },
          { text: say("undo", l), callback_data: `u:${id}` },
        ],
      ]);
    return;
  }

  if (op === "x") {
    await sb.from("ai_pending_actions").update({ status: "skipped" }).eq("id", id).eq("status", "pending");
    await answerButton(cbId, say("cancelled", l));
    return void (await mark(doneButton(`✕ ${say("cancel", l)}`)));
  }

  if (op === "u") {
    const r = await undoCard(sb, id);
    await answerButton(cbId, "ok" in r ? say("undone", l) : say("failed", l));
    if ("ok" in r) await mark(doneButton(say("undone", l)));
    return;
  }
  await answerButton(cbId);
}
