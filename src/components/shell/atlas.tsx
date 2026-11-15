"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMoney } from "@/components/money-data";
import { useLabel } from "@/components/nav-label";
import { Sheet } from "@/components/sheet";
import { THEME_OPTIONS, useTheme } from "@/components/theme";
import { MODULE_ORDER, MODULES, TOOLS, hrefOf } from "@/lib/nav";

/** Every screen in the app, by area, with the tools underneath. */
export function AtlasSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const label = useLabel();
  const { alerts } = useMoney();
  const alertCount = alerts.filter((a) => a.sev !== "info").length;
  const { pref, setTheme, isNoir } = useTheme();
  const pill = "hit44 flex min-h-11 items-center rounded-full border border-line bg-soft px-4 text-[13px] font-bold text-ink hover:text-ink";

  return (
    <Sheet title={t("copy.all_modules")} onClose={onClose}>
      <div className="flex flex-col gap-5" onClick={(e) => (e.target as HTMLElement).closest("a") && onClose()}>
        <Link href="/map" className={`${pill} self-start`}>
          {t("ui.life_map")}
        </Link>
        {MODULE_ORDER.map((k) => (
          <section key={k} aria-label={label(MODULES[k].key)} className="flex flex-col gap-2">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-mut2">{label(MODULES[k].key)}</div>
            <div className="flex flex-wrap gap-2">
              {MODULES[k].tabs.map((tab) => (
                <Link key={tab.id} href={hrefOf(tab.id)} className={pill}>
                  {label(tab.key)}
                </Link>
              ))}
            </div>
          </section>
        ))}
        <section aria-label={t("nav.tools")} className="flex flex-col gap-2">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-mut2">{t("nav.tools")}</div>
          <div className="flex flex-wrap gap-2">
            {TOOLS.map((tool) => (
              <Link key={tool.id} href={hrefOf(tool.id)} className={pill}>
                <tool.icon size={15} strokeWidth={2} className="mr-2" />
                {label(tool.key)}
                {tool.id === "alerts" && alertCount > 0 && <span className="ml-2 rounded-full bg-bad px-1.5 text-[11px] text-white">{alertCount}</span>}
              </Link>
            ))}
          </div>
        </section>
        {!isNoir && (
          <div className="grid grid-cols-3 gap-0.5 rounded-[10px] bg-soft2 p-[3px]">
            {THEME_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setTheme(o.value)}
                aria-label={t(o.key)}
                className={`flex min-h-10 items-center justify-center gap-[5px] rounded-lg border-0 text-[11.5px] font-bold ${pref === o.value ? "bg-card text-ink" : "bg-transparent text-mut"}`}
              >
                <o.icon size={13} strokeWidth={2} />
                {t(o.key)}
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
