import { describe, expect, it } from "vitest";
import { successor } from "./account";

describe("successor", () => {
  it("is nobody when the owner is alone", () => {
    expect(successor([])).toBeNull();
  });

  it("prefers the partner who joined first over an earlier member", () => {
    const heir = successor([
      { id: "kid", role: "member", sort: 1 },
      { id: "late", role: "partner", sort: 3 },
      { id: "early", role: "partner", sort: 2 },
    ]);
    expect(heir?.id).toBe("early");
  });

  it("falls back to the member who joined first", () => {
    expect(successor([{ id: "b", role: "member", sort: 4 }, { id: "a", role: "member", sort: 2 }])?.id).toBe("a");
  });
});
