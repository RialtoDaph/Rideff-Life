import { describe, expect, it } from "vitest";
import { hubForTool, parseShow } from "./show";

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
