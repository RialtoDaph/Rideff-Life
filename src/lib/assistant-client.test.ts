import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: () => ({}) }));

import { isMicError } from "@/lib/assistant-client";

describe("isMicError", () => {
  it("is true for a refused or missing microphone", () => {
    expect(isMicError(new DOMException("denied", "NotAllowedError"))).toBe(true);
    expect(isMicError(new DOMException("none", "NotFoundError"))).toBe(true);
  });
  it("is false for a timeout or a plain error", () => {
    expect(isMicError(new DOMException("slow", "TimeoutError"))).toBe(false);
    expect(isMicError(new Error("calls 500"))).toBe(false);
    expect(isMicError(null)).toBe(false);
  });
});
