"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useScene } from "@/components/scene/scene-host";
import { drawWrapped, CARD_H, CARD_W, type WrappedData } from "@/lib/wrapped-card";
import { eur } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { PageHeader } from "./page-header";

const PILLARS = ["money", "time", "health", "goals"] as const;

/** Life Wrapped: the month as one 9:16 card, to share or save. The same numbers drive the preview and the picture. */
export function WrappedScreen() {
  const t = useTranslations("story");
  const tt = useTranslations("t");
  const dates = useDates();
  const { members } = useAppData();
  const { today, budget } = useMoney();
  const { life } = useScene();
  const [busy, setBusy] = useState(false);

  const have = life.score.total !== null;
  const data: WrappedData = {
    title: t("w_title"),
    month: `${dates.monthLong(today.m)} ${today.y}`,
    names: members.map((m) => m.display_name).join(" & "),
    scoreLabel: t("w_score"),
    score: life.score.total,
    pillars: PILLARS.map((k) => ({ label: tt(`p_${k}`), score: life.score.pillars.find((p) => p.k === k)?.score ?? null })),
    leftLabel: t("w_left"),
    left: eur(budget.flexLeft, 0),
    made: t("w_made"),
    serif: "",
  };

  async function picture() {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    // next/font renames the family: read the real name and wait for it before drawing numbers in the serif.
    const serif = getComputedStyle(document.documentElement).getPropertyValue("--font-instrument-serif").trim() || "Georgia, serif";
    await document.fonts.load(`400 100px ${serif}`).catch(() => []);
    drawWrapped(canvas.getContext("2d")!, { ...data, serif });
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function share(save: boolean) {
    setBusy(true);
    try {
      const blob = await picture();
      if (!blob) return;
      const file = new File([blob], "life-wrapped.png", { type: "image/png" });
      if (!save && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: data.title }).catch(() => {});
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "life-wrapped.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      setBusy(false);
    }
  }

  const btn = "hit44 flex min-h-12 items-center justify-center rounded-full border border-line px-6 text-[14px] font-bold";
  return (
    <div data-screen-label="Wrapped" className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-5">
      <div className="self-stretch">
        <PageHeader eyebrow="rideff Life" title={t("w_title")}>
          <p className="m-0 mt-2 text-[14px] text-mut">{have ? t("w_sub") : t("w_empty")}</p>
        </PageHeader>
      </div>
      <div
        aria-label={`${data.title} ${data.month}`}
        className="relative flex aspect-[9/16] w-[min(340px,100%)] flex-col justify-between overflow-hidden rounded-[28px] border border-line2 bg-bg p-6 [background-image:radial-gradient(circle_at_50%_38%,rgba(232,217,181,.22),transparent_62%)]"
      >
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-acc">{data.title}</div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-mut">{data.month}</div>
        </div>
        <div className="text-center">
          <div className="font-serif text-[132px] font-normal leading-none tabular-nums">{data.score ?? "—"}</div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-acc">{data.scoreLabel}</div>
        </div>
        <div className="grid grid-cols-4 text-center">
          {data.pillars.map((p) => (
            <div key={p.label}>
              <div className="font-serif text-[30px] leading-none tabular-nums">{p.score ?? "—"}</div>
              <div className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[.1em] text-mut2">{p.label}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-line pt-4 text-center">
          <div className="font-serif text-[46px] leading-none tabular-nums">{data.left}</div>
          <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[.14em] text-mut">{data.leftLabel}</div>
          <div className="mt-4 font-mono text-[8px] font-bold uppercase tracking-[.12em] text-mut2">{data.names}</div>
          <div className="font-mono text-[8px] font-bold uppercase tracking-[.12em] text-mut2">{data.made}</div>
        </div>
      </div>
      {have && (
        <div className="flex flex-wrap justify-center gap-3">
          <button disabled={busy} onClick={() => void share(false)} className={`${btn} border-0 bg-acc text-onacc`}>
            {t("w_share")}
          </button>
          <button disabled={busy} onClick={() => void share(true)} className={`${btn} bg-card text-ink`}>
            {t("w_save")}
          </button>
        </div>
      )}
    </div>
  );
}
