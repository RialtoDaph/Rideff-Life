// Reads today's briefing aloud with the same ElevenLabs voice as Clopar. Signed-in people only, short text only,
// and a per-person hourly ceiling, so it cannot become a free text-to-speech endpoint.

import { authorize } from "@/lib/server-auth";

const MAX_CHARS = 700;
const MAX_HOURLY_CHARS = 8000;
const spent = new Map<string, { t0: number; chars: number }>();
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5";

export async function POST(req: Request) {
  // Secrets pasted into a dashboard often carry quotes or a newline: strip them.
  const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, "").trim();
  const key = clean(process.env.ELEVENLABS_API_KEY);
  const voice = clean(process.env.ELEVENLABS_VOICE_ID);
  const why = !key ? "no_key" : !key.startsWith("sk_") ? "key_not_sk" : !voice ? "no_voice" : null;
  if (why) {
    console.error("brief-tts not configured:", why); // the reason stays in the server log, never in the response
    return Response.json({ code: "not_configured" }, { status: 503 });
  }
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  if (!text) return Response.json({ code: "bad_request" }, { status: 400 });

  const now = Date.now();
  const mine = spent.get(auth.userId);
  const slot = mine && now - mine.t0 < 60 * 60 * 1000 ? mine : { t0: now, chars: 0 };
  if (slot.chars + text.length > MAX_HOURLY_CHARS) return Response.json({ code: "limit" }, { status: 429 });
  slot.chars += text.length;
  spent.set(auth.userId, slot);

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice!)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key!, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res?.ok || !res.body) {
    console.error("elevenlabs brief tts failed", res?.status, (await res?.text().catch(() => ""))?.slice(0, 300));
    return Response.json({ code: "failed" }, { status: 502 });
  }
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
