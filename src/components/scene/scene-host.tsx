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

/** Between these widths the backdrop has no gutter beside the column: it takes free room in the column's upper right. */
const BAND_MQ = "(min-width: 1280px) and (max-width: 1699px)";
/** The backdrop's box starts at the earliest here (a share of the window's width, as in the stage's desk:left-[48%]), and at the latest here. */
const BAND_LEFT = [0.48, 0.72];
/** Less free height than this and the map would be a speck: it is not drawn on that screen. */
const BAND_MIN = 240;

type Span = { top: number; bottom: number; right: number };

/**
 * What is drawn in the upper part of the screen, in page coordinates: text, cards, controls, pictures (a hairline
 * border does not count). The backdrop draws the map only where none of these are, so it never sits behind words that
 * are not on a card.
 */
function occupied(root: Element, limit: number): Span[] {
  const sy = window.scrollY;
  const spans: Span[] = [];
  const add = (r: DOMRect) => {
    if (r.width && r.height && r.top + sy < limit) spans.push({ top: r.top + sy, bottom: r.bottom + sy, right: r.right });
  };
  const range = document.createRange();
  const visit = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.height && r.top + sy >= limit) return; // below the band: nothing under it can rise into it in a normal layout
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") return;
    if (
      /^(IMG|SVG|CANVAS|VIDEO|INPUT|TEXTAREA|SELECT|BUTTON)$/i.test(el.tagName) ||
      cs.backgroundColor.replace(/\s/g, "").match(/^rgba\(.*,0\)$|^transparent$/) === null ||
      cs.backgroundImage !== "none" ||
      cs.backdropFilter !== "none"
    ) {
      add(r);
      if (/^(SVG|CANVAS|IMG|VIDEO)$/i.test(el.tagName)) return;
    }
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) {
        range.selectNodeContents(n);
        for (const t of range.getClientRects()) add(t);
      } else if (n.nodeType === Node.ELEMENT_NODE) visit(n as Element);
    }
  };
  visit(root);
  return spans.sort((a, b) => a.top - b.top);
}

/** The tallest empty band above `limit` to the right of `x0`, or null when there is none tall enough. */
function freeBand(spans: Span[], x0: number, limit: number): { top: number; height: number } | null {
  let best = { top: 0, height: 0 };
  let at = 0;
  for (const s of [...spans.filter((s) => s.right > x0), { top: limit, bottom: limit, right: Infinity }]) {
    if (s.top - at > best.height) best = { top: at, height: s.top - at };
    at = Math.max(at, s.bottom);
  }
  if (best.height < BAND_MIN) return null;
  // A little air between the map and what is above and below it.
  const pad = 12;
  return { top: best.top ? best.top + pad : 0, height: best.height - (best.top ? 2 * pad : pad) };
}

type Band = { left: number; top: number; height: number };

/**
 * The free band that holds the largest map. Its left edge is tried at the earliest start and just past the right edge of
 * each thing drawn in the upper right (a card that reaches into it, say). The map is drawn as large as the band's height
 * allows (camera at 175) unless the band is narrow, when its width decides (see backdropZoom in life-map-scene.ts).
 */
