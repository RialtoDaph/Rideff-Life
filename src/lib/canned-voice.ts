// Plays a canned answer as a timeline the app can follow, with no network and no writes.
// The plan is pure (easy to test); assistant.tsx runs it with timers.

import type { Canned, CannedStep } from "@/content/canned";

export type CannedCue =
  | { at: number; kind: "listen"; text: string }
  | { at: number; kind: "think" }
  | { at: number; kind: "show"; target: string }
  | { at: number; kind: "step"; step: CannedStep }
  | { at: number; kind: "speak"; text: string };

export const HEARD_MS = 1200;
export const STEP_MS = 650;

/** What happens when, in milliseconds from the start. Steps land one after another, the answer follows the last. */
export function planCanned(c: Canned): CannedCue[] {
  const cues: CannedCue[] = [{ at: 0, kind: "listen", text: c.heard }, { at: HEARD_MS, kind: "think" }];
  let at = HEARD_MS;
  if (c.show) cues.push({ at: at + 200, kind: "show", target: c.show });
  for (const step of c.steps) {
    at += STEP_MS;
    cues.push({ at, kind: "step", step });
  }
  cues.push({ at: at + STEP_MS, kind: "speak", text: c.answer });
  return cues;
}

/** The next canned answer for a language after `lastId`, wrapping round; null when there are none. */
export function nextCanned(list: Canned[], lastId: string | null): Canned | null {
  if (!list.length) return null;
  const i = list.findIndex((c) => c.id === lastId);
  return list[(i + 1) % list.length];
}
