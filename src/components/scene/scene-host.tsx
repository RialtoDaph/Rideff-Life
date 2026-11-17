"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createLifeMapScene, type LifeMapScene } from "@/lib/life-map-scene";
import type { MapGraph } from "@/lib/life-map";
import type { LifeScore } from "@/lib/life-score";
import { hrefOf, MODULE_ORDER } from "@/lib/nav";
import { sceneModeFor } from "@/lib/scene-camera";
import { hubForTool, isShowNode, parseShow, setShowIndex, SHOW_EVENT } from "@/lib/show";
import { stageCues } from "@/lib/stage-cues";
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
  const pathname = usePathname();
  const pointed = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSelect = useRef<(id: string | null) => void>(() => {});
  const [scene, setScene] = useState<LifeMapScene | null>(null);
  const [failed, setFailed] = useState(false);
  const [stageMode, setStageMode] = useState(false);
  const router = useRouter();
  const [epoch, setEpoch] = useState(0);
  const life = useLifeData();

  // The presenter's keys do not depend on the 3D scene: a failed or absent scene must not take the tour away.
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("stage");
    let on = asked === "1"; // from the address first: blocked storage must not lose it
    try {
      if (asked === "1") sessionStorage.setItem("rideff-stage", "1");
      else if (asked === "0") sessionStorage.removeItem("rideff-stage");
      on = asked === "1" || (asked !== "0" && sessionStorage.getItem("rideff-stage") === "1");
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStageMode(on);
  }, []);

  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    let made: LifeMapScene | null = null;
    // Presenter mode is chosen by ?stage=1 and kept for the tab: a reload or a link without the query must not drop it.
    const asked = new URLSearchParams(window.location.search).get("stage");
    let staged = false;
    try {
      if (asked === "1") sessionStorage.setItem("rideff-stage", "1");
      else if (asked === "0") sessionStorage.removeItem("rideff-stage");
      staged = sessionStorage.getItem("rideff-stage") === "1";
    } catch {
      staged = asked === "1";
    }
    createLifeMapScene(stage.current!, labels.current!, (id) => onSelect.current(id), () => setEpoch((n) => n + 1))
      .then((s) => {
        if (!alive) return s.dispose();
        made = s;
        // A projector wants a steady picture: cap the density and never step down in the middle of a talk.
        if (staged) s.setQuality({ maxDpr: 1.5, lock: true });
        // The presenter's size: the page is drawn larger for a room (see globals.css).
        if (staged) document.documentElement.dataset.stage = "1";
        // A hook for the end-to-end tests and the stage readout; nothing in the app reads it.
        // Only in the presenter's mode or an end-to-end build: nothing else gets a handle on the scene.
        if (staged || process.env.NEXT_PUBLIC_E2E === "1") {
          (window as unknown as { __rideffScene?: LifeMapScene }).__rideffScene = s;
          (window as unknown as { __rideffCue?: typeof stageCues }).__rideffCue = stageCues;
        }
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
      delete (window as unknown as { __rideffCue?: unknown }).__rideffCue;
      delete document.documentElement.dataset.stage;
      setScene(null);
    };
  }, [wanted, epoch]);

  // The scene draws the map on every live screen, so the host feeds it, not the map screen.
  useEffect(() => scene?.setGraph(life.graph), [scene, life.graph]);
  useEffect(() => setShowIndex(life.graph.nodes), [life.graph]);
  // "Show me": the assistant points at an area (the camera flies there) or a screen (it opens).
  // A tool at work lights up its streams until it answers.
  useEffect(() => {
    if (!scene) return;
    const open = new Map<string, { end: () => void }>();
    const off = stageCues.subscribe((c) => {
      if (c.t === "clear" && pointed.current) {
        clearTimeout(pointed.current);
        pointed.current = null;
        scene.setSelected(null);
      } else if (c.t === "transfer") {
        // Money moves: drop any pointing, show the whole picture for a moment, then send it.
        if (pointed.current) {
          clearTimeout(pointed.current);
          pointed.current = null;
        }
        scene.setSelected(null);
        void scene.flyTo("core", { ms: 700 }).then(() => scene.transfer(c.from, c.to));
      } else if (c.t === "tool-start") {
        const area = c.target ?? hubForTool(c.name);
        if (area) open.set(c.id, scene.pulse(area));
      } else if (c.t === "tool-end") {
        open.get(c.id)?.end();
        open.delete(c.id);
      }
    });
    return () => {
      off();
      open.forEach((p) => p.end());
    };
  }, [scene]);
  useEffect(() => {
    const onShow = (e: Event) => {
      // Only a place that really is in the app: nothing the model says becomes an address.
      const raw = (e as CustomEvent<{ target?: string }>).detail?.target;
      if (raw && isShowNode(raw)) {
        // One item on the map: select it, and let go of it after a while.
        if (/\/map\/?$/.test(pathname)) onSelect.current(raw);
        else {
          scene?.setSelected(raw);
          if (pointed.current) clearTimeout(pointed.current);
          pointed.current = setTimeout(() => scene?.setSelected(null), 9000);
        }
        return;
      }
      const target = parseShow(JSON.stringify({ target: raw }));
      if (!target) return;
      if (target === "core" || (MODULE_ORDER as string[]).includes(target)) void scene?.flyTo(target, { ms: 900 });
      else router.push(hrefOf(target));
    };
    window.addEventListener(SHOW_EVENT, onShow);
    return () => window.removeEventListener(SHOW_EVENT, onShow);
  }, [scene, router, pathname]);
  useEffect(() => {
    scene?.setMode(mode);
    // These screens keep the scene running for no one to see: let it rest.
    if (screen === "ask" || screen === "wrapped") scene?.pause();
  }, [scene, mode, screen]);
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
                ? "inset-y-0 min-[1250px]:left-[calc(50%+360px)] [mask-image:linear-gradient(to_right,transparent,#000_22%)]" // in the gutter on the column's right; its left edge fades out instead of cutting the sphere
                : "inset-y-0 cursor-grab"
          }`}
        >
          <div ref={labels} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" />
        </div>
      </div>
      {stageMode && scene && <StageHud scene={scene} />}
      {stageMode && <Presenter scene={scene} />}
      {children}
    </Ctx>
  );
}
