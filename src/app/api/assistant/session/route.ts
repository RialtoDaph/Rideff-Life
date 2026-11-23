// Opens an assistant session: checks the plan and quota, then mints a short-lived
// client token for the realtime API. The permanent key stays on this server.

import { createHash } from "node:crypto";
import { TOOLS } from "@/lib/assistant-tools";
import { SHOW_TOOL } from "@/lib/show";
import { buildInstructions, memoriesFor, MAX_MEMORIES, type MemoryFact } from "@/lib/assistant-prompt";
import { berlinToday } from "@/lib/money";
import { AI_NAME } from "@/lib/nav";
import { authorize } from "@/lib/server-auth";
import { agentSignedUrl, agentsEnabled } from "@/lib/agent-server";
import { ttsEnabled } from "@/lib/tts-server";

const MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1";
const fail = (code: string, status: number) => Response.json({ code }, { status });

export async function POST(req: Request) {
  const agentsOn = agentsEnabled();
  if (!process.env.OPENAI_API_KEY && !agentsOn) return fail("not_configured", 503);
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;
  const { sb, userId } = auth;

  const body = (await req.json().catch(() => null)) as { mode?: string; locale?: string } | null;
  const voice = body?.mode === "voice";
  // Typed sessions only ever use OpenAI: without its key there is nothing to open, and no session row may be created for it.
  if (!voice && !process.env.OPENAI_API_KEY) return fail("not_configured", 503);

  // Asked for before the session row exists: a slow or failed ElevenLabs then never leaves an open row behind
  // (an open voice row is later billed up to an hour), and the Realtime fallback below still answers in time.
  const signedUrl = voice && agentsOn ? await agentSignedUrl() : null;

  const { data: opened, error } = await sb.rpc("ai_session_start", { p_mode: voice ? "voice" : "text" });
  if (error) {
    const quota = ["voice_quota", "ai_quota"].find((q) => error.message.includes(q));
    return fail(quota ?? "failed", quota ? 402 : 502);
  }
  const info = opened as { session_id: string; plan: string; voice_left: number; ai_left: number | null };

  const [m, s] = await Promise.all([
    sb.from("members").select("id,display_name").order("sort"),
    sb.from("member_settings").select("ai_name,voice,memory_on,lang").eq("member_id", userId).maybeSingle(),
  ]);
  const members = (m.data ?? []) as { id: string; display_name: string }[];
  const settings = s.data as { ai_name: string | null; voice: string; memory_on: boolean; lang: string } | null;
  const memoryOn = settings?.memory_on ?? true;

  // Memory off means no load at all. RLS returns only this person's rows and shared rows.
  let memories: MemoryFact[] = [];
  if (memoryOn) {
    const { data } = await sb.from("ai_memories").select("id,text,scope,owner_id").order("created_at", { ascending: false }).limit(MAX_MEMORIES);
    memories = memoriesFor((data ?? []) as MemoryFact[], userId);
  }

  // Tells the transcriber which language is spoken: Indonesian and German are otherwise guessed from the first words.
  const spokenLang = ((l) => (l === "de" || l === "id" || l === "en" ? l : "en"))(body?.locale ?? settings?.lang);

  const aiName = settings?.ai_name || AI_NAME;
  const instructions = buildInstructions({
    aiName,
    speaker: members.find((x) => x.id === userId)?.display_name ?? "the person",
    members: members.map((x) => x.display_name),
    locale: body?.locale ?? settings?.lang ?? "en",
    today: berlinToday().iso,
    memories,
    memoryOn,
  });

  // ElevenAgents: ElevenLabs listens, thinks and speaks. The tools below still run on our server through /api/assistant/tool.
  // If it cannot be opened, Realtime (when its key is set) takes the call instead of leaving the person without a voice.
  if (voice && agentsOn) {
    if (signedUrl) return Response.json({ engine: "elevenagents", token: "", signed_url: signedUrl, instructions, language: spokenLang, spoken: true, tts: false, ...info });
    if (!process.env.OPENAI_API_KEY) {
      await sb.rpc("ai_session_end", { p_session: info.session_id });
      return fail("failed", 502);
    }
  }

  const spoken = voice || settings?.voice === "audio" || settings?.voice === "both";
  // Spike: the model writes the answer and ElevenLabs speaks it. Off unless VOICE_TTS=elevenlabs and its key and voice are set.
  const tts = voice && ttsEnabled(); // typed sessions with a spoken setting keep the OpenAI voice
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": createHash("sha256").update(userId).digest("hex"),
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: MODEL,
        instructions,
        tools: [...TOOLS, SHOW_TOOL],
        tool_choice: "auto",
        output_modalities: [spoken && !tts ? "audio" : "text"],
        audio: {
          input: voice ? { transcription: { model: "gpt-4o-mini-transcribe", language: spokenLang, ...(tts ? { prompt: `Names: ${aiName}, ${members.map((x) => x.display_name).join(", ")}. Topics: budget, jadwal, tabungan, rideff.` } : {}) }, turn_detection: { type: "semantic_vad" } } : { turn_detection: null },
          ...(tts ? {} : { output: { voice: "marin" } }),
        },
      },
    }),
  }).catch(() => null);

  const secret = res?.ok ? ((await res.json().catch(() => null)) as { value?: string } | null) : null;
  if (!secret?.value) {
    console.error("realtime token failed", MODEL, res?.status, (await res?.text().catch(() => ""))?.slice(0, 500));
    await sb.rpc("ai_session_end", { p_session: info.session_id });
    return fail("failed", 502);
  }
  return Response.json({ token: secret.value, spoken, tts, ...info });
}
