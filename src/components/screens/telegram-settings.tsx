"use client";

import { Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useAiName } from "@/components/app-data";
import { useToast } from "@/components/toast";
import { supabase } from "@/lib/supabase";

type Status = { linked: boolean; username: string | null; linked_at: string | null } | null;
type SectionLike = (p: { title: string; sub?: string; pill?: React.ReactNode; children: React.ReactNode }) => React.ReactNode;
type PillLike = (p: { tone: "ok" | "mut"; children: React.ReactNode }) => React.ReactNode;

const ERRORS = ["no_token", "no_server_key", "bad_token", "not_production"] as const;

/** Settings → Telegram: link this person's Telegram chat to Clopar, or remove the link. */
export function TelegramSection({ Section, Pill }: { Section: SectionLike; Pill: PillLike }) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const aiName = useAiName();
  const toast = useToast();
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase().rpc("telegram_status");
    setStatus(error ? null : (((data as Status[] | null) ?? [])[0] ?? null));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase().auth.getSession();
      const res = await fetch("/api/telegram/link", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const json = (await res.json().catch(() => null)) as { url?: string; code?: string; error?: string } | null;
      if (!res.ok || !json?.url) {
        const code = ERRORS.find((c) => c === json?.code);
        setError(code ? t(`tg_err_${code}`) : (json?.error ?? t("tg_err_failed")));
        return;
      }
      setLink(json.url);
    } catch {
      setError(navigator.onLine ? t("tg_err_failed") : t("needs_net"));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm(t("tg_disc_q"))) return;
    const { error } = await supabase().rpc("telegram_unlink");
    if (error) return toast(t("tg_disc_failed"));
    setLink("");
    void load();
    toast(t("tg_disc_done"));
  }

  const linked = !!status?.linked;
  const since = status?.linked_at
    ? new Date(status.linked_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" })
    : "";
  return (
    <Section title={t("tg_title")} sub={t("tg_sub", { name: aiName })} pill={<Pill tone={linked ? "ok" : "mut"}>{linked ? t("tg_connected") : t("p_off")}</Pill>}>
      {linked && <div className="text-[13px] text-mut">{t("tg_as", { who: status?.username ? `@${status.username}` : "Telegram", when: since })}</div>}
      {error && (
        <div className="rounded-[10px] bg-badbg p-3 text-[13px] font-bold text-bad" role="alert">
          {error}
        </div>
      )}
      {link && !linked ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-[10px] bg-soft p-3.5 text-[13px] leading-normal text-mut">{t("tg_how")}</div>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-full border-0 bg-acc text-sm font-extrabold text-onacc no-underline"
          >
            <Send size={16} /> {t("tg_open")}
          </a>
          <button onClick={() => void load()} className="min-h-11 rounded-full border border-line bg-transparent text-[13.5px] font-bold text-ink">
            {t("tg_check")}
          </button>
        </div>
      ) : (
        <button
          onClick={connect}
          disabled={busy}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-full text-sm font-extrabold disabled:opacity-50 ${
            linked ? "border border-line bg-transparent text-ink" : "border-0 bg-acc text-onacc"
          }`}
        >
          <Send size={16} /> {linked ? t("tg_reconnect") : t("tg_connect")}
        </button>
      )}
      {linked && (
        <button onClick={disconnect} className="min-h-11 border-0 bg-transparent text-[13.5px] font-bold text-bad">
          {t("tg_disc")}
        </button>
      )}
    </Section>
  );
}
