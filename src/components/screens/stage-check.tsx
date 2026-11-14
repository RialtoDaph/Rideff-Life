"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useAiName, useAppData } from "@/components/app-data";
import { Slab } from "@/components/ds/slab";
import { useScene } from "@/components/scene/scene-host";
import { DEMO_HOUSEHOLD } from "@/lib/tour";
import { authedPost, connectRealtime, type SessionInfo } from "@/lib/assistant-client";
import { canListen, canSpeak } from "@/lib/browser-voice";
import { PageHeader } from "./page-header";

type State = "wait" | "ok" | "bad" | "skip";
type Row = { key: string; state: State; fix?: string };

const DOT: Record<State, string> = { wait: "var(--mut2)", ok: "var(--ok)", bad: "var(--bad)", skip: "var(--warn)" };
const FPS_OK = 50;
const noop = () => () => {};

/**
 * The check before going on stage: every thing the demo needs, with a light for each.
 * What needs the person's tap (microphone, sound, the realtime link) waits for the button.
 */
export function StageCheckScreen() {
  const t = useTranslations("assistant");
  const aiName = useAiName();
  const { scene, failed } = useScene();
  const [online, setOnline] = useState(true);
  const { household } = useAppData();
  const isDemo = household?.name === DEMO_HOUSEHOLD;
  const [fps, setFps] = useState<number | null>(null);
  const [woken, setWoken] = useState<Partial<Record<"mic" | "audio" | "session" | "webrtc", Row>>>({});
  const [running, setRunning] = useState(false);
  const [charging, setCharging] = useState<boolean | null>(null);
  // What the browser can do is known only in the browser: the server draws the cautious answer first.
  const browserVoice = useSyncExternalStore(noop, () => canListen() && canSpeak(), () => false);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // On battery, the browser may hold animation to 30 frames a second: the demo should be on the charger.
  useEffect(() => {
    const get = (navigator as unknown as { getBattery?: () => Promise<{ charging: boolean; addEventListener: (n: string, f: () => void) => void; removeEventListener: (n: string, f: () => void) => void }> }).getBattery;
    if (!get) return;
    let alive = true;
    let off = () => {};
    void get.call(navigator).then((b) => {
      if (!alive) return;
      const read = () => setCharging(b.charging);
      read();
      b.addEventListener("chargingchange", read);
      off = () => b.removeEventListener("chargingchange", read);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  // The frame rate of the scene, read every second.
  useEffect(() => {
    if (!scene) return;
    const id = setInterval(() => setFps(scene.stats().fps), 1000);
    return () => clearInterval(id);
  }, [scene]);

  const wake = useCallback(async () => {
    setRunning(true);
    setWoken({});
    const set = (k: keyof typeof woken, row: Row) => setWoken((v) => ({ ...v, [k]: row }));
    // Each check stands alone and shows its light as soon as it is done: a permission prompt
    // nobody has answered yet must not hold the others back.
    await Promise.all([
      (async () => {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          mic.getTracks().forEach((x) => x.stop());
          set("mic", { key: "sc_mic", state: "ok" });
        } catch {
          set("mic", { key: "sc_mic", state: "bad", fix: t("sc_fix_mic") });
        }
      })(),
      (async () => {
        try {
          const ctx = new AudioContext();
          await ctx.resume();
          set("audio", { key: "sc_audio", state: ctx.state === "running" ? "ok" : "bad" });
          void ctx.close();
        } catch {
          set("audio", { key: "sc_audio", state: "bad" });
        }
      })(),
      (async () => {
        // The real thing: a session from the server, then the realtime link itself.
        const res = await authedPost<SessionInfo & { code?: string }>("/api/assistant/session", { mode: "text", locale: "en" });
        if (!res.ok || !res.data?.token) {
          set("session", { key: "sc_session", state: "bad", fix: t("sc_fix_session") });
          return set("webrtc", { key: "sc_webrtc", state: "skip" });
        }
        set("session", { key: "sc_session", state: "ok" });
        try {
          const rt = await connectRealtime(res.data.token, false, () => {}, () => {});
          rt.close();
          set("webrtc", { key: "sc_webrtc", state: "ok" });
        } catch {
          set("webrtc", { key: "sc_webrtc", state: "bad", fix: t("sc_fix_webrtc") });
        }
        void authedPost("/api/assistant/end", { session_id: res.data.session_id }, true);
      })(),
    ]);
    setRunning(false);
  }, [t]);

  const w = (k: keyof typeof woken, key: string): Row => woken[k] ?? { key, state: "wait" };
  const rows: Row[] = [
    { key: "sc_online", state: online ? "ok" : "bad" },
    { key: "sc_household", state: isDemo ? "ok" : "bad", fix: isDemo ? undefined : t("sc_fix_household") },
    { key: "sc_webgl", state: failed ? "bad" : scene ? "ok" : "wait" },
    { key: "sc_power", state: charging === null ? "skip" : charging ? "ok" : "bad", fix: charging === false ? t("sc_fix_power") : undefined },
    { key: "sc_fps", state: fps === null ? "wait" : fps >= FPS_OK ? "ok" : "bad", fix: fps !== null && fps < FPS_OK ? t("sc_fix_fps") : undefined },
    w("mic", "sc_mic"),
    w("audio", "sc_audio"),
    w("session", "sc_session"),
    w("webrtc", "sc_webrtc"),
    { key: "sc_browser_voice", state: browserVoice ? "ok" : "skip" },
  ];
  const text: Record<State, string> = { wait: t("sc_wait"), ok: t("sc_ok"), bad: t("sc_bad"), skip: t("sc_skip") };

  return (
    <div data-screen-label="Stage check" className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <PageHeader eyebrow="rideff Life" title={t("sc_title")}>
        <p className="m-0 mt-2 text-[14px] text-mut">{t("sc_sub")}</p>
      </PageHeader>
      <Slab className="flex flex-col gap-1">
        <button onClick={() => void wake()} disabled={running} className="hit44 mb-3 flex min-h-12 flex-col items-start justify-center rounded-[14px] border-0 bg-acc px-4 text-left text-onacc disabled:opacity-60">
          <span className="text-[15px] font-bold">{running ? t("sc_wait") : Object.keys(woken).length ? t("sc_run") : t("sc_wake", { name: aiName })}</span>
          <span className="text-[12px] opacity-80">{t("sc_wake_sub")}</span>
        </button>
        <ul className="m-0 flex list-none flex-col p-0">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: DOT[r.state] }} />
                <span className="flex-1 text-[15px] font-bold">{(t as (key: string) => string)(r.key)}</span>
                <span className="font-mono text-[12px] text-mut">
                  {r.key === "sc_fps" && fps !== null ? `${fps} fps` : text[r.state]}
                </span>
              </div>
              {r.fix && <p className="m-0 pl-[22px] text-[13px] text-mut">{r.fix}</p>}
            </li>
          ))}
        </ul>
      </Slab>
    </div>
  );
}
