import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="m-0 mt-1.5 font-serif text-[42px] font-normal leading-[1.05] tracking-[-0.01em]">{title}</h1>
      {children}
    </div>
  );
}
