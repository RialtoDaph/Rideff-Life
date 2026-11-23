// Server only: whether the ElevenLabs voice is switched on. All of these must be set; otherwise Realtime speaks as before.
export const ttsEnabled = () => process.env.VOICE_TTS === "elevenlabs" && !!process.env.ELEVENLABS_API_KEY && !!process.env.ELEVENLABS_VOICE_ID;
