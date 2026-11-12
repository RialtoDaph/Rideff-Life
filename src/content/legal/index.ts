// The four legal pages. German is the binding version; English and Indonesian are
// translations for convenience. These are drafts written without legal advice:
// have a lawyer check them before the app is opened to the public.

import type { Locale } from "@/i18n/routing";
import { de } from "./de";
import { en } from "./en";
import { id } from "./id";
import { OPERATOR, type Operator } from "./operator";

export const LEGAL_SLUGS = ["impressum", "privacy", "terms", "withdrawal"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export type LegalSection = { h: string; p: string[] };
export type LegalDoc = { title: string; sections: LegalSection[] };
export type LegalText = Record<LegalSlug, (op: Filled) => LegalDoc>;

/** Operator details with [placeholders] where a required field is still empty. */
export type Filled = Operator & { lines: string[] };

export function filled(op: Operator, missing: Record<"name" | "street" | "city" | "email", string>): Filled {
  const f = {
    ...op,
    name: op.name || missing.name,
    street: op.street || missing.street,
    city: op.city || missing.city,
    email: op.email || missing.email,
  };
  return { ...f, lines: [f.name, f.street, f.city, f.country].filter(Boolean) };
}

const TEXTS: Record<Locale, LegalText> = { en, de, id };
const MISSING: Record<Locale, Parameters<typeof filled>[1]> = {
  de: { name: "[Name des Anbieters]", street: "[Straße und Hausnummer]", city: "[PLZ und Ort]", email: "[E-Mail-Adresse]" },
  en: { name: "[name of the provider]", street: "[street and number]", city: "[postcode and town]", email: "[email address]" },
  id: { name: "[nama penyedia]", street: "[jalan dan nomor]", city: "[kode pos dan kota]", email: "[alamat email]" },
};

export const isLegalSlug = (s: string): s is LegalSlug => (LEGAL_SLUGS as readonly string[]).includes(s);

export function legalDoc(locale: Locale, slug: LegalSlug, op: Operator = OPERATOR): LegalDoc {
  return TEXTS[locale][slug](filled(op, MISSING[locale]));
}
