// Speaks one sentence of Clopar's reply with ElevenLabs. The key stays on this server.
// Only for a live session of the signed-in person, and only short text: it must not become a free text-to-speech endpoint.

import { authorize } from "@/lib/server-auth";
import { ttsEnabled } from "@/lib/tts-server";

const MAX_CHARS = 600;
const MAX_HOURLY_CHARS = 30000; // per person and hour, so opening new sessions does not reset it
const spent = new Map<string, { t0: number; chars: number }>();
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5";

export async function POST(req: Request) {
  if (!ttsEnabled()) return Response.json({ code: "not_configured" }, { status: 503 });
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;
  const body = (await req.json().catch(() => null)) as { session_id?: unknown; text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  if (typeof body?.session_id !== "string" || !text) return Response.json({ code: "bad_request" }, { status: 400 });

  // Row Level Security shows only this person's own sessions. Only a live voice session from the last hour may speak.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: session } = await auth.sb.from("ai_sessions").select("id").eq("id", body.session_id).eq("mode", "voice").is("ended_at", null).gt("started_at", since).maybeSingle();
  if (!session) return Response.json({ code: "no_session" }, { status: 403 });

  // A ceiling on what one person may spend. Per server instance, so a soft limit: it stops a loop, not a determined abuser.
  const now = Date.now();
  const mine = spent.get(auth.userId);
  const slot = mine && now - mine.t0 < 60 * 60 * 1000 ? mine : { t0: now, chars: 0 };
  if (slot.chars + text.length > MAX_HOURLY_CHARS) return Response.json({ code: "limit" }, { status: 429 });
  slot.chars += text.length;
  spent.set(auth.userId, slot);

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(process.env.ELEVENLABS_VOICE_ID!)}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res?.ok || !res.body) {
    console.error("elevenlabs tts failed", res?.status, (await res?.text().catch(() => ""))?.slice(0, 300));
    return Response.json({ code: "failed" }, { status: 502 });
  }
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
