"use client";

// The last net: shown when the root layout itself fails, so it brings its own
// document and cannot use the app's styles or translations.

import { useEffect } from "react";

const TEXT: Record<string, [string, string]> = {
  en: ["Something went wrong.", "Try again"],
  de: ["Etwas ist schiefgelaufen.", "Erneut versuchen"],
  id: ["Ada yang tidak beres.", "Coba lagi"],
};

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const lang = typeof window === "undefined" ? "en" : (window.location.pathname.split("/")[1] ?? "en");
  const [title, again] = TEXT[lang] ?? TEXT.en;

  return (
    <html lang={lang in TEXT ? lang : "en"}>
      <body style={{ margin: 0, minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, padding: 24, background: "#000", color: "#f4f1ea", fontFamily: "system-ui, sans-serif" }}>
        <title>rideff Life</title>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 400 }}>{title}</h1>
        <button type="button" onClick={() => retry()} style={{ alignSelf: "flex-start", minHeight: 46, padding: "0 20px", borderRadius: 999, border: 0, background: "#E8D9B5", color: "#000", fontSize: 14, fontWeight: 700 }}>
          {again}
        </button>
      </body>
    </html>
  );
}
