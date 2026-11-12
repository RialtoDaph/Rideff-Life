"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useToast } from "@/components/toast";
import { QUEUED } from "@/lib/offline-queue";
import { parseAmount } from "@/lib/money";

const field = "min-h-12 w-full rounded-xl border border-line bg-bg px-3.5 text-base font-bold text-ink";

/**
 * The first minute: bring a bank statement, or type three numbers.
 * Three numbers are enough for Home to show "flexible money left" at once.
 */
export function QuickStart() {
  const t = useTranslations("home");
  const toast = useToast();
  const { userId, settings } = useAppData();
  const money = useMoney();
  const [income, setIncome] = useState("");
  const [fixed, setFixed] = useState("");
  const [flex, setFlex] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const inc = parseAmount(income);
    const fix = fixed.trim() === "" ? 0 : parseAmount(fixed);
    const fl = parseAmount(flex);
    if (!(inc > 0) || !Number.isFinite(fix) || fix < 0 || !(fl > 0)) {
      setError(t("qs_check"));
      return;
    }
    setBusy(true);
    setError(null);
    const n = money.categories.length;
    const steps: [Parameters<typeof money.save>[0], Record<string, unknown>][] = [
      [
        "incomes",
        { name: t("qs_income_name"), member_id: userId, kind: "Salary", monthly_amount: inc, visibility: settings?.default_visibility?.incomes ?? "family" },
      ],
      ...(fix > 0
        ? ([["categories", { name: t("qs_fixed_name"), icon: "tag", monthly_limit: fix, is_fixed: true, sort: n + 1 }]] as [Parameters<typeof money.save>[0], Record<string, unknown>][])
        : []),
      ["categories", { name: t("qs_flex_name"), icon: "tag", monthly_limit: fl, is_fixed: false, sort: n + 2 }],
    ];
    for (const [table, values] of steps) {
      const err = await money.save(table, values);
      if (err && err !== QUEUED) {
        setBusy(false);
        setError(err);
        return;
      }
    }
    setBusy(false);
    toast(t("qs_done"));
  }

  return (
    <section data-screen-label="Quick start" className="flex flex-col gap-4 rounded-[18px] border border-line bg-card p-5">
      <div>
        <div className="eyebrow">{t("qs_eyebrow")}</div>
        <h2 className="m-0 mt-1.5 text-[22px] font-bold leading-[1.25] tracking-[-0.01em] [text-wrap:pretty]">{t("qs_title")}</h2>
      </div>

      <Link
        href="/import"
        className="flex min-h-12 items-center justify-center rounded-full bg-acc px-5 text-sm font-bold text-onacc hover:text-onacc"
      >
        {t("qs_import")}
      </Link>

      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[.12em] text-mut2">
        <span className="h-px flex-1 bg-line" />
        {t("qs_or")}
        <span className="h-px flex-1 bg-line" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1.5 text-[13.5px] font-bold">
          {t("qs_income")}
          <input value={income} onChange={(e) => setIncome(e.target.value)} inputMode="decimal" placeholder="0" className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13.5px] font-bold">
          {t("qs_fixed")}
          <input value={fixed} onChange={(e) => setFixed(e.target.value)} inputMode="decimal" placeholder="0" className={field} />
          <span className="text-xs font-normal text-mut2">{t("qs_fixed_hint")}</span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13.5px] font-bold">
          {t("qs_flex")}
          <input value={flex} onChange={(e) => setFlex(e.target.value)} inputMode="decimal" placeholder="0" className={field} />
          <span className="text-xs font-normal text-mut2">{t("qs_flex_hint")}</span>
        </label>
        {error && (
          <div role="alert" className="text-[13px] font-bold text-bad">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="min-h-12 rounded-full border-0 bg-tint px-5 text-sm font-extrabold text-acct disabled:opacity-60"
        >
          {t("qs_start")}
        </button>
      </form>
    </section>
  );
}
