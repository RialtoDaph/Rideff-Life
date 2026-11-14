"use client";

import { Keyboard, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAiName } from "@/components/app-data";
import { useAssistant, type ToolStep, type TraceEntry } from "@/components/assistant";
import { useErrorText } from "@/components/screens/ask";
import { Sheet } from "@/components/sheet";
import { firstSentence } from "@/lib/assistant-events";

const prettyArgs = (args: string) => {
  try {
    const o = JSON.parse(args) as Record<string, unknown>;
    return Object.keys(o).length ? JSON.stringify(o) : "";
  } catch {
    return args;
  }
};

function Step({ step }: { step: ToolStep }) {
  return (
    <li className="flex flex-col gap-1 rounded-[12px] border border-line bg-soft px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[13px] font-bold text-acc">{step.name}</span>
        <span className="font-mono text-[11px] text-mut2">{step.ms} ms</span>
      </div>
      {prettyArgs(step.args) && <code className="break-all font-mono text-[11.5px] text-mut">{prettyArgs(step.args)}</code>}
      <code className="line-clamp-3 break-all font-mono text-[11.5px] text-mut2">{step.output}</code>
    </li>
  );
}

/** How one answer was made, from what was heard to what was said. The real record, not a picture of it. */
function TraceSheet({ traces, onClose }: { traces: TraceEntry[]; onClose: () => void }) {
  const t = useTranslations("assistant");
  const label = { realtime: t("trace_realtime"), browser: t("trace_browser"), ask: t("trace_ask") };
  return (
    <Sheet title={t("trace_title")} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {[...traces].reverse().slice(0, 3).map((e) => (
          <section key={e.id} className="flex flex-col gap-2.5">
            <span className="self-start rounded-full bg-tint px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[.12em] text-acct">{label[e.tier]}</span>
            <div>
              <div className="font-mono text-[11px] font-bold uppercase tracking-[.14em] text-mut2">{t("trace_heard")}</div>
              <p className="m-0 mt-1 text-[15px]">{e.heard || "—"}</p>
            </div>
            <div>
              <div className="font-mono text-[11px] font-bold uppercase tracking-[.14em] text-mut2">{t("trace_called")}</div>
              {e.steps.length ? (
                <ul className="m-0 mt-1.5 flex list-none flex-col gap-2 p-0">
                  {e.steps.map((s, i) => (
                    <Step key={i} step={s} />
                  ))}
                </ul>
              ) : (
                <p className="m-0 mt-1 text-[13px] text-mut">{t("trace_none")}</p>
              )}
            </div>
            <div>
              <div className="font-mono text-[11px] font-bold uppercase tracking-[.14em] text-mut2">{t("trace_said")}</div>
              <p className="m-0 mt-1 text-[15px] leading-[1.45]">{e.answer}</p>
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

/**
 * What Clopar is doing, in words, above the dock: what it hears, that it is thinking, what it says,
 * and the tools behind the answer. A failure here is a card with something to press, not a dead end.
 */
export function VoiceCaption() {
  const t = useTranslations("assistant");
  const aiName = useAiName();
  const errorText = useErrorText();
  const { talk, error, tier, traces, voiceOn, busy, send, startVoice, stop } = useAssistant();
  const [trace, setTrace] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");

  const last = traces.at(-1);
  const active = voiceOn || busy || talk.mode !== "calm";
  if (!active && !error && !typing) return null;

  const status = error ? "" : talk.mode === "think" ? t("thinking") : talk.mode === "listen" ? t("listening") : talk.mode === "speak" ? aiName : "";
  const text = error
    ? errorText(error)
    : talk.mode === "think"
      ? ""
      : talk.mode === "listen"
        ? talk.heard || (last && !talk.heard ? last.answer : "")
        : firstSentence(talk.reply) || last?.answer || "";

  const submit = () => {
    const q = draft.trim();
    if (!q) return;
    setDraft("");
    setTyping(false);
    void send(q);
  };
  const btn = "hit44 pointer-events-auto flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-[13px] font-bold text-ink";

  return (
    <>
      <div data-noprint aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(104px+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4 text-center">
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[.16em] text-mut">
          {status}
          {tier === "browser" && !error && <span className="rounded-full bg-tint px-2 py-0.5 text-acct">{t("trace_browser")}</span>}
        </div>
        {text && (
          <p className="m-0 max-w-[min(720px,100%)] font-serif text-[clamp(22px,4.2vw,38px)] font-normal leading-[1.15] tracking-[-0.01em] text-ink [text-shadow:0_2px_16px_var(--bg),0_0_3px_var(--bg)] [text-wrap:balance]">
            {text}
          </p>
        )}
        {typing && (
          <div className="pointer-events-auto flex w-[min(360px,calc(100vw-32px))] items-center gap-1 rounded-full border border-line bg-card py-[3px] pl-4 pr-[3px]">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={t("type_to", { name: aiName })}
              className="h-10 min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none"
            />
            <button onClick={submit} aria-label={t("send")} className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-0 bg-acc font-bold text-onacc">
              ↑
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {error && (
            <>
              <button className={btn} onClick={() => void startVoice()}>
                {t("err_retry")}
              </button>
              <button className={btn} onClick={() => setTyping(true)}>
                <Keyboard size={15} strokeWidth={2} className="mr-2" />
                {t("type_instead")}
              </button>
            </>
          )}
          {!error && last && (
            <button className={btn} onClick={() => setTrace(true)}>
              {t("see_trace")}
              {last.steps.length > 0 && <span className="ml-2 font-mono text-[11px] text-mut2">{last.steps.length}</span>}
            </button>
          )}
          {(voiceOn || typing) && (
            <button
              className={`${btn} w-11 justify-center px-0`}
              onClick={() => {
                setTyping(false);
                stop();
              }}
              aria-label={t("close")}
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
      {trace && <TraceSheet traces={traces} onClose={() => setTrace(false)} />}
    </>
  );
}
