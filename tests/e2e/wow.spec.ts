import { expect, test, type Page } from "@playwright/test";
import { setData, setPlan, settle, signIn } from "./helpers";

// The presenter's extras: a tool at work lights the map, and money flies to a goal. All in ?stage=1.

type Scene = { stats: () => { pulses: number; frames: number }; transfer: (from: string[], to: string, o?: { ms?: number }) => Promise<void> };
type Win = { __rideffScene?: Scene; __rideffCue?: { emit: (c: unknown) => void } };
const pulses = (page: Page) => page.evaluate(() => (window as unknown as Win).__rideffScene?.stats().pulses ?? -1);
const canvases = (page: Page) => page.evaluate(() => document.querySelectorAll("[data-scene-host] canvas").length);

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()} ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/503|Failed to load resource|WebSocket/.test(m.text())) errors.push(`${page.url()} ${m.text()}`);
  });
  return errors;
}

test.beforeAll(async () => {
  await setPlan("together");
  await setData("seed");
});

test("a tool cue lights the map and leaves one canvas and no errors", async ({ context, page }) => {
  await signIn(context);
  const errors = watchErrors(page);
  await page.goto("/?stage=1");
  await settle(page);
  expect(await pulses(page)).toBe(0);
  await page.evaluate(() => {
    const cue = (window as unknown as Win).__rideffCue!;
    cue.emit({ t: "tool-start", id: "t1", name: "get_budget" });
    cue.emit({ t: "tool-end", id: "t1", name: "get_budget", ms: 212, ok: true });
  });
  expect(await pulses(page)).toBe(1);
  await page.waitForTimeout(1200);
  expect(await canvases(page)).toBe(1);
  expect(errors).toEqual([]);
});

test("a transfer to an unknown item does nothing and does not throw", async ({ context, page }) => {
  await signIn(context);
  const errors = watchErrors(page);
  await page.goto("/?stage=1");
  await settle(page);
  const done = await page.evaluate(() => (window as unknown as Win).__rideffScene!.transfer(["s-none"], "g-none").then(() => "resolved"));
  expect(done).toBe("resolved");
  expect(errors).toEqual([]);
});

test("with reduced motion a transfer resolves at once", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  await signIn(context);
  const page = await context.newPage();
  await page.goto("/?stage=1");
  await settle(page);
  const ms = await page.evaluate(async () => {
    const t0 = performance.now();
    await (window as unknown as Win).__rideffScene!.transfer(["s-x"], "g-x");
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(100);
  await context.close();
});

test("a deep link with a cue creates no canvas and no error", async ({ context, page }) => {
  await signIn(context);
  const errors = watchErrors(page);
  await page.goto("/budget");
  await settle(page);
  expect(await canvases(page)).toBe(0);
  await page.evaluate(() => (window as unknown as Win).__rideffCue?.emit({ t: "tool-start", id: "x", name: "get_budget" }));
  expect(await canvases(page)).toBe(0);
  expect(errors).toEqual([]);
});
