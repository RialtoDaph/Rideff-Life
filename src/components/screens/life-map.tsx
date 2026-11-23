"use client";

import { ArrowLeft, Keyboard, Maximize, Mic, RotateCw, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAiName, useAppData } from "@/components/app-data";
import { useAssistant } from "@/components/assistant";
import { ConfirmCard } from "@/components/assistant-card";
import { Clopar } from "@/components/clopar";
import { useScene } from "@/components/scene/scene-host";
import { ScreenEmpty } from "@/components/empty-state";
import { useMoneyForms } from "@/components/money-forms";
import { HUBS, type MapGraph, type MapNode } from "@/lib/life-map";
import { scoreState, type LifeScore, type PillarKey, type ScoreLine } from "@/lib/life-score";
import { useErrorText } from "./ask";
import { useFreshSteps } from "./home";

const OPEN: Record<PillarKey, string> = { money: "/budget", time: "/week", health: "/gym", goals: "/ygoals" };
const DOT = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)", neu: "var(--mut2)", acc: "var(--acc)" };
const CONFIRM_MS = 1400;
const noop = () => () => {};

export function LifeMapScreen() {
  const t = useTranslations("home");
  const label = useTranslations("ui");
  const { fresh } = useFreshSteps();
  const { openForm } = useMoneyForms();
  if (fresh) return <ScreenEmpty eyebrow={label("life_map")} title={t("map_empty")} action={t("map_empty_action")} onAction={() => openForm("income")} />;
  return <LifeMap />;
}

