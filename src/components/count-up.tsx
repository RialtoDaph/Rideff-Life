"use client";

import { useEffect, useRef, useState } from "react";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A number that counts to its value: from zero when it first appears, and from the
 * old value when it changes. Only use it where the number arrives after loading,
 * because it starts at zero. People who asked for less motion get the value at once.
 */
export function CountUp({ value, format, duration = 700 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || start === value;
    let frame = 0;
    let t0 = 0;
    const step = (now: number) => {
      t0 ||= now;
      const p = still ? 1 : Math.min(1, (now - t0) / duration);
      const next = start + (value - start) * easeOut(p);
      from.current = next;
      setShown(p === 1 ? value : next);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  // Screen readers get the real number, not the frames in between.
  return (
    <>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
