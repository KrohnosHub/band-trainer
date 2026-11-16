// Statische Invarianten: Version/Änderungslog, CSP-Hashes, Service-Worker-Version, Dateien, keine Inline-Handler/CDN
const fs = require('fs'), path = require('path'), crypto = require('crypto');
module.exports = async () => {
  const { test, eq, ok, root } = T;
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const ver = (html.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
  const csp = (html.match(/Content-Security-Policy"[^>]*content="([^"]+)"/) || [])[1] || '';
  await test('APP_VERSION vorhanden und im Änderungslog dokumentiert', () => {
    ok(/^\d+\.\d+\.\d+$/.test(ver || ''), 'APP_VERSION fehlt/ungültig');
    ok(new RegExp('^### v' + ver.replace(/\./g, '\\.') + ' – ', 'm').test(readme), 'README ohne Eintrag «### v' + ver + ' – …»');
  });
  await test('CSP-Hashes passen zu allen Inline-Skripten', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    ok(scripts.length >= 2, 'weniger als 2 Inline-Skripte');
    scripts.forEach((s, i) => { const h = 'sha256-' + crypto.createHash('sha256').update(s, 'utf8').digest('base64'); ok(csp.includes(h), 'Hash von Inline-Skript ' + (i + 1) + ' fehlt in der CSP (App startet sonst nicht)'); });
    eq((csp.match(/'sha256-/g) || []).length, scripts.length, 'veraltete Hashes in der CSP');
  });
  await test('CSP streng: kein unsafe-inline/eval für Skripte, nur die vorgesehenen Hosts', () => {
    const dir = n => (csp.split(';').map(x => x.trim()).find(x => x.startsWith(n + ' ')) || '');
    ok(!/'unsafe-inline'|'unsafe-eval'/.test(dir('script-src')), 'script-src zu offen');   // 'wasm-unsafe-eval' (nur WebAssembly für die Bild-Decoder von pdf.js) ist erlaubt, JS-eval nicht
    ok(/default-src 'self'/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp), 'Grundregeln fehlen');
    const hosts = [...csp.matchAll(/https:\/\/[^\s;]+/g)].map(m => m[0]);
    const allowed = ['https://accounts.google.com', 'https://apis.google.com', 'https://www.googleapis.com', 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://i.ytimg.com', 'https://paulrosen.github.io', 'https://accounts.spotify.com', 'https://api.spotify.com', 'https://open.spotify.com'];
    hosts.forEach(h => ok(allowed.includes(h), 'unerwarteter Host in der CSP: ' + h));
    ['https://paulrosen.github.io', 'https://www.googleapis.com'].forEach(h => ok(dir('connect-src').includes(h), h + ' fehlt in connect-src'));
  });
  await test('Keine Inline-Event-Handler, keine externen Skripte (CDN)', () => {
    ok(!/<[^>]+\son(click|load|error|input|change|submit|keydown|pointerdown)\s*=/i.test(html.replace(/<script>[\s\S]*?<\/script>/g, '')), 'Inline-Handler im Markup');
    ok(!/\son(click|load|error|input|change|submit)\s*=\s*\\?["'][^"']/.test(html), 'Inline-Handler in erzeugtem HTML');
    const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
    eq(srcs, ['vendor/abcjs-basic-min.js'], 'Skript-Quellen');
  });
  await test('sw.js VERSION = APP_VERSION + md5(index.html); Vendor-Cache-Hash aktuell', () => {
    const v = (sw.match(/VERSION\s*=\s*'([^']+)'/) || [])[1];
    const md5 = crypto.createHash('md5').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex').slice(0, 8);
    eq(v, ver + '-' + md5, 'sw VERSION (finalize.py vergessen?)');
    const files = [...sw.match(/PRECACHE_VENDOR\s*=\s*\[([\s\S]*?)\]/)[1].matchAll(/"([^"]+)"/g)].map(m => m[1]).sort();
    const h = crypto.createHash('md5'); files.forEach(f => { h.update(f, 'utf8'); h.update(fs.readFileSync(path.join(root, f))); });
    eq((sw.match(/VENDOR_CACHE\s*=\s*'band-trainer-vendor-([^']+)'/) || [])[1], h.digest('hex').slice(0, 8), 'VENDOR_CACHE');
  });
  await test('Pflichtdateien vorhanden, Manifest gültig', () => {
    ['manifest.webmanifest', 'sw.js', 'README.md', 'CLAUDE.md', 'vendor/abcjs-basic-min.js', 'vendor/abcjs-LICENSE.md', 'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs', 'vendor/pdfjs-LICENSE.md', 'vendor/wasm/openjpeg.wasm', 'vendor/standard_fonts/LiberationSans-Regular.ttf', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'tools/finalize.py', 'tools/check-version.py'].forEach(f => ok(fs.existsSync(path.join(root, f)), f + ' fehlt'));
    const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
    eq([m.start_url, m.scope, m.display], ['./', './', 'standalone']); m.icons.forEach(i => ok(fs.existsSync(path.join(root, i.src)), i.src));
  });
  await test('Keine Geheimnisse; Konfiguration wie vorgesehen (Client-ID, Scope drive.file, Ordnername)', () => {
    ok(!/client_secret['"]?\s*[:=]\s*['"][0-9a-zA-Z_-]{20,}/i.test(html), 'Client-Secret im Code');
    eq((html.match(/AIza[0-9A-Za-z_-]{30,}/g) || []).length, 1, 'API-Key nur einmal (CONFIG)');
    ok(/CLIENT_ID: '159994249880-flb4nhh2aq51tspov0d7nv787hir84e5\.apps\.googleusercontent\.com'/.test(html), 'CLIENT_ID');
    ok(/SCOPE: 'https:\/\/www\.googleapis\.com\/auth\/drive\.file'/.test(html) && /FOLDER_NAME: 'Band-Trainer'/.test(html), 'Scope/Ordner');
  });
  await test('Schweizer Schreibweise: kein «ß» in App und README', () => { ok(!/ß/.test(html), 'ß in index.html'); ok(!/ß/.test(readme), 'ß im README'); });
};
