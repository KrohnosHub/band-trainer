// v1.4.0: Takt-Raster («1 tippen», Feinjustierung, Taktart), Abschnitte (setzen, springen, Loop, bearbeiten, löschen),
// Metronom im Songtakt, mitlaufendes Akkordraster (linear und über Abschnittsnamen inkl. Strophe=Verse)
const { launch, open, wav } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  const setup = async pg => {
    await pg.evaluate(() => { const s = App.current(); s.bpm = 120; s.chords = '[Intro]\n| A | D |\n[Verse]\n| E | F#m | B7 |\n[Chorus]\n| G | C |  (x2)'; s.transpose = 0; Store.touch(s); UI.chords(); });
    await pg.click('[data-act=tab][data-tab=audio]');
    await pg.setInputFiles('#file-original', { name: 'o.wav', mimeType: 'audio/wav', buffer: wav(12, 8000, 220) });
    await pg.waitForFunction(() => Player.duration() > 11);
    await pg.click('[data-act=tab][data-tab=noten]');
  };
  const more = async pg => { if (await pg.locator('#bMore').isVisible()) await more(pg); };
  const cur = pg => pg.evaluate(() => { const e = document.querySelector('#chordOut .bar.cur'); return e ? e.textContent : null; });
  try {
    await test('Takt-Raster: erstes Tippen = Takt 1, weiteres Tippen korrigiert nur die Phase; Feinjustierung, Taktart, Entfernen', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-05' }); await setup(pg);
      await more(pg);
      ok(/nicht gesetzt/.test(await pg.locator('#gridBox').innerText()));
      await pg.evaluate(() => Player.seek(1.0)); await pg.click('[data-act=gridTap]');
      eq(await pg.evaluate(() => App.current().grid), { offset: 1, beats: 4 });
      await pg.evaluate(() => Player.seek(5.1)); await pg.click('[data-act=gridTap]');   // 2 Takte (à 2 s) später, 0.1 s daneben
      eq(await pg.evaluate(() => App.current().grid.offset), 1.1, 'nur Phase');
      await pg.click('[data-act=gridNudge][data-d="-0.02"]'); eq(await pg.evaluate(() => App.current().grid.offset), 1.08);
      await pg.click('[data-act=gridBeats]'); eq(await pg.evaluate(() => App.current().grid.beats), 3);
      await pg.click('[data-act=gridBeats]'); await pg.click('[data-act=gridBeats]'); eq(await pg.evaluate(() => App.current().grid.beats), 4);
      await pg.click('[data-act=gridClr]'); eq(await pg.evaluate(() => App.current().grid.offset), null);
      // ohne BPM: Hinweis statt Raster
      await pg.evaluate(() => { App.current().bpm = null; }); await pg.click('[data-act=gridTap]'); eq(await pg.evaluate(() => App.current().grid.offset), null);
      eq(pg.errs, []); await pg.context().close();
    });
    await test('Mitlaufen: linear über die ausgeschriebenen Takte (Wiederholungen), Anzeige «Takt n · Abschnitt»; abschaltbar', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-05' }); await setup(pg);
      await pg.evaluate(() => { const s = App.current(); s.grid.offset = 1; Store.touch(s); });
      const at = async t => { await pg.evaluate(x => { Player.seek(x); UI.follow(true); }, t); return cur(pg); };
      eq(await at(0.5), null, 'vor der ersten «1» nichts');
      eq(await at(1.1), 'A'); eq(await at(3.1), 'D'); eq(await at(5.2), 'E'); eq(await at(9.5), 'B7'); eq(await at(11.5), 'G');
      ok(/Takt 6/.test(await pg.locator('#followInfo').innerText()));
      await more(pg); await pg.click('[data-act=follow]'); eq(await at(3.1), null, 'Mitlaufen aus');
      await pg.click('[data-act=follow]');
      // Transponieren ändert nichts an der Zuordnung
      await pg.evaluate(() => { const s = App.current(); s.transpose = 2; Store.touch(s); UI.chords(); }); eq(await at(3.1), 'E');
      eq(pg.errs, []); await pg.context().close();
    });
    await test('Abschnitte: setzen (auf Takt gerundet, Namen aus dem Blatt), springen, Loop pro Abschnitt, Mitlaufen über «Strophe» → [Verse], bearbeiten, löschen', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-05' }); await setup(pg);
      await pg.evaluate(() => { const s = App.current(); s.grid.offset = 1; Store.touch(s); Player.seek(5.3); });
      await pg.click('[data-act=markAdd]'); await pg.waitForSelector('#markForm');
      eq(await pg.evaluate(() => [...document.querySelectorAll('#markForm [data-act=markName]')].map(b => b.dataset.n).slice(0, 4)), ['Intro', 'Verse', 'Chorus', 'Strophe'], 'Namen aus dem Akkordblatt');
      await pg.click('#markForm [data-act=markName][data-n=Strophe]'); await pg.click('#markForm [type=submit]');
      eq(await pg.evaluate(() => App.current().marks.map(m => [m.name, m.t])), [['Strophe', 5]], 'auf den Takt gerundet');
      await pg.evaluate(() => { Marks.add(App.current(), 'Refrain', 9); UI.marks(); });
      // Mitlaufen über Abschnittsnamen: Strophe beginnt bei 5 s → E; zweiter Takt F#m; Refrain → G
      const at = async t => { await pg.evaluate(x => { Player.seek(x); UI.follow(true); }, t); return cur(pg); };
      eq(await at(5.1), 'E'); eq(await at(7.1), 'F#m'); eq(await at(9.1), 'G'); eq(await at(11.1), 'C');
      ok(/Refrain/.test(await pg.locator('#followInfo').innerText()));
      // Springen und Loop
      await pg.click('#markBox [data-act=markGo] >> text=Strophe'); eq(await pg.evaluate(() => Math.round(Player.time() * 10) / 10), 5);
      await pg.click('#markBox .mk:first-child [data-act=markLoop]');
      eq(await pg.evaluate(() => App.current().loop), { a: 5, b: 9 }); ok(await pg.locator('#markBox .mk.on').count() === 1, 'Loop sichtbar');
      await pg.click('#markBox .mk:first-child [data-act=markLoop]'); eq(await pg.evaluate(() => App.current().loop), { a: null, b: null }, 'zweiter Tipp = Loop aus');
      // Letzter Abschnitt läuft bis zum Ende
      await pg.click('#markBox .mk:nth-child(2) [data-act=markLoop]'); ok(await pg.evaluate(() => App.current().loop.b > 11.9), 'bis Songende');
      // Bearbeiten und Löschen
      await pg.click('#markBox .mk:first-child [data-act=markEdit]'); await pg.fill('#markForm [name=name]', 'Verse 1'); await pg.click('#markForm [type=submit]');
      eq(await pg.evaluate(() => App.current().marks[0].name), 'Verse 1');
      pg.once('dialog', d => d.accept());
      await pg.click('#markBox .mk:first-child [data-act=markEdit]'); await pg.click('#markForm [data-act=markDel]');
      eq(await pg.evaluate(() => App.current().marks.map(m => m.name)), ['Refrain']);
      await pg.reload(); await pg.waitForSelector('#sTitle'); eq(await pg.evaluate(() => [App.current().marks.length, App.current().grid.offset]), [1, 1], 'bleibt gespeichert');
      eq(pg.errs, []); await pg.context().close();
    });
    await test('Metronom im Songtakt: Klicks auf den Schlägen des Rasters (auch bei 50 % Tempo), Betonung auf der 1', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-05' }); await setup(pg);
      await pg.evaluate(() => { const s = App.current(); s.grid.offset = 0.25; Store.touch(s);
        window.__clicks = []; const c0 = Metro.click.bind(Metro); Metro.click = (t, acc) => { window.__clicks.push([Player.time() + (t - AC.get().currentTime) * Player.rate, acc]); }; });
      await more(pg); await pg.click('#bPlay'); await pg.click('#bMetro');
      ok(await pg.evaluate(() => Metro.synced), 'synchron'); ok(/Songtakt/.test(await pg.locator('#bMetro').innerText()));
      await pg.waitForTimeout(1800);
      const cl = await pg.evaluate(() => window.__clicks);
      ok(cl.length >= 2, 'Klicks: ' + cl.length);
      ok(cl.every(([t]) => Math.abs(((t - 0.25) / 0.5) - Math.round((t - 0.25) / 0.5)) < 0.12), 'auf den Schlägen: ' + JSON.stringify(cl));
      ok(cl.every(([t, a]) => a === (Math.round((t - 0.25) / 0.5) % 4 === 0)), 'Betonung auf der 1');
      await pg.click('#bMetro'); eq(await pg.evaluate(() => Metro.on), false);
      eq(pg.errs, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
