// Server only: the ElevenAgents voice engine. ElevenLabs then does listening, thinking and speaking in one pipeline,
// instead of OpenAI Realtime (ears and brain) plus ElevenLabs TTS (mouth). Tools still run here, as the signed-in person.
// Off unless VOICE_ENGINE=elevenagents with an ElevenLabs key (sk_...) and the agent id. A bad setup counts as off.

type Env = Record<string, string | undefined>;

export function agentsEnabled(env: Env = process.env): boolean {
  if (env.VOICE_ENGINE !== "elevenagents" || !env.ELEVENLABS_API_KEY || !env.ELEVENLABS_AGENT_ID) return false;
  return env.ELEVENLABS_API_KEY.trim().startsWith("sk_");
}

/** A one-time wss URL for this person's conversation: the browser never sees the API key, and the agent only accepts signed starts. */
export async function agentSignedUrl(env: Env = process.env, fetcher: typeof fetch = fetch): Promise<string | null> {
  const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(env.ELEVENLABS_AGENT_ID ?? "")}`;
  const res = await fetcher(url, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY ?? "" }, signal: AbortSignal.timeout(2500) }).catch(() => null);
  if (!res?.ok) {
    console.error("elevenlabs signed url failed", res?.status, (await res?.text().catch(() => ""))?.slice(0, 300));
    return null;
  }
  const body = (await res.json().catch(() => null)) as { signed_url?: string } | null;
  return body?.signed_url?.startsWith("wss://") ? body.signed_url : null;
}
