// Tier 3 of the voice ladder: answers that play without the network, for when the live voice is down on stage.
// Nothing here is live and the screen says so. `source: "recorded"` means the words and audio come from a real
// session on the demo household ("Recorded earlier"); `"draft"` means the text was written from the seed numbers
// and is shown as "Prepared answer". Replace each draft with a real transcript (and optional `audio`) after the
// first good realtime run, then flip its source. Numbers follow scripts/demo-seed.mjs.

export type CannedStep = { name: string; args: string; ms: number; output: string };
export type Canned = {
  id: string;
  lang: "id" | "de" | "en";
  source: "recorded" | "draft";
  heard: string;
  answer: string;
  steps: CannedStep[];
  /** A place to point at (an area or a screen) while the answer is made. */
  show?: string;
  /** Optional recording under /demo/voice/. Without it the answer is read by the browser's own voice. */
  audio?: string;
};

export const CANNED: Canned[] = [
  {
    id: "id-fund",
    lang: "id",
    source: "draft",
    heard: "Berapa lama lagi sampai dana darurat kami penuh?",
    answer: "Dana daruratmu 9.800 euro dari 15.000, dan kalian menabung 450 euro sebulan. Jadi sekitar dua belas bulan lagi.",
    steps: [{ name: "get_goals", args: "{}", ms: 212, output: '{"emergency_fund":{"current":9800,"target":15000,"monthly":450}}' }],
    show: "goals",
  },
  {
    id: "id-month",
    lang: "id",
    source: "draft",
    heard: "Bagaimana uang kami bulan ini?",
    answer: "Pengeluaran bulan ini masih di bawah batas. Yang perlu diperhatikan: tiga langganan yang tidak terpakai, sekitar 38 euro sebulan.",
    steps: [{ name: "get_budget", args: "{}", ms: 187, output: '{"status":"under_limit","unused_subscriptions":3}' }],
    show: "money",
  },
  {
    id: "id-week",
    lang: "id",
    source: "draft",
    heard: "Ada apa saja minggu ini?",
    answer: "Hari ini ada telepon dengan klien Weber Verlag jam setengah sepuluh. Dan dalam lima hari ada SPT PPN, 612 euro.",
    steps: [{ name: "get_week", args: "{}", ms: 164, output: '{"today":["Client call 09:30","Gym 18:30"],"deadline":"VAT pre-return in 5 days, 612"}' }],
    show: "time",
  },
  {
    id: "de-fund",
    lang: "de",
    source: "draft",
    heard: "Wie lange noch, bis unser Notgroschen voll ist?",
    answer: "Euer Notgroschen steht bei 9.800 von 15.000 Euro, und ihr legt 450 im Monat zurück. Das sind noch etwa zwölf Monate.",
    steps: [{ name: "get_goals", args: "{}", ms: 205, output: '{"emergency_fund":{"current":9800,"target":15000,"monthly":450}}' }],
    show: "goals",
  },
  {
    id: "de-subs",
    lang: "de",
    source: "draft",
    heard: "Welche Abos nutzen wir gar nicht?",
    answer: "Drei Abos, die ihr nicht nutzt: Disney Plus, die Fitness-App und der Cloud-Speicher. Zusammen etwa 38 Euro im Monat.",
    steps: [{ name: "get_budget", args: "{}", ms: 191, output: '{"unused_subscriptions":["Disney+","Fitness app","Cloud storage 2 TB"],"monthly":37.97}' }],
    show: "money",
  },
];

/** The recordings for one language, in the order the presenter steps through them. */
export const cannedFor = (lang: string): Canned[] => CANNED.filter((c) => c.lang === lang);
