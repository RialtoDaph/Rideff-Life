// One WebRTC connection to the realtime model. Voice sends the microphone; typed
// sessions only receive, and both use the same event channel. The browser holds a
// short-lived token, never the API key. Audio is streamed and not stored.

import { supabase } from "@/lib/supabase";
import type { Card } from "@/lib/assistant-tools";
import { bandsOf, type Bands } from "@/lib/voice-level";

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export type SessionInfo = { token: string; session_id: string; plan: string; voice_left: number; ai_left: number | null };
export type SessionFail = { code: "not_configured" | "voice_quota" | "ai_quota" | "failed" };

export async function authedPost<T>(path: string, body: unknown, keepalive = false, timeoutMs?: number): Promise<{ ok: boolean; status: number; data: T | null }> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, status: 401, data: null };
  try {
    const res = await fetch(path, { method: "POST", keepalive, signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, status: res.status, data: (await res.json().catch(() => null)) as T | null };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export const runAssistantTool = (session_id: string, name: string, args: string) =>
  authedPost<{ output: Record<string, unknown>; card?: Card }>("/api/assistant/tool", { session_id, name, arguments: args });

export type Realtime = { send: (event: object) => void; setMuted: (on: boolean) => void; close: () => void; /** Loudness of the microphone and of the voice coming back, now. */ levels: () => { mic: Bands; out: Bands } };

const SILENT: Bands = { level: 0, bass: 0, mid: 0, high: 0 };
/** Reads the loudness of a stream, or silence when the browser cannot. */
function listenTo(ctx: AudioContext | null, stream: MediaStream): () => Bands {
  if (!ctx) return () => SILENT;
  try {
    const node = ctx.createAnalyser();
    node.fftSize = 256;
    node.smoothingTimeConstant = 0.8;
    ctx.createMediaStreamSource(stream).connect(node);
    const bins = new Uint8Array(node.frequencyBinCount);
    return () => {
      node.getByteFrequencyData(bins);
      return bandsOf(bins);
    };
  } catch {
    return () => SILENT;
  }
}

const CONNECT_MS = 5000;

export async function connectRealtime(token: string, voice: boolean, onEvent: (e: { type: string }) => void, onDrop: () => void): Promise<Realtime> {
  const pc = new RTCPeerConnection();
  const audio = new Audio();
  audio.autoplay = true;
  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioContext();
  } catch {}
  let out: () => Bands = () => SILENT;
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0];
    out = listenTo(ctx, e.streams[0]);
  };

  const mic = voice ? await navigator.mediaDevices.getUserMedia({ audio: true }) : null;
  const heard = mic ? listenTo(ctx, mic) : () => SILENT;
  try {
    if (mic) pc.addTrack(mic.getAudioTracks()[0], mic);
    else pc.addTransceiver("audio", { direction: "recvonly" });

    const channel = pc.createDataChannel("oai-events");
    channel.onmessage = (m) => {
      try {
        onEvent(JSON.parse(m.data as string));
      } catch {}
    };
    const opened = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), CONNECT_MS);
      channel.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    // If the offer fails first, this must not surface later as an unhandled rejection.
    opened.catch(() => {});

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const res = await fetch(CALLS_URL, { method: "POST", body: offer.sdp, signal: AbortSignal.timeout(CONNECT_MS), headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" } });
    if (!res.ok) throw new Error(`calls ${res.status}`);
    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
    await opened;

    let closed = false;
    let wait: ReturnType<typeof setTimeout> | undefined;
    pc.onconnectionstatechange = () => {
      if (closed) return;
      clearTimeout(wait);
      const state = pc.connectionState;
      if (state === "failed" || state === "closed") onDrop();
      // "disconnected" often mends by itself within a moment: only a link that stays down is a loss.
      else if (state === "disconnected")
        wait = setTimeout(() => {
          if (!closed && pc.connectionState === "disconnected") onDrop();
        }, 3000);
    };
    return {
      levels: () => ({ mic: heard(), out: out() }),
      send: (event) => channel.readyState === "open" && channel.send(JSON.stringify(event)),
      setMuted: (on) => {
        audio.muted = on;
      },
      close: () => {
        closed = true;
        clearTimeout(wait);
        mic?.getTracks().forEach((t) => t.stop());
        channel.close();
        pc.close();
        audio.srcObject = null;
        void ctx?.close().catch(() => {});
      },
    };
  } catch (e) {
    mic?.getTracks().forEach((t) => t.stop());
    pc.close();
    void ctx?.close().catch(() => {});
    throw e;
  }
}
