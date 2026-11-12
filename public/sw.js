// rideff Life service worker.
// - App shell: every page's HTML plus its /_next/static files are cached, so the app opens
//   offline from the Home Screen.
// - URLs are the same in every language (the NEXT_LOCALE cookie picks the language), so
//   pages are cached per language: the app tells this worker which language is on screen
//   and the pages are fetched again when it changes.
// - Pages and RSC data: network first, cached copy when offline.
// - /_next/static (hashed, never changes): cache first.
// - Supabase and other origins are never touched here.

const VERSION = "rl-v3";
const STATIC = `${VERSION}-static`;
const META = `${VERSION}-meta`;
const LOCALES = ["en", "de", "id"];
const pagesName = (locale) => `${VERSION}-pages-${locale}`;

const PAGES = [
  "/", "/login", "/settings", "/more", "/map", "/plan", "/help",
  "/budget", "/debts", "/import", "/recur", "/subs", "/remit", "/biz", "/tax",
  "/week", "/shifts", "/ygoals", "/learn",
  "/invest", "/sim", "/career",
  "/gym", "/together", "/journal",
  "/alerts", "/report", "/reports", "/ask", "/whatif", "/setup",
];
const EXTRA = ["/manifest.webmanifest", "/rideff-particles.js", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

const STATIC_RE = /\/_next\/static\/[^"'\s)\\]+/g;
const LANG_RE = /<html[^>]*\slang="([a-z]{2})"/;

// The language the app last reported. Kept in Cache Storage because this worker can be stopped any time.
let current = null;

async function getLocale() {
  if (current) return current;
  try {
    const hit = await (await caches.open(META)).match("/__locale");
    const value = hit ? await hit.text() : "";
    current = LOCALES.includes(value) ? value : "en";
  } catch {
    current = "en";
  }
  return current;
}

/** Fetches every page in `locale` (the cookie must already say so) and the files they need. */
async function precachePages(locale) {
  const pages = await caches.open(pagesName(locale));
  const statics = await caches.open(STATIC);
  const assets = new Set(EXTRA);
  await Promise.all(
    PAGES.map(async (path) => {
      try {
        const res = await fetch(path, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const html = await res.clone().text();
        // A page in another language (the cookie changed meanwhile) must not be filed under this one.
        const lang = html.match(LANG_RE);
        if (lang && lang[1] !== locale) return;
        for (const m of html.match(STATIC_RE) || []) assets.add(m);
        await pages.put(path, res);
      } catch {}
    }),
  );
  await Promise.all([...assets].map((url) => statics.add(url).catch(() => {})));
}

async function setLocale(locale) {
  if (!LOCALES.includes(locale)) return;
  current = locale;
  await (await caches.open(META)).put("/__locale", new Response(locale));
  const pages = await caches.open(pagesName(locale));
  // First time in this language: fetch everything. Later visits keep their pages fresh on their own.
  if (!(await pages.match("/"))) await precachePages(locale);
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(STATIC)
      .then((c) => Promise.all(EXTRA.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "locale") e.waitUntil(setLocale(e.data.locale));
});

async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(pagesName(await getLocale()));
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit =
      (await cache.match(request, { ignoreVary: true })) ||
      (fallbackPath && (await cache.match(fallbackPath, { ignoreSearch: true, ignoreVary: true }))) ||
      (fallbackPath && (await cache.match("/", { ignoreVary: true })));
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(cacheFirst(req));
  } else if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, url.pathname));
  } else {
    e.respondWith(networkFirst(req));
  }
});

// Web Push (phase 3) -----------------------------------------------------------
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || "rideff Life", {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.tag,
      data: { url: d.url || "/" },
    }),
  );
});

// Tapping a reminder opens its screen, reusing an open app window if there is one.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const win = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (win) return win.focus().then((w) => (w || win).navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
