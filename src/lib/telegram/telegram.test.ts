import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Telegram API and sign-in are replaced; what the bot sends is recorded. ---
const sent: { chat: number | string; text: string; keyboard?: unknown }[] = [];
vi.mock("./api", async (orig) => {
  const real = await orig<typeof import("./api")>();
  return {
    ...real,
    send: vi.fn(async (chat: number, text: string, keyboard?: unknown) => {
      sent.push({ chat, text, keyboard });
      return { message_id: 1 };
    }),
    typing: vi.fn(),
    setButtons: vi.fn(),
    answerButton: vi.fn(),
    download: vi.fn(async () => new Uint8Array([1, 2, 3])),
  };
});

type Row = Record<string, unknown>;
const calls: { table: string; op: string; values?: unknown; filters: [string, unknown][] }[] = [];
/** A tiny stand-in for the Supabase query builder: records what was asked. */
function fakeDb(answers: Record<string, Row | null> = {}) {
  return {
    rpc: vi.fn(async (fn: string) => ({ data: answers[`rpc:${fn}`] ?? null, error: null })),
    from(table: string) {
      const call = { table, op: "select", values: undefined as unknown, filters: [] as [string, unknown][] };
      calls.push(call);
      const q = {
        select: () => q,
        insert: (v: unknown) => ((call.op = "insert"), (call.values = v), q),
        update: (v: unknown) => ((call.op = "update"), (call.values = v), q),
        eq: (k: string, v: unknown) => (call.filters.push([k, v]), q),
        order: () => q,
        limit: () => q,
        single: async () => ({ data: answers[`${call.op}:${table}`] ?? null, error: null }),
        maybeSingle: async () => ({ data: answers[`${call.op}:${table}`] ?? null, error: null }),
        then: (r: (x: unknown) => void) => r({ data: null, error: null }),
      };
      return q;
    },
  };
}

let admin: ReturnType<typeof fakeDb>;
let user: ReturnType<typeof fakeDb>;
const member = { member_id: "m1", email: "a@b.c", display_name: "Alex", lang: "id", ai_name: null, memory_on: true };
let linked: typeof member | null = member;

vi.mock("./session", () => ({
  tgAdmin: () => admin,
  memberOfChat: vi.fn(async () => linked),
  actAs: vi.fn(async () => user),
}));
vi.mock("./chat", () => ({ chat: vi.fn(async () => ({ text: "Sisa €120.", cards: [] })) }));
vi.mock("@/lib/ai-read-server", () => ({ readWithAi: vi.fn() }));

const { handleUpdate } = await import("./bot");
const { answerHtml, cardHtml, lang, say, statementHtml } = await import("./text");
const { derivedSecret, secretMatches } = await import("./api");

const msg = (extra: Row, chatType = "private") => ({ update_id: 1, message: { message_id: 5, chat: { id: 42, type: chatType }, ...extra } });

beforeEach(() => {
  sent.length = 0;
  calls.length = 0;
  linked = member;
  admin = fakeDb({ "rpc:telegram_claim": [{ member_id: "m1", display_name: "Mira", lang: "de" }] as unknown as Row });
  user = fakeDb({ "insert:ai_pending_actions": { id: "11111111-1111-1111-1111-111111111111" } });
});

