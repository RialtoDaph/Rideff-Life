// Pure helpers for the persistent Life Map scene: how the camera eases, how dense the
// canvas may be, and what the scene does on each screen. No three.js, no DOM.

export type SceneMode = "hero" | "explore" | "backdrop" | "off";

/** Ease in-out cubic, clamped to 0..1: a camera flight that starts and ends softly. */
export function flyEase(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** The pixel ratio to draw at: the device's, never below 1 and never above the cap. */
export function lockedDpr(deviceDpr: number, cap: number): number {
  return Math.min(Math.max(deviceDpr, 1), cap);
}

// useScreen() reports the root as "home"; "" is accepted too.
const STAGE = new Set(["", "home", "ask", "wrapped", "stage-check"]);
const WORK = new Set(["settings", "plan", "setup", "import", "report", "reports", "help"]);

/** What the scene does on a screen (the value of useScreen()): live, explorable, frozen behind it, or not drawn. */
export function sceneModeFor(screen: string): SceneMode {
  if (screen === "map") return "explore";
  if (STAGE.has(screen)) return "hero";
  if (WORK.has(screen)) return "off";
  return "backdrop";
}
