import { describe, expect, it, vi } from "vitest";
import { agentSignedUrl, agentsEnabled } from "./agent-server";

const on = { VOICE_ENGINE: "elevenagents", ELEVENLABS_API_KEY: "sk_abc", ELEVENLABS_AGENT_ID: "agent_1" };

describe("agentsEnabled", () => {
  it("needs the flag, an sk_ key and the agent id", () => {
    expect(agentsEnabled(on)).toBe(true);
    expect(agentsEnabled({ ...on, VOICE_ENGINE: "" })).toBe(false);
    expect(agentsEnabled({ ...on, ELEVENLABS_AGENT_ID: "" })).toBe(false);
    expect(agentsEnabled({ ...on, ELEVENLABS_API_KEY: "6f1c2d3e" })).toBe(false);
  });
});

describe("agentSignedUrl", () => {
  it("returns the signed wss url", async () => {
    const f = vi.fn(async () => Response.json({ signed_url: "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_1&conversation_signature=x" }));
    expect(await agentSignedUrl(on, f as never)).toMatch(/^wss:\/\//);
    expect(f.mock.calls[0]).toBeDefined();
  });

  it("returns null when ElevenLabs refuses or answers with something else", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await agentSignedUrl(on, (async () => new Response("no", { status: 401 })) as never)).toBeNull();
    expect(await agentSignedUrl(on, (async () => Response.json({ signed_url: "https://evil.example" })) as never)).toBeNull();
    expect(await agentSignedUrl(on, (async () => { throw new Error("down"); }) as never)).toBeNull();
    err.mockRestore();
  });
});
