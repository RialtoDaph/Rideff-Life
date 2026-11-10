// What the bot says, in each person's app language. Plain functions, no I/O.

import type { Answer } from "@/lib/ask-schema";
import type { ReceiptResult, RosterResult, StatementResult } from "@/lib/ai-read-schema";
import { escapeHtml as h } from "./api";

export type Lang = "en" | "de" | "id";
export const lang = (l: string | null | undefined): Lang => (l === "de" || l === "id" ? l : "en");

const L = <T>(en: T, de: T, id: T) => ({ en, de, id });

export const T = {
  save: L("Save", "Speichern", "Simpan"),
  cancel: L("Cancel", "Abbrechen", "Batal"),
  undo: L("Undo", "Rückgängig", "Urungkan"),
  open_app: L("Open in the app", "In der App öffnen", "Buka di app"),
  saved: L("✓ Saved", "✓ Gespeichert", "✓ Tersimpan"),
  cancelled: L("Cancelled, nothing saved.", "Abgebrochen, nichts gespeichert.", "Dibatalkan, tidak ada yang disimpan."),
  undone: L("↩︎ Undone", "↩︎ Rückgängig gemacht", "↩︎ Dibatalkan"),
  gone: L("This was already handled.", "Das wurde schon erledigt.", "Ini sudah diproses."),
  failed: L("That did not work. Please try again.", "Das hat nicht geklappt. Bitte nochmal versuchen.", "Gagal. Coba lagi ya."),
  reading: L("Reading it…", "Ich lese…", "Sedang dibaca…"),
  what_is_it: L("What is this?", "Was ist das?", "Ini apa?"),
  k_receipt: L("🧾 Receipt", "🧾 Kassenbon", "🧾 Struk"),
  k_roster: L("📅 Work roster", "📅 Dienstplan", "📅 Jadwal kerja"),
  k_statement: L("🏦 Bank statement", "🏦 Kontoauszug", "🏦 Rekening koran"),
  too_big: L("The file is larger than 20 MB.", "Die Datei ist größer als 20 MB.", "File lebih dari 20 MB."),
  unsupported: L(
    "I can read text, photos and PDFs. Voice messages and other files don't work yet.",
    "Ich kann Text, Fotos und PDFs lesen. Sprachnachrichten und andere Dateien gehen noch nicht.",
    "Aku bisa baca teks, foto, dan PDF. Pesan suara dan file lain belum bisa.",
  ),
  quota: L(
    "This month's AI messages are used up. More messages come with Life Plus (Settings → Plan).",
    "Die KI-Nachrichten für diesen Monat sind aufgebraucht. Mehr gibt es mit Life Plus (Einstellungen → Tarif).",
    "Kuota pesan AI bulan ini sudah habis. Paket Life Plus punya lebih banyak (Pengaturan → Paket).",
  ),
  no_session: L(
    "I could not open your account just now. Please try again in a minute.",
    "Ich konnte dein Konto gerade nicht öffnen. Bitte gleich nochmal versuchen.",
    "Akunmu belum bisa dibuka. Coba lagi sebentar lagi ya.",
  ),
  low_conf: L("Hard to read, please check the amount and date.", "Schwer lesbar, bitte Betrag und Datum prüfen.", "Agak sulit dibaca, cek lagi jumlah dan tanggalnya."),
  receipt_q: L("Save this expense?", "Diese Ausgabe speichern?", "Simpan pengeluaran ini?"),
  no_category: L("no category", "keine Kategorie", "tanpa kategori"),
  foreign: L(
    "The receipt is in {c}. I can only convert Rupiah; please add it in the app in euro.",
    "Der Bon ist in {c}. Ich kann nur Rupiah umrechnen; bitte in der App in Euro eintragen.",
    "Struk ini dalam {c}. Aku hanya bisa mengonversi Rupiah; tambahkan di app dalam euro ya.",
  ),
  no_shifts: L("I found no shifts on this.", "Ich habe keine Schichten gefunden.", "Aku tidak menemukan shift di sini."),
  shifts_q: L("Save {n} shifts?", "{n} Schichten speichern?", "Simpan {n} shift?"),
  shift_title: L("Bar shift", "Barschicht", "Shift bar"),
  statement: L(
    "{bank}: {n} transactions, {from} – {to}\nIn {in} · Out {out}\n\nTo check and save them, open Bank import in the app.",
    "{bank}: {n} Buchungen, {from} – {to}\nEin {in} · Aus {out}\n\nZum Prüfen und Speichern öffne den Bankimport in der App.",
    "{bank}: {n} transaksi, {from} – {to}\nMasuk {in} · Keluar {out}\n\nUntuk memeriksa dan menyimpannya, buka Impor bank di app.",
  ),
  card_q: L("Tap Save to add it.", "Tippe auf Speichern, um es hinzuzufügen.", "Tekan Simpan untuk menambahkannya."),
  linked: L(
    "Hi {name}! This chat is now linked to rideff Life. Send me a photo of a receipt or your work roster, a PDF statement, or just ask, e.g. “How much is left for food this month?”. Nothing is saved until you tap Save.",
    "Hallo {name}! Dieser Chat ist jetzt mit rideff Life verbunden. Schick mir ein Foto vom Kassenbon oder Dienstplan, einen Kontoauszug als PDF, oder frag einfach, z. B. „Wie viel ist diesen Monat noch fürs Essen übrig?“. Gespeichert wird erst, wenn du auf Speichern tippst.",
    "Halo {name}! Chat ini sudah terhubung ke rideff Life. Kirim foto struk atau jadwal kerja, PDF rekening koran, atau langsung tanya, misalnya “Sisa budget makan bulan ini berapa?”. Tidak ada yang disimpan sebelum kamu tekan Simpan.",
  ),
  help: L(
    "What I can do:\n• 🧾 Photo of a receipt → an expense to save\n• 📅 Photo or PDF of your roster → your shifts\n• 🏦 PDF statement → a summary\n• Questions about money, goals and your week\n• “Spent €25 at Rewe” → an entry to save\nReminders and the morning briefing come here too.",
    "Was ich kann:\n• 🧾 Foto vom Kassenbon → Ausgabe zum Speichern\n• 📅 Foto oder PDF vom Dienstplan → deine Schichten\n• 🏦 Kontoauszug als PDF → Zusammenfassung\n• Fragen zu Geld, Zielen und deiner Woche\n• „25 € bei Rewe ausgegeben“ → Eintrag zum Speichern\nErinnerungen und das Morgen-Briefing kommen auch hierher.",
    "Yang bisa aku bantu:\n• 🧾 Foto struk → pengeluaran untuk disimpan\n• 📅 Foto atau PDF jadwal kerja → shift kamu\n• 🏦 PDF rekening koran → ringkasan\n• Pertanyaan soal uang, target, dan minggu ini\n• “Belanja 25 euro di Rewe” → catatan untuk disimpan\nPengingat dan briefing pagi juga dikirim ke sini.",
  ),
  // Shown before we know who is writing, so in all three languages.
  not_linked:
    "This chat is not linked yet. Open rideff Life → Settings → Telegram and tap “Connect Telegram”.\n\nDieser Chat ist noch nicht verbunden: rideff Life → Einstellungen → Telegram → „Telegram verbinden“.\n\nChat ini belum terhubung: buka rideff Life → Pengaturan → Telegram → “Hubungkan Telegram”.",
  bad_code:
    "This link has expired. Make a new one in Settings → Telegram.\n\nDieser Link ist abgelaufen. Erstelle einen neuen unter Einstellungen → Telegram.\n\nLink ini sudah kedaluwarsa. Buat yang baru di Pengaturan → Telegram.",
};

