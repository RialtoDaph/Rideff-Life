import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadBriefing, saveBriefing } from "./ask";
import type { Answer } from "./ask-schema";

const answer: Answer = { text: "€360.10 left, about €51.44 a day.", nums: [], next: null, action: "none" };

describe("today's saved briefing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T08:00:00Z"));
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      key: () => null,
      get length() {
        return store.size;
      },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const facts = { flexLeft: 360.1, alerts: 1 };
  const hour = 60 * 60 * 1000;

  it("is shown again, and not rewritten, while the money it talks about is unchanged", () => {
    saveBriefing("u", "family-id", "2026-11-24", facts, answer);
    expect(loadBriefing("u", "family-id", "2026-11-24", facts)).toEqual({ answer, stale: false });
  });

  it("is not rewritten for a small expense, so the daily limit is not used up", () => {
    saveBriefing("u", "family-id", "2026-11-24", facts, answer);
    vi.setSystemTime(Date.now() + 2 * hour);
    expect(loadBriefing("u", "family-id", "2026-11-24", { flexLeft: 352.2, alerts: 1 })?.stale).toBe(false);
  });

  it("is rewritten after a big move or a changed alert, but not within the hour", () => {
    saveBriefing("u", "family-id", "2026-11-24", facts, answer);
    expect(loadBriefing("u", "family-id", "2026-11-24", { flexLeft: 250, alerts: 1 })?.stale).toBe(false);
    vi.setSystemTime(Date.now() + 2 * hour);
    expect(loadBriefing("u", "family-id", "2026-11-24", { flexLeft: 250, alerts: 1 })).toEqual({ answer, stale: true });
    expect(loadBriefing("u", "family-id", "2026-11-24", { flexLeft: 360.1, alerts: 2 })?.stale).toBe(true);
  });

  it("keeps showing a briefing saved before this check existed", () => {
    localStorage.setItem("ef-brief-u-family-id-2026-11-24", JSON.stringify(answer));
    expect(loadBriefing("u", "family-id", "2026-11-24", { flexLeft: 10, alerts: 5 })).toEqual({ answer, stale: false });
  });
});
