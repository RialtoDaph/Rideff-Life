import { expect, test, type Page } from "@playwright/test";
import { setData, setPlan, settle, signIn } from "./helpers";

// The Life Map canvas lives in the shell (SceneHost): one WebGL canvas for the whole app,
// drawn only after the person has stood on Home or the map.

type Stats = { fps: number; tier: string; dpr: number; frames: number; paused: boolean; live: number };
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __rideffScene?: { stats: () => unknown } }).__rideffScene?.stats() as Stats | undefined);
/** True when the scene drew new frames over the next 700 ms: its loop is really running. */
async function draws(page: Page) {
  const a = await stats(page);
  await page.waitForTimeout(700);
  const b = await stats(page);
  return !!a && !!b && b.frames > a.frames;
}

const webgl = (page: Page) => page.evaluate(() => document.querySelectorAll("[data-scene-host] canvas").length);

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

test("a deep link to a detail screen draws no canvas and no errors", async ({ context, page }) => {
  await signIn(context);
  const errors = watchErrors(page);
  await page.goto("/budget");
  await settle(page);
  expect(await webgl(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("Home to Budget and back 20 times keeps exactly one canvas and no errors", async ({ context, page }) => {
  await signIn(context);
  const errors = watchErrors(page);
  await page.goto("/");
  await settle(page);
  expect(await webgl(page)).toBe(1);
  expect(await draws(page)).toBe(true); // Home draws, not an empty canvas
  const counts: number[] = [];
  const live = new Set<number>();
  for (let i = 0; i < 20; i++) {
    await page.locator('a[href="/budget"]:visible').first().click();
    await page.waitForURL(/\/budget$/);
    // The camera finishes its flight to the area, then the scene freezes.
    await page.waitForTimeout(1300);
    counts.push(await webgl(page));
    const frozen = await stats(page);
    live.add(frozen!.live);
    expect(frozen!.paused, "frozen behind Budget").toBe(true);
    if (i % 5 === 0) expect(await draws(page), "no frames behind Budget").toBe(false);
    await page.locator('a[href="/"]:visible').first().click();
    await page.waitForURL((u) => !u.pathname.includes("budget"));
    await page.waitForTimeout(250);
    counts.push(await webgl(page));
    expect((await stats(page))!.paused, "running on Home").toBe(false);
  }
  expect([...new Set(counts)]).toEqual([1]);
  expect([...live]).toEqual([1]); // exactly one live scene, never a second context
  expect(errors).toEqual([]);
});

test("the map falls back to the static map when WebGL is not available", async ({ context, page }) => {
  await signIn(context);
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (/webgl/.test(kind)) return null;
      return (real as (...a: unknown[]) => unknown).call(this, kind, ...rest) as never;
    } as typeof real;
  });
  const errors = watchErrors(page);
  await page.goto("/map");
  await settle(page);
  expect(await webgl(page)).toBe(0);
  await expect(page.getByText("This device can't draw the 3D map.")).toBeVisible();
  expect(errors.filter((e) => !/WebGL/i.test(e))).toEqual([]);
});

test("?stage=1 shows the readout", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/?stage=1");
  await settle(page);
  await expect(page.getByText(/\d+ fps · (high|medium|low) · dpr/)).toBeVisible();
  expect(await draws(page)).toBe(true); // a real reading, from a scene that is drawing
  expect((await stats(page))!.dpr).toBeLessThanOrEqual(1.5);
});

test("Home is a stage: the scene is visible beside the number and draws", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/");
  await settle(page);
  const host = await page.evaluate(() => {
    const h = document.querySelector("[data-scene-host]") as HTMLElement;
    const r = (h.firstElementChild as HTMLElement).getBoundingClientRect();
    return { opacity: getComputedStyle(h).opacity, stageLeft: Math.round(r.left), width: innerWidth };
  });
  expect(host.opacity).toBe("1");
  expect(await draws(page)).toBe(true);
  expect(host.stageLeft).toBe(0); // a phone: the scene spans the top (on a wide screen it starts at a third)
});

test("the presenter's keys walk the tour: . goes to the map, 1 comes back, B freezes", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/?stage=1");
  await settle(page);
  await expect(page.getByText("1/6 · home")).toBeVisible();
  // The spoken language is its own choice, apart from the app's language.
  await page.keyboard.press("i");
  await expect(page.getByText(/· ID ·/)).toBeVisible();
  await page.keyboard.press("d");
  await expect(page.getByText(/· DE ·/)).toBeVisible();
  await page.keyboard.press(".");
  await page.waitForURL(/\/map$/, { timeout: 8000 });
  await expect(page.getByText("2/6 · map")).toBeVisible();
  await page.keyboard.press("1");
  await page.waitForURL((u) => u.pathname === "/", { timeout: 8000 });
  await expect(page.getByText("1/6 · home")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.keyboard.press("b");
  await page.waitForTimeout(300);
  expect((await stats(page))!.paused).toBe(true);
});
