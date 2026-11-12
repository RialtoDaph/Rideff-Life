import { describe, expect, it } from "vitest";
import { dbErrorKey, dbErrorKind } from "./db-error";

describe("db errors", () => {
  it("tells an ended session from a refusal", () => {
    expect(dbErrorKind({ message: "JWT expired", code: "PGRST303" })).toBe("session");
    expect(dbErrorKind({ status: 401, message: "x" })).toBe("session");
    expect(dbErrorKind({ code: "42501", message: 'new row violates row-level security policy for table "goals"' })).toBe("denied");
  });

  it("recognises duplicates and bad values", () => {
    expect(dbErrorKind({ code: "23505", message: "duplicate key" })).toBe("duplicate");
    expect(dbErrorKind({ code: "23514", message: "check" })).toBe("invalid");
    expect(dbErrorKind({ code: "22P02", message: "bad uuid" })).toBe("invalid");
  });

  it("falls back to the raw message for anything else", () => {
    expect(dbErrorKind({ code: "XX000", message: "boom" })).toBe("other");
    expect(dbErrorKey({ code: "XX000" }, "could_not_save")).toBe("could_not_save");
    expect(dbErrorKey({ code: "23505" }, "could_not_save")).toBe("save_duplicate");
  });
});
