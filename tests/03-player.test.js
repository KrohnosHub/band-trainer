// Player mit WAV-Stems: Laden (IndexedDB), Wiedergabe, Tempo mit Tonhöhenerhalt, A-B-Loop, Mischung, Metronom
const { launch, open, wav } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  try {
    await test('Stems laden, abspielen, Tempo 50 %, Loop, Stummschalten, Metronom; bleiben nach Neuladen; Entfernen', async () => {
      const pg = await open(b, D, { hash: '#/song/demo-blues' });
      await pg.click('[data-act=tab][data-tab=audio]');
      await pg.setInputFiles('#file-original', { name: 'original.wav', mimeType: 'audio/wav', buffer: wav(3, 8000, 220) });
      await pg.waitForFunction(() => Player.tracks.original && Player.duration() > 2.5);
      await pg.setInputFiles('#file-bass', { name: 'bass.wav', mimeType: 'audio/wav', buffer: wav(3, 8000, 110) });
      await pg.waitForFunction(() => Player.tracks.bass && isFinite(Player.tracks.bass.el.duration));
      eq(await pg.evaluate(() => { const s = App.current(); return [s.stems.original.name, s.stems.bass.size, s.mix.bass.on]; }), ['original.wav', 48044, true]);
      ok(/original\.wav/.test(await pg.locator('[data-stem=original] .fn').innerText()), 'Dateiname sichtbar');
      eq(await pg.locator('#tDur').innerText(), '0:03');
      await pg.click('#bPlay'); await pg.waitForFunction(() => Player.playing && Player.time() > 0.3);
      ok(await pg.evaluate(() => !Player.tracks.bass.el.paused && Math.abs(Player.tracks.bass.el.currentTime - Player.time()) < 0.25), 'Stems laufen zusammen');
      // Tempo
      await pg.evaluate(() => { const r = document.querySelector('#rate'); r.value = 50; r.dispatchEvent(new Event('input', { bubbles: true })); });
      eq(await pg.evaluate(() => [Player.tracks.original.el.playbackRate, Player.tracks.bass.el.playbackRate, Player.tracks.original.el.preservesPitch]), [0.5, 0.5, true]);
      ok(/50 % · 50 BPM/.test(await pg.locator('#rateOut').innerText()), 'Tempoanzeige');
      await pg.click('#bPlay'); eq(await pg.evaluate(() => Player.playing), false, 'Pause');
      // A-B-Loop
      await pg.evaluate(() => { const r = document.querySelector('#rate'); r.value = 100; r.dispatchEvent(new Event('input', { bubbles: true })); Player.seek(0.4); });
      await pg.click('#bA'); await pg.evaluate(() => Player.seek(0.9)); await pg.click('#bB');
      ok(/Loop: A 0:00\s+→\s+B 0:00/.test(await pg.locator('#loopInfo').innerText()), 'Loop-Anzeige');
      await pg.click('#bPlay'); await pg.waitForTimeout(1600);
      const t = await pg.evaluate(() => Player.time()); ok(t >= 0.35 && t <= 1.0, 'Loop hält die Position im Bereich: ' + t);
      await pg.click('#bClr'); eq(await pg.evaluate(() => App.current().loop), { a: null, b: null });
      await pg.click('#bPlay');
      // Mischung
      await pg.click('[data-act=stemOn][data-slot=bass]');
      eq(await pg.evaluate(() => [App.current().mix.bass.on, Player.tracks.bass.gain ? Player.tracks.bass.gain.gain.value : (Player.tracks.bass.el.muted ? 0 : 1)]), [false, 0]);
      await pg.click('[data-act=preset][data-p=bass]'); eq(await pg.evaluate(() => [App.current().mix.original.on, App.current().mix.bass.on]), [false, true]);
      // Metronom
      await pg.click('#bMetro'); eq(await pg.evaluate(() => [Metro.on, Metro.bpm]), [true, 100]); await pg.click('#bMetro'); eq(await pg.evaluate(() => Metro.on), false);
      // Neuladen: Dateien kommen aus IndexedDB
      await pg.waitForTimeout(600); await pg.reload(); await pg.waitForFunction(() => Player.tracks.original && Player.tracks.bass);
      // Entfernen
      await pg.click('[data-act=tab][data-tab=audio]'); pg.once('dialog', d => d.accept()); await pg.click('[data-act=stemDel][data-slot=bass]');
      eq(await pg.evaluate(async () => [!!Player.tracks.bass, App.current().stems.bass.deleted, await IDB.get('demo-blues:bass') || null]), [false, true, null]);
      await pg.setInputFiles('#file-nobass', { name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }); await pg.waitForTimeout(200);
      eq(await pg.evaluate(() => !!Player.tracks.nobass), false, 'Nicht-Audio abgelehnt');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