/** The map without 3D, for a device that cannot draw it: the score, the four areas, and each area's items. */
function StaticMap({ graph, note, selected, onSelect }: { graph: MapGraph; note: string; selected: string | null; onSelect: (id: string | null) => void }) {
  const core = graph.nodes.find((n) => n.kind === "core");
  const hubs = graph.nodes.filter((n) => n.kind === "hub");
  return (
    <div className="absolute inset-0 z-[1] overflow-y-auto px-3.5 pb-[150px] pt-[calc(env(safe-area-inset-top)+128px)]">
      <div className="mx-auto flex max-w-[720px] flex-col gap-3">
        <div className="text-center">
          <div className="font-serif text-[64px] leading-none">{core?.val ?? "—"}</div>
          <div className="eyebrow mt-1">{core?.label}</div>
          <p className="m-0 mt-2 text-[12.5px] text-mut">{note}</p>
        </div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {hubs.map((h) => (
            <div key={h.id} className={`flex flex-col gap-2.5 rounded-[18px] border-[1.5px] bg-card p-4 ${selected === h.id ? "border-acc" : "border-line"}`}>
              <button onClick={() => onSelect(h.id)} className="flex items-center gap-2 border-0 bg-transparent p-0 text-left text-ink">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: DOT[h.st] }} />
                <span className="flex-1 text-[15px] font-bold">{h.label}</span>
                <span className="font-mono text-[13px] font-bold text-mut">{h.val ?? "—"}</span>
              </button>
              <div className="flex flex-wrap gap-1.5">
                {graph.nodes
                  .filter((n) => n.hub === h.hub && n.kind !== "hub")
                  .map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onSelect(n.id)}
                      className={`flex min-h-9 items-center gap-1.5 rounded-full border bg-soft px-3 text-[12.5px] font-bold text-ink ${selected === n.id ? "border-acc" : "border-line"}`}
                    >
                      <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: DOT[n.st] }} />
                      <span className="max-w-[180px] truncate">{n.label}</span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LifeMap() {
  const t = useTranslations("home");
  const tt = useTranslations("t");
  const ui = useTranslations("ui");
  const router = useRouter();
  const { openForm } = useMoneyForms();

  // The canvas lives in the shell, so it survives moving between screens; this screen drives it.
  const { scene, failed, setOnSelect, life } = useScene();
  const { score, graph } = life;
  const [selected, setSelected] = useState<string | null>(null);
  const reduced = useSyncExternalStore(noop, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const [spinChoice, setSpin] = useState<boolean | null>(null);
  const spin = spinChoice ?? !reduced;
  const [talking, setTalking] = useState(false);
  // The map belongs to Life Plus and Together; a finished trial counts as Life.
  const locked = useAppData().plan === "life";

  useEffect(() => {
    setOnSelect(setSelected);
    return () => setOnSelect(() => {});
  }, [setOnSelect]);
  useEffect(() => scene?.setSelected(selected), [scene, selected]);
  useEffect(() => scene?.setSpin(spin), [scene, spin]);
  // Leaving the map leaves nothing selected for the next screen that uses the canvas.
  useEffect(() => () => scene?.setSelected(null), [scene]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) {
        void scene?.flyTo("core", { ms: 600 });
        router.push("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, scene]);

  const node = graph.nodes.find((n) => n.id === selected);
  const topic = node ? node.label : HUBS.map((k) => tt(`p_${k}`)).join(", ");
  const question = tt("mapAsk").replace("{x}", topic);

  return (
    <section
      data-screen-label="Life Map"
      className={`fixed inset-0 z-[55] overflow-hidden ${failed ? "" : "pointer-events-none"}`}
      style={failed ? { background: "radial-gradient(circle at 50% 46%, var(--tint) 0%, var(--bg) 64%) var(--bg)" } : undefined}
    >

      <div className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] z-[2] flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2 self-start">
            {/* The way out, named as what it is. The × in the toolbar reads as a tool, not as "go back". */}
            <Link
              href="/"
              onClick={() => void scene?.flyTo("core", { ms: 600 })}
              aria-label={ui("back_home")}
              title={ui("back_home")}
              className="hit44 glass flex h-11 flex-none items-center justify-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-[13px] font-bold text-ink hover:text-ink"
            >
              <ArrowLeft size={18} strokeWidth={2.2} />
              <span className="hidden wide:inline">{ui("back_home")}</span>
            </Link>
            <div className="glass flex items-center gap-2 rounded-full border border-line bg-card py-[5px] pl-[5px] pr-3.5 shadow-[0_4px_16px_rgba(0,0,0,.06)]">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-acc text-[12.5px] font-bold text-onacc">{score.total ?? "—"}</span>
              <h1 className="m-0 whitespace-nowrap text-[13px] font-bold">{ui("life_map")}</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {score.pillars.map((p) => {
              const on = selected === `h-${p.k}`;
              return (
                <button
                  key={p.k}
                  onClick={() => setSelected(on ? null : `h-${p.k}`)}
                  aria-pressed={on}
                  className={`flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] bg-card px-3 text-[12.5px] font-bold text-ink ${on ? "border-acc" : "border-line"}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: DOT[scoreState(p.score)] }} />
                  {tt(`p_${p.k}`)}
                  <span className="font-mono text-[11.5px] text-mut2">{p.score ?? "—"}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="pointer-events-auto flex flex-none gap-1 rounded-xl border border-line bg-card p-1">
          <Link href="/" onClick={() => void scene?.flyTo("core", { ms: 600 })} aria-label={t("map_close")} title={t("map_close")} className="hit44 flex h-9 w-9 items-center justify-center rounded-lg bg-soft2 text-ink">
            <X size={16} strokeWidth={2.2} />
          </Link>
          <button
            onClick={() => {
              scene?.fit();
              setSelected(null);
            }}
            aria-label={tt("mapFit")}
            title={tt("mapFit")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-0 bg-transparent text-ink"
          >
            <Maximize size={17} strokeWidth={2} />
          </button>
          <button
            onClick={() => setSpin(!spin)}
            aria-label={tt("mapSpin")}
            aria-pressed={spin}
            title={tt("mapSpin")}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border-0 ${spin ? "bg-tint text-acct" : "bg-transparent text-mut"}`}
          >
            <RotateCw size={17} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* The canvas is for the eyes; this is the same map for a screen reader. */}
      <ul className="sr-only">
        {graph.nodes
          .filter((n) => n.kind !== "core")
          .map((n) => (
            <li key={n.id}>
              <button onClick={() => setSelected(n.id)}>{n.val === null || n.val === undefined ? n.label : `${n.label}: ${n.val}`}</button>
            </li>
          ))}
      </ul>

      {failed && <StaticMap graph={graph} note={t("map_failed")} selected={selected} onSelect={setSelected} />}

      <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+14px)] left-3.5 right-[118px] z-[2] flex flex-col gap-1.5">
        {!talking && !node && <div className="text-xs text-mut2">{tt("mapHint")}</div>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] font-bold text-mut">
          {(["ok", "warn", "bad"] as const).map((k) => (
            <span key={k} className="flex items-center gap-[5px]">
              <span className="h-2 w-2 rounded-full" style={{ background: DOT[k] }} />
              {tt(k === "ok" ? "mapOk" : k === "warn" ? "mapWarn" : "mapBad")}
            </span>
          ))}
        </div>
      </div>

      {node && !talking && (
        <Panel
          node={node}
          score={score}
          onClose={() => setSelected(null)}
          onEdit={(act) => openForm(act[0] as Parameters<typeof openForm>[0], act[1])}
          onAsk={() => setTalking(true)}
        />
      )}

      <Corner open={talking} onOpen={() => setTalking(true)} onClose={() => setTalking(false)} question={question} />

      {locked && (
        <div className="pointer-events-auto absolute inset-0 z-[5] flex items-center justify-center p-5 backdrop-blur-[7px]">
          <div className="flex max-w-[380px] flex-col gap-3 rounded-[14px] border border-line bg-card p-[22px] shadow-[0_20px_50px_rgba(0,0,0,.18)]">
            <span className="self-start rounded-full bg-tint px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[.12em] text-acct">Life Plus</span>
            <div className="text-xl font-bold leading-[1.25]">{tt("mapUnlock")}</div>
            <div className="text-[13.5px] leading-normal text-mut">{tt("mapUnlockSub")}</div>
            <Link href="/plan" className="flex min-h-12 items-center justify-center rounded-full bg-acc text-sm font-bold text-onacc hover:text-onacc">
              {t("unlock")}
            </Link>
            <Link href="/" className="flex min-h-11 items-center justify-center text-[13px] font-bold text-mut">
              {ui("back_home")}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function useScoreLine() {
  const t = useTranslations("home");
  return (l: ScoreLine) => {
    switch (l.key) {
      case "flex":
        return t("line_flex", { pct: l.pct });
      case "ef":
        return t("line_ef", { months: l.months, target: l.target });
      case "evenings":
        return t("line_evenings", { n: l.n });
      case "focus":
        return t("line_focus", { done: l.done, total: l.total });
      case "learn":
        return t("line_learn", { minutes: l.minutes });
      case "gym":
        return t("line_gym", { done: l.done, goal: l.goal });
      case "goals":
        return t("line_goals", { done: l.done, total: l.total });
      case "yearly":
        return t("line_yearly", { done: l.done, total: l.total });
    }
  };
}

function Panel({
  node,
  score,
  onClose,
  onEdit,
  onAsk,
}: {
  node: MapNode;
  score: LifeScore;
  onClose: () => void;
  onEdit: (act: [string, string]) => void;
  onAsk: () => void;
}) {
  const aiName = useAiName();
  const t = useTranslations("home");
  const tt = useTranslations("t");
  const lineText = useScoreLine();
  const lines = node.kind === "hub" ? (score.pillars.find((p) => p.k === node.hub)?.lines ?? []) : [];
  const pill = "flex min-h-10 items-center rounded-full px-3.5 text-[13px] font-bold";

  return (
    <div className="pointer-events-auto absolute bottom-11 left-3 right-[104px] z-[3] flex max-h-[58%] max-w-[320px] flex-col gap-2.5 overflow-y-auto rounded-[14px] border border-line bg-card p-3.5 shadow-[0_14px_40px_rgba(0,0,0,.16)] min-[701px]:bottom-auto min-[701px]:left-auto min-[701px]:right-3 min-[701px]:top-[110px] min-[701px]:w-[300px]">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: DOT[node.st] }} />
        <span className="flex-1 font-mono text-[11px] font-bold uppercase tracking-[.14em] text-mut2">{tt(`k_${node.kind}`)}</span>
        <button onClick={onClose} aria-label={t("close")} className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-soft2 text-ink">
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
      <div className="text-[19px] font-bold leading-[1.2] tracking-[-0.01em]">{node.label}</div>
      <div className="flex flex-wrap gap-1.5">
        {node.kind === "hub" && (
          <Link href={OPEN[node.hub!]} className={`hit44 ${pill} border border-line bg-card text-ink`}>
            {tt("mapOpen")}
          </Link>
        )}
        {node.act && (
          <button onClick={() => onEdit(node.act!)} className={`${pill} border border-line bg-card text-ink`}>
            {tt("mapEdit")}
          </button>
        )}
        <button onClick={onAsk} className={`${pill} border-0 bg-acc text-onacc`}>
          {tt("mapAskL")} {aiName}
        </button>
      </div>
      <div>
        {node.fields.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line py-[7px] text-[13px]">
            <span className="text-mut">{k}</span>
            <span className="text-right font-bold">{v}</span>
          </div>
        ))}
        {lines.map((l) => (
          <div key={l.key} className="flex gap-2 border-b border-line py-[7px] text-[13px]">
            <span className={l.good ? "text-ok" : "text-bad"}>{l.good ? "▲" : "▼"}</span>
            <span className="font-medium">{lineText(l)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Clopar in the corner: tap, it grows where it stands, listens, thinks, answers in a
 * short caption, smiles, and shrinks back. It never reaches the middle of the map.
 * The mode comes straight from the realtime session events.
 */
function Corner({ open, onOpen, onClose, question }: { open: boolean; onOpen: () => void; onClose: () => void; question: string }) {
  const aiName = useAiName();
  const t = useTranslations("assistant");
  const errorText = useErrorText();
  const { talk, caption, busy, voiceOn, muted, error, pendingCard: card, send, startVoice, stop, setMuted } = useAssistant();
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const asked = useRef(false);

  // Opening starts listening. Without a microphone or minutes it falls back to the
  // question about what the map is showing, as text.
  useEffect(() => {
    if (open && !asked.current) {
      void startVoice().then((ok) => {
        if (!ok) void send(question);
      });
    }
    asked.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    stop();
    setTyping(false);
    setDraft("");
    onClose();
  }

  // Shrinks back once the answer is done and nothing is waiting on a card.
  const idle = open && !voiceOn && !busy && !typing && !card && (talk.mode === "calm" || talk.mode === "speak") && !error;
  useEffect(() => {
    if (!idle) return;
    const timer = setTimeout(close, Math.max(3000, caption.length * 65) + CONFIRM_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, caption]);

  function submit() {
    const q = draft.trim();
    if (!q) return;
    setDraft("");
    setTyping(false);
    void send(q);
  }

  const round = "flex h-10 w-10 items-center justify-center rounded-full border-0 bg-soft2 text-ink";
  const line = error ? errorText(error) : caption;

  return (
    <div
      data-screen-label="Map talk"
      className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+14px)] right-3.5 z-[4] flex max-w-[calc(100%-28px)] flex-col items-end gap-1"
    >
      {open && card && (
        <div className="mb-1 flex w-[min(320px,calc(100vw-28px))]">
          <ConfirmCard key={card.id} card={card} />
        </div>
      )}
      {open && line && (
        <p
          aria-live="polite"
          className="m-0 mr-1.5 line-clamp-2 max-w-[300px] text-right text-[17px] font-light leading-[1.35] text-ink [text-shadow:0_1px_12px_var(--bg),0_0_2px_var(--bg)] [text-wrap:balance]"
        >
          {line}
        </p>
      )}
      {typing && (
        <div className="pointer-events-auto flex w-[min(280px,calc(100vw-28px))] items-center gap-1 rounded-full border border-line bg-card py-[3px] pl-3.5 pr-[3px]">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={t("type_to", { name: aiName })}
            className="h-[38px] min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none"
          />
          <button onClick={submit} aria-label={t("send")} className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full border-0 bg-acc font-bold text-onacc">
            ↑
          </button>
        </div>
      )}
      <button
        onClick={() => (open ? void startVoice() : onOpen())}
        aria-label={aiName}
        className={`pointer-events-auto border-0 bg-transparent p-0 transition-[width,height] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${
          open ? "h-[min(220px,46vw)] w-[min(220px,46vw)] wide:h-[260px] wide:w-[260px]" : "h-24 w-24 wide:h-32 wide:w-32"
        }`}
      >
        <span className="relative block h-full w-full">
          <Clopar variant="map" mode={talk.mode} />
        </span>
      </button>
      {!open && (
        <span className="glass pointer-events-none mr-1.5 rounded-full border border-line bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-ink">
          {t("ask_name", { name: aiName })}
        </span>
      )}
      {open && (
        <div className="pointer-events-auto mr-1.5 flex gap-1.5">
          <button
            onClick={() => (voiceOn ? stop() : void startVoice())}
            aria-label={t(voiceOn ? "voice_stop" : "voice_start")}
            aria-pressed={voiceOn}
            className={voiceOn ? "flex h-10 w-10 items-center justify-center rounded-full border-0 bg-acc text-onacc" : round}
          >
            <Mic size={17} strokeWidth={2} />
          </button>
          <button onClick={() => setTyping((v) => !v)} aria-label={t("type_instead")} className={round}>
            <Keyboard size={17} strokeWidth={2} />
          </button>
          <button onClick={() => setMuted(!muted)} aria-label={t(muted ? "unmute" : "mute")} aria-pressed={muted} className={round}>
            {muted ? <VolumeX size={17} strokeWidth={2} /> : <Volume2 size={17} strokeWidth={2} />}
          </button>
          <button onClick={close} aria-label={t("close")} className={round}>
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </div>
  );
}
