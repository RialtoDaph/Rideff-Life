// What the assistant is doing, as small events the 3D scene (and later the replay) can follow.
// A plain store like voice-level.ts: no React, no audio. Emitting with nobody listening is free.

export type StageCue =
  | { t: "tool-start"; id: string; name: string; target?: string }
  | { t: "tool-end"; id: string; name: string; ms: number; ok: boolean }
  | { t: "transfer"; from: string[]; to: string }
  | { t: "clear" };

type Listener = (cue: StageCue) => void;
const subs = new Set<Listener>();

export const stageCues = {
  emit(cue: StageCue) {
    // Copy first: a listener may unsubscribe while we are walking the set.
    for (const s of [...subs]) {
      try {
        s(cue);
      } catch {
        // One broken listener must never break the voice session.
      }
    }
  },
  subscribe(fn: Listener) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
};
