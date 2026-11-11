// Stripe tells this route what was paid. The only writer of a paid plan: the signature
// proves the sender, and the write uses the server key because no signed-in person is here.

import type Stripe from "stripe";
import { billStatus, PLANS, planOfPrice } from "@/lib/plans";
import { billingAdmin, stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const client = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sb = billingAdmin();
  if (!client || !secret || !sb) return new Response("not configured", { status: 503 });

  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("bad signature", { status: 400 });
  }
  if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    return Response.json({ received: true });
  }

  const sub = event.data.object as Stripe.Subscription;
  const household = sub.metadata.household_id;
  const item = sub.items.data[0];
  const bought = item && planOfPrice(item.price.id, process.env);
  if (!household || !bought) {
    console.error("stripe event without household or known price", event.id);
    return Response.json({ received: true });
  }

  // billing_apply handles each event once and never lets an older event overwrite a newer one
  // (Stripe sends some twice, and not always in order).
  const { data: outcome, error } = await sb.rpc("billing_apply", {
    p_event: event.id,
    p_type: event.type,
    p_event_at: new Date(event.created * 1000).toISOString(),
    p_household: household,
    p_plan: bought.plan,
    p_interval: bought.interval,
    p_status: billStatus(sub.status),
    p_seats: PLANS[bought.plan].seats,
    p_customer: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    p_period_end: new Date(item.current_period_end * 1000).toISOString(),
  });
  // A failed write answers 500, so Stripe sends the event again.
  if (error) return new Response("write failed", { status: 500 });
  if (outcome !== "applied") console.log("stripe event", event.id, outcome);
  return Response.json({ received: true });
}
