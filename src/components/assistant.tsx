"use client";

import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { askClopar } from "@/lib/ask";
import type { AskAction } from "@/lib/ask-schema";
import { authedPost, connectRealtime, isMicError, runAssistantTool, type Realtime, type SessionInfo } from "@/lib/assistant-client";
import { connectAgent } from "@/lib/agent-client";
import { firstSentence, functionCalls, TALK_START, talkStep, type FunctionCall, type Talk } from "@/lib/assistant-events";
import type { Card, CardStatus } from "@/lib/assistant-tools";
import { canListen, listenOnce, speak } from "@/lib/browser-voice";
import { cannedFor, type Canned } from "@/content/canned";
import { nextCanned, planCanned } from "@/lib/canned-voice";
import { stageCues } from "@/lib/stage-cues";
import { dispatchShow, hubForTool, resolveShow, showLabel } from "@/lib/show";
import { supabase } from "@/lib/supabase";
import { voiceLevel } from "@/lib/voice-level";

export type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  nums?: { label: string; value: string }[];
  next?: string | null;
  action?: AskAction;
  card?: Card;
};
/** One thing the assistant did while answering: a tool it called, with what it was asked and how long it took. */
export type ToolStep = { name: string; args: string; ms: number; output: string };
/** What one answer was made of: what was heard, what was done, what was said. */
export type TraceEntry = { id: string; heard: string; steps: ToolStep[]; answer: string; tier: "realtime" | "browser" | "ask" | "recorded" | "prepared" };
export type AssistantError = "voice_quota" | "ai_quota" | "not_configured" | "mic" | "failed" | null;
type Live = { rt: Realtime; info: SessionInfo & { spoken: boolean }; voice: boolean; turns: { role: string; text: string }[]; tools: string[]; timer?: ReturnType<typeof setTimeout> };

type Assistant = {
  turns: Turn[];
  /** The card this session is waiting on. */
  pendingCard: Card | null;
  talk: Talk;
  /** One or two lines for under the character. */
  caption: string;
  busy: boolean;
  connecting: boolean;
  voiceOn: boolean;
  muted: boolean;
  /** The microphone is held back (the session stays open). */
  micMuted: boolean;
  setMicMuted: (on: boolean) => void;
  error: AssistantError;
  quota: { voiceLeft: number | null; aiLeft: number | null };
  /** Which voice is in use: the realtime one, or the browser's own listening and speaking. */
  tier: "realtime" | "browser" | "recorded" | "prepared" | null;
  /** The latest answers, newest last, with the tools behind each. */
  traces: TraceEntry[];
  /** The tools called for the answer that is being made right now, as they finish. */
  liveSteps: ToolStep[];
  /** The language spoken to Clopar and spoken back. It starts as the app's language and can differ from it. */
  voiceLang: string;
  setVoiceLang: (lang: string) => void;
  send: (text: string, viaAsk?: boolean) => Promise<void>;
  startVoice: () => Promise<boolean>;
  stop: () => void;
  /** Plays the next canned answer in the voice language (tier 3): no network, nothing written. `again` repeats the last. */
  playCanned: (again?: boolean) => boolean;
  setMuted: (on: boolean) => void;
  answerCard: (card: Card, action: "save" | "undo", text?: string) => Promise<void>;
  editCard: (card: Card) => void;
  clear: () => Promise<void>;
};

const Ctx = createContext<Assistant | null>(null);
const CONFIRM_MS = 1400;
const IDLE_MS = 5 * 60 * 1000;
const newId = () => crypto.randomUUID();

