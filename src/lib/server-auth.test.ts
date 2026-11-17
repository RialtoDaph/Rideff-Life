import { describe, expect, it } from "vitest";
import { isAllowedUser } from "@/lib/server-auth";

describe("isAllowedUser", () => {
  it("allows everyone when the list is unset or blank", () => {
    expect(isAllowedUser("abc", undefined)).toBe(true);
    expect(isAllowedUser("abc", "")).toBe(true);
    expect(isAllowedUser("abc", "  ")).toBe(true);
    expect(isAllowedUser("abc", " , ")).toBe(false); // present but unusable: fail closed
  });
  it("allows only listed ids, ignoring case and spaces", () => {
    expect(isAllowedUser("AAA-1", "aaa-1, bbb-2")).toBe(true);
    expect(isAllowedUser("bbb-2", "aaa-1, bbb-2")).toBe(true);
    expect(isAllowedUser("ccc-3", "aaa-1, bbb-2")).toBe(false);
  });
});
