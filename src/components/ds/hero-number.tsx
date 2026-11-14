"use client";

import { useEffect, useState, ViewTransition } from "react";
import { CountUp } from "@/components/count-up";

// Names already shown in this session: the first appearance counts up, later ones carry their digits.
const shown = new Set<string>();

/**
 * The one big number on a screen. With a `shareName`, the same number on the next screen is
 * the same object: it flies and resizes there instead of being swapped (a view transition).
 * It counts up the first time it is seen; after that it starts from its own value, so the
 * flight carries digits, not a count from zero. Share only numbers that read the same on
 * both screens.
 */
export function HeroNumber({ value, format, shareName, className = "" }: { value: number; format: (n: number) => string; shareName?: string; className?: string }) {
  const [known] = useState(() => (shareName ? shown.has(shareName) : false));
  useEffect(() => {
    if (shareName) shown.add(shareName);
  }, [shareName]);
  const number = (
    <span className={`inline-block ${className}`}>
      <CountUp value={value} format={format} initial={known ? value : 0} />
    </span>
  );
  if (!shareName) return number;
  return (
    <ViewTransition name={shareName} share="morph" default="none">
      {number}
    </ViewTransition>
  );
}
