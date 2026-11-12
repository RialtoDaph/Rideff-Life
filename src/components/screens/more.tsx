"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useLabel } from "@/components/nav-label";
import { Bone } from "@/components/skeleton";
import { useTime } from "@/components/time-data";
import { MODULE_ORDER, MODULES, TOOLS, hrefOf, type ModuleKey } from "@/lib/nav";
import { eur } from "@/lib/money";

const TOOL_ROWS = TOOLS.map((t) => ({ id: t.id, label: t.key, icon: t.icon }));

export function More() {
  const t = useTranslations("copy");
  const h = useTranslations("home");
  const label = useLabel();
  const money = useMoney();
  const fin = useFinance();
  const time = useTime();
  const alertCount = money.alerts.filter((a) => a.sev !== "info").length;

  /** One short line per module, or null while its data loads. Empty modules say so instead of showing zeros. */
  function status(k: ModuleKey): string | null | undefined {
    if (k === "money") {
      if (!money.loaded) return null;
      if (!money.categories.length) return h("more_not_started");
      return h("more_money_left", { left: eur(money.budget.flexLeft), perDay: eur(money.budget.perDay) });
    }
    if (k === "time") {
      if (!time.loaded) return null;
      const n = time.yearlyGoals.filter((g) => g.year === money.today.y).length;
      return n ? h("more_time_goals", { n }) : h("more_not_started");
    }
    if (k === "invest") {
      if (!fin.loaded) return null;
      return fin.assets.length || fin.debts.length ? h("more_invest_net", { net: eur(fin.worth.net) }) : h("more_not_started");
    }
    if (!time.loaded) return null;
    const n = time.gym.filter((g) => g.date.startsWith(money.today.ym)).length;
    return n ? h("more_life_gym", { n }) : h("more_not_started");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="m-0 font-serif text-4xl font-normal tracking-[-0.01em]">{t("all_modules")}</h1>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        {MODULE_ORDER.map((k) => {
          const m = MODULES[k];
          const s = status(k);
          return (
            <Link
              key={k}
              href={hrefOf(m.tabs[0].id)}
              className="flex min-h-[96px] flex-col gap-2 rounded-[18px] border border-line bg-card p-4 text-ink"
            >
              <span className="flex items-center gap-2.5 text-[15px] font-bold">
                <m.icon size={18} strokeWidth={2} />
                {label(m.key)}
              </span>
              {s === null ? (
                <Bone className="h-3.5 w-[60%]" />
              ) : (
                <span className="text-[13px] text-mut">{s}</span>
              )}
            </Link>
          );
        })}
      </div>

      <section aria-label={h("more_tools")} className="rounded-[18px] border border-line bg-card px-4 py-1.5">
        {TOOL_ROWS.map((r, i) => (
          <Link
            key={r.id}
            href={hrefOf(r.id)}
            className={`flex min-h-[54px] w-full items-center gap-3 text-left text-[15px] font-bold text-ink ${
              i < TOOL_ROWS.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <r.icon size={18} strokeWidth={2} />
            <span className="flex-1">{label(r.label)}</span>
            {r.id === "alerts" && alertCount > 0 && (
              <span className="rounded-full bg-soft2 px-2 py-[3px] text-[11px] font-bold uppercase tracking-[.08em] text-mut">
                {alertCount}
              </span>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}
