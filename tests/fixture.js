// Gemeinsame Helfer: Browser starten, Seite öffnen, Google/YouTube stubben, Drive als In-Memory-Attrappe.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8766/index.html';
async function launch() { return chromium.launch(process.env.CHROMIUM || require('fs').existsSync('/opt/pw-browsers/chromium') ? { executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] } : { args: ['--autoplay-policy=no-user-gesture-required'] }); }

// Mono-WAV (16 Bit) mit Sinuston – eigene Testdatei, kein fremdes Material
function wav(seconds = 2, rate = 8000, freq = 220) {
  const n = Math.floor(seconds * rate), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / rate) * 9000), 44 + i * 2);
  return b;
}

// Attrappe der Google-Drive-API (nur was die App benutzt). Mehrere «Geräte» (Browser-Kontexte) teilen sich eine Instanz.
class FakeDrive {
  constructor() { this.files = new Map(); this.n = 0; this.log = []; this.pending = new Map(); this.failNext = 0; }
  add(f) { const id = f.id || 'id' + (++this.n) + 'xxxxx'; this.files.set(id, Object.assign({ id, trashed: false, parents: ['root'], mimeType: 'application/octet-stream', body: Buffer.alloc(0), modifiedTime: new Date().toISOString() }, f, { id })); return this.files.get(id); }
  live(pred) { return [...this.files.values()].filter(f => !f.trashed && (!pred || pred(f))); }
  byName(name) { return this.live(f => f.name === name); }
  json(name) { const f = this.byName(name)[0]; return f ? JSON.parse(f.body.toString('utf8')) : null; }
  query(q) {
    let out = this.live();
    for (const m of q.matchAll(/name\s*=\s*'((?:[^'\\]|\\.)*)'/g)) out = out.filter(f => f.name === m[1].replace(/\\(.)/g, '$1'));
    for (const m of q.matchAll(/name contains '([^']*)'/g)) out = out.filter(f => f.name.includes(m[1]));
    for (const m of q.matchAll(/'([^']+)' in parents/g)) out = out.filter(f => f.parents.includes(m[1]));
    for (const m of q.matchAll(/mimeType\s*=\s*'([^']+)'/g)) out = out.filter(f => f.mimeType === m[1]);
    return out;
  }
  async handle(route) {
    const req = route.request(), u = new URL(req.url()), m = req.method(), p = u.pathname;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'Location' };
    const send = (status, obj, extra) => route.fulfill({ status, headers: Object.assign({ 'content-type': 'application/json' }, cors, extra || {}), body: obj == null ? '' : JSON.stringify(obj) });
    if (m === 'OPTIONS') return send(204, null);
    this.log.push(m + ' ' + p + u.search);
    if (this.failNext > 0) { this.failNext--; return send(401, { error: { message: 'unauthorized' } }); }
    if (!/^Bearer /.test(req.headers()['authorization'] || '')) return send(401, { error: { message: 'no token' } });
    const meta = f => ({ id: f.id, name: f.name, trashed: f.trashed, modifiedTime: f.modifiedTime, size: String(f.body.length) });
    const body = req.postDataBuffer() || Buffer.alloc(0);
    if (p === '/drive/v3/about') return send(200, { user: { emailAddress: 'test@example.com' } });
    if (p === '/drive/v3/files' && m === 'GET') return send(200, { files: this.query(u.searchParams.get('q') || '').map(meta) });
    if (p === '/drive/v3/files' && m === 'POST') { const j = JSON.parse(body.toString('utf8')); return send(200, meta(this.add(j))); }
    let mm = p.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (mm) {
      const f = this.files.get(mm[1]); if (!f) return send(404, { error: { message: 'File not found' } });
      if (m === 'PATCH') { Object.assign(f, JSON.parse(body.toString('utf8'))); return send(200, meta(f)); }
      if (u.searchParams.get('alt') === 'media') return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': f.mimeType }, cors), body: f.body });
      return send(200, meta(f));
    }
    mm = p.match(/^\/upload\/drive\/v3\/files(?:\/([^/]+))?$/);
    if (mm) {
      const type = u.searchParams.get('uploadType');
      if (mm[1]) { const f = this.files.get(mm[1]); if (!f) return send(404, {}); f.body = body; f.modifiedTime = new Date().toISOString(); return send(200, meta(f)); }
      if (type === 'multipart') {
        const bd = '--' + (req.headers()['content-type'].match(/boundary=(.+)$/) || [])[1];
        const parts = []; let i = body.indexOf(bd);
        while (i >= 0) { const j = body.indexOf(bd, i + bd.length); if (j < 0) break; const part = body.subarray(i + bd.length + 2, j - 2), h = part.indexOf('\r\n\r\n'); parts.push(part.subarray(h + 4)); i = j; }
        const j = JSON.parse(parts[0].toString('utf8')); return send(200, meta(this.add(Object.assign(j, { body: Buffer.from(parts[1]) }))));
      }
      if (type === 'resumable' && m === 'POST') { const id = 'up' + (++this.n); this.pending.set(id, JSON.parse(body.toString('utf8'))); return send(200, null, { Location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=' + id }); }
      if (type === 'resumable' && m === 'PUT') { const j = this.pending.get(u.searchParams.get('upload_id')); if (!j) return send(404, {}); this.resumable = (this.resumable || 0) + 1; return send(200, meta(this.add(Object.assign(j, { body })))); }
    }
    return send(400, { error: { message: 'FakeDrive: nicht unterstützt ' + m + ' ' + p } });
  }
}

// opts: drive (FakeDrive), yt (Funktion query → items | {status}), cfg (CONFIG-Überschreibung), sw (Service Worker zulassen), init, hash
async function open(b, vp, { drive, yt, cfg, sw = false, init, hash = '', logs = true, storage } = {}) {
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: sw ? 'allow' : 'block', hasTouch: vp.width < 600, isMobile: vp.width < 600, storageState: storage });
  const pg = await ctx.newPage(); pg.errs = []; pg.csp = []; pg.ytQueries = [];
  pg.on('pageerror', e => { pg.errs.push(e.message); if (logs) console.log('PAGEERROR', e.message); });
  pg.on('console', msg => { if (/Content Security Policy/i.test(msg.text())) { pg.csp.push(msg.text()); if (logs) console.log('CSP', msg.text()); } });
  await ctx.route(/accounts\.google\.com|apis\.google|googleapis|youtube|ytimg|paulrosen/, r => r.abort());
  if (drive) await ctx.route(/^https:\/\/www\.googleapis\.com\/(drive|upload)\//, r => drive.handle(r));
  if (yt) await ctx.route(/^https:\/\/www\.googleapis\.com\/youtube\/v3\/search/, r => {
    const q = new URL(r.request().url()).searchParams.get('q'); pg.ytQueries.push(q); const out = yt(q);
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
    return out && out.status ? r.fulfill({ status: out.status, headers, body: JSON.stringify({ error: { message: 'quotaExceeded' } }) }) : r.fulfill({ status: 200, headers, body: JSON.stringify({ items: out }) });
  });
  await pg.addInitScript((c) => {
    window.__TEST_CFG = Object.assign({ YOUTUBE_API_KEY: '' }, c || {});
    // Google Identity Services: Attrappe des Token-Clients (kein echtes Google in den Tests)
    window.__auth = { calls: [], mode: 'ok', n: 0 };
    window.google = { accounts: { oauth2: {
      initTokenClient(conf) { window.__auth.cfg = { client_id: conf.client_id, scope: conf.scope }; return { requestAccessToken(o) { window.__auth.calls.push(o || {}); setTimeout(() => { if (window.__auth.mode === 'ok') conf.callback({ access_token: 'tok' + (++window.__auth.n), expires_in: 3600 }); else conf.error_callback({ type: 'popup_failed_to_open' }); }, 10); } }; },
      revoke(t, cb) { cb && cb(); } } } };
    // Wake Lock zählen
    window.__wake = { req: 0, rel: 0 };
    try { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__wake.req++; return { release: async () => { window.__wake.rel++; }, addEventListener() {} }; } } }); } catch (e) {}
  }, cfg);
  if (init) await pg.addInitScript(init);
  await pg.goto(BASE + hash); await pg.waitForSelector('#app > *');
  pg.settle = async (ms = 8000) => { await pg.waitForFunction(() => Cloud.syncing === 0 && !Cloud.busy, null, { timeout: ms }); };
  pg.syncNow = async () => { await pg.evaluate(() => Cloud.syncAll(true)); await pg.settle(); };
  return pg;
}
module.exports = { launch, open, wav, FakeDrive };

