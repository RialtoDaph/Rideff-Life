import { expect, test } from "@playwright/test";
import { STUB, setData, setPlan, settle, signIn } from "./helpers";

test("opens offline and syncs what was added", async ({ browser }) => {
  await setPlan("together");
  await setData("seed");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  await signIn(context);
  const page = await context.newPage();
  await page.goto("/gym");
  await settle(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await settle(page);

  await context.setOffline(true);
  await page.reload();
  await settle(page);
  await expect(page.getByRole("heading", { name: "Gym" })).toBeVisible();

  const inserts = async () => ((await (await fetch(`${STUB}/__log`)).json()) as unknown[][]).filter((l) => l[0] === "insert" && l[1] === "gym_sessions").length;
  const start = await inserts();
  await page.getByRole("button", { name: /Cardio/ }).first().click();
  await page.waitForTimeout(800);
  expect(await inserts()).toBe(start);

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(inserts, { timeout: 15000 }).toBe(start + 1);
  await context.close();
});

test("offline pages follow the language", async ({ browser }) => {
  await setPlan("together");
  await setData("seed");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  await signIn(context, "en");
  const page = await context.newPage();
  await page.goto("/gym");
  await settle(page);
  await page.evaluate(() => navigator.serviceWorker.ready);

  // The language changes (the cookie is what the app reads); a screen never opened in German must still open offline, in German.
  await context.addCookies([{ name: "NEXT_LOCALE", value: "de", url: "http://localhost:3100" }]);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // The worker fetches every page in German; wait until that, and the files the pages need, have settled.
  await page.waitForFunction(
    async () => {
      const count = async (name: string) => (await (await caches.open(name)).keys()).length;
      const w = window as unknown as { __seen?: string; __since?: number };
      const now = `${await count("rl-v3-pages-de")}/${await count("rl-v3-static")}`;
      if (w.__seen !== now) {
        w.__seen = now;
        w.__since = Date.now();
      }
      const hit = await (await caches.open("rl-v3-pages-de")).match("/week");
      return !!hit && (await hit.text()).includes("Diese Woche") && Date.now() - (w.__since ?? Date.now()) > 2000;
    },
    undefined,
    { timeout: 30000, polling: 500 },
  );

  await context.setOffline(true);
  await page.goto("/week");
  await settle(page);
  await expect(page.getByRole("heading", { name: "Diese Woche" }).first()).toBeVisible();
  await context.close();
});
