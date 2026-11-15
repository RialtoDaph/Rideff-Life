import { describe, expect, it } from "vitest";
import { beatForKey, TOUR } from "./tour";

describe("beatForKey", () => {
  it("steps forward with . and the right arrow, and stops at the last beat", () => {
    expect(beatForKey(0, ".")).toBe(1);
    expect(beatForKey(1, "ArrowRight")).toBe(2);
    expect(beatForKey(TOUR.length - 1, ".")).toBe(TOUR.length - 1);
  });
  it("steps back with , and the left arrow, and stops at the first", () => {
    expect(beatForKey(2, ",")).toBe(1);
    expect(beatForKey(1, "ArrowLeft")).toBe(0);
    expect(beatForKey(0, ",")).toBe(0);
  });
  it("jumps with the number keys that name a beat", () => {
    expect(beatForKey(0, "3")).toBe(2);
    expect(beatForKey(2, "1")).toBe(0);
    expect(beatForKey(0, String(TOUR.length + 1))).toBeNull();
    expect(beatForKey(0, "0")).toBeNull();
  });
  it("ignores every other key", () => {
    expect(beatForKey(0, "a")).toBeNull();
    expect(beatForKey(0, "Enter")).toBeNull();
  });
});

describe("TOUR", () => {
  it("has beats with a route and something to fly to", () => {
    for (const b of TOUR) {
      expect(b.route.startsWith("/")).toBe(true);
      expect(b.fly.length).toBeGreaterThan(0);
    }
  });
});
