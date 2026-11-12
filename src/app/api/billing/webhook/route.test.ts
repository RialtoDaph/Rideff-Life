import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apply = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: (name: string, args: unknown) => (apply(name, args), Promise.resolve({ data: "applied", error: null })) }),
}));

import { POST } from "./route";

const SECRET = "whsec_test";
const event = (status: string, price = "price_plus") => ({
  id: "evt_1",
  created: 1790000000,
  type: "customer.subscription.updated",
  data: { object: { status, customer: "cus_1", metadata: { household_id: "hh1" }, items: { data: [{ price: { id: price }, current_period_end: 1800000000 }] } } },
});

function post(body: object, signature?: string) {
  const payload = JSON.stringify(body);
  const header = signature ?? Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return POST(new Request("http://x/api/billing/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
}

describe("stripe webhook", () => {
  beforeEach(() => {
    apply.mockClear();
    Object.assign(process.env, {
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: SECRET,
      SUPABASE_SECRET_KEY: "k",
      NEXT_PUBLIC_SUPABASE_URL: "http://x",
      STRIPE_PRICE_PLUS_YEAR: "price_plus",
    });
  });

  it("refuses a forged event", async () => {
    expect((await post(event("active"), "t=1,v1=forged")).status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes the paid plan", async () => {
    expect((await post(event("active"))).status).toBe(200);
    expect(apply.mock.calls[0][0]).toBe("billing_apply");
    // The event's id and time go along, so the database can drop a repeat or an older event.
    expect(apply.mock.calls[0][1]).toMatchObject({
      p_event: "evt_1",
      p_event_at: new Date(1790000000 * 1000).toISOString(),
      p_household: "hh1",
      p_plan: "plus",
      p_interval: "year",
      p_status: "active",
      p_seats: 1,
      p_customer: "cus_1",
    });
  });

  it("ignores an unknown price", async () => {
    expect((await post(event("active", "price_other"))).status).toBe(200);
    expect(apply).not.toHaveBeenCalled();
  });
});
