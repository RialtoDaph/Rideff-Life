import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** One grey bar. Size it with classes: `h-4 w-32`. */
export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} />;
}

function Frame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div aria-hidden className={`rounded-[18px] border border-line bg-card p-5 ${className}`}>{children}</div>;
}

/** The big card at the top of a screen: a label, one large number, a line under it. */
export function SkeletonHero({ className = "" }: { className?: string }) {
  return (
    <Frame className={`flex flex-col gap-4 ${className}`}>
      <Bone className="h-3 w-28" />
      <Bone className="h-14 w-48 rounded-[12px]" />
      <Bone className="h-3.5 w-[min(100%,260px)]" />
      <Bone className="mt-2 h-1.5 w-full rounded-full" />
    </Frame>
  );
}

/** A titled card with rows: a round mark, two lines, a number on the right. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <Frame className="flex flex-col gap-4">
      <Bone className="h-5 w-36" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Bone className="h-9 w-9 flex-none rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Bone className={`h-3.5 ${i % 2 ? "w-[55%]" : "w-[70%]"}`} />
            <Bone className="h-3 w-[35%]" />
          </div>
          <Bone className="h-4 w-14 flex-none" />
        </div>
      ))}
    </Frame>
  );
}

/** Small cards that each hold one number. */
export function SkeletonNumbers({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
      {Array.from({ length: count }, (_, i) => (
        <Frame key={i} className="flex flex-col gap-3">
          <Bone className="h-3 w-20" />
          <Bone className="h-8 w-24 rounded-[10px]" />
        </Frame>
      ))}
    </div>
  );
}

/** A whole screen while its data loads: hero, numbers, two lists. "Loading…" is read aloud. */
export function ScreenSkeleton({ numbers = true }: { numbers?: boolean }) {
  const t = useTranslations("home");
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{t("loading")}</span>
      <SkeletonHero />
      {numbers && <SkeletonNumbers />}
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <SkeletonList />
        <SkeletonList rows={3} />
      </div>
    </div>
  );
}
