import { describe, expect, it } from "vitest";
import { labelOf, needsReload, newsOf, type LiveChange } from "./household-live";

const ME = "me";
const insert = (table: string, row: Record<string, unknown>): LiveChange => ({ table, type: "INSERT", row });

describe("household live", () => {
  it("names a row by what a person calls it", () => {
    expect(labelOf("transactions", { payee: "REWE" })).toBe("REWE");
    expect(labelOf("week_priorities", { title: "Call the bank" })).toBe("Call the bank");
    expect(labelOf("goals", { name: "Holiday" })).toBe("Holiday");
    expect(labelOf("goals", { name: "  " })).toBeNull();
    expect(labelOf("goals", null)).toBeNull();
  });

  it("does not reload for our own new rows, only for everything else", () => {
    expect(needsReload([insert("goals", { owner_id: ME })], ME)).toBe(false);
    expect(needsReload([insert("goals", { owner_id: "mira" })], ME)).toBe(true);
    expect(needsReload([{ table: "goals", type: "UPDATE", row: { owner_id: ME } }], ME)).toBe(true);
    expect(needsReload([{ table: "goals", type: "DELETE", row: null }], ME)).toBe(true);
  });

  it("says who added what, or how many", () => {
    expect(newsOf([insert("transactions", { owner_id: "mira", payee: "REWE" })], ME)).toEqual({ owner: "mira", n: 1, what: "REWE" });
    expect(newsOf([insert("transactions", { owner_id: "mira", payee: "A" }), insert("goals", { owner_id: "mira", name: "B" })], ME)).toEqual({ owner: "mira", n: 2, what: null });
    expect(newsOf([insert("goals", { owner_id: ME, name: "mine" })], ME)).toBeNull();
    expect(newsOf([{ table: "goals", type: "UPDATE", row: { owner_id: "mira" } }], ME)).toBeNull();
  });
});
