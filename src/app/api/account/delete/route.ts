// Deletes the signed-in person's account for good (GDPR Art. 17).
// The last person in a household takes the household with them. An owner who leaves
// others behind hands the household to a partner and ends the paid plan, because the
// card on file is theirs.

import type { SupabaseClient } from "@supabase/supabase-js";
import { successor, type Heir } from "@/lib/account";
import { billingAdmin, stripe } from "@/lib/stripe";

const fail = (code: string, status: number) => Response.json({ code }, { status });
const BUCKET = "files";

/** Removes every upload under `<household>/<member>/`. Returns false when storage refused. */
async function removeUploads(admin: SupabaseClient, folder: string): Promise<boolean> {
  for (let round = 0; round < 200; round++) {
    const { data, error } = await admin.storage.from(BUCKET).list(folder, { limit: 1000 });
    if (error) return false;
    if (!data.length) return true;
    const { error: gone } = await admin.storage.from(BUCKET).remove(data.map((f) => `${folder}/${f.name}`));
    if (gone) return false;
  }
  return false;
}

export async function POST(req: Request) {
  const admin = billingAdmin();
  if (!admin) return fail("not_configured", 503);
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return fail("signed_out", 401);
  const { data: who } = await admin.auth.getUser(token);
  if (!who.user) return fail("signed_out", 401);
  const userId = who.user.id;

  const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== "DELETE") return fail("not_confirmed", 400);

  // A second try after a half-finished one finds no member row and only removes the sign-in.
  const me = await admin.from("members").select("role,household_id").eq("id", userId).maybeSingle();
  if (me.error) return fail("delete_failed", 500);

  if (me.data) {
    const household = me.data.household_id as string;
    const rest = await admin.from("members").select("id,role,sort").eq("household_id", household).neq("id", userId);
    // Never guess here: an unread list would look like "nobody else" and delete the household.
    if (rest.error || !rest.data) return fail("delete_failed", 500);
    const others = rest.data as Heir[];
    const owner = me.data.role === "owner";

    if (owner) {
      const bill = await admin.from("subscriptions_billing").select("provider_ref").eq("household_id", household).maybeSingle();
      if (bill.error) return fail("delete_failed", 500);
      const customer = bill.data?.provider_ref as string | null | undefined;
      if (customer) {
        const client = stripe();
        if (!client) return fail("not_configured", 503);
        try {
          // Deleting the customer ends every subscription at once, so no charge follows the account.
          await client.customers.del(customer);
        } catch (e) {
          if ((e as { code?: string }).code !== "resource_missing") return fail("billing_failed", 502);
        }
      }
    }

    const folders = others.length ? [userId] : [userId, ...others.map((m) => m.id)];
    for (const member of folders) {
      if (!(await removeUploads(admin, `${household}/${member}`))) return fail("delete_failed", 500);
    }

    if (!others.length) {
      const { error } = await admin.from("households").delete().eq("id", household);
      if (error) return fail("delete_failed", 500);
    } else if (owner) {
      const heir = successor(others)!;
      const { error } = await admin.from("members").update({ role: "owner" }).eq("id", heir.id);
      if (error) return fail("delete_failed", 500);
      const { error: billError } = await admin
        .from("subscriptions_billing")
        .update({ status: "cancelled", provider_ref: null, updated_at: new Date().toISOString() })
        .eq("household_id", household);
      if (billError) return fail("delete_failed", 500);
    }
  }

  // Removes the sign-in, its passkeys and, through the member row, everything this person owned.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return fail("delete_failed", 500);
  return Response.json({ ok: true });
}
