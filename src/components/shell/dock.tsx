"use client";

import { LayoutGrid, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAiName } from "@/components/app-data";
import { useAssistant } from "@/components/assistant";
import { Clopar } from "@/components/clopar";
import { useMoney } from "@/components/money-data";
import { useShell } from "./shell-context";

const round = "hit44 flex h-12 w-12 flex-none items-center justify-center rounded-full border border-line bg-soft text-ink";

/**
 * The bar at the bottom of every screen. Clopar is its centre: one tap to talk. Around it are the
 * atlas of every screen, search (a field on a wide screen), and the + for adding something.
 * It steps out of the way while you read down a page.
 */
export function Dock({ away }: { away: boolean }) {
  const t = useTranslations();
  const aiName = useAiName();
  const { openAtlas, openCommand, openQuickAdd } = useShell();
  const { alerts } = useMoney();
  const { talk, voiceOn, startVoice, stop } = useAssistant();
  const urgent = alerts.some((a) => a.sev !== "info");

  return (
    <div data-noprint data-stage-scale className="pointer-events-none fixed inset-x-0 bottom-[calc(14px+env(safe-area-inset-bottom))] z-40 flex justify-center px-3">
      <div
        data-away={away || undefined}
        className="fab pointer-events-auto flex items-center gap-2 rounded-full border border-line2 bg-card p-1.5 shadow-[0_10px_30px_rgba(0,0,0,.35)]"
      >
        <button onClick={openAtlas} aria-label={t("copy.all_modules")} title={t("copy.all_modules")} className={`${round} relative`}>
          <LayoutGrid size={18} strokeWidth={2} />
          {urgent && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-bad" />}
        </button>
        <button
          onClick={() => (voiceOn ? stop() : void startVoice())}
          aria-label={t("ui.ask_name", { name: aiName })}
          aria-pressed={voiceOn}
          className="no-hit relative -my-3 block h-[64px] w-[64px] flex-none overflow-hidden rounded-full border border-line2 bg-card p-0 shadow-[0_0_28px_var(--tint2)]"
        >
          <Clopar variant="tab" mode={talk.mode} />
        </button>
        <button onClick={openCommand} aria-label={t("copy.search")} title={t("copy.search")} className={`${round} wide:hidden`}>
          <Search size={18} strokeWidth={2} />
        </button>
        <button
          onClick={openCommand}
          className="hit44 hidden h-12 w-[min(34vw,340px)] min-w-0 items-center gap-2 rounded-full border border-line bg-soft px-4 text-left text-[13px] text-mut hover:border-line2 wide:flex"
        >
          <Search size={15} strokeWidth={2} className="flex-none" />
          <span className="flex-1 truncate">{t("copy.search_or_ask")}</span>
          <span className="flex-none rounded-[5px] border border-line px-[5px] py-px font-mono text-[11px]">⌘K</span>
        </button>
        <button onClick={openQuickAdd} aria-label={t("copy.quick_add")} title={t("copy.quick_add")} className="hit44 flex h-12 w-12 flex-none items-center justify-center rounded-full border-0 bg-acc text-onacc hover:bg-acc2">
          <Plus size={22} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
