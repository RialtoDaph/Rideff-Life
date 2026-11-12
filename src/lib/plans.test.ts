import { describe, expect, it } from "vitest";
import { activePlan, billStatus, lockedBy, planOfPrice, priceEnv, trialOver } from "./plans";

describe("plans", () => {
  it("locks screens above the plan", () => {
    expect(lockedBy("/journal", "life")).toBe("plus");
    expect(lockedBy("/together", "plus")).toBe("together");
    expect(lockedBy("/together", "together")).toBeNull();
    expect(lockedBy("/budget", "life")).toBeNull();
    expect(lockedBy("/", "life")).toBeNull();
  });

  it("falls back to Life when cancelled", () => {
    expect(activePlan({ plan: "together", status: "cancelled", current_period_end: null }, 0)).toBe("life");
    expect(activePlan({ plan: "plus", status: "past_due", current_period_end: null }, 0)).toBe("plus");
  });

  it("a finished trial counts as Life, a running one keeps its plan", () => {
    const now = Date.parse("2026-11-12T10:00:00Z");
    const trial = (end: string | null) => ({ plan: "together" as const, status: "trial" as const, current_period_end: end });
    expect(activePlan(trial("2026-11-11T10:00:00Z"), now)).toBe("life");
    expect(trialOver(trial("2026-11-11T10:00:00Z"), now)).toBe(true);
    expect(activePlan(trial("2026-11-20T10:00:00Z"), now)).toBe("together");
    expect(activePlan(trial(null), now)).toBe("together");
    // A paid plan is never cut by its period end here: Stripe decides that.
    expect(activePlan({ plan: "plus", status: "active", current_period_end: "2026-01-01T00:00:00Z" }, now)).toBe("plus");
  });

  it("reads Stripe's status and prices", () => {
    expect(billStatus("canceled")).toBe("cancelled");
    expect(billStatus("trialing")).toBe("trial");
    expect(billStatus("something_new")).toBe("past_due");
    expect(priceEnv("plus", "year")).toBe("STRIPE_PRICE_PLUS_YEAR");
    expect(planOfPrice("p2", { STRIPE_PRICE_LIFE_MONTH: "p1", STRIPE_PRICE_TOGETHER_YEAR: "p2" })).toEqual({ plan: "together", interval: "year" });
    expect(planOfPrice("nope", {})).toBeNull();
  });
});
