// v1.12.0: Drum-Groove (Schläge, Stile, Raster), Ablaufplan (bearbeiten, aus Akkordblatt, Mitlaufen, Auftrittsmodus), Probennotizen
const { launch, open, wav } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  const more = async pg => { if (await pg.locator('#bMore').isVisible()) await pg.click('#bMore'); };
  try {
    await test('Drum-Groove: Rock-Pattern im Songtempo (Kick 1/3+, Snare 2/4, Hats Achtel), Stilwechsel, Stopp; ohne BPM Hinweis', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-05' }); await pg.waitForSelector('#sTitle');
      await pg.evaluate(() => { const s = App.current(); s.bpm = 120; s.groove = 'rock'; Store.touch(s); UI.groove();
        window.__hits = []; for (const k of ['kick', 'snare', 'hat']) { const f = Drums[k].bind(Drums); Drums[k] = (t, v, o) => { window.__hits.push([k, t]); return f(t, v, o); }; } });
      await more(pg); await pg.click('[data-act=groove]'); ok(await pg.evaluate(() => Drums.on)); ok(/Stopp/.test(await pg.locator('[data-act=groove]').innerText()));
      await pg.waitForTimeout(2300); await pg.click('[data-act=groove]'); eq(await pg.evaluate(() => Drums.on), false);
      const h = await pg.evaluate(() => window.__hits); const t0 = h[0][1], step = 0.125;   // 120 BPM → Achtel 0.25 s, 16tel 0.125 s
      const at = k => h.filter(x => x[0] === k).map(x => Math.round((x[1] - t0) / step) % 16);
      ok(at('kick').length >= 3 && at('kick').every(i => [0, 8, 10].includes(i)), 'Kick: ' + at('kick'));
      ok(at('snare').length >= 2 && at('snare').every(i => [4, 12].includes(i)), 'Snare: ' + at('snare'));
      ok(at('hat').every(i => i % 2 === 0), 'Hats Achtel');
      await pg.selectOption('#grooveSel', 'shuffle'); await pg.waitForTimeout(700); eq(await pg.evaluate(() => App.current().groove), 'shuffle');
      await pg.evaluate(() => { App.current().bpm = null; }); await pg.click('[data-act=groove]'); eq(await pg.evaluate(() => Drums.on), false, 'ohne BPM');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Ablauf: aus Akkordblatt, Teile bearbeiten/verschieben/löschen, Einzählen/Schluss; Mitlaufen folgt dem Ablauf (Wiederholung, eigene Taktzahl)', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-05' }); await pg.waitForSelector('#sTitle');
      await pg.evaluate(() => { const s = App.current(); s.bpm = 120; s.chords = '[Intro]\n| A | D |\n[Verse]\n| E | F#m |\n[Chorus]\n| G | C |'; s.form = []; Store.touch(s); UI.song(); });
      await pg.click('#fDet summary'); await pg.click('[data-act=formFromSheet]');
      eq(await pg.evaluate(() => App.current().form.map(x => x.sect)), ['Intro', 'Verse', 'Chorus']);
      await pg.click('[data-act=formAdd]'); await pg.fill('#formOut .frow:nth-child(4) .fsect', 'Verse'); await pg.fill('#formOut .frow:nth-child(4) .fbars', '4');
      await pg.selectOption('#formOut .frow:nth-child(4) [data-k=dyn]', 'voll'); await pg.selectOption('#formOut .frow:nth-child(4) [data-k=role]', 'Stabs');
      await pg.fill('#fCount', 'Drummer (4 Sticks)'); await pg.fill('#fEnd', 'Schlag auf 1'); await pg.waitForTimeout(700);
      eq(await pg.evaluate(() => { const s = App.current(); return [s.form[3], s.countBy, s.ending].map(x => typeof x === 'object' ? [x.sect, x.bars, x.dyn, x.role] : x); }), [['Verse', 4, 'voll', 'Stabs'], 'Drummer (4 Sticks)', 'Schlag auf 1']);
      // Mitlaufen: Raster bei 0 s, Takt = 2 s: Intro(2) Verse(2) Chorus(2) Verse(4 → E F#m E F#m)
      await pg.click('[data-act=tab][data-tab=audio]'); await pg.setInputFiles('#file-original', { name: 'o.wav', mimeType: 'audio/wav', buffer: wav(20, 8000, 220) });
      await pg.waitForFunction(() => Player.duration() > 19); await pg.click('[data-act=tab][data-tab=noten]');
      await pg.evaluate(() => { const s = App.current(); s.grid.offset = 0; Store.touch(s); });
      const at = async t => { await pg.evaluate(x => { Player.seek(x); UI.follow(true); }, t); return pg.evaluate(() => { const e = document.querySelector('#chordOut .bar.cur'); return [e ? e.textContent : null, [...document.querySelectorAll('#formOut .frow')].findIndex(r => r.classList.contains('cur'))]; }); };
      eq(await at(0.5), ['A', 0]); eq(await at(4.5), ['E', 1]); eq(await at(9), ['G', 2]); eq(await at(11), ['C', 2]); eq(await at(12.5), ['E', 3]); eq(await at(15), ['F#m', 3]); eq(await at(17), ['E', 3], 'Wiederholung im eigenen Teil');
      // verschieben, löschen
      await pg.click('#formOut .frow:nth-child(4) [data-act=formUp]'); eq(await pg.evaluate(() => App.current().form.map(x => x.sect)), ['Intro', 'Verse', 'Verse', 'Chorus']);
      await pg.click('#formOut .frow:nth-child(1) [data-act=formDel]'); eq(await pg.evaluate(() => App.current().form.length), 3);
      // Auftrittsmodus zeigt Ablauf und Einzählen/Schluss
      await pg.click('[data-pane=noten] [data-act=stage]'); await pg.waitForSelector('.stage');
      ok(/Drummer \(4 Sticks\)/.test(await pg.locator('.scount').innerText()) && /Schlag auf 1/.test(await pg.locator('.scount').innerText()));
      eq(await pg.locator('.sform .fc2').count(), 3); eq(await pg.locator('.sform .fc2.d-voll').count(), 1);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Probennotizen: notieren (Enter), abhaken, löschen; im Auftrittsmodus per ✎; offene Zahl in der Liste; bleibt gespeichert', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-02' }); await pg.waitForSelector('#sTitle');
      await pg.click('[data-act=tab][data-tab=info]'); await pg.fill('#rnIn', 'Bridge wackelt'); await pg.press('#rnIn', 'Enter');
      await pg.fill('#rnIn', 'Schluss zu früh'); await pg.click('[data-act=rnAdd]');
      eq(await pg.locator('#rnOut .rn').count(), 2); eq(await pg.inputValue('#rnIn'), '');
      await pg.click('#rnOut .rn:has-text("Bridge") [data-act=rnDone]'); ok(await pg.locator('#rnOut .rn.done').count() === 1, 'abgehakt');
      await pg.click('#tabLists'); await pg.click('[data-act=filter][data-f=list-setlist]');
      eq(await pg.locator('#songList li[data-id=seed-02] .rnb').innerText(), '✎1');
      await pg.evaluate(() => { location.hash = '#/stage/seed-02'; }); await pg.waitForFunction(() => document.querySelector('.stage h1') && /Free Fallin/.test(document.querySelector('.stage h1').textContent));
      ok(/✎ 1/.test(await pg.locator('[data-act=stageNote]').innerText()));
      await pg.click('[data-act=stageNote]'); ok(/Schluss zu früh/.test(await pg.locator('#rnForm').innerText()), 'offene Notizen sichtbar');
      await pg.fill('#rnForm [name=t]', 'Tempo Refrain'); await pg.click('#rnForm [type=submit]');
      ok(/✎ 2/.test(await pg.locator('[data-act=stageNote]').innerText()));
      await pg.reload(); await pg.waitForSelector('#songList', { state: 'attached' }); eq(await pg.evaluate(() => Store.get('seed-02').rnotes.map(n => [n.text, n.done])), [['Bridge wackelt', true], ['Schluss zu früh', false], ['Tempo Refrain', false]]);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
