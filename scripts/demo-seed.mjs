#!/usr/bin/env node
// Fills the demo household "Lena & Tom Brandt, Leipzig" for the live talk.
//
//   node scripts/demo-seed.mjs --dry-run     prints what would be written; no network, no login
//   node scripts/demo-seed.mjs --check       signs in and reports the guards; writes nothing
//   node scripts/demo-seed.mjs               signs in as the demo person and writes (resets their own rows first)
//
// It signs in as Lena with the publishable key, so Row Level Security applies exactly as in the app:
// no service role, nothing can reach another household. Credentials come from .env.demo.local
// (git-ignored): DEMO_EMAIL, DEMO_PASSWORD, optionally DEMO_TOM_EMAIL.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const HOUSEHOLD = "Lena & Tom Brandt"; // keep in step with DEMO_HOUSEHOLD in src/lib/tour.ts
const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const CHECK = args.has("--check");

function loadEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
  );
}

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const monthKey = (d, ago) => iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - ago, 1))).slice(0, 7);

/** The whole persona, as rows per table. `ids` carries what must be known first (categories, businesses, members). */
export function build(today, ids = {}) {
  const mon = addDays(today, -((today.getUTCDay() + 6) % 7));
  const m0 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const cat = (n) => ids.cat?.[n] ?? null;
  const tom = ids.tom ?? null;
  const categories = [
    ["Rent & utilities", "house", 1180, true], ["Insurance & health", "shield", 310, true], ["Transport", "train-front", 98, true],
    ["Business tools", "laptop", 150, true], ["Streaming & apps", "tv", 70, true], ["Groceries", "shopping-cart", 560, false],
    ["Online shopping", "package", 220, false], ["Eating out", "utensils", 240, false], ["Coffee & drinks", "coffee", 90, false],
    ["Personal & gifts", "gift", 140, false],
  ].map(([name, icon, monthly_limit, is_fixed], i) => ({ name, icon, monthly_limit, is_fixed, sort: i + 1 }));
  return {
    categories,
    incomes: [
      { name: "Leipzig Verkehrsbetriebe · salary (Tom)", member_id: tom, kind: "Salary", monthly_amount: 2480 },
      { name: "Lena Brandt Design", member_id: ids.me ?? null, kind: "Business", monthly_amount: 2900 },
    ],
    recurring: [
      ["Rent · LWB Leipzig", "house", -920, "Rent & utilities", 1], ["Stadtwerke Leipzig · power", "house", -96, "Rent & utilities", 1],
      ["Telekom · internet & phones", "smartphone", -92, "Rent & utilities", 1], ["Techniker Krankenkasse", "shield", -265, "Insurance & health", 1],
      ["HUK · liability & home", "shield", -38, "Insurance & health", 1], ["Deutschlandticket ×2", "train-front", -98, "Transport", 1],
      ["Figma + Adobe · studio", "laptop", -79, "Business tools", 12], ["LVB · salary (Tom)", "banknote", 2480, null, 28],
    ].map(([name, icon, amount, c, day_of_month]) => ({ name, icon, amount, category_id: c ? cat(c) : null, day_of_month })),
    transactions: [
      [0, -52.3, "REWE Leipzig", "Groceries"], [-1, -24.99, "Amazon.de", "Online shopping"], [-1, -4.8, "Café Cantona", "Coffee & drinks"],
      [-2, -61.4, "Zalando", "Online shopping"], [-3, 540, "Client payment · Weber Verlag", null], [-4, -46.5, "Trattoria Da Marco", "Eating out"],
    ].map(([off, amount, payee, c]) => ({ date: iso(addDays(today, Math.max(off, -today.getUTCDate() + 1))), amount, payee, category_id: c ? cat(c) : null })),
    // Storyline 1: the emergency fund, 9 800 of 15 000, +450 a month.
    goals: [
      { name: "Emergency fund · 6 months", icon: "life-buoy", target: 15000, current: 9800, monthly: 450, is_emergency_fund: true, visibility: "family" },
      { name: "Family car", icon: "car", target: 12000, current: 3400, monthly: 250, is_emergency_fund: false, visibility: "family" },
      { name: "Retirement ETF · first milestone", icon: "trending-up", target: 20000, current: 12300, monthly: 350, is_emergency_fund: false, visibility: "family" },
      { name: "Studio equipment", icon: "briefcase", target: 6000, current: 2150, monthly: 150, is_emergency_fund: false, visibility: "family" },
      { name: "Anniversary trip, Lisbon", icon: "mountain", target: 1200, current: 640, monthly: 80, is_emergency_fund: false, visibility: "private" },
    ],
    debts: [
      { name: "Furniture loan", icon: "sofa", lender: "Sparkasse Leipzig", balance: 3200, original: 5000, rate_pct: 6.4, monthly_payment: 150 },
      { name: "Phone financing", icon: "smartphone", lender: "o2", balance: 380, original: 760, rate_pct: 0, monthly_payment: 32 },
      { name: "Klarna pay later", icon: "credit-card", lender: "Klarna", balance: 214, original: 360, rate_pct: 0, monthly_payment: 70 },
    ],
    // Storyline 2: three subscriptions nobody uses, about 38 a month. Clopar offers to cancel them.
    subscriptions: [
      ["Netflix", 13.99, null], ["Spotify Family", 17.99, null],
      ["Disney+", 9.99, null], ["Fitness app (unused)", 13.99, null], ["Cloud storage 2 TB (unused)", 13.99, null],
    ].map(([name, monthly_price, for_whom]) => ({ name, monthly_price, for_whom })),
    // Storyline 3: the VAT pre-return in five days, 612 due, 540 set aside.
    businesses: [{ name: "Lena Brandt Design", sort: 1, mine: true }],
    business_months: [[1, 3150, 480, 190], [2, 2780, 455, 180], [3, 2950, 470, 170]].map(([ago, revenue, costs, tax_set_aside]) => ({ ago, month: monthKey(today, ago), revenue, costs, tax_set_aside })),
    tax_deadlines: [
      { title: "VAT pre-return", due_date: iso(addDays(today, 5)), amount: 612, kind: "vat" },
      { title: "Income tax return (joint)", due_date: `${today.getUTCFullYear() + 1}-07-31`, amount: null, kind: "return" },
    ],
    assets: [
      { name: "ETF savings plan", icon: "trending-up", location: "Trade Republic · FTSE All-World", orig_currency: "EUR", orig_value: 12300 },
      { name: "Tagesgeld", icon: "landmark", location: "Trade Republic · 2.0% interest", orig_currency: "EUR", orig_value: 9800 },
      { name: "Goal pots", icon: "target", location: "Sparkasse sub-accounts", orig_currency: "EUR", orig_value: 6190 },
    ],
    events: [
      ["Client call · Weber Verlag", 0, "09:30", null, "event"], ["Gym", 0, "18:30", null, "event"], ["Invoice run", 1, "10:00", null, "event"],
      ["Tom · early shift", 2, "05:30", "13:30", "shift"], ["Tom · early shift", 3, "05:30", "13:30", "shift"],
      ["Date night", 4, "19:00", null, "event"], ["VAT pre-return", 5, "09:00", null, "event"],
    ].map(([title, d, start_time, end_time, kind]) => ({ title, date: iso(addDays(mon, d)), start_time, end_time, kind })),
    yearly_goals: [
      { name: "Read 24 books", icon: "graduation-cap", target: 24, unit: "books", done: 17, step: "1 hour of reading" },
      { name: "Design studio: 8 new clients", icon: "laptop", target: 8, unit: "clients", done: 6, step: "5 outreach messages" },
      { name: "Gym 3× a week", icon: "dumbbell", target: 156, unit: "sessions", done: 104, step: "3 sessions" },
      { name: "45 date nights", icon: "heart", target: 45, unit: "dates", done: 33, step: "1 date night" },
    ],
    gym_sessions: [["Strength", 0, "07:30"], ["Strength", -2, "10:00"], ["Cardio", -4, "07:30"], ["Strength", -6, "07:30"]].map(([type, d, time]) => ({ type, date: iso(addDays(today, d)), time })),
    // What Clopar already knows: the next session can start from it.
    ai_memories: [
      { scope: "shared", kind: "plan", text: "Lena and Tom are saving 450 euros a month to reach a 15,000 euro emergency fund.", source: "voice" },
      { scope: "shared", kind: "preference", text: "Prefers short answers with the number first.", source: "manual" },
    ],
  };
}

