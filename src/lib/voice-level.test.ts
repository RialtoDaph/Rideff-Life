import { describe, expect, it } from "vitest";
import { bandsOf, voiceLevel } from "./voice-level";

describe("bandsOf", () => {
  it("is silent for silence", () => {
    expect(bandsOf(new Uint8Array(128))).toEqual({ level: 0, bass: 0, mid: 0, high: 0 });
  });
  it("is full for full energy", () => {
    const b = bandsOf(new Uint8Array(128).fill(255));
    expect(b.level).toBeCloseTo(1, 5);
    expect(b.bass).toBeCloseTo(1, 5);
    expect(b.high).toBeCloseTo(1, 5);
  });
  it("tells a low voice from a hiss", () => {
    const low = new Uint8Array(128);
    low.fill(220, 0, 8);
    const b = bandsOf(low);
    expect(b.bass).toBeGreaterThan(b.mid);
    expect(b.mid).toBe(0);
    expect(b.high).toBe(0);
  });
  it("copes with an empty reading", () => {
    expect(bandsOf(new Uint8Array(0))).toEqual({ level: 0, bass: 0, mid: 0, high: 0 });
  });
});

describe("voiceLevel", () => {
  it("tells subscribers, and stops when they leave", () => {
    const seen: number[] = [];
    const off = voiceLevel.subscribe((f) => seen.push(f.level));
    voiceLevel.set({ state: "listen", level: 0.4, bass: 0.4, mid: 0.2, high: 0.1 });
    off();
    voiceLevel.set({ state: "idle", level: 0, bass: 0, mid: 0, high: 0 });
    expect(seen).toEqual([0.4]);
    expect(voiceLevel.get().state).toBe("idle");
  });
});