export const say = (key: Exclude<keyof typeof T, "not_linked" | "bad_code">, l: Lang, vars: Record<string, string | number> = {}) =>
  T[key][l].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

const TAG: Record<Lang, string> = { en: "en-IE", de: "de-DE", id: "id-ID" };
export const eur = (n: number, l: Lang) => new Intl.NumberFormat(TAG[l], { style: "currency", currency: "EUR" }).format(n);
export const day = (iso: string, l: Lang) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(TAG[l], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** An answer from Ask Clopar or the briefing, as Telegram HTML. */
export function answerHtml(a: Answer) {
  const nums = a.nums.map((n) => `• ${h(n.label)}: <b>${h(n.value)}</b>`).join("\n");
  return [h(a.text), nums, a.next ? `→ ${h(a.next)}` : ""].filter(Boolean).join("\n\n");
}

export function receiptHtml(r: ReceiptResult, amountEur: number, date: string, l: Lang) {
  const items = r.items
    .slice(0, 8)
    .map((i) => `  ${h(i.name)} ${i.amount.toFixed(2)}`)
    .join("\n");
  return [
    `🧾 <b>${h(r.merchant || "?")}</b>`,
    `${day(date, l)} · <b>${eur(amountEur, l)}</b> · ${h(r.category ?? say("no_category", l))}`,
    items,
    r.confidence === "low" ? `⚠️ ${say("low_conf", l)}` : "",
    say("receipt_q", l),
  ]
    .filter(Boolean)
    .join("\n");
}

export function rosterHtml(r: RosterResult, l: Lang) {
  const lines = r.shifts.map((s) => `• ${day(s.date, l)} ${s.start}${s.end ? `–${s.end}` : ""}${s.note ? ` (${h(s.note)})` : ""}`);
  const warn = r.warnings.map((w) => `⚠️ ${h(w)}`);
  return [`📅 ${lines.join("\n")}`, ...warn, say("shifts_q", l, { n: r.shifts.length })].join("\n");
}

export function statementHtml(r: StatementResult, l: Lang) {
  const tx = r.transactions;
  const dates = tx.map((t) => t.date).sort();
  const money = (n: number) => (r.currency.toUpperCase() === "EUR" ? eur(n, l) : `${r.currency} ${n.toFixed(2)}`);
  const body = say("statement", l, {
    bank: h(r.bank ?? "🏦"),
    n: tx.length,
    from: dates[0] ? day(dates[0], l) : "–",
    to: dates.at(-1) ? day(dates.at(-1)!, l) : "–",
    in: money(tx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)),
    out: money(-tx.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)),
  });
  return [body, ...r.warnings.map((w) => `⚠️ ${h(w)}`)].join("\n");
}

