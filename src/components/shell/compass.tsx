"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { LogoTile } from "@/components/logo";
import { useMoney } from "@/components/money-data";
import { useLabel } from "@/components/nav-label";
import { useOnline, usePendingCount } from "@/components/pwa";
import { useScene } from "@/components/scene/scene-host";
import { MODULE_ORDER, MODULES, hrefOf, moduleOf } from "@/lib/nav";
import { Avatar } from "./avatar";

/**
 * The top of every screen: where you are, and the four places you can go. The four names are the
 * four areas of the Life Map, and choosing one sends the camera there as the screen changes.
 */
export function Compass({ screen }: { screen: string }) {
  const t = useTranslations();
  const label = useLabel();
  const { scene } = useScene();
  const { me, household } = useAppData();
  const { alerts } = useMoney();
  const alertCount = alerts.filter((a) => a.sev !== "info").length;
  const online = useOnline();
  const waiting = usePendingCount();
  const here = moduleOf(screen);

  return (
    <header
      data-noprint
      className="fixed inset-x-0 top-0 z-30 flex items-center gap-2 border-b border-line bg-bg px-3 pb-2 pt-[calc(8px+env(safe-area-inset-top))] wide:gap-6 wide:px-8 wide:pb-3 wide:pt-[calc(12px+env(safe-area-inset-top))]"
    >
      <Link href="/" aria-label={label("nav.home")} className="hit44 flex min-w-0 flex-none items-center gap-2.5 text-ink hover:text-ink wide:w-[220px]">
        <LogoTile />
        <span className="hidden min-w-0 truncate text-[14.5px] font-bold tracking-[-0.01em] wide:block">{household?.name ?? "rideff Life"}</span>
      </Link>

      <nav aria-label={t("copy.all_modules")} className="flex min-w-0 flex-1 items-center justify-between gap-1 wide:justify-center wide:gap-9">
        {MODULE_ORDER.map((k) => {
          const on = here === k;
          return (
            <Link
              key={k}
              href={hrefOf(MODULES[k].tabs[0].id)}
              onClick={() => void scene?.flyTo(k, { ms: 900 })}
              aria-current={on ? "page" : undefined}
              className={`hit44 flex min-h-11 items-center whitespace-nowrap border-b-2 px-1.5 font-mono text-[11px] font-bold uppercase tracking-[.12em] hover:text-ink wide:text-[12px] wide:tracking-[.16em] ${
                on ? "border-acc text-ink" : "border-transparent text-mut"
              }`}
            >
              {label(MODULES[k].key)}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-none items-center justify-end gap-1.5 wide:w-[220px]">
        {(!online || waiting > 0) && (
          <span className="hidden flex-none rounded-full bg-soft2 px-[9px] py-1 text-[11px] font-bold text-mut wide:block">
            {online ? t("ui.syncing") : t("copy.offline")}
            {waiting > 0 && ` · ${waiting}`}
          </span>
        )}
        <Link href="/alerts" aria-label={t("nav.alerts")} className="hit44 relative hidden h-10 w-10 flex-none items-center justify-center rounded-full border border-line bg-card text-ink hover:text-ink wide:flex">
          <Bell size={17} strokeWidth={2} />
          {alertCount > 0 && (
            <span className="absolute -right-[3px] -top-[3px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-[5px] text-[11px] font-bold text-white">{alertCount}</span>
          )}
        </Link>
        <Link href="/settings" aria-label={t("nav.settings")} className="hit44 flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line bg-card p-[3px]">
          <Avatar member={me} />
        </Link>
      </div>
    </header>
  );
}
