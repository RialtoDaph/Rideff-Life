"use client";

import { useCallback, useEffect, useState, ViewTransition, type ReactNode } from "react";
import { HouseholdLive } from "@/components/household-live";
import { useMoneyForms } from "@/components/money-forms";
import { useServiceWorker } from "@/components/pwa";
import { SceneHost } from "@/components/scene/scene-host";
import { usePathname } from "@/i18n/navigation";
import { sceneModeFor } from "@/lib/scene-camera";
import type { QuickAddItem } from "@/lib/nav";
import { AtlasSheet } from "./atlas";
import { CommandPalette } from "./command-palette";
import { Compass } from "./compass";
import { Dock } from "./dock";
import { VoiceCaption } from "./voice-caption";
import { QuickAddSheet } from "./quick-add";
import { ShellContext, useShell, type ShellUI } from "./shell-context";

export { useShell };

export function useScreen() {
  const path = usePathname() ?? "/";
  return path === "/" ? "home" : path.split("/")[1];
}

export function AppShell({ children }: { children: ReactNode }) {
  const screen = useScreen();
  const { openForm } = useMoneyForms();
  const [quickAdd, setQuickAdd] = useState(false);
  const [command, setCommand] = useState(false);
  const [atlas, setAtlas] = useState(false);
  const dockAway = useScrollingDown(screen);
  // A detail screen is a slab: one opaque column, with the frozen scene visible on both sides of it.
  const slab = sceneModeFor(screen) === "backdrop";
  useServiceWorker();

  // ⌘K / Ctrl+K toggles the command palette anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runQuickAdd = useCallback(
    (item: QuickAddItem) => {
      setQuickAdd(false);
      if (item.form) openForm(item.form);
    },
    [openForm],
  );

  const ui: ShellUI = {
    openQuickAdd: () => setQuickAdd(true),
    openCommand: () => setCommand(true),
    openAtlas: () => setAtlas(true),
    runQuickAdd,
  };

  return (
    <ShellContext value={ui}>
      <SceneHost screen={screen}>
        <HouseholdLive />
        <Compass screen={screen} />
        <main className="px-[14px] pb-[calc(140px+env(safe-area-inset-bottom))] pt-[calc(84px+env(safe-area-inset-top))] wide:px-10 wide:pb-[150px] wide:pt-[calc(96px+env(safe-area-inset-top))]">
          {/* Keyed by screen, so moving between screens fades the old one out and lifts the new one in. */}
          <ViewTransition key={screen} enter="page" exit="page" default="none">
            <div className={slab ? "mx-auto flex max-w-[880px] flex-col gap-4 wide:rounded-[28px] wide:border wide:border-line wide:bg-bg wide:p-8" : "mx-auto flex max-w-[1120px] flex-col gap-4"}>{children}</div>
          </ViewTransition>
        </main>
        {screen !== "ask" && screen !== "map" && (
          <>
            <VoiceCaption />
            <Dock away={dockAway} />
          </>
        )}
        {quickAdd && <QuickAddSheet onClose={() => setQuickAdd(false)} />}
        {atlas && <AtlasSheet onClose={() => setAtlas(false)} />}
        {command && <CommandPalette onClose={() => setCommand(false)} />}
      </SceneHost>
    </ShellContext>
  );
}

/**
 * True while the person reads down the page, false again as soon as they scroll up,
 * reach the end, or open another screen. The + button uses it to get out of the way.
 */
function useScrollingDown(screen: string) {
  const [down, setDown] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 8;
      // Small moves (rubber-banding, a resting thumb) change nothing.
      if (Math.abs(y - last) > 6) setDown(y > last && y > 80 && !atEnd);
      else if (y <= 80) setDown(false);
      last = y;
    };
    const onScroll = () => (frame ||= requestAnimationFrame(read));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      setDown(false);
    };
  }, [screen]);
  return down;
}
