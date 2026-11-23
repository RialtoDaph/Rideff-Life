import { describe, expect, it } from "vitest";
import { TOOLS } from "./assistant-tools";
import { AGENT_TOOLS } from "./agent-client";

describe("AGENT_TOOLS", () => {
  it("is every tool of the realtime model plus show, so the voice engines cannot drift apart", () => {
    expect([...AGENT_TOOLS].sort()).toEqual([...TOOLS.map((t) => t.name), "show"].sort());
  });
});
