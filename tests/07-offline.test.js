// Offline-Start über den Service Worker: App und abcjs kommen aus dem Cache
const { launch, open } = require('./fixture.js');
const fs = require('fs'), path = require('path');
module.exports = async () => {
  const { test, eq, ok, root } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  try {
    await test('Service Worker cached App + vendor; Neuladen ohne Netz zeigt Liste und Notenbild', async () => {
      const pg = await open(b, D, { sw: true });
      await pg.evaluate(() => navigator.serviceWorker.ready);
      await pg.waitForFunction(async () => { const ks = await caches.keys(); const v = ks.find(k => k.startsWith('band-trainer-vendor-')); return v && !!(await (await caches.open(v)).match('vendor/abcjs-basic-min.js')) && !!(await (await caches.open(v)).match('vendor/standard_fonts/LiberationSans-Regular.ttf')) && !!(await (await caches.open(v)).match('vendor/pdf.worker.min.mjs')) && !!navigator.serviceWorker.controller; }, null, { timeout: 15000 });
      const swVer = (fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/VERSION\s*=\s*'([^']+)'/) || [])[1];
      const keys = await pg.evaluate(() => caches.keys()); ok(keys.includes('band-trainer-' + swVer), 'Cache-Name mit Version: ' + keys.join(','));
      await pg.evaluate(() => { const s = Store.get('seed-01'); s.notes = 'vor dem Offline-Gehen'; Store.touch(s); });
      await pg.context().setOffline(true);
      await pg.reload(); await pg.waitForSelector('#songList');
      eq(await pg.locator('#songList > li[data-id]').count(), 24);
      eq(await pg.evaluate(() => [navigator.onLine, typeof ABCJS, Store.get('seed-01').notes, document.querySelector('#syncState').textContent]), [false, 'object', 'vor dem Offline-Gehen', 'Nur lokal']);
      await pg.click('[data-act=open][data-id="demo-blues"]'); await pg.waitForSelector('#abcOut svg');
      eq(await pg.evaluate(() => document.querySelectorAll('#abcOut .abcjs-note').length), 24);
      await pg.click('#bBass'); await pg.waitForFunction(() => Bass.playing && Bass.oscNodes.length === 24); await pg.click('#bBass');   // offline sofort Oszillator-Ersatz
      eq(await pg.evaluate(async () => (await fetch('manifest.webmanifest')).ok && (await fetch('icons/icon-192.png')).ok), true, 'Manifest und Icon offline');
      eq(await pg.evaluate(async () => { const m = await import('./vendor/pdf.min.mjs'); return [typeof m.getDocument, (await fetch('vendor/pdf.worker.min.mjs')).ok, (await fetch('vendor/wasm/openjpeg.wasm')).ok, (await fetch('vendor/standard_fonts/LiberationSans-Regular.ttf')).ok]; }), ['function', true, true, true], 'pdf.js samt Worker, Wasm und Schriften offline');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