// Kleine Test-PDF (eigene Datei, kein fremdes Material): pro Seite eine Textzeile in Helvetica (Standardschrift, nicht eingebettet)
function pdf(pages = 2) {
  const objs = [], add = s => { objs.push(s); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>'); add('');   // 2 = Pages (wird unten gefüllt)
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'), kids = [];
  for (let i = 1; i <= pages; i++) {
    const txt = 'BT /F1 48 Tf 40 300 Td (Testblatt Seite ' + i + ') Tj ET\n0 0 0 rg 40 200 200 30 re f';
    const c = add('<< /Length ' + txt.length + ' >>\nstream\n' + txt + '\nendstream');
    kids.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 560] /Resources << /Font << /F1 ' + font + ' 0 R >> >> /Contents ' + c + ' 0 R >>'));
  }
  objs[1] = '<< /Type /Pages /Count ' + pages + ' /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] >>';
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
// Kleines PNG (w×h, einfarbig mit dunklem Balken) – als «Scan/Foto»
function png(w = 60, h = 80) {
  const zlib = require('zlib'), raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const v = y > 20 && y < 30 ? 20 : 235; raw.fill(v, y * (w * 3 + 1) + 1 + x * 3, y * (w * 3 + 1) + 4 + x * 3); } }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
module.exports.pdf = pdf; module.exports.png = png;
