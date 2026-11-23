import { describe, expect, it } from "vitest";
import { speakable, takeSentences } from "./tts-text";

describe("takeSentences", () => {
  it("holds an unfinished sentence", () => {
    expect(takeSentences("Halo, aku Clopar")).toEqual({ ready: [], rest: "Halo, aku Clopar" });
  });
  it("releases whole sentences and keeps the tail", () => {
    const r = takeSentences("Halo, apa kabar? Aku siap bantu. Mau cek bud");
    expect(r.ready).toEqual(["Halo, apa kabar?", "Aku siap bantu."]);
    expect(r.rest).toBe("Mau cek bud");
  });
  it("flushes the tail at the end", () => {
    expect(takeSentences("Selesai", true)).toEqual({ ready: ["Selesai"], rest: "" });
  });
  it("joins a tiny fragment with the next sentence", () => {
    expect(takeSentences("Ya. Budget bulan ini aman. ").ready).toEqual(["Ya. Budget bulan ini aman."]);
  });
  it("does not split inside a number like 3.5", () => {
    expect(takeSentences("Sisa 3.5 jam minggu ini. ").ready).toEqual(["Sisa 3.5 jam minggu ini."]);
  });
});

describe("speakable", () => {
  it("drops markdown marks", () => {
    expect(speakable("**Budget** aman\n- satu\n- dua")).toBe("Budget aman satu dua");
  });
});

describe("takeSentences on lists", () => {
  it("splits at a newline without full stops", () => {
    expect(takeSentences("Budget aman\nJadwal padat\nTabungan naik", true).ready).toEqual(["Budget aman", "Jadwal padat", "Tabungan naik"]);
  });
});
