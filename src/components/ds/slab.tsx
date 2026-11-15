import type { ReactNode } from "react";

/** A slab: one opaque surface for one idea, a step above the page. Screens are made of slabs. */
export function Slab({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border border-line bg-card p-5 ${className}`}>{children}</section>;
}
