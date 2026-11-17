import { describe, expect, it } from "vitest";
import { CANNED, cannedFor } from "@/content/canned";
import { nextCanned, planCanned } from "@/lib/canned-voice";

describe("planCanned", () => {
  it("goes listen, think, show, steps, speak, in time order", () => {
    const cues = planCanned(CANNED[0]);
    expect(cues.map((c) => c.kind)).toEqual(["listen", "think", "show", "step", "speak"]);
    expect(cues.every((c, i) => i === 0 || c.at >= cues[i - 1].at)).toBe(true);
  });
  it("speaks the answer last", () => {
    const cues = planCanned(CANNED[0]);
    expect(cues.at(-1)).toMatchObject({ kind: "speak", text: CANNED[0].answer });
  });
});

describe("nextCanned", () => {
  it("steps through a language and wraps", () => {
    const id = cannedFor("id");
    expect(nextCanned(id, null)?.id).toBe(id[0].id);
    expect(nextCanned(id, id.at(-1)!.id)?.id).toBe(id[0].id);
  });
  it("is null for a language with no answers", () => {
    expect(nextCanned(cannedFor("en"), null)).toBeNull();
  });
});

describe("canned content", () => {
  it("has unique ids and every answer says its numbers from the seed", () => {
    expect(new Set(CANNED.map((c) => c.id)).size).toBe(CANNED.length);
    expect(CANNED.find((c) => c.id === "id-fund")!.answer).toContain("9.800");
  });
});