export function useAssistant() {
  const a = useContext(Ctx);
  if (!a) throw new Error("useAssistant needs AssistantProvider");
  return a;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const toast = useToast();
  const { userId } = useAppData();
  const money = useMoney();
  const time = useTime();
  const { openForm } = useMoneyForms();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingCard, setPendingCard] = useState<Card | null>(null);
  const [talk, setTalkState] = useState<Talk>(TALK_START);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [micMuted, setMicMutedState] = useState(false);
  const micMutedRef = useRef(false);
  const [error, setError] = useState<AssistantError>(null);
  const [quota, setQuota] = useState<Assistant["quota"]>({ voiceLeft: null, aiLeft: null });
  const [tier, setTier] = useState<Assistant["tier"]>(null);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [liveSteps, setLiveSteps] = useState<ToolStep[]>([]);
  const [voiceChoice, setVoiceChoice] = useState<string | null>(null);
  const voiceLang = voiceChoice ?? locale;
  const langRef = useRef(voiceLang);
  useEffect(() => {
    langRef.current = voiceLang;
  }, [voiceLang]);
  const dropRef = useRef<() => void>(() => {});
  const canned = useRef<{ timers: ReturnType<typeof setTimeout>[]; last: string | null; stopSpeak: () => void; audio: HTMLAudioElement | null }>({ timers: [], last: null, stopSpeak: () => {}, audio: null });
  // Bumped by every stop(): a start that was still connecting when the person stopped must not come alive afterwards.
  const gen = useRef(0);
  const starting = useRef(false);

  const talkRef = useRef(TALK_START);
  const live = useRef<Live | null>(null);
  const mutedRef = useRef(false);
  const handler = useRef<(e: { type: string }) => void>(() => {});
  const steps = useRef<ToolStep[]>([]);
  const heardLast = useRef("");
  const browser = useRef<{ stopListen: () => void; stopSpeak: () => void; on: boolean }>({ stopListen: () => {}, stopSpeak: () => {}, on: false });
  const sendRef = useRef<(q: string, viaAsk?: boolean) => Promise<void>>(async () => {});
  const loopRef = useRef<() => void>(() => {});

  const setTalk = useCallback((next: Talk) => {
    talkRef.current = next;
    setTalkState(next);
  }, []);

  // Chat history lives in ai_messages: own rows only, pruned after 90 days.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const sb = supabase();
      const { data } = await sb.from("ai_messages").select("id,role,text,cards").order("created_at", { ascending: false }).limit(100);
      const rows = ((data ?? []) as { id: string; role: Turn["role"]; text: string; cards: Partial<Turn> | null }[]).reverse();
      const loaded: Turn[] = rows.map((r) => ({ id: r.id, role: r.role, text: r.text, ...r.cards }));
      const ids = loaded.flatMap((x) => (x.card ? [x.card.id] : []));
      if (ids.length) {
        const { data: states } = await sb.from("ai_pending_actions").select("id,status").in("id", ids);
        const by = new Map(((states ?? []) as { id: string; status: CardStatus }[]).map((s) => [s.id, s.status]));
        for (const x of loaded) if (x.card) x.card = { ...x.card, status: by.get(x.card.id) ?? x.card.status };
      }
      if (alive) setTurns(loaded);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const addTurn = useCallback((turn: Omit<Turn, "id">) => {
    const row: Turn = { id: newId(), ...turn };
    setTurns((x) => [...x, row]);
    const { nums, next, action, card } = row;
    void supabase().from("ai_messages").insert({ role: row.role, text: row.text, cards: { nums, next, action, card } });
    if (live.current) live.current.turns.push({ role: row.role, text: row.text });
    return row;
  }, []);

  const stop = useCallback(() => {
    gen.current += 1;
    setConnecting(false);
    canned.current.timers.forEach(clearTimeout);
    canned.current.timers = [];
    canned.current.stopSpeak();
    canned.current.audio?.pause();
    canned.current.audio = null;
    setLiveSteps([]);
    const s = live.current;
    live.current = null;
    browser.current.on = false;
    browser.current.stopListen();
    browser.current.stopSpeak();
    setTier(null);
    setPendingCard(null);
    setVoiceOn(false);
    setBusy(false);
    setTalk(TALK_START);
    voiceLevel.idle();
    if (!s) return;
    clearTimeout(s.timer);
    s.rt.close();
    void authedPost("/api/assistant/end", { session_id: s.info.session_id, turns: s.turns, tools: s.tools, voice: s.voice }, true);
  }, [setTalk]);

  const touch = useCallback(
    (ms = IDLE_MS) => {
      const s = live.current;
      if (!s) return;
      clearTimeout(s.timer);
      s.timer = setTimeout(stop, ms);
    },
    [stop],
  );

  // Set below, once runOne exists: the ElevenAgents session calls its tools through it.
  const agentToolRef = useRef<(name: string, args: string) => Promise<string>>(async () => JSON.stringify({ error: "Tool failed." }));

  const open = useCallback(
    async (voice: boolean) => {
      setConnecting(true);
      setError(null);
      const res = await authedPost<SessionInfo & { spoken: boolean; code?: string; engine?: string; signed_url?: string; instructions?: string; language?: string }>("/api/assistant/session", { mode: voice ? "voice" : "text", locale: langRef.current }, false, voice ? 10000 : 6000);
      if (!res.ok || (!res.data?.token && !res.data?.signed_url)) {
        setConnecting(false);
        return { ok: false as const, code: (res.data?.code ?? "failed") as Exclude<AssistantError, null> };
      }
      const info = res.data;
      setQuota({ voiceLeft: info.voice_left, aiLeft: info.ai_left });
      try {
        const rt =
          info.engine === "elevenagents" && info.signed_url
            ? await connectAgent({ signed_url: info.signed_url, instructions: info.instructions ?? "", language: info.language ?? "en" }, (e) => handler.current(e), () => dropRef.current(), (name, args) => agentToolRef.current(name, args))
            : await connectRealtime(info.token, voice, (e) => handler.current(e), () => dropRef.current(), info.tts ? { sessionId: info.session_id } : undefined);
        rt.setMuted(mutedRef.current);
        rt.muteMic(micMutedRef.current);
        live.current = { rt, info, voice, turns: [], tools: [] };
        setConnecting(false);
        // A voice session ends when the month's minutes do.
        touch(voice ? Math.min(info.voice_left * 1000, 60 * 60 * 1000) : IDLE_MS);
        return { ok: true as const };
      } catch (e) {
        setConnecting(false);
        void authedPost("/api/assistant/end", { session_id: info.session_id });
        return { ok: false as const, code: (isMicError(e) ? "mic" : "failed") as Exclude<AssistantError, null> };
      }
    },
    [touch],
  );

  /** Runs one tool call as the signed-in person (cue, trace step, card, show) and returns the JSON the model gets back. */
  const runOne = useCallback(
    async (c: FunctionCall): Promise<string | null> => {
      {
        const s = live.current;
        if (!s) return null;
        s.tools.push(c.name);
        const began = performance.now();
        // Pointing at a place is the app's own business; a reading tool also points at its area.
        const hub = c.name === "show" ? resolveShow(c.arguments) : hubForTool(c.name);
        if (hub) dispatchShow(hub);
        stageCues.emit({ t: "tool-start", id: c.call_id, name: c.name, target: hub ?? undefined });
        const res = c.name === "show" ? { data: { output: (hub ? { shown: showLabel(hub) ?? hub } : { error: "not on the map" }) as Record<string, unknown> } as { output: Record<string, unknown>; card?: Card } } : await runAssistantTool(s.info.session_id, c.name, c.arguments);
        const took = Math.round(performance.now() - began);
        stageCues.emit({ t: "tool-end", id: c.call_id, name: c.name, ms: took, ok: (() => { const out = res.data?.output; return !!out && typeof out === "object" && !("error" in out); })() });
        steps.current.push({ name: c.name, args: c.arguments, ms: took, output: JSON.stringify(res.data?.output ?? { error: "Tool failed." }).slice(0, 600) });
        setLiveSteps([...steps.current]);
        if (res.data?.card) {
          addTurn({ role: "assistant", text: "", card: res.data.card });
          setPendingCard(res.data.card);
        }
        return JSON.stringify(res.data?.output ?? { error: "Tool failed." });
      }
    },
    [addTurn],
  );

  useEffect(() => {
    agentToolRef.current = async (name, args) => (await runOne({ name, call_id: newId(), arguments: args })) ?? JSON.stringify({ error: "No session." });
  }, [runOne]);

  const runCalls = useCallback(
    async (calls: FunctionCall[]) => {
      const s = live.current; // results go to the session that asked, never to one started since
      if (!s) return;
      for (const c of calls) {
        const out = await runOne(c);
        if (out === null || live.current !== s) return;
        s.rt.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: c.call_id, output: out } });
      }
      s.rt.send({ type: "response.create" });
    },
    [runOne],
  );

  useEffect(() => {
    handler.current = (e) => {
      const event = e as Parameters<typeof talkStep>[1];
      const before = talkRef.current;
      const s = live.current;
      setTalk(talkStep({ ...before, live: !!s?.voice }, event));
      if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript?.trim()) {
        heardLast.current = event.transcript.trim();
        addTurn({ role: "user", text: event.transcript.trim() });
      }
      // Any sign of life from the session ends an earlier error card.
      if (event.type === "input_audio_buffer.speech_started" || event.type === "response.created") setError(null);
      if (event.type === "input_audio_buffer.speech_started") stageCues.emit({ t: "clear" });
      if (event.type === "error") {
        // A stray error event while Clopar listens or speaks is not worth a sticky card. Only a lost answer is.
        setBusy(false);
        if (before.mode === "think") {
          setError("failed");
          setTalk({ ...TALK_START, mode: s?.voice ? "listen" : "calm", live: !!s?.voice });
        }
        return;
      }
      if (event.type !== "response.done") return;
      const calls = functionCalls(event);
      if (calls.length) return void runCalls(calls);
      setBusy(false);
      const reply = talkRef.current.reply.trim();
      if (reply) {
        addTurn({ role: "assistant", text: reply });
        setTraces((x) => [...x.slice(-9), { id: newId(), heard: heardLast.current, steps: steps.current, answer: reply, tier: "realtime" }]);
        steps.current = [];
        setLiveSteps([]);
      }
      if (s && !s.voice) touch();
      if (s && !s.info.spoken) setTalk({ ...talkRef.current, mode: s.voice ? "listen" : "calm" });
    };
  }, [addTurn, runCalls, setTalk, touch]);

  // The browser's own voice: listen for a sentence, answer it through /api/ask, say it aloud, listen again.
  const listenLoop = useCallback(() => {
    const b = browser.current;
    if (!b.on) return;
    setTalk({ ...TALK_START, mode: "listen", live: true });
    b.stopListen = listenOnce(
      langRef.current,
      (text) => {
        heardLast.current = text;
        void sendRef.current(text, true);
      },
      (reason) => {
        if (!b.on || reason === undefined) return; // stopped, or a sentence came and send carries on
        // Silence is no failure: keep listening. Anything else (no permission, no microphone, the speech
        // service out of reach) ends the browser voice with a card that says what to do.
        if (reason === "no-speech" || reason === "nothing") return void setTimeout(() => loopRef.current(), 300);
        stop();
        setError(["not-allowed", "service-not-allowed", "audio-capture", "unsupported"].includes(reason) ? "mic" : "failed");
      },
    );
  }, [setTalk, stop]);

  useEffect(() => {
    loopRef.current = listenLoop;
  }, [listenLoop]);

  /** Hands the conversation to the browser's own voice. */
  const beginBrowser = useCallback(() => {
    browser.current.on = true;
    setTier("browser");
    setVoiceOn(true);
    setError(null);
    listenLoop();
  }, [listenLoop]);

  // A realtime link that is lost while talking is not a silent end: the browser voice takes over, or a card says what happened.
  useEffect(() => {
    dropRef.current = () => {
      const wasVoice = live.current?.voice;
      stop();
      if (!wasVoice) return;
      if (canListen()) beginBrowser();
      else setError("failed");
    };
  }, [beginBrowser, stop]);

  const afterOpen = useCallback(
    (res: Awaited<ReturnType<typeof open>>) => {
      if (!res.ok) {
        // No realtime voice (no key, no connection): the browser can still listen and speak.
        if ((res.code === "not_configured" || res.code === "failed") && canListen()) {
          beginBrowser();
          return true;
        }
        setError(res.code);
        return false;
      }
      setTier("realtime");
      setVoiceOn(true);
      setTalk({ ...TALK_START, mode: "listen", live: true });
      return true;
    },
    [beginBrowser, setTalk],
  );

  const startVoice = useCallback(async () => {
    if (live.current?.voice || browser.current.on) {
      setError(null); // "Retry" on a session that is still alive just clears the card
      return true;
    }
    if (starting.current) return true; // already connecting: not a failure, so callers must not fall back to another session
    starting.current = true;
    try {
      stop();
      const g = gen.current;
      const res = await open(true);
      if (gen.current !== g) {
        // Stopped while connecting: close what just opened and stay quiet.
        if (res.ok) stop();
        return true; // cancelled on purpose, not a failure
      }
      return afterOpen(res);
    } finally {
      starting.current = false;
    }
  }, [afterOpen, open, stop]);

  const playCanned = useCallback(
    (again = false) => {
      const list = cannedFor(langRef.current);
      const c: Canned | null = again && canned.current.last ? (list.find((x) => x.id === canned.current.last) ?? null) : nextCanned(list, canned.current.last);
      if (!c) return false;
      stop(); // any live session or earlier playback ends first
      canned.current.last = c.id;
      const kind = c.source === "recorded" ? "recorded" : "prepared";
      const mine = gen.current;
      const played: ToolStep[] = [];
      setError(null);
      setTier(kind);
      for (const cue of planCanned(c)) {
        canned.current.timers.push(
          setTimeout(() => {
            if (gen.current !== mine) return;
            if (cue.kind === "listen") setTalk({ ...TALK_START, mode: "listen", heard: cue.text, live: false });
            else if (cue.kind === "think") setTalk({ ...TALK_START, mode: "think", live: false });
            else if (cue.kind === "show") dispatchShow(cue.target);
            else if (cue.kind === "step") {
              played.push(cue.step);
              setLiveSteps([...played]);
            } else {
              setTalk({ ...TALK_START, mode: "speak", reply: cue.text, live: false });
              const done = () => {
                if (gen.current !== mine) return;
                setTraces((x) => [...x.slice(-9), { id: newId(), heard: c.heard, steps: played, answer: c.answer, tier: kind }]);
                setLiveSteps([]);
                setTalk(TALK_START);
                setTier(null);
              };
              if (c.audio) {
                const au = new Audio(c.audio);
                canned.current.audio = au;
                au.onended = done;
                au.onerror = () => {
                  canned.current.stopSpeak = speak(cue.text, c.lang, done); // no recording on disk: the browser reads it
                };
                void au.play().catch(() => au.onerror?.(new Event("error")));
              } else canned.current.stopSpeak = speak(cue.text, c.lang, done);
            }
          }, cue.at),
        );
      }
      return true;
    },
    [setTalk, stop],
  );

  const send = useCallback(
    async (raw: string, viaAsk = false) => {
      const q = raw.trim();
      if (!q) return;
      if (busy) {
        // The browser voice is waiting for its next sentence: keep it listening.
        if (viaAsk && browser.current.on) loopRef.current();
        return;
      }
      setError(null);
      const history = turns.filter((x) => x.text).map((x) => ({ role: x.role, text: x.text }));
      addTurn({ role: "user", text: q });
      setBusy(true);
      setTalk({ ...TALK_START, mode: "think", live: !!live.current?.voice });

      if (!live.current && !viaAsk) {
        const res = await open(false);
        // Only a quota is final. No key or no connection falls through to /api/ask below, so a typed question still gets an answer.
        if (!res.ok && (res.code === "ai_quota" || res.code === "voice_quota")) {
          setBusy(false);
          setTalk(TALK_START);
          return setError(res.code);
        }
      }
      const s = live.current;
      if (s) {
        const { data: left, error: used } = await supabase().rpc("ai_message_used");
        if (used?.message.includes("ai_quota")) {
          setBusy(false);
          setTalk(TALK_START);
          setQuota((v) => ({ ...v, aiLeft: 0 }));
          return setError("ai_quota");
        }
        if (typeof left === "number") setQuota((v) => ({ ...v, aiLeft: left }));
        s.rt.send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: q }] } });
        s.rt.send({ type: "response.create" });
        return;
      }

      // No realtime key yet: answer through /api/ask. It reads, it never writes.
      const { answer, error: failed } = await askClopar(q, history, langRef.current);
      setBusy(false);
      if (!answer) {
        if (viaAsk) stop();
        setTalk(TALK_START);
        return setError(failed === "quota" ? "ai_quota" : "failed");
      }
      addTurn({ role: "assistant", text: answer.text, nums: answer.nums, next: answer.next, action: answer.action });
      setTraces((x) => [...x.slice(-9), { id: newId(), heard: q, steps: [], answer: answer.text, tier: viaAsk ? "browser" : "ask" }]);
      setTalk({ ...TALK_START, mode: "speak", reply: answer.text, live: browser.current.on });
      // Spoken aloud when the person talked; then back to listening.
      if (viaAsk && browser.current.on) {
        browser.current.stopSpeak = speak(answer.text, langRef.current, () => {
          if (!browser.current.on) return setTalk(TALK_START);
          listenLoop();
        });
      }
    },
    [addTurn, busy, listenLoop, open, setTalk, stop, turns],
  );
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // While Clopar listens, thinks or speaks, the loudness drives the character and the scene.
  useEffect(() => {
    if (talk.mode === "calm" && !voiceOn) return voiceLevel.idle();
    let raf = 0;
    const tick = (now: number) => {
      const mode = talkRef.current.mode;
      const rt = live.current?.rt;
      let b = { level: 0, bass: 0, mid: 0, high: 0 };
      if (rt && (mode === "listen" || mode === "speak")) b = mode === "speak" ? rt.levels().out : rt.levels().mic;
      else if (mode === "think") b = { level: 0.14 + 0.08 * Math.sin(now / 260), bass: 0.14, mid: 0.08, high: 0.04 };
      else if (mode === "speak") b = { level: 0.3 + 0.22 * Math.abs(Math.sin(now / 150)), bass: 0.3, mid: 0.2, high: 0.1 }; // the browser's voice has no signal to read
      const lift = (v: number) => Math.min(1, v * 2.4);
      voiceLevel.set({ state: mode === "confirm" || mode === "calm" ? "idle" : mode, level: lift(b.level), bass: lift(b.bass), mid: lift(b.mid), high: lift(b.high) });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [talk.mode, voiceOn]);

  const setCard = useCallback((id: string, status: CardStatus) => {
    setTurns((x) => x.map((row) => (row.card?.id === id ? { ...row, card: { ...row.card, status } } : row)));
    setPendingCard((c) => (c?.id === id ? null : c));
  }, []);

  const tell = useCallback((note: string) => {
    live.current?.rt.send({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text: note }] } });
  }, []);

  const answerCard = useCallback(
    async (card: Card, action: "save" | "undo", text?: string) => {
      // An unsaved card is simply dismissed.
      const verb = action === "undo" && card.status === "pending" ? "skip" : action;
      const res = await authedPost<{ ok?: boolean }>("/api/assistant/confirm", { id: card.id, action: verb, text });
      if (!res.ok) return toast(t("card_failed"));
      setCard(card.id, verb === "save" ? "saved" : verb === "skip" ? "skipped" : "undone");
      if (verb === "skip") return tell("The person dismissed the card; nothing was saved.");
      if (verb === "save" && card.kind === "cancel_subs") {
        // The freed money visibly flows to the goal that gets it.
        const subs = (Array.isArray(card.args.subs) ? card.args.subs : []) as { id: string }[];
        const goal = card.args.goal as { id: string } | null;
        if (goal) stageCues.emit({ t: "transfer", from: subs.map((x) => `s-${x.id}`), to: `g-${goal.id}` });
      }
      await Promise.all([money.reload(), time.reload()]);
      if (verb === "undo") return tell("The person undid the saved card.");
      tell("The person saved the card.");
      const back = talkRef.current;
      setTalk({ ...back, mode: "confirm" });
      setTimeout(() => {
        if (talkRef.current.mode === "confirm") setTalk({ ...talkRef.current, mode: back.live ? "listen" : "calm" });
      }, CONFIRM_MS);
    },
    [money, setCard, setTalk, t, tell, time, toast],
  );

  const editCard = useCallback(
    (card: Card) => {
      const a = card.args as Record<string, string | number | null>;
      const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
      if (card.kind === "transaction") {
        const amount = Number(a.amount);
        openForm("tx", undefined, { kind: amount < 0 ? "out" : "in", amount: String(Math.abs(amount)), payee: str(a.payee), category: str(a.category_id), date: str(a.date), visibility: str(a.visibility) });
      } else if (card.kind === "event") {
        openForm("event", undefined, { title: str(a.title), date: str(a.date), start: str(a.time), visibility: str(a.visibility) });
      } else if (card.kind === "goal") {
        openForm("goal", undefined, { name: str(a.name), target: str(a.target), monthly: str(a.monthly), visibility: str(a.visibility) });
      }
      // The form saves it now, so the card is done.
      void authedPost("/api/assistant/confirm", { id: card.id, action: "skip" });
      setCard(card.id, "skipped");
    },
    [openForm, setCard],
  );

  const setMuted = useCallback((on: boolean) => {
    mutedRef.current = on;
    setMutedState(on);
    live.current?.rt.setMuted(on);
  }, []);

  const setMicMuted = useCallback((on: boolean) => {
    micMutedRef.current = on;
    setMicMutedState(on);
    live.current?.rt.muteMic(on);
  }, []);

  const clear = useCallback(async () => {
    setTurns([]);
    await supabase().from("ai_messages").delete().eq("member_id", userId);
  }, [userId]);

  // A thinking state that never ends (the model or a tool went quiet) must end: after 30 s the card says so.
  useEffect(() => {
    // Realtime voice never sets busy (the person just speaks), so "think" alone arms it.
    if (talk.mode !== "think") return;
    const id = setTimeout(() => {
      setBusy(false);
      setError("failed");
      const s = live.current;
      setTalk({ ...TALK_START, mode: s?.voice ? "listen" : "calm", live: !!s?.voice });
    }, 45000);
    return () => clearTimeout(id);
  }, [talk.mode, setTalk]);

  // Losing the network is a drop like any other: the browser voice takes over, or a card says what happened.
  useEffect(() => {
    const off = () => {
      if (live.current?.voice) dropRef.current();
    };
    window.addEventListener("offline", off);
    return () => window.removeEventListener("offline", off);
  }, []);

  // Close properly when the page goes away, so the minutes and memories are booked.
  useEffect(() => {
    window.addEventListener("pagehide", stop);
    return () => window.removeEventListener("pagehide", stop);
  }, [stop]);

  const caption =
    talk.mode === "think" ? t("thinking") : talk.mode === "listen" ? talk.heard || t("listening") : firstSentence(talk.reply);

  const value = useMemo<Assistant>(
    () => ({ turns, pendingCard, talk, caption, busy, connecting, voiceOn, muted, micMuted, setMicMuted, error, quota, tier, traces, liveSteps, voiceLang, setVoiceLang: setVoiceChoice, send, startVoice, stop, playCanned, setMuted, answerCard, editCard, clear }),
    [turns, pendingCard, talk, caption, busy, connecting, voiceOn, muted, micMuted, setMicMuted, error, quota, tier, traces, liveSteps, voiceLang, setVoiceChoice, send, startVoice, stop, playCanned, setMuted, answerCard, editCard, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
