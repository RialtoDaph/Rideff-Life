"use client";

import { useEffect, useState } from "react";
import type { LifeMapScene } from "@/lib/life-map-scene";

/** A readout for the person on stage: frames per second, tier and pixel ratio. Only with ?stage=1. */
export function StageHud({ scene }: { scene: LifeMapScene }) {
  const [s, setS] = useState(() => scene.stats());
  useEffect(() => {
    const id = setInterval(() => setS(scene.stats()), 500);
    return () => clearInterval(id);
  }, [scene]);
  return (
    <div data-noprint data-stage-scale className="pointer-events-none fixed bottom-2 left-2 z-[60] rounded-md border border-line bg-card px-2 py-1 font-mono text-[11px] text-mut">
      {s.fps} fps · {s.tier} · dpr {s.dpr}
    </div>
  );
}
