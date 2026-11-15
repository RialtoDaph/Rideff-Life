"use client";

import { useTranslations } from "next-intl";
import { HeroBlock } from "@/components/ds/hero-block";
import { Slab } from "@/components/ds/slab";
import { BUILT_STATS, DECISIONS, ROUNDS } from "@/content/built-stats";
import { PageHeader } from "./page-header";

/** The story of how this app was made, told by the app: rounds of work, what each did, what went wrong. */
export function BuiltScreen() {
  const t = useTranslations("story");
  // Message keys are built from the round's letter: r_A_t (title), r_A_w (what it did), r_A_x (what went wrong).
  const say = t as unknown as (key: string) => string;
  return (
    <div data-screen-label="Built" className="flex flex-col gap-4">
      <PageHeader eyebrow="rideff Life" title={t("built_title")}>
        <p className="m-0 mt-2 max-w-[60ch] text-[14px] text-mut">{t("built_sub")}</p>
      </PageHeader>
      <HeroBlock
        number={BUILT_STATS.rounds}
        label={t("built_rounds")}
        stats={[
          { label: t("built_tests"), value: BUILT_STATS.tests },
          { label: t("built_screens"), value: BUILT_STATS.screens },
        ]}
      />
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {ROUNDS.map((r) => (
          <li key={r}>
            <Slab className="flex flex-col gap-3">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px] font-bold tracking-[.14em] text-acc">{r}</span>
                <h2 className="m-0 font-serif text-[26px] font-normal leading-[1.1] tracking-[-0.01em]">{say(`r_${r}_t`)}</h2>
              </div>
              <div>
                <div className="font-mono text-[11px] font-bold uppercase tracking-[.14em] text-mut2">{t("built_what")}</div>
                <p className="m-0 mt-1 text-[14.5px] leading-[1.5]">{say(`r_${r}_w`)}</p>
              </div>
              <div>
                <div className="font-mono text-[11px] font-bold uppercase tracking-[.14em] text-mut2">{t("built_wrong")}</div>
                <p className="m-0 mt-1 text-[14.5px] leading-[1.5] text-mut">{say(`r_${r}_x`)}</p>
              </div>
            </Slab>
          </li>
        ))}
      </ol>
      <Slab className="flex flex-col gap-3">
        <h2 className="m-0 font-serif text-[26px] font-normal tracking-[-0.01em]">{t("built_decisions")}</h2>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {DECISIONS.map((d) => (
            <li key={d} className="border-l-2 border-acc pl-3.5 text-[14.5px] leading-[1.5]">
              {say(d)}
            </li>
          ))}
        </ul>
      </Slab>
      <p className="m-0 text-center font-mono text-[11px] font-bold uppercase tracking-[.16em] text-mut2">{t("built_credit")}</p>
    </div>
  );
}
