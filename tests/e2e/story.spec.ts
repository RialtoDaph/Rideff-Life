import { expect, test } from "@playwright/test";
import { LOCALES, setData, setPlan, settle, signIn } from "./helpers";

test.beforeAll(async () => {
  await setPlan("together");
  await setData("seed");
});

for (const locale of LOCALES) {
  test(`How it was built shows every round and the credit, ${locale}`, async ({ context, page }) => {
    await signIn(context, locale);
    await page.goto("/built");
    await settle(page);
    await expect(page.locator('[data-screen-label="Built"] ol > li')).toHaveCount(8);
    await expect(page.locator('[data-screen-label="Built"]')).not.toContainText("story.");
    await expect(page.locator('[data-screen-label="Built"]')).toContainText("Claude Code");
  });
}

test("Life Wrapped draws a card and saves it as a picture", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/wrapped");
  await settle(page);
  await expect(page.locator('[data-screen-label="Wrapped"]').getByText("Life Score").first()).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save image" }).click()]);
  expect(download.suggestedFilename()).toBe("life-wrapped.png");
  const path = await download.path();
  const { size } = await import("node:fs").then((fs) => fs.statSync(path));
  expect(size).toBeGreaterThan(20_000); // a real 1080x1920 picture, not an empty file
});