/** What an assistant card (propose_* / remember / forget) would save. */
export function cardHtml(kind: string, a: Record<string, unknown>, l: Lang) {
  const s = (v: unknown) => h(String(v ?? ""));
  switch (kind) {
    case "transaction":
      return `💶 <b>${s(a.payee)}</b> · ${eur(Number(a.amount), l)}\n${day(String(a.date), l)}${a.category ? ` · ${s(a.category)}` : ""}${a.visibility === "private" ? " · 🔒" : ""}`;
    case "event":
      return `📅 <b>${s(a.title)}</b>\n${day(String(a.date), l)}${a.time ? ` ${s(a.time)}` : ""}${a.visibility === "private" ? " · 🔒" : ""}`;
    case "goal":
      return `🎯 <b>${s(a.name)}</b> · ${eur(Number(a.target), l)}${Number(a.monthly) > 0 ? ` (${eur(Number(a.monthly), l)}/mo)` : ""}`;
    case "remember":
      return `🧠 ${s(a.text)}${a.scope === "shared" ? " · 👥" : ""}`;
    case "forget":
      return `🗑 ${s(a.text)}`;
    default:
      return "";
  }
}

/** Screens an answer can point to: app paths (the locale is added by the app). */
export const ACTION_PATH: Record<string, string> = {
  whatif: "/whatif",
  budget: "/budget",
  debts: "/debts",
  subs: "/subs",
  remit: "/remit",
  tax: "/tax",
  invest: "/invest",
  sim: "/sim",
  week: "/week",
  shifts: "/shifts",
  ygoals: "/ygoals",
  import: "/import",
  report: "/report",
  setup: "/setup",
};
