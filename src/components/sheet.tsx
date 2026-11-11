"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** How far (px) or how fast (px/ms) a sheet must be pulled down to close. */
const DRAG_CLOSE_PX = 110;
const DRAG_CLOSE_SPEED = 0.6;

/**
 * Bottom sheet on phones, centred modal from 900px up. Tapping the scrim, Escape,
 * the X, or pulling the sheet down by its top closes it; it animates out first.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("copy");
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; at: number; dy: number } | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const close = useCallback(() => setClosing(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  // If the closing animation never reports back (tab hidden, element gone), close anyway.
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => onCloseRef.current(), 400);
    return () => clearTimeout(timer);
  }, [closing]);

  // Pull down by the header to dismiss (phones only: the modal on wide screens stays put).
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || window.innerWidth >= 900 || (e.target as HTMLElement).closest("button")) return;
    drag.current = { y: e.clientY, at: e.timeStamp, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !panel.current) return;
    d.dy = Math.max(0, e.clientY - d.y);
    panel.current.style.transition = "none";
    panel.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !panel.current) return;
    const speed = d.dy / Math.max(1, e.timeStamp - d.at);
    if (d.dy > DRAG_CLOSE_PX || (d.dy > 24 && speed > DRAG_CLOSE_SPEED)) return close(); // leaves from where the finger let go
    panel.current.style.transition = "transform var(--dur-2) var(--ease-sheet)";
    panel.current.style.transform = "";
  };

  return (
    <div
      onClick={close}
      data-closing={closing || undefined}
      className="sheet-scrim fixed inset-0 z-[60] flex items-end justify-center bg-black/55 wide:items-center wide:p-6"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-closing={closing || undefined}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => closing && e.target === e.currentTarget && onCloseRef.current()}
        className="sheet-panel flex max-h-[88dvh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-[24px] bg-card px-[22px] pb-[calc(22px+env(safe-area-inset-bottom))] pt-[22px] shadow-[0_20px_60px_rgba(0,0,0,.3)] wide:rounded-[24px]"
      >
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="relative -mx-[22px] -mt-[22px] flex touch-none items-center justify-between gap-2.5 px-[22px] pt-[22px]"
        >
          <span aria-hidden className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-line2 wide:hidden" />
          <h2 className="m-0 text-xl font-extrabold tracking-[-0.01em]">{title}</h2>
          <button
            onClick={close}
            aria-label={t("close")}
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full border-0 bg-soft2 text-ink"
          >
            <X size={16} strokeWidth={2.6} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export type FieldValue = string | boolean | File | null;
export type FormValues = Record<string, FieldValue>;

export type Field =
  | { kind: "text"; key: string; label: string; placeholder?: string; required?: boolean }
  | { kind: "amount"; key: string; label: string; prefix?: "€" | "Rp"; placeholder?: string; required?: boolean }
  | { kind: "number"; key: string; label: string; placeholder?: string; required?: boolean }
  | { kind: "date"; key: string; label: string; required?: boolean }
  | { kind: "time"; key: string; label: string; required?: boolean }
  | { kind: "textarea"; key: string; label: string; placeholder?: string; required?: boolean; rows?: number }
  | {
      kind: "chips";
      key: string;
      label: string;
      options: { value: string; label: string; icon?: LucideIcon }[];
      required?: boolean;
    }
  | { kind: "toggle"; key: string; label: string; toggleLabel: string }
  | { kind: "file"; key: string; label: string; accept: string; current?: string }
  | { kind: "note"; key: string; label: string; text: string };

const inputCls =
  "h-[50px] rounded-[10px] border border-line bg-soft px-3.5 text-base text-ink outline-none focus:border-line2";

/** The one generic form used everywhere. */
/** "Visible to: Family / Only me", the same on every form. */
export function useVisibilityField(): Field {
  const tm = useTranslations("money");
  return {
    kind: "chips",
    key: "visibility",
    label: tm("visible_to"),
    required: true,
    options: [
      { value: "family", label: tm("family") },
      { value: "private", label: tm("only_me") },
    ],
  };
}