describe("telegram bot", () => {
  it("ignores group chats", async () => {
    await handleUpdate(msg({ text: "hi" }, "group") as never, "https://x.test");
    expect(sent).toHaveLength(0);
  });

  it("tells an unknown chat how to link, and reads nothing", async () => {
    linked = null;
    await handleUpdate(msg({ text: "Sisa budget?" }) as never, "https://x.test");
    expect(sent[0].text).toContain("Settings → Telegram");
    expect(calls).toHaveLength(0);
  });

  it("links with the code from Settings and greets in the member's language", async () => {
    await handleUpdate(msg({ text: "/start cabc123", from: { username: "mira" } }) as never, "https://x.test");
    expect(admin.rpc).toHaveBeenCalledWith("telegram_claim", { p_code: "cabc123", p_chat: 42, p_username: "mira" });
    expect(sent[0].text).toContain("Hallo Mira");
  });

  it("answers a question and keeps both turns in the app's chat", async () => {
    await handleUpdate(msg({ text: "Sisa budget makan?" }) as never, "https://x.test");
    expect(sent[0].text).toBe("Sisa €120.");
    const insert = calls.find((c) => c.table === "ai_messages" && c.op === "insert");
    expect((insert?.values as Row[]).map((r) => r.role)).toEqual(["user", "assistant"]);
  });

  it("asks what a photo is when the caption does not say, offering receipt and roster", async () => {
    await handleUpdate(msg({ photo: [{ file_id: "small" }, { file_id: "big" }] }) as never, "https://x.test");
    const pending = calls.find((c) => c.table === "ai_pending_actions" && c.op === "insert");
    expect(pending?.values).toEqual({ tool: "tg_file", args: { file_id: "big", mime: "image/jpeg" } });
    const buttons = (sent[0].keyboard as { callback_data: string }[][])[0].map((b) => b.callback_data);
    expect(buttons).toEqual(["k:r:11111111-1111-1111-1111-111111111111", "k:o:11111111-1111-1111-1111-111111111111"]);
  });

  it("Cancel only skips a card that is still waiting", async () => {
    await handleUpdate({ update_id: 2, callback_query: { id: "q", data: "x:11111111-1111-1111-1111-111111111111", message: { message_id: 9, chat: { id: 42, type: "private" } } } } as never, "https://x.test");
    const upd = calls.find((c) => c.table === "ai_pending_actions" && c.op === "update");
    expect(upd?.values).toEqual({ status: "skipped" });
    expect(upd?.filters).toEqual([
      ["id", "11111111-1111-1111-1111-111111111111"],
      ["status", "pending"],
    ]);
  });

  it("refuses a button with a malformed id", async () => {
    await handleUpdate({ update_id: 3, callback_query: { id: "q", data: "s:'; drop", message: { message_id: 9, chat: { id: 42, type: "private" } } } } as never, "https://x.test");
    expect(calls).toHaveLength(0);
  });
});

describe("telegram text", () => {
  it("escapes HTML from the AI and the data", () => {
    expect(answerHtml({ text: "a <b> & c", nums: [{ label: "<x>", value: "€1" }], next: null, action: "none" })).toBe("a &lt;b&gt; &amp; c\n\n• &lt;x&gt;: <b>€1</b>");
  });

  it("falls back to English and fills in values", () => {
    expect(lang("fr")).toBe("en");
    expect(say("shifts_q", "id", { n: 3 })).toBe("Simpan 3 shift?");
  });

  it("sums a statement's money in and out", () => {
    const s = statementHtml(
      {
        bank: "Sparkasse",
        currency: "EUR",
        warnings: [],
        transactions: [
          { date: "2026-10-02", amount: 2000, payee: "Lohn", purpose: "" },
          { date: "2026-10-05", amount: -45.5, payee: "Rewe", purpose: "" },
          { date: "2026-10-09", amount: -4.5, payee: "Bäcker", purpose: "" },
        ],
      },
      "en",
    );
    expect(s).toContain("Sparkasse: 3 transactions");
    expect(s).toContain("In €2,000.00 · Out €50.00");
  });

  it("shows a private entry with a lock", () => {
    expect(cardHtml("transaction", { payee: "Rewe", amount: -25, date: "2026-11-10", category: "Food", visibility: "private" }, "en")).toContain("🔒");
  });
});

describe("telegram secrets", () => {
  it("accepts only the secret made from the bot token", () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456:abcdefghijklmnopqrstuvwxyzABCDEFGH";
    expect(secretMatches(derivedSecret("webhook"), "webhook")).toBe(true);
    expect(secretMatches(derivedSecret("notify"), "webhook")).toBe(false);
    expect(secretMatches(null, "notify")).toBe(false);
  });
});
