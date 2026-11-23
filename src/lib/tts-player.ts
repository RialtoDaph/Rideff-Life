// Speaks a reply that arrives as text, sentence by sentence, with a voice from /api/assistant/tts.
// Realtime used to do the speaking and the barge-in; now this does: cancel() on the person's voice stops it at once.

import { supabase } from "@/lib/supabase";
import { bandsOf, type Bands } from "@/lib/voice-level";
import { speakable, takeSentences } from "@/lib/tts-text";

const SILENT: Bands = { level: 0, bass: 0, mid: 0, high: 0 };

export type TtsPlayer = {
  /** A piece of a reply as it is written. `rid` is the realtime response it belongs to. */
  push: (rid: string | undefined, delta: string) => void;
  /** That reply is complete: speak what is left. */
  finish: (rid: string | undefined) => void;
  /** Stop now (barge-in): queue, requests and sound. What is still arriving from the cut-off reply is ignored. */
  cancel: () => void;
  /** A new response began. Reports which one, so a cancelled one can be told apart later. */
  begin: (rid: string | undefined) => void;
  /** The response was cut off by the person: its late text must not reach the screen either. */
  isDead: (rid: string | undefined) => boolean;
  setMuted: (on: boolean) => void;
  levels: () => Bands;
  close: () => void;
};

const MAX_IN_FLIGHT = 2; // ElevenLabs limits concurrent requests per plan: the sentence playing plus one ahead

export function createTtsPlayer(ctx: AudioContext, sessionId: string, on: { start: () => void; stop: () => void; /** Milliseconds from the first piece of text to the first sound, per reply: the spike's number. */ metric?: (ms: number) => void }): TtsPlayer {
  const gain = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  gain.connect(analyser);
  analyser.connect(ctx.destination);
  const bins = new Uint8Array(analyser.frequencyBinCount);

  let gen = 0; // bumped only by cancel()/close(): everything older is dropped
  const dead = new Set<string>(); // responses cut off by the person
  let current_rid: string | undefined;
  let buffer = "";
  let started = false; // the first sentence of this reply has been taken
  let ended = false; // finish() was called for the latest reply
  let active = false; // text was pushed since the last stop event
  let speaking = false;
  let tFirst = 0;
  let chain: Promise<void> = Promise.resolve();
  let pending = 0;
  let aborts = new Set<AbortController>();
  let current: AudioBufferSourceNode | null = null;
  let free = MAX_IN_FLIGHT;
  let waiters: (() => void)[] = [];

  const acquire = () => (free > 0 ? (free--, Promise.resolve()) : new Promise<void>((r) => waiters.push(r)));
  const release = () => {
    const next = waiters.shift();
    if (next) next();
    else free++;
  };

  async function fetchAudio(text: string, mine: number): Promise<AudioBuffer | null> {
    await acquire();
    const ac = new AbortController();
    aborts.add(ac);
    try {
      if (mine !== gen) return null;
      const { data } = await supabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return null;
      const res = await fetch("/api/assistant/tts", { method: "POST", signal: ac.signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId, text }) });
      if (!res.ok) {
        if (mine === gen) console.warn("[tts] a sentence could not be spoken, status", res.status);
        return null;
      }
      if (mine !== gen) return null;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null; // a lost sentence is skipped; the caption still shows it
    } finally {
      aborts.delete(ac);
      if (mine === gen) release(); // after a cancel the limiter was already reset: a stale request must not add a slot
    }
  }

  /** One request is at most about 500 characters (the route cuts at 600): a long run without full stops breaks at a space. */
  function enqueue(text: string) {
    let clean = speakable(text);
    while (clean.length > 500) {
      const at = Math.max(clean.lastIndexOf(", ", 500), clean.lastIndexOf(" ", 500));
      const cut = at > 100 ? at + 1 : 500;
      enqueueOne(clean.slice(0, cut).trim());
      clean = clean.slice(cut).trim();
    }
    enqueueOne(clean);
  }

  function enqueueOne(clean: string) {
    if (!clean) return;
    const mine = gen;
    pending++;
    const audio = fetchAudio(clean, mine); // requested ahead (two at a time); played in order
    chain = chain.then(async () => {
      const buf = await audio;
      if (mine !== gen) return;
      if (buf) await play(buf, mine);
      if (mine === gen && --pending === 0 && ended) done();
    });
  }

  function play(buf: AudioBuffer, mine: number) {
    return new Promise<void>((resolve) => {
      if (mine !== gen) return resolve();
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gain);
      current = src;
      // A suspended context never fires onended: do not hang the queue on it.
      const guard = setTimeout(finish, buf.duration * 1000 + 1500);
      function finish() {
        clearTimeout(guard);
        if (current === src) current = null;
        resolve();
      }
      src.onended = finish;
      if (!speaking) {
        speaking = true;
        if (tFirst) on.metric?.(performance.now() - tFirst);
        on.start();
      }
      src.start();
    });
  }

  /** The reply is over. Always say so when text was pushed, even if no sentence could be spoken: the mode must not stay on "speak". */
  function done() {
    if (speaking || active) {
      speaking = false;
      active = false;
      on.stop();
    }
  }

  function reset() {
    gen++;
    buffer = "";
    started = false;
    ended = false;
    pending = 0;
    tFirst = 0;
    chain = Promise.resolve();
    aborts.forEach((a) => a.abort());
    aborts = new Set();
    waiters.forEach((r) => r());
    waiters = [];
    free = MAX_IN_FLIGHT;
    try {
      current?.stop();
    } catch {}
    current = null;
  }

  return {
    isDead: (rid) => !!rid && dead.has(rid),
    begin(rid) {
      if (rid) current_rid = rid;
    },
    push(rid, delta) {
      if (rid && dead.has(rid)) return;
      if (rid) current_rid = rid;
      if (ended) {
        // A new reply (after a tool call, say) queues behind what is still playing; nothing is cut.
        ended = false;
        started = false;
        tFirst = 0;
      }
      active = true;
      if (!tFirst) tFirst = performance.now();
      buffer += delta;
      const { ready, rest } = takeSentences(buffer, false, !started);
      buffer = rest;
      if (ready.length) started = true;
      ready.forEach(enqueue);
    },
    finish(rid) {
      if (rid && dead.has(rid)) return;
      const { ready } = takeSentences(buffer, true, !started);
      buffer = "";
      started = true;
      ready.forEach(enqueue);
      ended = true;
      if (pending === 0) done();
    },
    cancel() {
      if (current_rid) dead.add(current_rid);
      const was = speaking || active;
      reset();
      speaking = false;
      active = false;
      if (was) on.stop();
    },
    setMuted(m) {
      gain.gain.value = m ? 0 : 1;
    },
    levels() {
      if (!speaking) return SILENT;
      analyser.getByteFrequencyData(bins);
      return bandsOf(bins);
    },
    close() {
      reset();
      speaking = false;
      active = false;
    },
  };
}
