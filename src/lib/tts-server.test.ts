import { describe, expect, it, vi } from "vitest";
import { ttsEnabled } from "./tts-server";

const on = { VOICE_TTS: "elevenlabs", ELEVENLABS_API_KEY: "sk_abc123", ELEVENLABS_VOICE_ID: "voice1" };

describe("ttsEnabled", () => {
  it("is on only with the flag, a key and a voice", () => {
    expect(ttsEnabled(on)).toBe(true);
    expect(ttsEnabled({ ...on, VOICE_TTS: "" })).toBe(false);
    expect(ttsEnabled({ ...on, ELEVENLABS_API_KEY: "" })).toBe(false);
    expect(ttsEnabled({ ...on, ELEVENLABS_VOICE_ID: undefined })).toBe(false);
  });

  it("treats a key that is not an sk_ secret as off, so OpenAI's voice keeps working", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(ttsEnabled({ ...on, ELEVENLABS_API_KEY: "6f1c2d3e4a5b" })).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
