import { describe, expect, it } from "vitest";
import { hubForTool, parseShow, resolveShow, setShowIndex } from "./show";

describe("parseShow", () => {
  it("accepts an area, the core and a screen", () => {
    expect(parseShow('{"target":"money"}')).toBe("money");
    expect(parseShow('{"target":"core"}')).toBe("core");
    expect(parseShow('{"target":"budget"}')).toBe("budget");
  });
  it("ignores what is not a place in the app", () => {
    expect(parseShow('{"target":"drop table"}')).toBeNull();
    expect(parseShow('{"target":42}')).toBeNull();
    expect(parseShow("not json")).toBeNull();
    expect(parseShow("{}")).toBeNull();
  });
});

describe("hubForTool", () => {
  it("points each reading tool at its area", () => {
    expect(hubForTool("get_budget")).toBe("money");
    expect(hubForTool("get_net_worth")).toBe("money");
    expect(hubForTool("get_week")).toBe("time");
    expect(hubForTool("get_goals")).toBe("goals");
    expect(hubForTool("simulate")).toBe("goals");
  });
  it("leaves proposals and memory alone", () => {
    expect(hubForTool("propose_event")).toBeNull();
    expect(hubForTool("remember")).toBeNull();
  });
});

describe("resolveShow", () => {
  const n = (id: string, label: string) => ({ id, label, kind: "item" });
  it("finds one item by name, ignoring case and accents", () => {
    setShowIndex([n("g1", "Emergency fund"), n("g2", "Café budget"), { id: "h-money", label: "Money", kind: "hub" }]);
    expect(resolveShow('{"target":"emergency FUND"}')).toBe("g1");
    expect(resolveShow('{"target":"cafe"}')).toBe("g2");
  });
  it("prefers areas and screens, and never invents an address", () => {
    setShowIndex([n("g1", "Budget plan")]);
    expect(resolveShow('{"target":"budget"}')).toBe("budget");
    expect(resolveShow('{"target":"//evil.com"}')).toBeNull();
    expect(resolveShow('{"target":"zzz"}')).toBeNull();
  });
  it("returns nothing when the name fits more than one item", () => {
    setShowIndex([n("a", "Savings car"), n("b", "Savings trip")]);
    expect(resolveShow('{"target":"savings"}')).toBeNull();
    expect(resolveShow('{"target":"savings car"}')).toBe("a");
  });
  it("does not point at hubs", () => {
    setShowIndex([{ id: "h-x", label: "Fun", kind: "hub" }]);
    expect(resolveShow('{"target":"fun"}')).toBeNull();
  });
});
