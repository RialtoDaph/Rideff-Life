import { describe, expect, it, vi } from "vitest";
import { stageCues, type StageCue } from "./stage-cues";

describe("stageCues", () => {
  it("delivers cues in order to every subscriber", () => {
    const a: StageCue[] = [];
    const b: StageCue[] = [];
    const offA = stageCues.subscribe((c) => a.push(c));
    const offB = stageCues.subscribe((c) => b.push(c));
    stageCues.emit({ t: "tool-start", id: "1", name: "get_budget" });
    stageCues.emit({ t: "tool-end", id: "1", name: "get_budget", ms: 212, ok: true });
    expect(a.map((c) => c.t)).toEqual(["tool-start", "tool-end"]);
    expect(b).toHaveLength(2);
    offA();
    offB();
  });

  it("stops delivering after unsubscribe and survives a throwing listener", () => {
    const seen = vi.fn();
    const offBad = stageCues.subscribe(() => {
      throw new Error("boom");
    });
    const off = stageCues.subscribe(seen);
    expect(() => stageCues.emit({ t: "clear" })).not.toThrow();
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    offBad();
    stageCues.emit({ t: "clear" });
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
