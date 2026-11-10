// Server only. The bot works as the person who wrote, never with admin rights on
// their data: the server key is used only to find who a chat belongs to and to
// open a normal sign-in session for that person. Row Level Security then decides
// what the bot reads and writes, exactly as in the app.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type TgMember = { member_id: string; email: string; display_name: string; lang: string; ai_name: string | null; memory_on: boolean };

const URL_ = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

/** Calls the telegram_* functions that only the server key may run. */
export function tgAdmin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY;
  return key ? createClient(URL_(), key, opts) : null;
}

export async function memberOfChat(admin: SupabaseClient, chatId: number): Promise<TgMember | null> {
  const { data, error } = await admin.rpc("telegram_member", { p_chat: chatId });
  if (error) console.error("telegram_member", error.message);
  return ((data as TgMember[] | null) ?? [])[0] ?? null;
}

// Sessions are reused while this server instance lives, so not every message signs in.
const sessions = new Map<string, { token: string; until: number }>();

/** A database client that acts as this member. */
export async function actAs(admin: SupabaseClient, m: Pick<TgMember, "member_id" | "email">): Promise<SupabaseClient | null> {
  let s = sessions.get(m.member_id);
  if (!s || s.until < Date.now() + 120_000) {
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: m.email });
    const hash = link.data?.properties?.hashed_token;
    if (!hash) {
      console.error("telegram sign-in link", link.error?.message);
      return null;
    }
    const anon = createClient(URL_(), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, opts);
    const { data, error } = await anon.auth.verifyOtp({ token_hash: hash, type: "email" });
    if (!data.session || data.user?.id !== m.member_id) {
      console.error("telegram sign-in", error?.message);
      return null;
    }
    s = { token: data.session.access_token, until: (data.session.expires_at ?? 0) * 1000 };
    sessions.set(m.member_id, s);
  }
  return createClient(URL_(), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    ...opts,
    global: { headers: { Authorization: `Bearer ${s.token}` } },
  });
}
