// Akkordraster, Transponieren, ABC-Notenbild (abcjs lokal), Bass-Wiedergabe (Oszillator-Ersatz), Auftrittsmodus
const { launch, open } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  const bars = pg => pg.evaluate(() => [...document.querySelectorAll('#chordOut .bar')].map(e => e.textContent));
  try {
    await test('ABC-Rendering: Demo-Bassline als Notenbild im Bassschlüssel; Eingabe wird neu gesetzt', async () => {
      const pg = await open(b, D, { hash: '#/song/demo-blues' });
      await pg.waitForSelector('#abcOut svg');
      eq(await pg.evaluate(() => [typeof ABCJS.renderAbc, document.querySelectorAll('#abcOut .abcjs-note').length, [...document.querySelectorAll('#abcOut .abcjs-chord')].map(e => e.textContent.trim()).slice(0, 2)]), ['function', 24, ['A7', 'D7']]);
      eq((await bars(pg)).length, 12); eq((await bars(pg)).slice(0, 5), ['A7', 'A7', 'A7', 'A7', 'D7']);
      await pg.click('details:has(#abcIn) > summary');
      await pg.fill('#abcIn', 'X:1\nM:4/4\nL:1/4\nK:C clef=bass\nC,, E,, G,, C, |]');
      await pg.waitForFunction(() => document.querySelectorAll('#abcOut .abcjs-note').length === 4);
      await pg.click('details:has(#chordsIn) > summary'); await pg.fill('#chordsIn', 'Strophe\n| C | G/B | Am7 | F |'); 
      eq(await bars(pg), ['C', 'G/B', 'Am7', 'F']); eq(await pg.locator('#chordOut .sect').innerText(), 'STROPHE');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Transponieren: ± Halbtöne, ♯/♭, pro Song gespeichert; Notenbild und Wiedergabe folgen', async () => {
      const pg = await open(b, D, { hash: '#/song/demo-blues' });
      await pg.waitForSelector('#abcOut svg');
      eq(await pg.evaluate(() => [trToken('F#m7/C#', 2, false), trToken('Bb', -1, true), trToken('Fine', 2, false), trToken('N.C.', 2, false), trToken('%', 2, false), trBar('A7  D7', 3, false), trToken('Cmaj7', 1, true), trToken('Esus4', 1, false)]),
        ['G#m7/D#', 'A', 'Fine', 'N.C.', '%', 'C7  F7', 'Dbmaj7', 'Fsus4']);
      await pg.click('[data-act=tr][data-d="1"]');
      eq((await bars(pg)).slice(0, 5), ['Bb7', 'Bb7', 'Bb7', 'Bb7', 'Eb7'], '+1 von A → B♭ (♭-Schreibweise)');
      await pg.click('#bFlats'); eq((await bars(pg))[0], 'A#7', 'umgeschaltet auf ♯');
      await pg.click('[data-act=tr][data-d="1"]'); eq((await bars(pg))[8], 'F#7');
      eq(await pg.locator('#trOut').innerText(), '+2 HT');
      ok(/Tonart A → B/.test(await pg.locator('#sSub').innerText()), 'Tonart-Anzeige');
      eq(await pg.evaluate(() => [...document.querySelectorAll('#abcOut .abcjs-chord')][0].textContent.trim()), 'B7', 'Notenbild transponiert');
      eq(await pg.evaluate(() => Bass.visual.setUpAudio({ chordsOff: true, midiTranspose: Bass.tr }).tracks[0].filter(e => e.cmd === 'note')[0].pitch), 47, 'Wiedergabe +2 (A1=45 → 47)');
      await pg.waitForTimeout(100); await pg.reload(); await pg.waitForSelector('#abcOut svg');
      eq([await pg.evaluate(() => App.current().transpose), (await bars(pg))[0]], [2, 'B7'], 'gespeichert');
      eq(await pg.evaluate(() => App.current().chords.includes('| A7 |')), true, 'Eingabe bleibt in Originaltonart');
      await pg.click('#bTrReset'); eq([(await bars(pg))[0], await pg.locator('#trOut').innerText()], ['A7', 'Original']);
      for (let i = 0; i < 14; i++) await pg.click('[data-act=tr][data-d="-1"]');
      eq(await pg.evaluate(() => App.current().transpose), -11, 'begrenzt');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Bass anhören: ohne Soundfont (Netz gesperrt) spielt der Oszillator-Ersatz', async () => {
      const pg = await open(b, D, { hash: '#/song/demo-blues' });
      await pg.waitForSelector('#abcOut svg'); await pg.click('#bBass');
      await pg.waitForFunction(() => Bass.playing && Bass.oscNodes.length === 24, null, { timeout: 12000 });
      ok(/Stopp/.test(await pg.locator('#bBass').innerText()), 'Knopf zeigt Stopp');
      await pg.click('#bBass'); eq(await pg.evaluate(() => [Bass.playing, Bass.oscNodes.length]), [false, 0]);
      eq(pg.errs, []); await pg.context().close();
    });
    await test('Auftrittsmodus: Vollbild-Akkordraster, Tasten und Wischen, Bildschirm wach, Beenden', async () => {
      const pg = await open(b, D);
      const order = await pg.evaluate(() => { const s = Store.get('seed-02'); s.chords = '| C | G |'; s.transpose = 2; s.notes = 'Orgel'; Store.touch(s); return Store.setlist().map(x => x.title); });
      await pg.click('#listBar [data-act=stage]'); await pg.waitForSelector('.stage');
      const st = () => pg.evaluate(() => [document.querySelector('#stagePos').textContent, document.querySelector('.stage h1').textContent]);
      eq(await st(), ['1 / 12', order[0]]);
      ok(await pg.evaluate(() => window.__wake.req >= 1 && document.body.classList.contains('stage-on')), 'Wake Lock angefordert');
      await pg.keyboard.press('ArrowRight'); eq(await st(), ['2 / 12', order[1]]);
      eq(await pg.evaluate(() => [[...document.querySelectorAll('#stageChords .bar')].map(e => e.textContent), document.querySelector('.snotes').textContent]), [['D', 'A'], 'Orgel'], 'transponiert + Notizen');
      await pg.keyboard.press('PageDown'); eq((await st())[0], '3 / 12');
      await pg.keyboard.press('ArrowLeft'); eq((await st())[0], '2 / 12');
      // Wischen nach links = nächster Song
      const swipe = (x0, x1) => pg.evaluate(([a, c]) => { const el = document.querySelector('#stage'); const mk = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 });
        el.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(a)], changedTouches: [mk(a)], bubbles: true })); el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk(c)], bubbles: true })); }, [x0, x1]);
      await swipe(600, 300); eq((await st())[0], '3 / 12'); await swipe(300, 600); eq((await st())[0], '2 / 12');
      await swipe(300, 320); eq((await st())[0], '2 / 12', 'kurzes Tippen wechselt nicht');
      await pg.click('[data-act=stageNext]'); eq((await st())[0], '3 / 12');
      const fs = await pg.evaluate(() => getComputedStyle(document.querySelector('#stageChords')).fontSize);
      await pg.click('[data-act=stageZoom][data-d="0.15"]'); ok(parseFloat(await pg.evaluate(() => getComputedStyle(document.querySelector('#stageChords')).fontSize)) > parseFloat(fs), 'A+ vergrössert');
      for (let i = 0; i < 12; i++) await pg.keyboard.press('ArrowRight'); eq((await st())[0], '12 / 12', 'am Ende bleibt der letzte Song');
      await pg.keyboard.press('Escape'); await pg.waitForSelector('#songList');
      ok(await pg.evaluate(() => window.__wake.rel >= 1 && !document.body.classList.contains('stage-on')), 'Wake Lock freigegeben');
      // aus einem Song ausserhalb der Setlist: nur dieser Song
      await pg.goto(pg.url().replace(/#.*/, '') + '#/song/demo-blues'); await pg.waitForSelector('#abcOut svg');
      await pg.click('section[data-pane=noten] [data-act=stage]'); await pg.waitForSelector('.stage'); eq((await st())[0], '1 / 1');
      eq(await pg.locator('#stageChords .bar').count(), 12);
      await pg.click('[data-act=stageExit]'); await pg.waitForSelector('#sTitle');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Akkordfolge ohne Taktstriche («A – D/F# G (x2)») wird erkannt und transponiert; Hinweise bleiben Text (v1.2.2)', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-06' }); await pg.waitForSelector('#sTitle');
      await pg.evaluate(() => { const s = App.current(); s.chords = '[Intro]\nA – D/F# G – D/F# A (x2)\n[Solo]\nÜber Verse-Folge\n[Outro]\nA – D/A G (wiederholen)'; s.transpose = 0; Store.touch(s); UI.chords(); });
      const view = () => pg.evaluate(() => [[...document.querySelectorAll('.chordview .fc')].map(e => e.textContent).join(' '), [...document.querySelectorAll('.chordview .sect')].map(e => e.textContent), [...document.querySelectorAll('.chordview .cnote')].map(e => e.textContent), [...document.querySelectorAll('.chordview .rep')].map(e => e.textContent)]);
      eq(await view(), ['A D/F# G D/F# A A D/A G', ['Intro', 'Solo', 'Outro'], ['Über Verse-Folge', '(wiederholen)'], ['×2']]);
      await pg.evaluate(() => { const s = App.current(); s.transpose = 3; Store.touch(s); UI.chords(); });
      eq((await view())[0], 'C F/A A# F/A C C F/C A#', 'Ziel C-Dur → ♯-Schreibweise');
      await pg.evaluate(() => { const s = App.current(); s.flats = true; Store.touch(s); UI.chords(); });
      eq((await view())[0], 'C F/A Bb F/A C C F/C Bb', '♭ umgeschaltet');
      eq(pg.errs, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
