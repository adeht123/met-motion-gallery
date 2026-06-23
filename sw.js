const VERSION = "met-motion-v4";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;
const IMAGE_CACHE = `${VERSION}-images`;

const SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=detail-rail-v1",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
  "./src/main.js",
  "./src/metApi.js",
  "./src/normalizer.js",
  "./src/fallbackData.js",
  "./assets/art/10497.jpg",
  "./assets/art/12127.jpg",
  "./assets/art/253370.jpg",
  "./assets/art/339683.jpg",
  "./assets/art/35721.jpg",
  "./assets/art/39571.jpg",
  "./assets/art/436535.jpg",
  "./assets/art/436634.jpg",
  "./assets/art/437881.jpg",
  "./assets/art/438817.jpg",
  "./assets/art/444408.jpg",
  "./assets/art/444713.jpg",
  "./assets/art/45434.jpg",
  "./assets/art/459052.jpg",
  "./assets/art/467642.jpg",
  "./assets/art/469963.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("met-motion-") && ![SHELL_CACHE, DATA_CACHE, IMAGE_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    network.catch(() => null);
    return cached;
  }
  return (await network) || Response.error();
}

async function networkFirst(request, cacheName, timeoutMs = 6500) {
  const cache = await caches.open(cacheName);
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("network timeout")), timeoutMs);
  });

  try {
    const response = await Promise.race([fetch(request), timeout]);
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

async function metProxy(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({
      error: {
        source: "met-proxy",
        message: "Network access is unavailable.",
        retryable: true
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, SHELL_CACHE, 3500)
        .then((response) => response.ok ? response : caches.match("./index.html"))
    );
    return;
  }

  if (url.hostname === "collectionapi.metmuseum.org") {
    event.respondWith(networkFirst(request, DATA_CACHE, 7000));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/met")) {
    event.respondWith(metProxy(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, SHELL_CACHE, 2500));
    return;
  }

  if (url.hostname === "images.metmuseum.org" || request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
  }
});