function bestBand(root: Element): Band | null {
  const w = window.innerWidth;
  const limit = window.innerHeight * 0.62;
  const spans = occupied(root, limit);
  const [from, to] = BAND_LEFT.map((s) => Math.round(w * s));
  const lefts = [...new Set([from, ...spans.map((s) => Math.round(s.right + 16)).filter((x) => x > from && x <= to)])].sort((a, b) => a - b);
  let best: Band | null = null;
  let score = 0;
  for (const left of lefts) {
    const b = freeBand(spans, left, limit);
    const s = b ? Math.min(b.height / 175, (w - left) / 270) : 0;
    if (b && s > score) {
      score = s;
      best = { left, ...b };
    }
  }
  return best;
}

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

  const host = useRef<HTMLDivElement>(null);
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

  // On Home the scene is fixed behind a page that scrolls over it: as the page leaves the hero, the scene fades out,
  // so orbs and labels never sit on top of the cards and numbers below. The backdrop does the same below 1700px, where it
  // takes the upper right above a detail screen's cards (from 1700px it is in the free gutter beside the column and stays).
  useEffect(() => {
    const el = host.current;
    if (!el || (screen !== "home" && mode !== "backdrop")) return;
    const gutter = mode === "backdrop" ? window.matchMedia("(min-width: 1700px)") : null;
    let frame = 0;
    const read = () => {
      frame = 0;
      const k = gutter?.matches ? 0 : Math.min(1, window.scrollY / (window.innerHeight * 0.45));
      el.style.setProperty("--scroll-o", String(1 - k * 0.92));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    gutter?.addEventListener("change", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      gutter?.removeEventListener("change", onScroll);
      if (frame) cancelAnimationFrame(frame);
      el.style.removeProperty("--scroll-o");
    };
  }, [screen, mode]);
  // Below 1700px the backdrop has no gutter: it takes the tallest free band in the column's upper right, measured on
  // each screen and again whenever that screen's content changes (data arriving, a tab switched) or the window resizes.
  // undefined: not measured (the stage's classes decide); null: no room on this screen, so the map is not drawn there.
  const [band, setBand] = useState<Band | null | undefined>(undefined);
  useEffect(() => {
    if (mode !== "backdrop") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBand(undefined);
      return;
    }
    const mq = window.matchMedia(BAND_MQ);
    let timer = 0;
    const measure = () => {
      timer = 0;
      const root = document.querySelector("main");
      if (!mq.matches || !root) return setBand(undefined);
      const next = bestBand(root);
      setBand((was) => (was && next && was.left === next.left && Math.abs(was.top - next.top) < 2 && Math.abs(was.height - next.height) < 2 ? was : next));
    };
    const soon = () => {
      if (!timer) timer = window.setTimeout(measure, 120);
    };
    measure();
    const root = document.querySelector("main");
    const watch = new MutationObserver(soon);
    if (root) watch.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    window.addEventListener("resize", soon);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", soon);
      if (timer) clearTimeout(timer);
    };
  }, [mode, pathname]);
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
    // No free room for the backdrop on this screen: it is not shown, so it need not keep drawing.
    if (mode === "backdrop" && band === null) scene?.pause();
  }, [scene, mode, screen, band]);
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
        ref={host}
        // Behind everything, except on the map, where it sits just under that screen's own controls.
        className={`fixed inset-0 opacity-[calc(var(--host-o)*var(--scroll-o,1))] transition-opacity duration-[320ms] motion-reduce:transition-none ${
          mode === "explore" ? "z-[54] [--host-o:1]" : `pointer-events-none z-[-1] ${screen === "home" ? "[--host-o:1]" : mode === "backdrop" && band !== null ? "[--host-o:.92] min-[1700px]:[--host-o:.7] max-[1279px]:[--host-o:0]" : "[--host-o:0]"}`
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
              ? "top-[64px] h-[42svh] wide:inset-y-0 wide:top-0 wide:left-[32%] desk:left-[calc(88px+(100%-88px)*.32)] wide:h-auto"
              : mode === "backdrop"
                ? "inset-y-0 desk:left-[48%] desk:h-[52svh] desk:[mask-image:linear-gradient(to_bottom,transparent,#000_7%,#000_86%,transparent),linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)] desk:[mask-composite:intersect] min-[1700px]:[mask-composite:add] min-[1700px]:h-auto min-[1700px]:left-[calc(50%+564px)] min-[1700px]:[mask-image:linear-gradient(to_right,transparent,#000_22%)]" // 1280-1699px: the free band in the column's upper right (see freeBand; the camera comes closer there, see backdropZoom), its edges fading out so an orb or label at the edge is not cut. From 1700px: in the gutter on the column's right (the 1040px column is centred beside the 88px sidebar rail, so its edge is at 50% + 564px), its left edge fading out instead of cutting the sphere
                : "inset-y-0 cursor-grab"
          }`}
          style={mode === "backdrop" && band ? { left: band.left, top: band.top, bottom: "auto", height: band.height } : undefined}
        >
          <div ref={labels} className={`pointer-events-none absolute inset-0 z-[1] overflow-hidden ${mode === "backdrop" ? "min-[1700px]:opacity-0" : ""}`} />
        </div>
      </div>
      {stageMode && scene && <StageHud scene={scene} />}
      {stageMode && <Presenter scene={scene} />}
      {children}
    </Ctx>
  );
}
