// The stage tour: a few beats a presenter steps through with the keyboard (?stage=1).
// Each beat is a screen and where the camera goes on it; the presenter keeps the tempo.

export type Beat = {
  id: string;
  route: string;
  /** Where the camera flies, one after another: the core or an area. */
  fly: string[];
  /** Starts Clopar listening when the beat opens. */
  voice?: boolean;
};

export const TOUR: Beat[] = [
  { id: "home", route: "/", fly: ["core"] },
  { id: "map", route: "/map", fly: ["core", "money"] },
  { id: "areas", route: "/map", fly: ["time", "health", "goals", "core"] },
  { id: "clopar", route: "/", fly: ["core"], voice: true },
  { id: "built", route: "/built", fly: ["core"] },
  { id: "wrapped", route: "/wrapped", fly: ["core"] },
];

/** The beat a key leads to from `current`, or null when the key is not for the tour. */
export function beatForKey(current: number, key: string, count = TOUR.length): number | null {
  if (key === "." || key === "ArrowRight") return Math.min(current + 1, count - 1);
  if (key === "," || key === "ArrowLeft") return Math.max(current - 1, 0);
  if (/^[1-9]$/.test(key)) return Number(key) <= count ? Number(key) - 1 : null;
  return null;
}
