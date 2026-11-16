// v1.5.0: Sound-Setup (speichern, Registerzüge, Auftrittsmodus), Voicing-Hilfe (Töne, Voice Leading, Transponieren), Bassline-Vorschlag (gültiges ABC je Stil)
const { launch, open } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  try {
    await test('Akkordlehre: Töne, unbekannte Zusätze, Voice Leading mit kleinen Wegen', async () => {
      const pg = await open(b, D);
      const r = await pg.evaluate(() => {
        const pcs = t => { const c = parseChord(t); return c && c.iv.map(i => (c.root + i) % 12); };
        const c = voicing(parseChord('C'), null), g = voicing(parseChord('G'), c), am = voicing(parseChord('Am'), g), f = voicing(parseChord('F/A'), am);
        const move = (a, b) => a.reduce((s, n, i) => s + Math.abs(n - b[i]), 0);
        return { c7: pcs('C7'), fm7: pcs('F#m7'), bb: pcs('Bbmaj7'), sus: pcs('Dsus4'), unk: parseChord('Gfoo'), fine: parseChord('Fine'), slash: parseChord('D/F#').bass,
          c, g, moves: [move(c, g), move(g, am)], inRange: [c, g, am, f].every(v => v[0] >= 53 && v[v.length - 1] <= 84) };
      });
      eq([r.c7, r.fm7, r.bb, r.sus], [[0, 4, 7, 10], [6, 9, 1, 4], [10, 2, 5, 9], [2, 7, 9]]);
      eq([r.unk, r.fine, r.slash], [null, null, 6]);
      eq(r.c, [64, 67, 72], 'C: E4 G4 C5 um die Mitte'); eq(r.g, [62, 67, 71], 'G nahe dran: D4 G4 B4');
      ok(r.moves.every(m => m <= 5), 'kleine Wege: ' + r.moves); ok(r.inRange, 'Lage F3–C6');
      await pg.context().close();
    });
    await test('Voicing-Hilfe in der Song-Ansicht: jeder Akkord einmal, mit Transponieren, Hinweis bei unbekanntem Zusatz', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-05' }); await pg.waitForSelector('#sTitle');
      await pg.evaluate(() => { const s = App.current(); s.chords = '[Intro]\n| A | D/F# | E7 | A |\nA – Bm – Cxyz'; s.transpose = 0; Store.touch(s); UI.chords(); });
      await pg.click('#vDet summary'); await pg.waitForSelector('#voiceOut .vn');
      eq(await pg.evaluate(() => [...document.querySelectorAll('#voiceOut .vn')].map(e => e.textContent)), ['A', 'D/F#', 'E7', 'Bm']);
      ok(/L:\s*F#2/.test(await pg.locator('#voiceOut .vc:nth-child(2) .vt').innerText()), 'Slash-Bass links');
      ok(/Cxyz/.test(await pg.locator('#voiceOut').innerText()), 'unbekannter Zusatz genannt');
      eq(await pg.locator('#voiceOut .vc:first-child .kbd .k.on').count(), 3);
      await pg.evaluate(() => { const s = App.current(); s.transpose = 2; Store.touch(s); UI.chords(); }); await pg.waitForTimeout(50);
      eq(await pg.evaluate(() => [...document.querySelectorAll('#voiceOut .vn')].map(e => e.textContent)), ['B', 'E/G#', 'F#7', 'C#m']);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Sound-Setup: speichern, Registerzüge nur 0–8, Zusammenfassung, im Auftrittsmodus sichtbar', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-05' }); await pg.waitForSelector('#sTitle');
      await pg.click('#sDet summary');
      await pg.fill('#sdSplit', 'C3'); await pg.fill('#sdLeft', 'Synth-Bass'); await pg.fill('#sdRight', 'Hammond-Orgel'); await pg.fill('#sdDraw', '88x8009991'); await pg.fill('#sdNotes', 'Leslie schnell im Refrain');
      await pg.waitForTimeout(700);
      eq(await pg.evaluate(() => App.current().sound), { split: 'C3', left: 'Synth-Bass', right: 'Hammond-Orgel', drawbars: '88800', notes: 'Leslie schnell im Refrain' });
      await pg.fill('#sdDraw', '888000000'); await pg.waitForTimeout(700); eq(await pg.locator('#drawOut .db').count(), 9);
      ok(/Split C3 · L: Synth-Bass · R: Hammond-Orgel · Register 888000000/.test(await pg.locator('#soundSum').innerText()));
      await pg.reload(); await pg.waitForSelector('#sTitle'); eq(await pg.evaluate(() => App.current().sound.drawbars), '888000000');
      await pg.click('[data-pane=noten] [data-act=stage]'); await pg.waitForSelector('.stage');
      ok(/Split C3/.test(await pg.locator('.ssound').innerText()) && /Leslie/.test(await pg.locator('.ssound').innerText()), 'Auftrittsmodus');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Bassline-Vorschlag: alle Stile ergeben gültiges ABC (abcjs ohne Warnungen), richtige Grundtöne, Slash-Bass, Überschreiben nur nach Rückfrage', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-05' }); await pg.waitForSelector('#sTitle');
      await pg.evaluate(() => { const s = App.current(); s.chords = '[Verse]\n| A | D/F# | E7 G |  (x2)\n[Chorus]\nBb – Bm'; s.bassAbc = ''; Store.touch(s); UI.chords(); });
      const res = await pg.evaluate(() => Object.keys(BASS_STYLES).map(st => { const abc = bassSuggest(App.current(), st); const d = document.createElement('div'); document.body.appendChild(d);
        const tune = ABCJS.renderAbc(d, abc, { add_classes: true })[0]; const w = tune.warnings || []; d.remove(); return [st, w.length, (abc.match(/\|/g) || []).length, abc]; }));
      for (const [st, w, bars] of res) { eq(w, 0, st + ': abcjs-Warnungen'); ok(bars >= 8, st + ': Takte ' + bars); }
      const rock = res[0][3];
      ok(/"A"A,,A,,A,,A,,A,,A,,A,,A,,/.test(rock), 'A-Grundton Achtel in E2–D#3-Lage: ' + rock.split('\n').slice(7, 9).join(' / '));
      ok(/"D\/F#"\^F,,/.test(rock), 'Slash-Bass F#');
      ok(/"Bb"\^A,,|"Bb"_B,,/.test(rock), 'Bb als A#/Bb');
      ok(/"E7"E,,4 ?"G"G,,4|"E7"E,,E,,E,,E,,/.test(rock) || /"G"G,,/.test(rock), 'zwei Akkorde im Takt');
      ok(/^% Verse/m.test(rock) && /^% Chorus/m.test(rock), 'Abschnitte als Kommentar');
      // Übernehmen über die Oberfläche; zweites Mal fragt nach
      await pg.click('summary >> text=Bassline bearbeiten'); await pg.selectOption('#bassStyle', 'walk'); await pg.click('[data-act=bassSuggest]');
      ok(/Walking/.test(await pg.evaluate(() => App.current().bassAbc))); await pg.waitForSelector('#abcOut svg');
      pg.once('dialog', d => d.dismiss()); await pg.selectOption('#bassStyle', 'country'); await pg.click('[data-act=bassSuggest]');
      ok(/Walking/.test(await pg.evaluate(() => App.current().bassAbc)), 'abgelehnt → unverändert');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
