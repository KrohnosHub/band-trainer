// Service Worker des Band-Trainers – hält Programm, abcjs und pdf.js (Notenblätter) offline bereit.
// Songs liegen in localStorage, Audiodateien und Notenblätter in IndexedDB (nicht hier).
const VERSION = '1.9.1-6b61c07c';
const CACHE = 'band-trainer-' + VERSION;
// vendor/ und icons/ ändern sich selten: eigener Cache, dessen Name nur wechselt, wenn sich der Inhalt
// dieser Dateien ändert (Hash von tools/finalize.py) – sie werden nicht bei jeder Version neu geladen.
const VENDOR_CACHE = 'band-trainer-vendor-d6bab1a5';
const PRECACHE = [
 "./",
 "index.html",
 "manifest.webmanifest",
 "pitch-worklet.js"
];
const PRECACHE_VENDOR = [
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "vendor/abcjs-basic-min.js",
 "vendor/pdf.min.mjs",
 "vendor/pdf.worker.min.mjs",
 "vendor/wasm/jbig2.wasm",
 "vendor/wasm/openjpeg.wasm",
 "vendor/wasm/qcms_bg.wasm",
 "vendor/standard_fonts/FoxitDingbats.pfb",
 "vendor/standard_fonts/FoxitFixed.pfb",
 "vendor/standard_fonts/FoxitFixedBold.pfb",
 "vendor/standard_fonts/FoxitFixedBoldItalic.pfb",
 "vendor/standard_fonts/FoxitFixedItalic.pfb",
 "vendor/standard_fonts/FoxitSerif.pfb",
 "vendor/standard_fonts/FoxitSerifBold.pfb",
 "vendor/standard_fonts/FoxitSerifBoldItalic.pfb",
 "vendor/standard_fonts/FoxitSerifItalic.pfb",
 "vendor/standard_fonts/FoxitSymbol.pfb",
 "vendor/standard_fonts/LiberationSans-Bold.ttf",
 "vendor/standard_fonts/LiberationSans-BoldItalic.ttf",
 "vendor/standard_fonts/LiberationSans-Italic.ttf",
 "vendor/standard_fonts/LiberationSans-Regular.ttf"
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async (u) => { try { await c.add(new Request(u, { cache: 'reload' })); } catch (err) { /* einzelne Datei nicht kritisch */ } }));
    const vc = await caches.open(VENDOR_CACHE);
    await Promise.all(PRECACHE_VENDOR.map(async (u) => {
      try {
        if (await vc.match(u)) return;   // schon vorhanden (gleicher Inhalt => gleicher Cache-Name)
        await vc.add(new Request(u, { cache: 'reload' }));
      } catch (err) { /* einzelne Datei nicht kritisch */ }
    }));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k === CACHE || k === VENDOR_CACHE) continue;
      if (k.startsWith('band-trainer-')) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;         // Google/YouTube/Soundfont nie abfangen
  if (!url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (isPage) {
    // Netz zuerst (damit Updates ankommen), bei Offline/Langsamkeit die gespeicherte Version
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        // cache:'no-store': sonst liefert der HTTP-Cache mancher Hosts/Browser eine veraltete Seite aus
        const freshReq = new Request(req.url, { cache: 'no-store' });
        const res = await Promise.race([fetch(freshReq), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))]);
        if (res && res.ok) { c.put('index.html', res.clone()); }
        return res;
      } catch (err) {
        return (await c.match('index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }
  const isVendor = /\/(vendor|icons)\//.test(url.pathname);
  e.respondWith((async () => {
    const c = await caches.open(isVendor ? VENDOR_CACHE : CACHE);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { const res = await fetch(req); if (res && res.ok) c.put(req, res.clone()); return res; }
    catch (err) { return Response.error(); }
  })());
});
