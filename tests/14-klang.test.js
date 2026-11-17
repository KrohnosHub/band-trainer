// v1.8.0: Akkorde anhören – Klavier/Orgel (Samples), Gitarre, Hammond; Lexikon, Antipp-Fenster, Voicing-Karten
const { launch, open } = require('./fixture.js');
const fs = require('fs'), path = require('path');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  try {
    await test('Sample-Zuordnung: jede Orgelnote A1–E♭6 und jedes Klavier-Rastersample existiert als Datei, Lizenzen liegen bei', async () => {
      const pg = await open(b, D);
      const files = await pg.evaluate(() => { const o = new Set(); for (let m = 21; m <= 108; m++) { o.add(Sound.smpFile('organ', m).url); o.add(Sound.smpFile('piano', m).url); } return [...o]; });
      const root = path.join(__dirname, '..');
      eq(files.filter(f => !fs.existsSync(path.join(root, f))), [], 'fehlende Dateien');
      ok(files.filter(f => /organ/.test(f)).length === 55 && files.filter(f => /piano/.test(f)).length === 21);
      ok(fs.existsSync(path.join(root, 'samples/piano/LICENSE.txt')) && fs.existsSync(path.join(root, 'samples/organ/LICENSE.txt')));
      eq(await pg.evaluate(() => [Sound.smpFile('piano', 61).base, Sound.smpFile('organ', 61).url]), [60, 'samples/organ/Db4.mp3']);
      await pg.context().close();
    });
    await test('Lexikon: Klang wählen (gemerkt), ▶ spielt den Akkord – Samples werden geladen, Stimmen entstehen, ohne Fehler; Zeile klappt dabei nicht auf', async () => {
      const pg = await open(b, D, { hash: '#/akkorde' }); await pg.waitForSelector('table.lex');
      await pg.evaluate(() => { window.__notes = []; const n0 = Sound.note.bind(Sound); Sound.note = (i, m, t, d, v) => { window.__notes.push([i, m]); return n0(i, m, t, d, v); }; });
      for (const inst of ['piano', 'organ', 'guitar', 'hammond']) {
        await pg.evaluate(() => { window.__notes = []; }); await pg.click(`[data-act=inst][data-i=${inst}]`); await pg.waitForFunction(() => window.__notes.length >= 3); await pg.waitForTimeout(100); await pg.evaluate(() => { window.__notes = []; });
        await pg.click('table.lex tr[data-act=lexRow] >> nth=14 >> [data-act=playCh]');   // dim7
        await pg.waitForFunction(n => window.__notes.length >= n, 8);
        const ns = await pg.evaluate(() => window.__notes);
        eq(ns.slice(0, 4).map(x => x[1]), [60, 63, 66, 69], inst + ': Cdim7'); ok(ns.every(x => x[0] === inst), inst + ': Klang');
      }
      eq(await pg.evaluate(() => Sound.inst()), 'hammond'); ok(await pg.evaluate(() => Sound.smp.piano.size >= 3 && Sound.smp.organ.size >= 4), 'Samples geladen');
      eq(await pg.locator('table.lex tr.open').count(), 0, 'Zeile bleibt zu');
      await pg.uncheck('#arpIn'); await pg.evaluate(() => { window.__notes = []; }); await pg.click('table.lex tr[data-act=lexRow] >> nth=0 >> [data-act=playCh]'); await pg.waitForTimeout(200);
      eq(await pg.evaluate(() => window.__notes.length), 3, 'ohne Arpeggio nur der Akkord');
      await pg.reload(); await pg.waitForSelector('table.lex'); ok(await pg.locator('[data-act=inst][data-i=hammond].on').count() === 1 && !(await pg.isChecked('#arpIn')), 'gemerkt');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Antipp-Fenster und Voicing-Karten: ▶ spielt Akkord inkl. Slash-Bass, Hammond nutzt die Registerzüge des Songs', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-05' }); await pg.waitForSelector('#sTitle');
      await pg.evaluate(() => { LS.set('instr', 'hammond'); LS.set('arp', '0'); const s = App.current(); s.chords = '| D/F# | G |'; s.transpose = 0; s.sound.drawbars = '808000008'; Store.touch(s); UI.chords();
        window.__notes = []; const n0 = Sound.note.bind(Sound); Sound.note = (i, m, t, d, v) => { window.__notes.push(m); return n0(i, m, t, d, v); }; });
      await pg.click('#chordOut [data-ch="D/F#"]'); await pg.click('#chordPop [data-act=playCh]'); await pg.waitForTimeout(150);
      eq(await pg.evaluate(() => window.__notes), [54, 62, 66, 69], 'F#3 im Bass + D-Dur'); ok(await pg.locator('#chordPop').isVisible(), 'Fenster bleibt offen');
      eq(await pg.evaluate(() => Sound.drawbars), '808000008');
      await pg.click('#vDet summary'); await pg.waitForSelector('#voiceOut .vplay'); await pg.evaluate(() => { window.__notes = []; });
      await pg.click('#voiceOut .vc:nth-child(2) .vplay'); await pg.waitForTimeout(150);
      const ns = await pg.evaluate(() => window.__notes); eq(ns[0] % 12, 7, 'Bass G'); eq(ns.length, 4);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