export function FormSheet({
  title,
  fields,
  initial,
  editing = false,
  onSave,
  onDelete,
  onClose,
}: {
  title: string;
  fields: Field[];
  initial?: FormValues;
  editing?: boolean;
  onSave: (values: FormValues) => Promise<string | void> | string | void;
  onDelete?: () => Promise<void> | void;
  onClose: () => void;
}) {
  const tm = useTranslations("money");
  const [values, setValues] = useState<FormValues>(initial ?? {});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: string, v: FieldValue) => setValues((s) => ({ ...s, [key]: v }));

  async function save() {
    const missing = fields.find(
      (f) => "required" in f && f.required && !String(values[f.key] ?? "").trim(),
    );
    if (missing) {
      setError(tm("please_fill_in", { label: missing.label }));
      return;
    }
    setBusy(true);
    setError("");
    const err = await onSave(values);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-2">
            <div className="text-[12.5px] font-bold text-mut">{f.label}</div>
            {f.kind === "text" && (
              <input
                className={inputCls}
                value={String(values[f.key] ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.kind === "number" && (
              <input
                className={inputCls}
                inputMode="decimal"
                value={String(values[f.key] ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.kind === "date" && (
              <input
                type="date"
                className={inputCls}
                value={String(values[f.key] ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.kind === "time" && (
              <input
                type="time"
                className={inputCls}
                value={String(values[f.key] ?? "").slice(0, 5)}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.kind === "textarea" && (
              <textarea
                className="min-h-[120px] rounded-[10px] border border-line bg-soft px-3.5 py-3 text-base leading-normal text-ink outline-none focus:border-line2"
                rows={f.rows ?? 5}
                value={String(values[f.key] ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.kind === "amount" && (
              <div className="flex h-14 items-center gap-2 rounded-[10px] border border-line bg-soft px-3.5">
                <span className="text-xl font-black text-mut2">{f.prefix ?? "€"}</span>
                <input
                  inputMode="decimal"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[22px] font-black text-ink outline-none"
                  value={String(values[f.key] ?? "")}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </div>
            )}
            {f.kind === "chips" && (
              <div className="flex flex-wrap gap-1.5">
                {f.options.map((o) => {
                  const on = values[f.key] === o.value;
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-label={o.label || o.value}
                      aria-pressed={on}
                      onClick={() => set(f.key, o.value)}
                      className={`inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-[13px] text-[13px] font-bold ${
                        on ? "border-ink bg-inv text-white" : "border-line bg-card text-ink"
                      }`}
                    >
                      {Icon && <Icon size={18} strokeWidth={1.7} />}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
            {f.kind === "file" && (
              <label className="flex min-h-[50px] cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-line2 bg-soft px-3.5 py-3">
                <span className="rounded-full bg-card px-3 py-1.5 text-[13px] font-extrabold text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]">
                  {tm("choose_file")}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-mut">
                  {values[f.key] instanceof File ? (values[f.key] as File).name : (f.current ?? tm("no_file_yet"))}
                </span>
                <input
                  type="file"
                  accept={f.accept}
                  className="sr-only"
                  onChange={(e) => set(f.key, e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {f.kind === "note" && <div className="text-[13px] leading-normal text-mut">{f.text}</div>}
            {f.kind === "toggle" && (
              <button
                type="button"
                onClick={() => set(f.key, !values[f.key])}
                className="flex min-h-[50px] items-center gap-3 rounded-[10px] border-0 bg-soft px-3.5 py-3 text-left"
              >
                <Switch on={!!values[f.key]} />
                <span className="text-[13.5px] font-bold text-ink">{f.toggleLabel}</span>
              </button>
            )}
          </div>
        ))}
        {error && <div className="text-[13px] font-bold text-bad">{error}</div>}
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete()}
              className="h-[50px] rounded-full border border-badbg bg-card px-[18px] text-sm font-extrabold text-bad"
            >
              {tm("delete_5")}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="h-[50px] flex-1 rounded-full border-0 bg-acc text-[15px] font-extrabold text-onacc hover:bg-acc2 disabled:opacity-60"
          >
            {busy ? tm("saving") : editing ? tm("save_changes") : tm("save")}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Visual on/off switch (46×28). Wrap it in a button. */
export function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-7 w-[46px] flex-none rounded-full p-[3px] ${on ? "justify-end bg-acc" : "justify-start bg-line2"}`}
    >
      <span className="h-[22px] w-[22px] rounded-full bg-card shadow-[0_1px_3px_rgba(0,0,0,.2)]" />
    </span>
  );
}
