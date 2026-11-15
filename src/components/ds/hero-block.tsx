import type { ReactNode } from "react";

export type HeroStat = { label: string; value: ReactNode; note?: ReactNode };

/**
 * The head of a detail screen: one thing said large. A label, the number (or a short sentence when
 * `textual`), a line under it, up to three small numbers, and room for an action. No card behind it:
 * the screen's slab is the surface.
 */
export function HeroBlock({
  eyebrow,
  label,
  number,
  textual = false,
  sub,
  stats,
  footer,
}: {
  eyebrow?: ReactNode;
  label?: ReactNode;
  number: ReactNode;
  textual?: boolean;
  sub?: ReactNode;
  stats?: HeroStat[];
  footer?: ReactNode;
}) {
  return (
    <section data-screen-label="Hero" className="flex flex-col gap-2 pb-2 pt-1">
      {eyebrow && <div className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-acc">{eyebrow}</div>}
      {label && <div className="text-[13px] text-mut">{label}</div>}
      <div
        className={
          textual
            ? "font-serif text-[clamp(32px,5.6vw,52px)] font-normal leading-[1.06] tracking-[-0.015em] [text-wrap:balance]"
            : "font-serif text-[clamp(64px,13vw,112px)] font-normal leading-[.92] tabular-nums tracking-[-0.03em]"
        }
      >
        {number}
      </div>
      {sub && <div className="text-[15px] leading-normal text-mut">{sub}</div>}
      {stats && stats.length > 0 && (
        <dl className="m-0 mt-3 flex flex-wrap gap-x-9 gap-y-3 border-t border-line pt-4">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="text-xs font-semibold text-mut2">{s.label}</dt>
              <dd className="m-0 mt-1 truncate text-xl font-bold tabular-nums">{s.value}</dd>
              {s.note && <div className="mt-0.5 text-xs text-mut2">{s.note}</div>}
            </div>
          ))}
        </dl>
      )}
      {footer && <div className="mt-2">{footer}</div>}
    </section>
  );
}
