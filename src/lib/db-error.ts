/** What a refused write means to a person, so the message can say what to do next. */
export type DbErrorKind = "session" | "denied" | "duplicate" | "invalid" | "other";

export function dbErrorKind(error: { code?: string; message?: string; status?: number }): DbErrorKind {
  const code = error.code ?? "";
  const m = error.message ?? "";
  if (error.status === 401 || /jwt|not authenticated|PGRST30[0-9]/i.test(`${code} ${m}`)) return "session";
  if (code === "42501" || /row-level security|permission denied/i.test(m)) return "denied";
  if (code === "23505") return "duplicate";
  if (["23502", "23503", "23514", "22P02", "22001", "22003"].includes(code)) return "invalid";
  return "other";
}

/** The message key for a failed write: a specific one when we know what happened, otherwise `fallback`. */
export function dbErrorKey<F extends string>(error: { code?: string; message?: string; status?: number }, fallback: F) {
  const kind = dbErrorKind(error);
  return (kind === "other" ? fallback : `save_${kind}`) as F | "save_session" | "save_denied" | "save_duplicate" | "save_invalid";
}