const rows = (d) => Object.entries(d).map(([t, r]) => `${t.padEnd(18)} ${String(r.length).padStart(3)} rows`);

if (DRY) {
  const d = build(new Date());
  console.log(`DRY RUN: nothing is read or written.\nHousehold: ${HOUSEHOLD}, Leipzig\n`);
  console.log(rows(d).join("\n"));
  console.log("\nOrder when it runs for real: guard -> rpc reset_my_data -> rename household -> insert every table above.");
  process.exit(0);
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env.demo.local"), ...process.env };
const need = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "DEMO_EMAIL", "DEMO_PASSWORD"].filter((k) => !env[k]);
if (need.length) {
  console.error(`Missing ${need.join(", ")}. Put DEMO_EMAIL and DEMO_PASSWORD in .env.demo.local (git-ignored).`);
  process.exit(1);
}
if (!/jfvgfbmilavkkdjohmcl/.test(env.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error("Refusing: the Supabase URL is not the rideff-life project.");
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const must = (what, { data, error }) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const { data: auth, error: aerr } = await sb.auth.signInWithPassword({ email: env.DEMO_EMAIL, password: env.DEMO_PASSWORD });
if (aerr) throw new Error(`sign-in: ${aerr.message}`);
const me = auth.user.id;
const members = must("members", await sb.from("members").select("id,email,display_name,household_id"));
const hh = must("household", await sb.from("households").select("id,name").limit(1).maybeSingle());
const tom = members.find((m) => env.DEMO_TOM_EMAIL && m.email === env.DEMO_TOM_EMAIL)?.id ?? null;

// Guards: only a fresh or already-demo household, at most two people, and only the person who signed in.
const guards = [
  [members.some((m) => m.id === me && m.email === env.DEMO_EMAIL), "the signed-in member is the demo email"],
  [hh && (hh.name === HOUSEHOLD || hh.name === "Household"), `household is "${HOUSEHOLD}" or still the default name (is: "${hh?.name}")`],
  [members.length <= 2, "at most two members"],
];
for (const [ok, text] of guards) console.log(`${ok ? "ok  " : "STOP"} ${text}`);
if (guards.some(([ok]) => !ok)) process.exit(1);
if (CHECK) {
  console.log("\nGuards pass. Nothing written (--check).");
  process.exit(0);
}

must("reset", await sb.rpc("reset_my_data")); // her own rows only (RLS), including Clopar's messages and memories
must("rename", await sb.from("households").update({ name: HOUSEHOLD, home_city: "Leipzig" }).eq("id", hh.id));

const cats = must("categories", await sb.from("categories").insert(build(new Date()).categories).select("id,name"));
const ids = { cat: Object.fromEntries(cats.map((c) => [c.name, c.id])), me, tom };
const d = build(new Date(), ids);
const biz = must("business", await sb.from("businesses").insert(d.businesses.map(({ mine, ...b }) => ({ ...b, member_id: mine ? me : null }))).select("id"));
for (const t of ["incomes", "recurring", "transactions", "goals", "debts", "subscriptions", "tax_deadlines", "assets", "events", "yearly_goals", "gym_sessions", "ai_memories"]) {
  must(t, await sb.from(t).insert(d[t]));
}
must("business_months", await sb.from("business_months").insert(d.business_months.map(({ ago, ...m }) => ({ ...m, business_id: biz[0].id }))));
console.log("\nDone:\n" + rows(d).join("\n"));
