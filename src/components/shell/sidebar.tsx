"use client";

import { Bell, House } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { LogoTile } from "@/components/logo";
import { useMoney } from "@/components/money-data";
import { useLabel } from "@/components/nav-label";
import { MODULE_ORDER, MODULES, hrefOf, moduleOf } from "@/lib/nav";
import { lockedBy } from "@/lib/plans";
import { Avatar } from "./avatar";

/**
 * The desktop navigation (1280px and up): a floating rail that rests as a 64px column of icons and
 * opens over the page to 240px while the pointer (or keyboard focus) is on it. It replaces the top
 * bar's four links; the area you are in lists its pages when open. main, the dock and the scene
 * leave room for the resting 64px rail plus its 12px margin (88px).
 */
export function Sidebar({ screen }: { screen: string }) {
  const t = useTranslations();
  const label = useLabel();
  const { me, household, plan } = useAppData();
  const { alerts } = useMoney();
  const alertCount = alerts.filter((a) => a.sev !== "info").length;
  const here = moduleOf(screen);
  const link = "flex min-h-10 items-center gap-3 rounded-[12px] px-[13px] text-[13.5px] font-semibold hover:text-ink";
  const word = "whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100";

  return (
    <aside data-noprint className="glass group !fixed inset-y-3 left-3 z-30 hidden w-[64px] flex-col overflow-hidden rounded-[22px] border border-line bg-card px-2 pb-3 pt-4 transition-[width] duration-200 ease-out hover:w-[240px] has-[:focus-visible]:w-[240px] desk:flex">
      <Link href="/" aria-label={label("nav.home")} className="mb-4 flex min-w-0 items-center gap-2.5 px-[5px] text-ink hover:text-ink">
        <LogoTile />
        <span className={`min-w-0 truncate text-[14.5px] font-bold tracking-[-0.01em] ${word}`}>{household?.name ?? "rideff Life"}</span>
      </Link>

      <nav aria-label={t("copy.all_modules")} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden">
        <Link href="/" aria-current={screen === "home" ? "page" : undefined} className={`${link} ${screen === "home" ? "bg-soft text-ink" : "text-mut"}`}>
          <House size={18} strokeWidth={2} className="flex-none" />
          <span className={word}>{label("nav.home")}</span>
        </Link>
        {MODULE_ORDER.map((k) => {
          const m = MODULES[k];
          const on = here === k;
          const Icon = m.icon;
          return (
            <div key={k} className="mt-1 flex flex-col gap-0.5">
              <Link
                href={hrefOf(m.tabs[0].id)}
                aria-current={on && screen === m.tabs[0].id ? "page" : undefined}
                className={`${link} font-mono text-[11px] font-bold uppercase tracking-[.14em] ${on ? "text-ink" : "text-mut"}`}
              >
                <Icon size={18} strokeWidth={2} className="flex-none" />
                <span className={word}>{label(m.key)}</span>
              </Link>
              {on &&
                m.tabs.map((tab) => {
                  const need = lockedBy(`/${tab.id}`, plan);
                  return (
                  <Link
                    key={tab.id}
                    href={hrefOf(tab.id)}
                    aria-current={screen === tab.id ? "page" : undefined}
                    className={`hidden min-h-9 items-center whitespace-nowrap rounded-[10px] pl-[44px] pr-3 group-hover:flex group-has-[:focus-visible]:flex text-[13px] hover:text-ink ${screen === tab.id ? "bg-soft font-bold text-ink" : "text-mut"}`}
                  >
                    {label(tab.key)}
                    {need && <span className="ml-1.5 text-[11px] font-bold text-mut2">{need === "plus" ? "Plus" : "Together"}</span>}
                  </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <Link href="/settings" aria-label={t("nav.settings")} className="relative flex min-w-0 flex-1 items-center gap-2.5 rounded-full text-ink hover:text-ink">
          <span className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line bg-card p-[3px]">
            <Avatar member={me} />
            {alertCount > 0 && <span className="absolute -right-px -top-px h-2.5 w-2.5 rounded-full bg-bad group-hover:hidden group-has-[:focus-visible]:hidden" />}
          </span>
          <span className={`min-w-0 truncate text-[13px] font-semibold ${word}`}>{me?.display_name ?? t("nav.settings")}</span>
        </Link>
        <Link href="/alerts" aria-label={t("nav.alerts")} className="relative hidden h-10 w-10 flex-none items-center justify-center rounded-full border border-line bg-card text-ink hover:text-ink group-hover:flex group-has-[:focus-visible]:flex">
          <Bell size={17} strokeWidth={2} />
          {alertCount > 0 && <span className="absolute -right-[3px] -top-[3px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-[5px] text-[11px] font-bold text-white">{alertCount}</span>}
        </Link>
      </div>
    </aside>
  );
}
