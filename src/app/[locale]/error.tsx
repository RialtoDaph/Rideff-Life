"use client";

// Shown when a screen fails to draw, instead of a blank page. The person can try
// again or go Home; what they saved is untouched.

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function ScreenError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("ui");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-4 p-6 wide:items-center wide:text-center">
      <h1 className="m-0 font-serif text-4xl font-normal tracking-[-0.01em]">{t("error_title")}</h1>
      <p className="m-0 max-w-[420px] text-sm text-mut">{t("error_body")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => retry()} className="flex min-h-[46px] items-center rounded-full bg-acc px-5 text-sm font-bold text-onacc">
          {t("error_retry")}
        </button>
        <Link href="/" className="flex min-h-[46px] items-center rounded-full border border-line px-5 text-sm font-bold">
          {t("back_home")}
        </Link>
      </div>
    </main>
  );
}
