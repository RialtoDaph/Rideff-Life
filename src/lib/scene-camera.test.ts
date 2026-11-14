import { describe, expect, it } from "vitest";
import { flyEase, lockedDpr, sceneModeFor } from "./scene-camera";

describe("flyEase", () => {
  it("runs from 0 to 1 and is 0.5 in the middle", () => {
    expect(flyEase(0)).toBe(0);
    expect(flyEase(1)).toBe(1);
    expect(flyEase(0.5)).toBeCloseTo(0.5, 10);
  });
  it("clamps outside 0..1", () => {
    expect(flyEase(-1)).toBe(0);
    expect(flyEase(2)).toBe(1);
  });
  it("never goes backwards", () => {
    let last = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const v = flyEase(t);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
});

describe("lockedDpr", () => {
  it("caps a dense display", () => expect(lockedDpr(2, 1.5)).toBe(1.5));
  it("keeps a display under the cap", () => expect(lockedDpr(1, 1.5)).toBe(1));
  it("never goes below 1", () => expect(lockedDpr(0.5, 1.5)).toBe(1));
});

describe("sceneModeFor", () => {
  it("shows Home as the hero", () => {
    expect(sceneModeFor("")).toBe("hero");
    expect(sceneModeFor("home")).toBe("hero");
  });
  it("explores on the map", () => expect(sceneModeFor("map")).toBe("explore"));
  it("keeps Clopar, Wrapped and the stage check on the stage", () => {
    expect(sceneModeFor("stage-check")).toBe("hero");
    expect(sceneModeFor("ask")).toBe("hero");
    expect(sceneModeFor("wrapped")).toBe("hero");
  });
  it("switches the canvas off on work screens", () => {
    for (const s of ["settings", "plan", "setup", "import", "report", "reports", "help"]) expect(sceneModeFor(s)).toBe("off");
  });
  it("freezes it behind detail screens, and for an unknown screen", () => {
    expect(sceneModeFor("budget")).toBe("backdrop");
    expect(sceneModeFor("unknown-route")).toBe("backdrop");
  });
});
