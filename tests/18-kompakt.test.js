// v1.13.0: Bassline-Grösse (Standard kleiner, A−/A+ gemerkt), Player einklappen (gemerkt, Play funktioniert)
const { launch, open, wav } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  try {
    await test('Bassline: Standard 0.7, A−/A+ verändert Grösse und Takte pro Zeile, gemerkt', async () => {
      const pg = await open(b, D, { hash: '#/song/demo-blues' }); await pg.waitForSelector('#abcOut svg');
      const h = () => pg.evaluate(() => document.querySelector('#abcOut svg .abcjs-staff').getBoundingClientRect().height);
      eq(await pg.evaluate(() => Store.data.settings.bassSize), 0.7);
      const h0 = await h(); await pg.click('[data-act=bassZoom][data-d="0.1"]'); await pg.click('[data-act=bassZoom][data-d="0.1"]'); await pg.click('[data-act=bassZoom][data-d="0.1"]'); await pg.waitForSelector('#abcOut svg');
      const h1 = await h(); ok(h1 > h0 * 1.25, `grösser: ${h0} → ${h1}`);
      for (let i = 0; i < 8; i++) await pg.click('[data-act=bassZoom][data-d="-0.1"]');
      eq(await pg.evaluate(() => Store.data.settings.bassSize), 0.4, 'Untergrenze');
      await pg.reload(); await pg.waitForSelector('#abcOut svg'); eq(await pg.evaluate(() => Store.data.settings.bassSize), 0.4);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Bass anhören: aktuelle Note markiert; Note antippen = Startpunkt (Takt angezeigt), Wiedergabe ab dort, «von vorne» setzt zurück', async () => {
      const pg = await open(b, D, { hash: '#/song/demo-blues' }); await pg.waitForSelector('#abcOut svg');
      ok(/antippen/.test(await pg.locator('#bassStart').innerText()));
      const ns = pg.locator('#abcOut .abcjs-note'); await ns.nth(Math.min(12, (await ns.count()) - 2)).click({ force: true });
      const st = await pg.evaluate(() => [Bass.startMs, document.querySelectorAll('#abcOut .bsel').length]);
      ok(st[0] > 1000 && st[1] > 0, 'Startpunkt ' + st); ok(/Start ab Takt \d+/.test(await pg.locator('#bassStart').innerText()));
      await pg.evaluate(() => { window.__osc = []; const o = Bass.playOsc.bind(Bass); Bass.playOsc = c => { const r = o(c); window.__osc.push(Bass.oscNodes.length); return r; }; });
      await pg.click('#bBass'); await pg.waitForFunction(() => document.querySelectorAll('#abcOut .bcur').length > 0, null, { timeout: 12000 });
      ok(await pg.evaluate(() => window.__osc[0] < 48), 'nur Noten ab Startpunkt: ' + await pg.evaluate(() => window.__osc[0]));
      await pg.click('#bBass'); await pg.waitForFunction(() => !Bass.playing); eq(await pg.locator('#abcOut .bcur').count(), 0, 'Markierung weg nach Stopp');
      await pg.click('[data-act=bassFromStart]'); eq(await pg.evaluate(() => [Bass.startMs, document.querySelectorAll('#abcOut .bsel').length]), [0, 0]);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Player einklappen: nur Zeitleiste + Play, gemerkt, Play steuert die Wiedergabe; aufklappen zeigt alles wieder', async () => {
      const pg = await open(b, { width: 390, height: 844 }, { hash: '#/song/demo-blues' }); await pg.waitForSelector('#sTitle');
      await pg.click('[data-act=tab][data-tab=audio]'); await pg.setInputFiles('#file-original', { name: 'o.wav', mimeType: 'audio/wav', buffer: wav(4, 8000, 220) }); await pg.waitForFunction(() => Player.tracks.original);
      const hFull = await pg.evaluate(() => document.querySelector('.transport').offsetHeight);
      await pg.click('[data-act=tpMin]');
      const r = await pg.evaluate(() => [document.querySelector('.transport').offsetHeight, getComputedStyle(document.querySelector('.btnrow')).display, getComputedStyle(document.querySelector('#bPlay2')).display, localStorage.getItem('bt_tpMin')]);
      ok(r[0] < hFull * 0.6, `kleiner: ${hFull} → ${r[0]}`); eq(r.slice(1), ['none', 'flex', '1']);
      await pg.click('#bPlay2'); await pg.waitForFunction(() => Player.playing); await pg.click('#bPlay2'); await pg.waitForFunction(() => !Player.playing);
      await pg.reload(); await pg.waitForSelector('#sTitle'); ok(await pg.evaluate(() => document.querySelector('.transport').classList.contains('min')), 'gemerkt');
      await pg.click('[data-act=tpMin]'); ok(await pg.locator('#bPlay').isVisible() && !(await pg.locator('#bPlay2').isVisible()), 'aufgeklappt');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
