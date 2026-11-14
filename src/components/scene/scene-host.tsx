"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createLifeMapScene, type LifeMapScene } from "@/lib/life-map-scene";
import type { MapGraph } from "@/lib/life-map";
import type { LifeScore } from "@/lib/life-score";
import { hrefOf, MODULE_ORDER } from "@/lib/nav";
import { sceneModeFor } from "@/lib/scene-camera";
import { SHOW_EVENT } from "@/lib/show";
import { voiceLevel } from "@/lib/voice-level";
import { Presenter } from "./presenter";
import { StageHud } from "./stage-hud";
import { useLifeData } from "./use-life-data";

type SceneContext = {
  scene: LifeMapScene | null;
  failed: boolean;
  /** The layer the scene draws its HTML labels into. */
  labels: RefObject<HTMLDivElement | null>;
  /** The score and the map graph the scene draws, built once here for every screen. */
  life: { score: LifeScore; graph: MapGraph };
  /** Who hears a tap on a node: the screen that is showing the map. */
  setOnSelect: (cb: (id: string | null) => void) => void;
};

const Ctx = createContext<SceneContext | null>(null);
export function useScene(): SceneContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScene needs the SceneHost");
  return ctx;
}

const EXPLORE_BG = "radial-gradient(circle at 50% 46%, var(--tint) 0%, var(--bg) 64%) var(--bg)";

/**
 * One canvas for the whole app. It is drawn only after the person has stood on a live screen
 * (Home, the map), so a deep link to a detail screen never pays for WebGL. After that it lives
 * here, outside the screens: live on Home, explorable on the map, frozen and dimmed behind a
 * detail screen, and switched off on work screens.
 */
export function SceneHost({ screen, children }: { screen: string; children: ReactNode }) {
  const mode = sceneModeFor(screen);
  const live = mode === "hero" || mode === "explore";
  const [wanted, setWanted] = useState(false);
  if (live && !wanted) setWanted(true);

  const stage = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const onSelect = useRef<(id: string | null) => void>(() => {});
  const [scene, setScene] = useState<LifeMapScene | null>(null);
  const [failed, setFailed] = useState(false);
  const [stageMode, setStageMode] = useState(false);
  const router = useRouter();
  const life = useLifeData();

  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    let made: LifeMapScene | null = null;
    const staged = new URLSearchParams(window.location.search).get("stage") === "1";
    createLifeMapScene(stage.current!, labels.current!, (id) => onSelect.current(id))
      .then((s) => {
        if (!alive) return s.dispose();
        made = s;
        // A projector wants a steady picture: cap the density and never step down in the middle of a talk.
        if (staged) s.setQuality({ maxDpr: 1.5, lock: true });
        setStageMode(staged);
        // The presenter's size: the page is drawn larger for a room (see globals.css).
        if (staged) document.documentElement.dataset.stage = "1";
        // A hook for the end-to-end tests and the stage readout; nothing in the app reads it.
        (window as unknown as { __rideffScene?: LifeMapScene }).__rideffScene = s;
        setScene(s);
      })
      .catch(() => alive && setFailed(true));
    // The scene takes its colours from the tokens, so it follows the theme and palette.
    const watch = new MutationObserver(() => made?.repaint());
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-palette"] });
    return () => {
      alive = false;
      watch.disconnect();
      made?.dispose();
      delete (window as unknown as { __rideffScene?: LifeMapScene }).__rideffScene;
      delete document.documentElement.dataset.stage;
      setScene(null);
    };
  }, [wanted]);

  // The scene draws the map on every live screen, so the host feeds it, not the map screen.
  useEffect(() => scene?.setGraph(life.graph), [scene, life.graph]);
  // "Show me": the assistant points at an area (the camera flies there) or a screen (it opens).
  useEffect(() => {
    const onShow = (e: Event) => {
      const target = (e as CustomEvent<{ target?: string }>).detail?.target;
      if (!target) return;
      if (target === "core" || (MODULE_ORDER as string[]).includes(target)) void scene?.flyTo(target, { ms: 900 });
      else router.push(hrefOf(target));
    };
    window.addEventListener(SHOW_EVENT, onShow);
    return () => window.removeEventListener(SHOW_EVENT, onShow);
  }, [scene, router]);
  useEffect(() => scene?.setMode(mode), [scene, mode]);
  // The voice moves the scene too: what the assistant measures, the data "hears".
  useEffect(() => {
    if (!scene) return;
    scene.setVoice(voiceLevel.get());
    return voiceLevel.subscribe((f) => scene.setVoice(f));
  }, [scene]);

  const value = useMemo<SceneContext>(() => ({ scene, failed, life, labels, setOnSelect: (cb) => (onSelect.current = cb) }), [scene, failed, life]);

  return (
    <Ctx value={value}>
      <div
        aria-hidden
        data-noprint
        data-scene-host
        // Behind everything, except on the map, where it sits just under that screen's own controls.
        className={`fixed inset-0 opacity-[var(--host-o)] transition-opacity duration-[320ms] motion-reduce:transition-none ${
          mode === "explore" ? "z-[54] [--host-o:1]" : `pointer-events-none z-[-1] ${screen === "home" ? "[--host-o:1]" : mode === "backdrop" ? "[--host-o:.7] max-[1250px]:[--host-o:0]" : "[--host-o:0]"}`
        }`}
        // The scene is seen on the map, as Home's stage, and frozen beside a detail screen's column (wide screens only:
        // on a phone the column is the whole width). Everywhere else it is hidden.
        style={mode === "explore" ? { background: EXPLORE_BG } : undefined}
      >
        {/* On Home the scene takes the right of the stage and leaves the left to the number; on a phone it takes the top and the number sits under it. */}
        <div
          ref={stage}
          className={`absolute right-0 left-0 ${
            screen === "home"
              ? "top-[64px] h-[42svh] wide:inset-y-0 wide:top-0 wide:left-[32%] wide:h-auto"
              : mode === "backdrop"
                ? "inset-y-0 min-[1250px]:left-[calc(50%+460px)]" // beside the detail column, in the gutter on its right
                : "inset-y-0 cursor-grab"
          }`}
        >
          <div ref={labels} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" />
        </div>
      </div>
      {stageMode && scene && <StageHud scene={scene} />}
      {stageMode && scene && <Presenter scene={scene} />}
      {children}
    </Ctx>
  );
}
