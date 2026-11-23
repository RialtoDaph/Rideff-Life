// Server only: whether the ElevenLabs voice is switched on. All of these must be set; otherwise Realtime speaks as before.
// A real ElevenLabs secret starts with "sk_". Pasting the key's ID instead (easy to do, the dashboard shows both) makes every
// sentence fail and Clopar go silent, so a malformed key counts as "off" and OpenAI's own voice keeps working.
let warned = false;
export function ttsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VOICE_TTS !== "elevenlabs" || !env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) return false;
  if (!env.ELEVENLABS_API_KEY.trim().startsWith("sk_")) {
    if (!warned) console.error("ELEVENLABS_API_KEY does not start with sk_ (an API key ID was probably pasted): ElevenLabs voice is off");
    warned = true;
    return false;
  }
  return true;
}
