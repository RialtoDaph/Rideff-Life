"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAssistant } from "@/components/assistant";
import type { LifeMapScene } from "@/lib/life-map-scene";
import { useAppData } from "@/components/app-data";
import { beatForKey, DEMO_HOUSEHOLD, TOUR } from "@/lib/tour";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** The screen the page is on right now, read from the address, without the language prefix. */
const here = () => window.location.pathname.replace(/^\/(de|id)(?=\/|$)/, "") || "/";
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * The presenter's keys (only with ?stage=1): . or → for the next beat, , or ← for the one before,
 * 1-6 to jump, B to freeze or thaw the scene, and I, D or E to choose the language spoken to Clopar (Indonesian, German, English). A beat opens its screen, flies the camera and, for the
 * last one, wakes Clopar. The person on stage keeps the tempo; nothing runs on a timer.
 */
export function Presenter({ scene }: { scene: LifeMapScene }) {
  const router = useRouter();
  const { household } = useAppData();
  const demo = household?.name === DEMO_HOUSEHOLD;
  const demoRef = useRef(demo);
  useEffect(() => {
    demoRef.current = demo;
  }, [demo]);
  const { startVoice, stop, voiceLang, setVoiceLang } = useAssistant();
  const [beat, setBeat] = useState(0);
  const run = useRef(0);
  const at = useRef({ beat: 0 });
  const frozen = useRef(false);

  const go = useCallback(
    async (i: number) => {
      const mine = ++run.current;
      at.current.beat = i;
      setBeat(i);
      const b = TOUR[i];
      if (here() !== b.route) {
        router.push(b.route);
        await sleep(900);
      }
      for (const target of b.fly) {
        if (run.current !== mine) return;
        await scene.flyTo(target, { ms: 1100 });
        await sleep(700);
      }
      if (b.voice && run.current === mine) void startVoice();
    },
    [router, scene, startVoice],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.key.toLowerCase() === "b") {
        frozen.current = !frozen.current;
        if (frozen.current) scene.pause();
        else scene.resume();
        return;
      }
      const lang = ({ i: "id", d: "de", e: "en" } as Record<string, string>)[e.key.toLowerCase()];
      if (lang) {
        stop(); // a conversation in the old language ends; the next tap on Clopar starts one in the new
        setVoiceLang(lang);
        return;
      }
      const next = beatForKey(at.current.beat, e.key);
      if (next !== null && demoRef.current) {
        e.preventDefault();
        void go(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, scene, setVoiceLang, stop]);

  return (
    <div data-noprint data-stage-scale className="pointer-events-none fixed bottom-2 left-[170px] z-[60] rounded-md border border-line bg-card px-2 py-1 font-mono text-[11px] text-mut">
      {demo ? "" : "NOT DEMO · "}{beat + 1}/{TOUR.length} · {TOUR[beat].id} · {voiceLang.toUpperCase()} · . , I D E
    </div>
  );
}
