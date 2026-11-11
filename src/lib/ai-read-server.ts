// Server only. Reads a receipt photo, a PDF bank statement or a work roster with
// Claude, for the app (/api/read) and Telegram. The API key never reaches a phone.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RECEIPT_PROMPT, ROSTER_PROMPT, STATEMENT_PROMPT, receiptSchema, rosterSchema, statementSchema } from "@/lib/ai-read-schema";
import { MODEL } from "@/lib/ask-server";

export type ReadKind = "receipt" | "statement" | "roster";
export type ReadOutcome = { result: unknown } | { error: string; status: number };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** `today` is YYYY-MM-DD, for rosters that print no year; `person` is whose roster it is. */
export async function readWithAi(
  sb: SupabaseClient,
  kind: ReadKind,
  bytes: Uint8Array,
  mime: string,
  today: string,
  person?: string,
): Promise<ReadOutcome> {
  const data = Buffer.from(bytes).toString("base64");

  let source: Anthropic.Beta.BetaContentBlockParam;
  if (mime === "application/pdf" && kind !== "receipt") {
    source = { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  } else if (kind === "statement") {
    return { error: "Please choose a PDF file.", status: 415 };
  } else {
    const type = IMAGE_TYPES.find((t) => t === mime);
    if (!type) return { error: "Please choose a photo or screenshot (JPEG or PNG).", status: 415 };
    source = { type: "image", source: { type: "base64", media_type: type, data } };
  }

  // A cap per person per day (public.ai_use), so one account cannot run up the bill.
  const { error: quota } = await sb.rpc("ai_use", { p_kind: "read" });
  if (quota) {
    return quota.message.includes("ai_quota")
      ? { error: "That is all the files Clopar can read for you today. Try again tomorrow.", status: 429 }
      : { error: "Could not check your plan. Try again.", status: 502 };
  }

  let task: { system: string; schema: Record<string, unknown>; text: string; maxTokens: number; effort: "low" | "medium" };
  if (kind === "receipt") {
    // Categories of this household, so receipts get one of yours.
    const { data: cats } = await sb.from("categories").select("name").order("sort");
    const names = (cats ?? []).map((c) => c.name as string);
    task = {
      system: RECEIPT_PROMPT,
      schema: receiptSchema(names),
      text: `Read this receipt. Categories to choose from: ${names.join(", ") || "(none)"}.`,
      maxTokens: 8000,
      effort: "low",
    };
  } else if (kind === "roster") {
    task = { system: ROSTER_PROMPT, schema: rosterSchema(), text: `Today is ${today}.${person ? ` The person is called ${person.slice(0, 60)}.` : ""} Read the shifts.`, maxTokens: 16000, effort: "low" };
  } else {
    task = {
      system: STATEMENT_PROMPT,
      schema: statementSchema(),
      text: "Read every booked transaction in this bank statement.",
      maxTokens: 64000,
      effort: "medium",
    };
  }

  const client = new Anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: task.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: task.effort, format: { type: "json_schema", schema: task.schema } },
      system: task.system,
      messages: [{ role: "user", content: [source, { type: "text", text: task.text }] }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return { error: "The AI could not read this file.", status: 422 };
    if (msg.stop_reason === "max_tokens")
      return { error: kind === "statement" ? "The statement is too long. Split it into shorter months." : "The file is too long to read at once.", status: 422 };
    const text = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
    if (!text) return { error: "The AI gave no answer. Try again.", status: 502 };
    return { result: JSON.parse(text) };
  } catch (e) {
    console.error("read failed", kind, e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
    if (e instanceof Anthropic.AuthenticationError) return { error: "The AI key is not valid. Check it in Vercel.", status: 503 };
    if (e instanceof Anthropic.RateLimitError) return { error: "The AI is busy. Try again in a minute.", status: 429 };
    if (e instanceof Anthropic.BadRequestError)
      return { error: "The AI could not handle this request. If it keeps happening, check the credit in the Anthropic console.", status: 422 };
    if (e instanceof Anthropic.APIError) return { error: `The AI is not reachable right now (${e.status}).`, status: 502 };
    return { error: "Something went wrong while reading.", status: 500 };
  }
}
