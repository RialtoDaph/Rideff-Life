// Server only. A typed message in Telegram: Clopar answers from the person's data
// (the same view as Ask Clopar) and may call the assistant's tools. Tools that would
// change data only leave a card; the person decides with the Save button.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildContext } from "@/lib/ask-context";
import { loadAskRows, MODEL } from "@/lib/ask-server";
import { buildInstructions, memoriesFor, MAX_MEMORIES, type MemoryFact } from "@/lib/assistant-prompt";
import { runTool, TOOLS, type Card } from "@/lib/assistant-tools";
import { berlinToday } from "@/lib/money";
import { AI_NAME } from "@/lib/nav";
import type { TgMember } from "./session";

const TELEGRAM_NOTE = `You are chatting in Telegram. Write plain text: no Markdown, no tables, no headings. Short paragraphs; a few "• " lines are fine for lists.
The DATA message holds what this person may see. Use it for numbers, or call a tool. When the person says they spent, earned, planned or want to remember something, call the matching propose tool right away with what you know (today's date if none is given), then say in one short sentence that a card with Save is below.`;

export type ChatReply = { text: string; cards: Card[] } | { error: "quota" | "data" | "ai" };

export async function chat(sb: SupabaseClient, m: TgMember, question: string): Promise<ChatReply> {
  const { error: quota } = await sb.rpc("ai_message_used");
  if (quota?.message.includes("ai_quota")) return { error: "quota" };

  const [rows, past, mem] = await Promise.all([
    loadAskRows(sb, m.member_id),
    sb.from("ai_messages").select("role,text").order("created_at", { ascending: false }).limit(6),
    m.memory_on ? sb.from("ai_memories").select("id,text,scope,owner_id").order("created_at", { ascending: false }).limit(MAX_MEMORIES) : null,
  ]);
  if (!rows) return { error: "data" };
  const today = berlinToday();
  const context = buildContext(rows, m.member_id, today, m.member_id);
  const system = [
    buildInstructions({
      aiName: m.ai_name || AI_NAME,
      speaker: m.display_name,
      members: rows.members.map((x) => x.display_name),
      locale: m.lang,
      today: today.iso,
      memories: memoriesFor((mem?.data ?? []) as MemoryFact[], m.member_id),
      memoryOn: m.memory_on,
    }),
    TELEGRAM_NOTE,
  ].join("\n\n");

  const history = ((past.data ?? []) as { role: "user" | "assistant"; text: string }[])
    .reverse()
    .map((t) => ({ role: t.role, content: t.text.slice(0, 2000) }));
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `DATA (what ${context.asked_by} can see):\n${JSON.stringify(context)}` },
    { role: "assistant", content: "Understood. I will only use this data." },
    ...history,
    { role: "user", content: question.slice(0, 2000) },
  ];
  const tools = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema }));

  const client = new Anthropic();
  const cards: Card[] = [];
  try {
    let msg: Anthropic.Beta.BetaMessage | null = null;
    for (let turn = 0; turn < 6; turn++) {
      msg = await client.beta.messages
        .stream({
          model: MODEL,
          max_tokens: 8000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          system,
          tools,
          messages,
        })
        .finalMessage();
      if (msg.stop_reason !== "tool_use") break;
      messages.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const b of msg.content) {
        if (b.type !== "tool_use") continue;
        const r = await runTool(sb, m.member_id, b.name, (b.input ?? {}) as Record<string, unknown>);
        if (r.card) cards.push(r.card);
        results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(r.output) });
      }
      messages.push({ role: "user", content: results });
    }
    const text = (msg?.content ?? [])
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("\n")
      .trim();
    if (!text && !cards.length) return { error: "ai" };
    return { text, cards };
  } catch (e) {
    console.error("telegram chat failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
    return { error: "ai" };
  }
}
