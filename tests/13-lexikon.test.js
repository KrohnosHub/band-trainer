// v1.7.0: Akkord-Lexikon (alle Typen, richtige Schreibweise, Grundton wählbar) und Töne an den Akkord-Kacheln (Tooltip + Antippen)
const { launch, open } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  try {
    await test('Schreibweise der Töne nach Stufen (auch vermindert/übermässig, Kreuz-/Be-Tonarten, Doppel-Be)', async () => {
      const pg = await open(b, D);
      const r = await pg.evaluate(() => ['C', 'Am', 'Ebm', 'F#', 'Bb7', 'Cdim', 'Cdim7', 'Bdim', 'Caug', 'Gsus4', 'Dsus2', 'Am7b5', 'C#m7', 'Fmaj7', 'E7#9', 'Abadd9', 'C6/9', 'D/F#', 'Gfoo'].map(c => { const i = chordInfo(c); return i ? i.notes.join(' ') + (i.bass ? '/' + i.bass : '') : null; }));
      eq(r, ['C E G', 'A C E', 'E♭ G♭ B♭', 'F♯ A♯ C♯', 'B♭ D F A♭', 'C E♭ G♭', 'C E♭ G♭ B𝄫', 'B D F', 'C E G♯', 'G C D', 'D E A', 'A C E♭ G', 'C♯ E G♯ B', 'F A C E', 'E G♯ B D F𝄪', 'A♭ C E♭ B♭', 'C E G A D', 'D F♯ A/F♯', null]);
      eq(await pg.evaluate(() => [chordType('min7').q, chordType('°').q, chordType('ø').q, chordType('M7').q, chordType('+').q]), ['m7', 'dim', 'm7b5', 'maj7', 'aug']);
      await pg.context().close();
    });
    await test('Lexikon: aus der Liste erreichbar, alle Akkordtypen, Grundton wechseln, Klaviatur per Antippen, zurück', async () => {
      const pg = await open(b, { width: 390, height: 844 });
      await pg.click('header [data-act=lexicon]'); await pg.waitForSelector('table.lex');
      eq(await pg.evaluate(() => document.querySelectorAll('table.lex tr[data-act=lexRow]').length), await pg.evaluate(() => CHORD_TYPES.length));
      const row = name => pg.evaluate(n => { const tr = [...document.querySelectorAll('table.lex tr[data-act=lexRow]')].find(t => t.querySelector('.small').textContent === n); return tr && [tr.querySelector('b').textContent, tr.querySelector('.ln').textContent]; }, name);
      eq(await row('Dur'), ['C', 'C E G']); eq(await row('vermindert'), ['Cdim', 'C E♭ G♭']); eq(await row('halbvermindert'), ['Cm7b5', 'C E♭ G♭ B♭']);
      await pg.click('[data-act=lexRoot][data-r=Eb]'); eq(await row('Moll'), ['E♭m', 'E♭ G♭ B♭']); eq(await row('Dominantseptakkord'), ['E♭7', 'E♭ G B♭ D♭']);
      ok(!(await pg.locator('table.lex tr.lexk').first().isVisible()), 'Klaviatur zu'); await pg.click('table.lex tr[data-act=lexRow] >> nth=0');
      ok(await pg.locator('table.lex tr.lexk').first().isVisible(), 'Klaviatur offen'); eq(await pg.locator('table.lex tr.lexk >> nth=0 >> .k.on').count(), 3);
      eq(await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 0), true, 'nichts läuft seitlich über');
      await pg.click('[data-act=back]'); await pg.waitForSelector('#songList');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Akkord-Kacheln: Tooltip mit Tönen (Maus), Antippen zeigt Töne + Klaviatur, auch transponiert und bei Folgen ohne Taktstriche; zweiter Tipp schliesst', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-05' }); await pg.waitForSelector('#sTitle');
      await pg.evaluate(() => { const s = App.current(); s.chords = '| C Cdim7 | Am7b5 |\nF – G7'; s.transpose = 0; Store.touch(s); UI.chords(); });
      eq(await pg.evaluate(() => [...document.querySelectorAll('#chordOut [data-ch]')].map(e => e.title)), ['C: C E G (Dur)', 'Cdim7: C E♭ G♭ B𝄫 (vermindert mit verminderter Septime)', 'Am7b5: A C E♭ G (halbvermindert)', 'F: F A C (Dur)', 'G7: G B D F (Dominantseptakkord)']);
      await pg.click('#chordOut [data-ch=Cdim7]'); await pg.waitForSelector('#chordPop');
      ok(/C – E♭ – G♭ – B𝄫/.test(await pg.locator('#chordPop').innerText()), 'Töne'); eq(await pg.locator('#chordPop .k.on').count(), 4);
      await pg.click('#chordOut [data-ch=Cdim7]'); eq(await pg.locator('#chordPop').count(), 0, 'zweiter Tipp schliesst');
      await pg.click('#chordOut [data-ch=G7]'); await pg.click('#sTitle'); eq(await pg.locator('#chordPop').count(), 0, 'Klick daneben schliesst');
      await pg.evaluate(() => { const s = App.current(); s.transpose = 3; Store.touch(s); UI.chords(); });
      eq(await pg.evaluate(() => document.querySelector('#chordOut [data-ch]').title), 'Eb: E♭ G B♭ (Dur)');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
