import type { LegalText } from ".";

export const en: LegalText = {
  impressum: (op) => ({
    title: "Legal notice",
    sections: [
      {
        h: "Provider (§ 5 DDG)",
        p: [
          op.lines.join("\n"),
          ...(op.representative ? [`Represented by: ${op.representative}`] : []),
          ...(op.register ? [`Register entry: ${op.register}`] : []),
          ...(op.vatId ? [`VAT identification number (§ 27a UStG): ${op.vatId}`] : []),
        ],
      },
      { h: "Contact", p: [[`Email: ${op.email}`, ...(op.phone ? [`Phone: ${op.phone}`] : [])].join("\n")] },
      { h: "Responsible for the content (§ 18 (2) MStV)", p: [op.lines.slice(0, 3).join("\n")] },
      {
        h: "Consumer dispute resolution",
        p: ["We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board."],
      },
      {
        h: "About the content",
        p: [
          "rideff Life helps you organise money, time and everyday life. The app and its assistant do not replace tax, legal, investment or medical advice. Calculations and AI answers can be wrong; check important numbers yourself.",
        ],
      },
    ],
  }),

  privacy: (op) => ({
    title: "Privacy policy",
    sections: [
      {
        h: "1. Controller",
        p: [`${op.lines.join(", ")}\nEmail: ${op.email}`, "Write to this address with any question about your data."],
      },
      {
        h: "2. What we process",
        p: [
          "Account data: email address, display name, language, role in the household, passkeys or a password hash, sign-in times.",
          "What you enter: income, spending, budgets, debts, subscriptions, shifts, goals, journal and training entries, uploaded files such as receipts and bank statements, and your messages to the assistant and what it remembers.",
          "Payment data: the plan you chose, the billing status and a customer number at Stripe. We never see or store card or bank details; Stripe holds them.",
          "Technical data: IP address, time, requested address and browser details in server logs and, if you turn on notifications, your device's push address.",
        ],
      },
      {
        h: "3. Purposes and legal bases",
        p: [
          "Providing the app, your account and the paid features: performance of a contract (Art. 6 (1) (b) GDPR).",
          "Security, protection against abuse and finding errors: legitimate interest (Art. 6 (1) (f) GDPR).",
          "Voice assistant, Telegram link and push notifications: your consent, which you can withdraw in Settings at any time (Art. 6 (1) (a) GDPR).",
          "If you choose to enter health details, for example in the journal or training log, we process them only to show them to you, based on your explicit consent (Art. 9 (2) (a) GDPR).",
          "Invoices and payment records: legal retention duties (Art. 6 (1) (c) GDPR).",
        ],
      },
      {
        h: "4. Recipients and processors",
        p: [
          "Supabase (database, sign-in, file storage): stored in Frankfurt am Main, EU.",
          "Vercel (hosting and delivery of the app): server functions run in Frankfurt am Main; the company is based in the USA.",
          "Stripe Payments Europe, Ireland (payments).",
          "Anthropic, USA (AI assistant): receives your question, the part of your data needed to answer it, and files you ask it to read.",
          "OpenAI, Ireland/USA (voice assistant): receives the audio of your conversation while it runs, and only when you start voice mode.",
          "Telegram (only if you link your account): receives the messages the bot sends you.",
          "Push services by Apple, Google or Mozilla (only with notifications on): receive encrypted notifications.",
          "We have data processing agreements with providers that work on our behalf. We do not sell data and show no advertising.",
        ],
      },
      {
        h: "5. Transfers outside the EU",
        p: [
          "Some providers are based in the USA or process data there. Transfers rely on the adequacy decision for the EU-US Data Privacy Framework where the provider is certified, and otherwise on the European Commission's standard contractual clauses.",
        ],
      },
      {
        h: "6. AI assistant",
        p: [
          "The assistant answers from your own entries. Under the AI providers' terms, content sent through their interface is not used to train their models.",
          "No automated decision with legal effect within the meaning of Art. 22 GDPR takes place. The assistant proposes changes to your data; you confirm them.",
        ],
      },
      {
        h: "7. Cookies and storage on your device",
        p: [
          "We only use what the app technically needs (§ 25 (2) TDDDG): a cookie for the language, your sign-in, the offline copy of your data, your display settings and, if you turn it on, the hash of your PIN. There are no tracking or advertising cookies and no analytics services.",
        ],
      },
      {
        h: "8. Retention and deletion",
        p: [
          "We keep your data for as long as your account exists. Under Settings → Data you can export a copy, delete your entries or delete your account completely. Deleting the account removes your entries and files at once; our providers' backups expire after their fixed periods.",
          "Invoice and payment data stays with Stripe and with us for as long as the law requires. Server logs are deleted after a short time.",
        ],
      },
      {
        h: "9. Shared households",
        p: [
          "If you join a household, its members see the entries marked “Family” and what the owner shares with you. Private entries stay visible to you alone.",
        ],
      },
      {
        h: "10. Your rights",
        p: [
          "You have the right to access, rectification, erasure, restriction of processing, data portability and objection (Art. 15 to 21 GDPR). You can withdraw consent at any time with effect for the future.",
          "You can complain to a data protection authority, for example the one where you live (Art. 77 GDPR).",
          "Your email address is required for the account. Everything else you enter is voluntary.",
        ],
      },
    ],
  }),

  terms: (op) => ({
    title: "Terms of service",
    sections: [
      {
        h: "1. Scope and provider",
        p: [
          `These terms apply to the use of rideff Life. The provider and your contract partner is ${op.name}, ${op.street}, ${op.city}. The service is meant for consumers aged 18 and over.`,
        ],
      },
      {
        h: "2. The service",
        p: [
          "rideff Life is a web app for organising your household's money, time and everyday life. What is included depends on the plan (Life, Life Plus, Together) and is described on the plan page.",
          "The app and its AI assistant give no tax, legal, investment or medical advice. Answers and calculations can be incomplete or wrong. Decisions are yours.",
          "AI features have daily or monthly limits, which are stated on the plan page.",
        ],
      },
      {
        h: "3. Account and trial",
        p: [
          "Signing up with your email creates a free account with a 14-day trial. No payment details are needed, and the trial never turns into a paid plan by itself.",
          "After the trial, without a paid plan only a limited set of features is available. Your data is kept and can still be exported.",
          "Keep your sign-in details secret and only enter data you are allowed to use.",
        ],
      },
      {
        h: "4. How a paid plan is concluded",
        p: [
          "The plan overview is not a binding offer. You make an offer by confirming the purchase in the checkout of our payment provider Stripe. The contract is concluded when we unlock the plan. You can read the contract text on this page at any time; the contract language is German.",
        ],
      },
      {
        h: "5. Prices and payment",
        p: [
          "The prices shown at checkout apply, in euros, as final prices. Depending on your choice you are billed monthly or yearly in advance through the payment method stored with Stripe.",
          "If a payment fails, we may lock paid features until the open amount is settled.",
        ],
      },
      {
        h: "6. Term and cancellation",
        p: [
          "A paid plan runs for one month or one year and renews for the same period unless cancelled. After the first year, yearly plans continue for an indefinite time and can then be cancelled at any time with one month's notice; we refund any amount paid for the time after that.",
          `You can cancel at any time to the end of the current period: in the app under Plan → Manage payment, or by email to ${op.email}. The right to terminate for good cause is unaffected.`,
          "You can delete your account at any time under Settings → Data. This also ends a paid plan at once.",
        ],
      },
      {
        h: "7. Right of withdrawal",
        p: ["Consumers have a statutory right of withdrawal. The details are in the withdrawal notice."],
      },
      {
        h: "8. Availability and changes",
        p: [
          "We aim for uninterrupted service but cannot rule out interruptions through maintenance or faults. We provide the updates needed to keep the service in conformity with the contract.",
          "We may develop the app further as long as the core of the plan you booked remains. We announce material changes to these terms or to prices by email at least six weeks ahead; you may then cancel as of the date of the change. Price changes apply only from the next billing period and only with your agreement.",
        ],
      },
      {
        h: "9. Liability",
        p: [
          "We are liable without limit for intent and gross negligence, for injury to life, body or health, and under the Product Liability Act. For slightly negligent breaches of essential contractual duties our liability is limited to the foreseeable damage typical for this kind of contract. Otherwise liability is excluded. Statutory warranty rights for digital products remain.",
        ],
      },
      {
        h: "10. Final provisions",
        p: [
          "German law applies. Mandatory consumer protection rules of the country where you habitually live continue to apply.",
          "We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board.",
          "If one provision is invalid, the others remain in force.",
        ],
      },
    ],
  }),

  withdrawal: (op) => ({
    title: "Withdrawal notice",
    sections: [
      {
        h: "Right of withdrawal",
        p: [
          "You have the right to withdraw from this contract within fourteen days without giving any reason. The withdrawal period is fourteen days from the day the contract was concluded.",
          `To exercise the right of withdrawal, you must inform us (${op.lines.join(", ")}, email: ${op.email}) of your decision to withdraw from this contract by a clear statement, for example by email or letter. You may use the model withdrawal form below, but you do not have to.`,
          "To meet the deadline, it is enough to send your notice before the withdrawal period has expired.",
        ],
      },
      {
        h: "Effects of withdrawal",
        p: [
          "If you withdraw from this contract, we will repay all payments received from you without undue delay and at the latest within fourteen days from the day we received your notice. We use the same means of payment you used for the original transaction unless something else was expressly agreed with you; you are not charged for the repayment.",
          "If you asked for the service to begin during the withdrawal period, you owe us a reasonable amount in proportion to what was provided up to your withdrawal, compared with the full scope of the contract.",
        ],
      },
      {
        h: "Model withdrawal form",
        p: [
          "If you want to withdraw from the contract, fill in this form and send it back.",
          `To ${op.lines.join(", ")}, email: ${op.email}`,
          "I/We (*) hereby withdraw from the contract concluded by me/us (*) for the following service: rideff Life, plan ______",
          "Ordered on: ______\nName of the consumer(s): ______\nEmail address of the account: ______\nAddress of the consumer(s): ______\nDate: ______",
          "(*) Delete as appropriate.",
        ],
      },
    ],
  }),
};
