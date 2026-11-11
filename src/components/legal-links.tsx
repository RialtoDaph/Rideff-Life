import Link from "next/link";
import { useTranslations } from "next-intl";
import { LEGAL_SLUGS, type LegalSlug } from "@/content/legal";

/** The four legal pages as a row of links; `current` is left out on the page that shows it. */
export function LegalLinks({ className = "", current }: { className?: string; current?: LegalSlug }) {
  const t = useTranslations("ui");
  return (
    <nav aria-label={t("legal_nav")} className={`flex flex-wrap items-center gap-x-4 ${className}`}>
      {LEGAL_SLUGS.filter((s) => s !== current).map((slug) => (
        <Link key={slug} href={`/legal/${slug}`} className="hit44 inline-flex min-h-11 items-center text-xs font-bold text-mut underline-offset-2 hover:underline">
          {t(`legal_${slug}`)}
        </Link>
      ))}
    </nav>
  );
}
