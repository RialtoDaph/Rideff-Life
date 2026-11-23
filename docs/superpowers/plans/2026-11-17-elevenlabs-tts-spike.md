# ElevenLabs voice spike (2026-11-17)

**Idea:** OpenAI Realtime keeps listening (speech-to-text), thinking and calling tools. It sends the answer as **text only**; ElevenLabs speaks it. Tools, `show`, transfers, cards and quota are untouched.

**Off by default.** With `VOICE_TTS` empty the session is exactly as before (OpenAI voice "marin").

## Turn it on (locally or on Vercel)

```
VOICE_TTS=elevenlabs
ELEVENLABS_API_KEY=...        # yours, server only
ELEVENLABS_VOICE_ID=...       # pick one that speaks Indonesian well
ELEVENLABS_MODEL=eleven_flash_v2_5   # optional; Flash v2.5 lists Indonesian among its 32 languages
```

## What changed

| File | What |
|---|---|
| `src/app/api/assistant/session/route.ts` | flag on: `output_modalities: ["text"]`, no OpenAI output voice; returns `tts: true`. Also a transcription `prompt` with the family names, so "Clopar" is less often heard as "Klopak". |
| `src/app/api/assistant/tts/route.ts` | one sentence in, mp3 out. Needs sign-in and a live session of that person; max 600 characters. |
| `src/lib/tts-text.ts` | cuts the growing reply into sentences (tested). |
| `src/lib/tts-player.ts` | requests all sentences at once, plays them in order, cancels on barge-in, feeds the orb's loudness. |
| `src/lib/assistant-client.ts` | routes text deltas to the player and sends the same `output_audio_buffer.started/stopped` events the UI already uses. |

## Measure (the point of the spike)

Open the browser console while talking. Each reply logs `[tts] first sound N ms after the first word`. Compare by ear with the OpenAI voice (flag off). Fill in:

| | OpenAI voice | ElevenLabs |
|---|---|---|
| Speech end to first sound | | |
| Indonesian pronunciation | | |
| Barge-in feels instant? | | |

**Verdict rule:** keep it if first-sound delay stays under about 1.5 s and Indonesian is clearly better; otherwise drop the flag, nothing else depends on it.

## Not verified (no keys in this checkout)

Nothing ran against OpenAI or ElevenLabs. Unit-tested: the sentence splitter only. The player, the TTS route and the `mp3_44100_128` format on the stream endpoint still need a first real run.

## Does not make Clopar smarter

A new voice changes how it sounds, not how it thinks. The weak answers come from the model and the prompt in `src/lib/assistant-prompt.ts`.
