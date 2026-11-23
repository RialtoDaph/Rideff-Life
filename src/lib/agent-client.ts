// ElevenAgents as the voice: ElevenLabs listens, thinks and speaks. This wraps its session in the same handle and the same
// event names the screen already understands from OpenAI Realtime, so the character, captions and cards need no changes.
// Tools are client tools: they run in this browser and call /api/assistant/tool as the signed-in person.

import { Conversation, type VoiceConversation } from "@elevenlabs/client";
import { bandsOf, type Bands } from "@/lib/voice-level";
import type { Realtime } from "@/lib/assistant-client";

export type AgentSession = { signed_url: string; instructions: string; language: string };
export const AGENT_TOOLS = ["show", "get_budget", "get_goals", "get_week"] as const;

const SILENT: Bands = { level: 0, bass: 0, mid: 0, high: 0 };

/** The tool bridge: returns the JSON the agent gets back. */
export type RunTool = (name: string, args: string) => Promise<string>;

type Event = { type: string; delta?: string; transcript?: string };

export async function connectAgent(info: AgentSession, onEvent: (e: Event) => void, onDrop: () => void, runTool: RunTool): Promise<Realtime> {
  let closed = false;
  let convo: VoiceConversation | null = null;
  const emit = (e: Event) => {
    if (!closed) onEvent(e);
  };

  const clientTools = Object.fromEntries(
    AGENT_TOOLS.map((name) => [
      name,
      async (params: unknown) => {
        // The result must always be a string the agent can read, even when the tool failed or the session already ended.
        if (closed) return JSON.stringify({ error: "No session." });
        try {
          return await runTool(name, JSON.stringify(params ?? {}));
        } catch {
          return JSON.stringify({ error: "Tool failed." });
        }
      },
    ]),
  );

  try {
    convo = (await Conversation.startSession({
      signedUrl: info.signed_url,
      connectionType: "websocket",
      textOnly: false,
      // The page's CSP forbids blob: and CDN scripts, so the audio worklets are served from our own origin (public/vendor/elevenlabs).
      workletPaths: { rawAudioProcessor: "/vendor/elevenlabs/rawAudioProcessor.js", audioConcatProcessor: "/vendor/elevenlabs/audioConcatProcessor.js" },
      libsampleratePath: "/vendor/elevenlabs/libsamplerate.worklet.js",
      clientTools,
      overrides: { agent: { prompt: { prompt: info.instructions }, language: info.language as never, firstMessage: "" } },
      onModeChange: ({ mode }) => emit({ type: mode === "speaking" ? "output_audio_buffer.started" : "output_audio_buffer.stopped" }),
      onMessage: ({ role, message }) => {
        if (!message?.trim()) return;
        if (role === "user") {
          emit({ type: "input_audio_buffer.speech_stopped" });
          emit({ type: "conversation.item.input_audio_transcription.completed", transcript: message });
          emit({ type: "response.created" });
        } else {
          // Each agent message is its own reply: without this, a second message in one turn would be saved glued to the first.
          emit({ type: "response.created" });
          emit({ type: "response.output_text.delta", delta: message });
          emit({ type: "response.done" });
        }
      },
      onError: (message) => {
        console.warn("[agent]", message);
        emit({ type: "error" }); // lets the screen leave "think" and accept typing again
      },
      onDisconnect: (details) => {
        if (!closed && details.reason !== "user") onDrop();
      },
    })) as VoiceConversation;
  } catch (e) {
    closed = true;
    throw e;
  }

  const c = convo;
  return {
    levels: () => {
      if (closed) return { mic: SILENT, out: SILENT };
      try {
        return { mic: bandsOf(c.getInputByteFrequencyData()), out: bandsOf(c.getOutputByteFrequencyData()) };
      } catch {
        return { mic: SILENT, out: SILENT };
      }
    },
    // The few events the screen sends to a realtime model, translated: typed text, a system note. Tool results go back by themselves.
    send: (event) => {
      const e = event as { type?: string; item?: { role?: string; content?: { text?: string }[] } };
      if (closed || e.type !== "conversation.item.create") return;
      const text = e.item?.content?.map((x) => x.text ?? "").join(" ").trim();
      if (!text) return;
      if (e.item?.role === "user") c.sendUserMessage(text);
      else c.sendContextualUpdate(text);
    },
    setMuted: (on) => c.setVolume({ volume: on ? 0 : 1 }),
    muteMic: (on) => c.setMicMuted(on),
    close: () => {
      closed = true;
      void c.endSession().catch(() => {});
    },
  };
}
