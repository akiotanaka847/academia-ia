/* =====================================================================
   ACADEMIA IA · Service Worker (PWA)
   Estrategia "network-first": si hay internet, SIEMPRE se sirve la versión
   fresca (así evitamos contenido viejo cacheado, el problema clásico de PWA);
   la caché solo entra como respaldo cuando no hay conexión.
   Nunca tocamos peticiones a otros dominios (Supabase, el CDN de supabase-js).
   ===================================================================== */
const CACHE = "academia-ia-v1";
const SHELL = ["./", "./index.html", "./acceso.html", "./css/styles.css", "./js/main.js"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // no interceptar Supabase/CDN

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then((r) => r || caches.match("./index.html"))
      )
  );
});
