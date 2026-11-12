import { expect, test } from "@playwright/test";
import { LOCALES } from "./helpers";

const TITLES: Record<(typeof LOCALES)[number], Record<string, string>> = {
  en: { impressum: "Legal notice", privacy: "Privacy policy", terms: "Terms of service", withdrawal: "Withdrawal notice" },
  de: { impressum: "Impressum", privacy: "Datenschutzerklärung", terms: "Allgemeine Geschäftsbedingungen", withdrawal: "Widerrufsbelehrung" },
  id: { impressum: "Impressum", privacy: "Kebijakan privasi", terms: "Syarat dan ketentuan", withdrawal: "Pemberitahuan hak pembatalan" },
};

for (const locale of LOCALES) {
  test(`legal pages open without an account, ${locale}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: "block" });
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3100" }]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const [slug, title] of Object.entries(TITLES[locale])) {
      await page.goto(`/legal/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      // The three other pages are one tap away.
      await expect(page.locator("nav a")).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      expect(await page.locator("body").innerText()).not.toMatch(/MISSING_MESSAGE|\bui\.legal_/);
    }
    await page.goto("/login");
    await expect(page.locator('a[href="/legal/impressum"]')).toBeVisible();
    // An unknown page shows the translated 404 (streamed, so the status line cannot say it).
    await page.goto("/legal/nothing");
    await expect(page.getByText("404")).toBeVisible();
    await context.close();
    expect(errors).toEqual([]);
  });
}
