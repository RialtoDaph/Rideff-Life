// The loudness of the voice, shared between whoever measures it (the assistant) and
// whoever draws it (the character and the 3D scene). A plain store: no React, no audio.

import type { VoiceFrame } from "./life-map-scene";

export type Bands = { level: number; bass: number; mid: number; high: number };
const SILENT: Bands = { level: 0, bass: 0, mid: 0, high: 0 };

const mean = (a: Uint8Array, from: number, to: number) => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += a[i];
  return to > from ? sum / (to - from) / 255 : 0;
};

/** Loudness overall and in three bands (low, middle, high), 0..1, from FFT byte data. */
export function bandsOf(bins: Uint8Array): Bands {
  const n = bins.length;
  if (!n) return SILENT;
  const low = Math.max(1, Math.round(n / 16));
  const mid = Math.round(n * 0.3);
  return { level: mean(bins, 0, n), bass: mean(bins, 0, low), mid: mean(bins, low, mid), high: mean(bins, mid, n) };
}

const IDLE: VoiceFrame = { state: "idle", level: 0, bass: 0, mid: 0, high: 0 };
let frame: VoiceFrame = IDLE;
const subs = new Set<(f: VoiceFrame) => void>();

export const voiceLevel = {
  get: () => frame,
  set(next: VoiceFrame) {
    frame = next;
    subs.forEach((s) => s(next));
  },
  idle() {
    this.set(IDLE);
  },
  subscribe(fn: (f: VoiceFrame) => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
};
