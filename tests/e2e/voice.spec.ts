import { expect, test } from "@playwright/test";
import { setData, setPlan, settle, signIn } from "./helpers";

// No realtime key in the test setup, so the voice falls to the browser's own listening, and that
// has no microphone here: what the person sees must be a card with something to press.

test.beforeAll(async () => {
  await setPlan("together");
  await setData("seed");
});

test("the stage check lights its rows, and the tap-to-wake check settles", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/stage-check");
  await settle(page);
  // By the row's own label, so a hint that mentions another row's words does not match it.
  const row = (name: string) => page.locator("li").filter({ has: page.getByText(name, { exact: true }) });
  await expect(row("Internet connection")).toContainText("Ready");
  await expect(row("3D map (WebGL)")).toContainText("Ready");
  await expect(row("Power")).toBeVisible();
  await expect(row("Frame rate")).toContainText(/\d+ fps/, { timeout: 8000 });
  await page.getByRole("button", { name: /Wake Clopar/ }).click();
  // Without the realtime key the session row needs attention and says why; none stays "Checking…".
  await expect(row("Realtime voice session")).toContainText("Needs attention", { timeout: 15000 });
  await expect(row("Realtime voice session")).toContainText("voice key");
  await expect(row("Realtime link (WebRTC)")).toContainText("Not available");
  // A microphone prompt nobody answered must not hold the other lights back.
  await expect(row("Sound output")).not.toContainText("Checking…");
});

test("tapping Clopar without a working voice ends in a card with something to press", async ({ context, page }) => {
  await signIn(context);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await settle(page);
  await page.getByRole("button", { name: "Ask Clopar" }).click();
  // The pointer stays on the orb after the tap: its particles must stay too.
  await page.waitForTimeout(1200);
  const lit = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('button[aria-label="Ask Clopar"] canvas')!;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
    return n;
  });
  expect(lit, "orb still drawn after the tap").toBeGreaterThan(300);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Type instead" }).click();
  await expect(page.getByPlaceholder(/Type to Clopar|Type to/i)).toBeVisible();
  expect(errors).toEqual([]);
});
