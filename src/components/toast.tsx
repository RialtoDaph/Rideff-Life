"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

type Toast = { id: number; msg: string; leaving?: boolean };

const SHOW_MS = 3800;
const MAX = 3;

/** Short messages at the top of the screen. Up to three stack; each leaves on its own. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const leave = useCallback((id: number) => setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t))), []);
  const drop = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (msg: string) => {
      const id = nextId.current++;
      // The same message twice in a row replaces itself instead of stacking.
      setToasts((list) => [...list.filter((t) => t.msg !== msg), { id, msg }].slice(-MAX));
      setTimeout(() => leave(id), SHOW_MS);
      // Removed even if the leaving animation never ends (hidden tab).
      setTimeout(() => drop(id), SHOW_MS + 600);
    },
    [leave, drop],
  );

  return (
    <ToastContext value={show}>
      {children}
      {toasts.length > 0 && (
        <div
          data-noprint
          className="pointer-events-none fixed inset-x-0 top-[calc(66px+env(safe-area-inset-top))] z-[90] flex flex-col items-center gap-2 px-[4vw] wide:top-5"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              data-leaving={t.leaving || undefined}
              onAnimationEnd={() => t.leaving && drop(t.id)}
              className="toast flex w-max max-w-[min(92vw,460px)] items-center gap-2.5 rounded-xl bg-inv px-4 py-3 text-[13.5px] font-bold leading-[1.4] text-white shadow-[0_10px_30px_rgba(0,0,0,.25)]"
            >
              <span className="h-2 w-2 flex-none rounded-full bg-acc2" />
              <span>{t.msg}</span>
            </div>
          ))}
        </div>
      )}
    </ToastContext>
  );
}
