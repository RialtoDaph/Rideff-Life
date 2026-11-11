// Who runs rideff Life. German law (DDG §5) wants these on the Impressum, and the
// privacy policy, terms and withdrawal notice name the same person.
// Fill in every field that applies. While `name`, `street`, `city` or `email` is empty,
// the legal pages show a "draft" banner and [placeholders] instead of the details.

export type Operator = {
  /** Full legal name: a person ("Maria Muster") or a company with its form ("Muster GmbH"). */
  name: string;
  /** Who represents a company, e.g. its managing director. Leave empty for a person. */
  representative: string;
  street: string;
  /** Postcode and town. */
  city: string;
  country: string;
  email: string;
  /** Recommended: a second quick way to reach you besides email. */
  phone: string;
  /** USt-IdNr., if you have one. */
  vatId: string;
  /** Register court and number, e.g. "Amtsgericht Berlin, HRB 12345". Companies only. */
  register: string;
};

export const OPERATOR: Operator = {
  // Sole trader (Einzelunternehmer) trading as Rideff.
  name: "Rialto Daphino Effendy (Rideff)",
  representative: "",
  street: "",
  city: "",
  country: "Deutschland",
  email: "hallo@rideff.com",
  phone: "+49 176 32572420",
  vatId: "",
  register: "",
};

export const operatorReady = (op: Operator = OPERATOR) => !!(op.name && op.street && op.city && op.email);

/** The date the legal texts were last changed (ISO). */
export const LEGAL_UPDATED = "2026-11-11";
