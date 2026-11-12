import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { LegalLinks } from "@/components/legal-links";
import { LogoTile } from "@/components/logo";
import { LEGAL_SLUGS, isLegalSlug, legalDoc } from "@/content/legal";
import { LEGAL_UPDATED, operatorReady } from "@/content/legal/operator";
import { routing } from "@/i18n/routing";

// Public pages: readable without an account, in every language.
export function generateStaticParams() {
  return LEGAL_SLUGS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/legal/[doc]">): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!hasLocale(routing.locales, locale) || !isLegalSlug(doc)) return {};
  return { title: `${legalDoc(locale, doc).title} · rideff Life` };
}

export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[doc]">) {
  const { locale, doc } = await params;
  if (!hasLocale(routing.locales, locale) || !isLegalSlug(doc)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "ui" });
  const format = await getFormatter({ locale });
  const text = legalDoc(locale, doc);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-6 px-5 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))]">
      <Link href="/" aria-label={t("back_home")} className="hit44 flex min-h-11 items-center gap-2.5 self-start text-ink hover:text-ink">
        <LogoTile />
        <span className="text-[15px] font-bold tracking-[-0.01em]">rideff Life</span>
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="m-0 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em] [text-wrap:pretty]">{text.title}</h1>
        <div className="text-[13px] text-mut">{t("legal_updated", { date: format.dateTime(new Date(`${LEGAL_UPDATED}T12:00:00Z`), { dateStyle: "long", timeZone: "Europe/Berlin" }) })}</div>
        {!operatorReady() && (
          <div role="note" className="rounded-[10px] border border-line2 bg-soft2 px-4 py-3 text-[13.5px] font-bold text-ink">
            {t("legal_draft")}
          </div>
        )}
        {locale !== "de" && <div className="text-[13px] text-mut">{t("legal_binding")}</div>}
      </header>

      {text.sections.map((s) => (
        <section key={s.h} className="flex flex-col gap-2.5">
          <h2 className="m-0 text-lg font-extrabold [text-wrap:pretty]">{s.h}</h2>
          {s.p.map((p, i) => (
            <p key={i} className="m-0 whitespace-pre-line text-[15px] leading-relaxed text-ink [overflow-wrap:anywhere]">
              {p}
            </p>
          ))}
        </section>
      ))}

      <LegalLinks current={doc} className="mt-2 border-t border-line pt-3" />
    </main>
  );
}
