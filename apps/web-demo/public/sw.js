/* global self, caches */
// Offline cache: the page, the face model and its runtime, fonts and images.
// Nothing is ever sent anywhere; this only keeps downloaded files on the phone.
const CACHE = "eye-demo-v1";
const HOSTS = [
  "cdn.jsdelivr.net",
  "storage.googleapis.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function cacheable(url) {
  return url.origin === self.location.origin || HOSTS.includes(url.hostname);
}

async function put(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    // Network first so a new deploy shows up; the cached page when offline.
    event.respondWith(
      fetch(request)
        .then((response) => put(request, response))
        .catch(async () => (await caches.match(request)) || caches.match("/")),
    );
    return;
  }
  if (!cacheable(url)) return;
  event.respondWith(
    caches
      .match(request)
      .then((hit) => hit || fetch(request).then((response) => put(request, response))),
  );
});

// The page sends the files it already loaded before this worker took control.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache") return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      let ok = 0;
      for (const href of event.data.urls) {
        const url = new URL(href);
        if (!cacheable(url)) continue;
        try {
          if (!(await cache.match(href))) {
            const response = await fetch(href, {
              mode: url.origin === self.location.origin ? "same-origin" : "cors",
            });
            if (!response.ok) continue;
            await cache.put(href, response);
          }
          ok += 1;
        } catch {
          // Skipped; it is fetched again next time.
        }
      }
      event.source?.postMessage({ type: "cached", ok });
    })(),
  );
});
