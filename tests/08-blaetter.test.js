// v1.1.0: Notenblätter (PDF über pdf.js, Bild), Freihand-Notizen, Drive-Abgleich (Attrappe), Abschnitte im Akkordraster,
// Quellen-Links, Akkord-Import mit unscharfer Zuordnung, Notenblatt im Auftrittsmodus
const { launch, open, pdf, png, FakeDrive } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 }, M = { width: 390, height: 844 };
  const signIn = async pg => { await pg.click('[data-act=menu]'); await pg.click('[data-act=signIn]'); await pg.waitForFunction(() => !!localStorage.getItem('bt_libId')); await pg.settle(); await pg.click('#dlg [data-act=close]'); };
  const toSheets = async (pg, id) => { await pg.evaluate(i => { location.hash = '#/song/' + i; }, id); await pg.waitForSelector('#sTitle'); await pg.click('[data-act=tab][data-tab=blaetter]'); };
  const addFile = async (pg, file, kind, label) => {
    const n = await pg.evaluate(() => liveSheets(App.current()).length);
    await pg.evaluate(() => { document.querySelector('#sheetAdd').open = true; });
    await pg.selectOption('#shKind', kind || 'lead'); await pg.fill('#shLabel', label || '');
    await pg.setInputFiles('#sheetFile', file); await pg.waitForFunction(c => liveSheets(App.current()).length > c, n);
  };
  // auf eine asynchrone Bedingung in der Seite warten (waitForFunction wartet Promises nicht verlässlich ab)
  const until = async (pg, fn, arg, ms = 10000) => { const t0 = Date.now(); for (;;) { if (await pg.evaluate(fn, arg)) return; if (Date.now() - t0 > ms) throw new Error('until: Zeit abgelaufen'); await pg.waitForTimeout(50); } };
  const rendered = (pg, page) => pg.waitForFunction(p => Viewer.el && Viewer.ready && Viewer.pageCv && Viewer.el.dataset.page === String(p), page, { timeout: 20000 });
  // Anteil dunkler Bildpunkte des gerenderten Blatts (Text/Balken vorhanden?) und Farbe an einer Stelle der Notiz-Ebene
  const dark = pg => pg.evaluate(() => { const c = document.querySelector('#vBase'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] < 90 && d[i + 1] < 90 && d[i + 2] < 90) n++; return n; });
  const inkAt = (pg, fx, fy) => pg.evaluate(([x, y]) => { const c = document.querySelector('#vInk'); return [...c.getContext('2d').getImageData(Math.round(c.width * x), Math.round(c.width * y), 1, 1).data]; }, [fx, fy]);
  const draw = async (pg, pts) => {   // Strich in Seitenbreiten-Koordinaten mit der Maus ziehen
    const r = await pg.locator('#vInk').boundingBox(), xy = p => [r.x + p[0] * r.width, r.y + p[1] * r.width];
    await pg.mouse.move(...xy(pts[0])); await pg.mouse.down();
    for (const p of pts.slice(1)) await pg.mouse.move(...xy(p), { steps: 4 });
    await pg.mouse.up();
  };
  const annOf = (pg, song, id) => pg.evaluate(async ([s, i]) => { const r = await IDB.get(annKey(s, i)); return r ? { u: r.u, pages: Object.fromEntries(Object.entries(r.data.pages).map(([k, v]) => [k, v.map(o => [o.hl ? 'hl' : 'pen', o.c, o.p.length > 1])])) } : null; }, [song, id]);
  try {
    await test('Notenblätter: PDF (pdf.js lokal) und Bild hochladen, Typ/Bezeichnung, Seiten per Taste/Knopf/Wischen, Zoom, Seitenbreite; bleibt nach Neuladen', async () => {
      const pg = await open(b, D);
      await toSheets(pg, 'seed-01');
      ok(/urheberrechtlich geschützt/.test(await pg.locator('section[data-pane=blaetter]').innerText()), 'Hinweistext Urheberrecht');
      await addFile(pg, { name: 'Leadsheet Test.pdf', mimeType: 'application/pdf', buffer: pdf(2) }, 'lead', '');
      await addFile(pg, [{ name: 'scan1.png', mimeType: 'image/png', buffer: png() }, { name: 'foto2.png', mimeType: 'image/png', buffer: png(80, 60) }], 'piano', 'Klavier');
      const meta = await pg.evaluate(() => liveSheets(App.current()).map(m => [m.name, m.kind, m.type, m.file]));
      eq(meta, [['Leadsheet Test', 'lead', 'application/pdf', 'Leadsheet Test.pdf'], ['Klavier 1', 'piano', 'image/png', 'scan1.png'], ['Klavier 2', 'piano', 'image/png', 'foto2.png']]);
      eq(await pg.locator('#sheetList .sheet').count(), 3);
      ok(/Leadsheet \/ Akkorde/.test(await pg.locator('#sheetList .sheet').first().innerText()) && /PDF · 1 KB · nur auf diesem Gerät/.test(await pg.locator('#sheetList .sheet').first().innerText()), 'Listeneintrag');
      // falscher Dateityp wird abgelehnt
      await pg.setInputFiles('#sheetFile', { name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }); await pg.waitForTimeout(150);
      eq(await pg.evaluate(() => liveSheets(App.current()).length), 3);
      // PDF öffnen: zwei Seiten, Inhalt gerendert
      await pg.locator('#sheetList [data-act=sheetOpen]').first().click(); await rendered(pg, 1);
      eq(await pg.evaluate(() => [typeof pdfjsLib.getDocument, Viewer.pages, document.querySelector('#vPos').textContent, document.querySelector('#vBase').width > 600]), ['function', 2, '1 / 2', true]);
      ok(await dark(pg) > 300, 'Seite 1 enthält Text/Balken: ' + await dark(pg));
      await pg.keyboard.press('ArrowRight'); await rendered(pg, 2); eq(await pg.locator('#vPos').innerText(), '2 / 2');
      await pg.keyboard.press('ArrowRight'); eq(await pg.evaluate(() => Viewer.page), 2, 'am Ende bleibt die letzte Seite');
      await pg.click('#vPrev'); await rendered(pg, 1); ok(await pg.locator('#vPrev').isDisabled(), 'erste Seite: zurück gesperrt');
      // Zoom und Seitenbreite / ganze Seite
      const w = () => pg.evaluate(() => document.querySelector('#vStack').getBoundingClientRect().width);
      const w0 = await w(); ok(Math.abs(w0 - await pg.evaluate(() => document.querySelector('#vWrap').clientWidth)) < 3, 'Seitenbreite füllt die Breite');
      await pg.click('[data-act=vZoom][data-d="1"]'); await pg.waitForFunction(x => document.querySelector('#vStack').getBoundingClientRect().width > x * 1.2, w0);
      await pg.click('#vFit'); await pg.waitForFunction(() => { const s = document.querySelector('#vStack').getBoundingClientRect(), wr = document.querySelector('#vWrap'); return s.height <= wr.clientHeight + 2 && s.width < wr.clientWidth * 0.8; });
      eq(await pg.locator('#vFit').innerText(), 'Ganze Seite');
      await pg.click('#vFit'); await pg.waitForFunction(x => Math.abs(document.querySelector('#vStack').getBoundingClientRect().width - x) < 3, w0);
      await pg.keyboard.press('Escape'); eq(await pg.locator('#viewer').count(), 0, 'Esc schliesst');
      // Bild öffnen
      await pg.locator('#sheetList [data-act=sheetOpen]').nth(1).click(); await rendered(pg, 1);
      eq(await pg.evaluate(() => [Viewer.pages, !!Viewer.img, Math.round(100 * Viewer.pageCv.height / Viewer.pageCv.width)]), [1, true, 133]);
      ok(await dark(pg) > 50, 'Bild gerendert');
      await pg.click('[data-act=vClose]');
      // Bearbeiten: Bezeichnung/Typ, fürs Auftreten wählen
      await pg.locator('#sheetList [data-act=sheetEdit]').nth(2).click(); await pg.fill('#sheetForm [name=name]', 'Bass <b>Tabs</b>'); await pg.selectOption('#sheetForm [name=kind]', 'bass'); await pg.check('#sheetForm [name=stage]'); await pg.click('#sheetForm [type=submit]');
      const row = await pg.locator('#sheetList .sheet').nth(2).innerText(); ok(/Bass <b>Tabs<\/b>/.test(row) && /Bassnoten \/ Tabs/.test(row) && /Auftritt/.test(row), 'bearbeitet, HTML nicht ausgeführt: ' + row);
      await pg.waitForTimeout(100); await pg.reload(); await pg.waitForSelector('#sTitle'); await pg.click('[data-act=tab][data-tab=blaetter]');
      eq(await pg.locator('#sheetList .sheet').count(), 3, 'nach Neuladen noch da');
      await pg.locator('#sheetList [data-act=sheetOpen]').first().click(); await rendered(pg, 1); eq(await pg.evaluate(() => Viewer.pages), 2, 'Datei aus IndexedDB');
      await pg.click('[data-act=vClose]');
      // Entfernen → Löschmarke, Datei weg
      const id3 = await pg.evaluate(() => liveSheets(App.current())[2].id);
      pg.once('dialog', d => d.accept()); await pg.locator('#sheetList [data-act=sheetEdit]').nth(2).click(); await pg.click('#dlg [data-act=sheetDel]');
      await pg.waitForFunction(() => liveSheets(App.current()).length === 2);
      eq(await pg.evaluate(async i => { const s = App.current(); return [s.sheets.find(x => x.id === i).deleted, s.stageSheet, (await IDB.get(sheetKey(s.id, i))) || null]; }, id3), [true, '', null]);
      await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForSelector('#songList'); eq(await pg.locator('#songList li[data-id=seed-01] .badge').count(), 0, 'Übersicht ohne Indikatoren (v1.3.0)');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Handy (390×844): Tab «Blätter» und Notenblatt laufen nicht über; Wischen blättert', async () => {
      const pg = await open(b, M); await toSheets(pg, 'seed-02');
      await addFile(pg, { name: 'a.pdf', mimeType: 'application/pdf', buffer: pdf(3) }, 'lead', 'Ein ziemlich langer Name für ein Leadsheet der Band');
      const over = () => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(await over() <= 0, 'Tab zu breit: ' + await over());
      await pg.click('#sheetList [data-act=sheetOpen]'); await rendered(pg, 1);
      ok(await pg.evaluate(() => document.querySelector('#viewer .vbar').scrollWidth <= window.innerWidth && document.querySelector('#vStack').getBoundingClientRect().width <= window.innerWidth), 'Anzeige passt in die Breite');
      const swipe = (x0, x1) => pg.evaluate(([a, c]) => { const el = document.querySelector('#vWrap'); const mk = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 });
        el.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(a)], changedTouches: [mk(a)], bubbles: true })); el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk(c)], bubbles: true })); }, [x0, x1]);
      await swipe(300, 80); await rendered(pg, 2); await swipe(80, 300); await rendered(pg, 1); await swipe(200, 220); eq(await pg.evaluate(() => Viewer.page), 1);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Freihand-Notizen: Stift, Marker, Radierer, Rückgängig – pro Seite gespeichert und nach Neuladen wieder da', async () => {
      const pg = await open(b, D); await toSheets(pg, 'seed-01');
      await addFile(pg, { name: 'noten.pdf', mimeType: 'application/pdf', buffer: pdf(2) }, 'piano', 'Noten');
      const id = await pg.evaluate(() => liveSheets(App.current())[0].id);
      await pg.click('#sheetList [data-act=sheetOpen]'); await rendered(pg, 1);
      // im Lese-Modus zeichnet die Maus nicht
      await draw(pg, [[0.2, 0.2], [0.6, 0.2]]); eq(await pg.evaluate(() => Object.keys(Viewer.ann.pages).length), 0);
      await pg.click('[data-act=vTool][data-tool=pen]'); eq(await pg.locator('#vCols .col').count(), 4);
      await draw(pg, [[0.2, 0.2], [0.6, 0.2]]);
      eq((await inkAt(pg, 0.4, 0.2)).slice(0, 3), [211, 47, 47], 'roter Stiftstrich sichtbar');
      await pg.click('#vCols .col[data-c="#1565c0"]'); await draw(pg, [[0.2, 0.4], [0.6, 0.4]]);
      await pg.click('[data-act=vTool][data-tool=hl]'); await draw(pg, [[0.2, 0.3], [0.6, 0.3]]);
      eq((await inkAt(pg, 0.4, 0.3))[3], 0, 'Marker liegt nicht auf der Stift-Ebene, sondern im Blatt');
      ok(await pg.evaluate(() => { const c = document.querySelector('#vBase'), d = c.getContext('2d').getImageData(Math.round(c.width * 0.4), Math.round(c.width * 0.3), 1, 1).data; return d[0] > 200 && d[2] < 200; }), 'Marker gelb im Blatt');
      // Seite 2: eigener Strich
      await pg.click('#vNext'); await rendered(pg, 2); await pg.click('[data-act=vTool][data-tool=pen]'); await draw(pg, [[0.3, 0.3], [0.5, 0.5]]);
      await until(pg, async i => { const r = await IDB.get(annKey('seed-01', i)); return r && r.data.pages['2']; }, id);
      eq((await annOf(pg, 'seed-01', id)).pages, { 1: [['pen', '#d32f2f', true], ['pen', '#1565c0', true], ['hl', '#ffe14d', true]], 2: [['pen', '#1565c0', true]] });
      eq(await pg.evaluate(() => JSON.parse(localStorage.getItem('bt_annDirty'))), ['seed-01|' + id], 'für den Abgleich vorgemerkt');
      // Radierer entfernt den ganzen Strich, Rückgängig holt ihn zurück
      await pg.click('#vPrev'); await rendered(pg, 1); await pg.click('[data-act=vTool][data-tool=eraser]'); await draw(pg, [[0.4, 0.15], [0.4, 0.25]]);
      eq(await pg.evaluate(() => Viewer.ann.pages['1'].length), 2); eq((await inkAt(pg, 0.4, 0.2))[3], 0, 'Strich weg');
      await pg.click('#vUndo'); eq(await pg.evaluate(() => Viewer.ann.pages['1'].map(o => o.c)), ['#d32f2f', '#1565c0', '#ffe14d'], 'an alter Stelle zurück');
      await pg.click('[data-act=vTool][data-tool=eraser]'); await draw(pg, [[0.4, 0.35], [0.4, 0.45]]);
      await pg.click('[data-act=vClose]'); await pg.waitForTimeout(150);
      await pg.reload(); await pg.waitForSelector('#sTitle'); await pg.click('[data-act=tab][data-tab=blaetter]');
      await pg.click('#sheetList [data-act=sheetOpen]'); await rendered(pg, 1);
      eq(await pg.evaluate(() => [Viewer.ann.pages['1'].map(o => o.c), Viewer.ann.pages['2'].length]), [['#d32f2f', '#ffe14d'], 1], 'geladen');
      eq((await inkAt(pg, 0.4, 0.2)).slice(0, 3), [211, 47, 47], 'Strich nach Neuladen gezeichnet');
      // unbrauchbare Daten werden beim Laden verworfen
      eq(await pg.evaluate(() => { const a = cleanAnn({ u: 5, pages: { 1: [{ p: [[0.1, 0.1], ['x', 2], [0.2, 0.2]], c: 'red;evil', w: 99 }, { p: 'nix' }], 'böse': [{ p: [[0, 0]] }], 0: [] } }); return [Object.keys(a.pages), a.pages['1'].length, a.pages['1'][0].p.length, a.pages['1'][0].c, a.pages['1'][0].w]; }), [['1'], 1, 2, '#d32f2f', 0.08]);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Drive (Attrappe): Blätter und Notizen-JSON im Unterordner «Notenblätter», zweites Gerät lädt beides, neuerer Notizen-Stand gewinnt, Entfernen räumt auf', async () => {
      const drive = new FakeDrive(), body = pdf(2);
      const A = await open(b, D, { drive }); await signIn(A);
      eq(drive.byName('Notenblätter').length, 0, 'Ordner entsteht erst mit dem ersten Blatt');
      await toSheets(A, 'seed-03'); await addFile(A, { name: 'lead sheet.pdf', mimeType: 'application/pdf', buffer: body }, 'lead', 'Lead');
      const id = await A.evaluate(() => liveSheets(App.current())[0].id);
      await A.click('#sheetList [data-act=sheetOpen]'); await rendered(A, 1); await A.click('[data-act=vTool][data-tool=pen]'); await draw(A, [[0.2, 0.2], [0.6, 0.2]]); await A.click('[data-act=vClose]');
      await A.waitForFunction(i => { const m = liveSheets(Store.get('seed-03')).find(x => x.id === i); return m && m.driveId && m.annId; }, id, { timeout: 10000 }); await A.settle();
      const root = drive.byName('Band-Trainer')[0], nf = drive.byName('Notenblätter'); eq([nf.length, nf[0].parents[0]], [1, root.id]);
      const inF = () => drive.live(f => f.parents[0] === nf[0].id).map(f => f.name).sort();
      eq(await inF(), ['seed-03__' + id + '.annotations.json', 'seed-03__' + id + '__lead sheet.pdf']);
      ok(Buffer.compare(drive.byName('seed-03__' + id + '__lead sheet.pdf')[0].body, body) === 0, 'PDF unverändert in Drive');
      const aj = drive.json('seed-03__' + id + '.annotations.json'); eq([aj.app, aj.kind, aj.pages['1'].length, aj.pages['1'][0].c], ['band-trainer', 'annotations', 1, '#d32f2f']);
      const libM = drive.json('library.json').songs.find(s => s.id === 'seed-03').sheets[0]; eq([libM.name, libM.kind, !!libM.driveId, !!libM.annId, libM.au === aj.u], ['Lead', 'lead', true, true, true]);
      eq(await A.evaluate(() => [localStorage.getItem('bt_annDirty'), localStorage.getItem('bt_dirty')]), [null, null], 'nichts mehr offen');
      ok(/✓ in Drive/.test(await A.locator('#sheetList .sheet').innerText()), 'Anzeige «in Drive»');
      const up = drive.log.filter(l => /^(PATCH|POST|PUT) \/upload/.test(l)).length; await A.syncNow(); eq(drive.log.filter(l => /^(PATCH|POST|PUT) \/upload/.test(l)).length, up, 'Abgleich ohne Änderung lädt nichts hoch');
      // Gerät B: Blatt + Notizen kommen beim Abgleich
      const B = await open(b, D, { drive }); await signIn(B);
      await until(B, async i => !!(await IDB.get(sheetKey('seed-03', i))) && !!(await IDB.get(annKey('seed-03', i))), id); await B.settle();
      eq(drive.byName('Notenblätter').length, 1, 'kein zweiter Ordner');
      await toSheets(B, 'seed-03'); await B.click('#sheetList [data-act=sheetOpen]'); await rendered(B, 1);
      eq(await B.evaluate(() => [Viewer.pages, Viewer.ann.pages['1'].length]), [2, 1]); eq((await inkAt(B, 0.4, 0.2)).slice(0, 3), [211, 47, 47], 'Strich von A auf B sichtbar');
      // B zeichnet dazu → A erhält den neueren Stand, auch im geöffneten Blatt
      await A.click('#sheetList [data-act=sheetOpen]'); await rendered(A, 1);
      await B.click('[data-act=vTool][data-tool=hl]'); await draw(B, [[0.2, 0.5], [0.6, 0.5]]);
      await until(B, async i => { const r = await IDB.get(annKey('seed-03', i)); return r && r.data.pages['1'].length === 2; }, id);
      await B.waitForFunction(() => !localStorage.getItem('bt_annDirty'), null, { timeout: 10000 }); await B.settle();
      eq(drive.live(f => /annotations\.json$/.test(f.name)).length, 1, 'Notizen-Datei wird ersetzt, nicht verdoppelt');
      await A.syncNow(); await A.waitForFunction(() => Viewer.ann.pages['1'] && Viewer.ann.pages['1'].length === 2, null, { timeout: 8000 });
      eq((await annOf(A, 'seed-03', id)).pages, { 1: [['pen', '#d32f2f', true], ['hl', '#ffe14d', true]] });
      // Merge-Regeln der Metadaten
      eq(await A.evaluate(() => { const m = mergeSheets([{ id: 'a', name: 'alt', u: 1, driveId: 'DRIVE1', au: 9, annId: 'ANN99' }, { id: 'b', name: 'B', u: 5 }], [{ id: 'a', name: 'neu', u: 2 }, { id: 'b', deleted: true, u: 6 }, { id: 'c', name: 'C', u: 1 }]);
        return m.map(x => [x.id, x.name || null, x.deleted || false, x.driveId || null, x.au || null]); }), [['a', 'neu', false, 'DRIVE1', 9], ['b', null, true, null, null], ['c', 'C', false, null, null]]);
      // B entfernt das Blatt → Drive-Dateien im Papierkorb, A verliert Datei und Anzeige
      await B.click('[data-act=vClose]'); B.once('dialog', d => d.accept()); await B.click('#sheetList [data-act=sheetEdit]'); await B.click('#dlg [data-act=sheetDel]'); await B.syncNow();
      eq(await inF(), [], 'Drive aufgeräumt');
      await A.syncNow(); await A.waitForFunction(() => !Viewer.el);
      eq(await A.evaluate(async i => [liveSheets(Store.get('seed-03')).length, (await IDB.get(sheetKey('seed-03', i))) || null, (await IDB.get(annKey('seed-03', i))) || null, document.querySelectorAll('#sheetList .sheet').length], id), [0, null, null, 0]);
      eq(A.errs, []); eq(B.errs, []); eq(A.csp, []); await A.context().close(); await B.context().close();
    });
    await test('Akkorde mit Abschnitten: [Intro]/[Verse], Wiederholung «(x4)», Transponieren, Quelle + Status als Badge, Auftrittsmodus', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-12' }); await pg.waitForSelector('#sTitle');
      eq(await pg.evaluate(() => parseChords('[Intro]\n| Bm A | E | Bm A | E |\n[Verse]\n| Bm A | E |  (x4)\nRefrain\n| D | A (x2) |\n[Solo] | G | D | 2x\n| C | x3 |\n\n[]\n')), [
        { t: 'sect', text: 'Intro' }, { t: 'bars', bars: ['Bm A', 'E', 'Bm A', 'E'], rep: '' }, { t: 'sect', text: 'Verse' }, { t: 'bars', bars: ['Bm A', 'E'], rep: '4' },
        { t: 'sect', text: 'Refrain' }, { t: 'bars', bars: ['D', 'A'], rep: '2' }, { t: 'sect', text: 'Solo' }, { t: 'bars', bars: ['G', 'D'], rep: '2' }, { t: 'bars', bars: ['C', 'x3'], rep: '' }]);
      await pg.click('details:has(#chordsIn) > summary'); await pg.fill('#chordsIn', '[Intro]\n| Bm A | E | Bm A | E |\n[Verse]\n| Bm A | E |  (x4)');
      const view = sel => pg.evaluate(s => [...document.querySelectorAll(s + ' > *')].map(e => e.classList.contains('sect') ? '§' + e.textContent : [...e.querySelectorAll('.bar')].map(x => x.textContent).join('|') + (e.querySelector('.rep') ? ' ' + e.querySelector('.rep').textContent : '')), sel);
      eq(await view('#chordOut'), ['§Intro', 'Bm A|E|Bm A|E', '§Verse', 'Bm A|E ×4']);
      ok(await pg.evaluate(() => { const s = getComputedStyle(document.querySelector('#chordOut .sect')), b = getComputedStyle(document.querySelector('#chordOut .bar')); return s.color !== b.color && parseInt(s.fontWeight, 10) >= 600 && parseFloat(s.borderLeftWidth) >= 2; }), 'Abschnitt hervorgehoben');
      await pg.click('[data-act=tr][data-d="1"]'); await pg.click('[data-act=tr][data-d="1"]');
      eq(await view('#chordOut'), ['§Intro', 'C#m B|F#|C#m B|F#', '§Verse', 'C#m B|F# ×4'], 'transponiert, Abschnitte und ×4 unverändert');
      eq(await pg.evaluate(() => [useFlats({ key: '', chords: '[A]\n| F | Bb |', flats: null }, 0), useFlats({ key: '', chords: '[F]\n| A | D |', flats: null }, 0)]), [true, false], 'Abschnittsname zählt nicht als Akkord');
      // Quelle + Status
      eq(await pg.locator('#chordMeta .badge').innerText(), 'Akkorde ungeprüft');
      await pg.fill('#chordSrc', 'javascript:alert(1)'); await pg.locator('#chordSrc').blur(); ok(!/^javascript/.test(await pg.evaluate(() => App.current().chordSource)), 'nur http(s)');
      await pg.fill('#chordSrc', 'https://www.example.org/tab/123'); await pg.locator('#chordSrc').blur(); await pg.selectOption('#chordStatus', 'checked');
      eq(await pg.evaluate(() => [document.querySelector('#chordMeta .badge').textContent, document.querySelector('#chordMeta .badge').className, document.querySelector('#chordMeta a').textContent, document.querySelector('#chordMeta a').href, document.querySelector('#chordMeta a').rel]), ['Akkorde geprüft', 'badge cs-ok', 'example.org', 'https://www.example.org/tab/123', 'noopener noreferrer']);
      await pg.waitForTimeout(650); await pg.reload(); await pg.waitForSelector('#sTitle');
      eq(await pg.evaluate(() => [App.current().chordSource, App.current().chordStatus, document.querySelector('#chordStatus').value, cleanSong({ id: 'x', title: 'X', chordSource: 'ftp://x', chordStatus: 'egal' }).chordStatus, cleanSong({ id: 'x', title: 'X', chordSource: 'ftp://x' }).chordSource]), ['https://www.example.org/tab/123', 'checked', 'checked', 'unchecked', '']);
      await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForSelector('#songList');
      eq(await pg.locator('#songList li[data-id=seed-12] .badge').count(), 0, 'Übersicht ohne Status-Badges (v1.3.0)');
      // Auftrittsmodus: Abschnitte gross
      await pg.evaluate(() => { location.hash = '#/stage/seed-12'; }); await pg.waitForSelector('#stageChords');
      eq(await view('#stageChords'), ['§Intro', 'C#m B|F#|C#m B|F#', '§Verse', 'C#m B|F# ×4']);
      ok(await pg.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#stageChords .sect')).fontSize) >= 18), 'Abschnitt im Auftritt gross: ' + await pg.evaluate(() => getComputedStyle(document.querySelector('#stageChords .sect')).fontSize));
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Quellen-Links: Hooktheory, Musicnotes, Sheet Music Direct (Google-Site-Suche), Ultimate Guitar', async () => {
      const pg = await open(b, D); await toSheets(pg, 'seed-05');
      const links = await pg.evaluate(() => [...document.querySelectorAll('#srcBox a')].map(a => [a.textContent.split(':')[0], a.href, a.target, a.rel]));
      eq(links.map(l => l[0]), ['Hooktheory TheoryTab', 'Musicnotes', 'Sheet Music Direct', 'Ultimate Guitar']);
      eq(links.map(l => l[1]), ['https://www.google.com/search?q=site%3Ahooktheory.com%2Ftheorytab%20Hotel%20California%20Eagles', 'https://www.google.com/search?q=site%3Amusicnotes.com%20Hotel%20California%20Eagles', 'https://www.google.com/search?q=site%3Asheetmusicdirect.com%20Hotel%20California%20Eagles', 'https://www.ultimate-guitar.com/search.php?search_type=title&value=Hotel%20California%20Eagles']);
      ok(links.every(l => l[2] === '_blank' && l[3] === 'noopener noreferrer'), 'neuer Tab, kein Referrer');
      eq(await pg.evaluate(() => sourceLinks({ title: 'A&B <x>', artist: '' })[0][1]), 'https://www.google.com/search?q=site%3Ahooktheory.com%2Ftheorytab%20A%26B%20%3Cx%3E');
      await toSheets(pg, 'demo-blues'); eq(await pg.locator('#srcBox a').count(), 0, 'Demo ohne Suchlinks');
      eq(pg.errs, []); await pg.context().close();
    });
    await test('Akkord-Import: unscharfe Zuordnung (Gross/Klein, Satzzeichen, «The», Abkürzung), Vorschau, nur die vier Felder werden überschrieben', async () => {
      const pg = await open(b, D);
      eq(await pg.evaluate(() => [normName("The Black Crowes"), normName("Sweet Child O' Mine (Live)"), normName('WHAT’S UP?'), normName('Old Time Rock & Roll') === normName('Old Time Rock N Roll'), normName('Free Falling') === normName('Free Fallin'), artistMatch('CCR', 'Creedence Clearwater Revival'), artistMatch('Guns N\' Roses', 'guns n roses'), artistMatch('Eagles', 'The Eagles'), artistMatch('Prince', ''), artistMatch('Prince', 'Eagles')]),
        ['black crowes', 'sweet child o mine', 'whats up', true, true, true, true, true, null, false]);
      await pg.evaluate(() => { for (const x of Store.data.songs) if (!x.isDemo) { x.chords = ''; x.key = ''; x.chordSource = ''; } Store.persist(); });   // Vorbelegung (v1.2.0) ausblenden
      await pg.evaluate(() => { const s = Store.get('seed-05'); s.chords = '| alt |'; s.notes = 'bleibt'; s.bpm = 75; Store.touch(s); });
      const file = { songs: [
        { title: 'hotel california', artist: 'The Eagles', key: 'Bm', chords: '[Intro]\n| Bm | F# |  (x2)', chordSource: 'https://example.org/hc', chordStatus: 'geprüft', notes: 'NICHT übernehmen', bpm: 200, id: undefined },
        { title: "What's Up?", artist: '4 non blondes', key: 'A', chords: ['[Verse]', '| A | Bm | D | A |'] },
        { title: 'HAVE YOU EVER SEEN THE RAIN?', artist: 'Creedence Clearwater Revival', key: 'C', chordSource: 'javascript:alert(1)' },
        { title: 'Imagine', artist: 'Jemand Anderes', chords: '| C | F |' },
        { title: 'Gibt es nicht', artist: 'Niemand', chords: '| C |' },
        { title: 'Heroes', artist: 'David Bowie' }, { artist: 'ohne Titel' }, 'kaputt'
      ] };
      await pg.click('[data-act=menu]');
      await pg.setInputFiles('#chordFile', { name: 'akkorde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
      await pg.waitForSelector('#impList');
      const rows = await pg.evaluate(() => [...document.querySelectorAll('#impList .imp')].map(r => { const c = r.querySelector('input'); return [c.checked, c.disabled, r.innerText.replace(/\s+/g, ' ').trim()]; }));
      eq(rows.length, 6); eq(rows.map(r => [r[0], r[1]]), [[true, false], [true, false], [true, false], [false, false], [false, true], [false, true]]);
      ok(/→ Hotel California \(Eagles\)/.test(rows[0][2]) && /Tonart: Bm/.test(rows[0][2]) && /Akkorde: 2 Takte, 1 Abschnitte \(ersetzt die vorhandenen\)/.test(rows[0][2]) && /Quelle: example\.org/.test(rows[0][2]) && /Status: geprüft/.test(rows[0][2]), rows[0][2]);
      ok(/→ What's Up \(4 Non Blondes\)/.test(rows[1][2]) && /Akkorde: 4 Takte/.test(rows[1][2]) && /Status/.test(rows[1][2]) === false, rows[1][2]);
      ok(/→ Have You Ever Seen the Rain \(CCR\)/.test(rows[2][2]) && /Tonart: C/.test(rows[2][2]) && !/Quelle/.test(rows[2][2]), rows[2][2]);
      ok(/Interpret weicht ab/.test(rows[3][2]), rows[3][2]); ok(/kein passender Song/.test(rows[4][2]), rows[4][2]); ok(/nichts zu tun/.test(rows[5][2]), rows[5][2]);
      ok(/6 Einträge in der Datei, 5 zugeordnet/.test(await pg.locator('#impInfo').innerText()), 'Übersicht');
      eq(await pg.locator('#impApply').innerText(), 'Übernehmen (3)');
      eq(await pg.evaluate(() => [Store.get('seed-05').key, Store.get('seed-05').chords]), ['', '| alt |'], 'vor dem Übernehmen nichts geändert');
      await pg.locator('#impList input').nth(1).uncheck(); eq(await pg.locator('#impApply').innerText(), 'Übernehmen (2)');
      await pg.click('#impApply'); await pg.waitForSelector('#songList');
      eq(await pg.evaluate(() => { const s = Store.get('seed-05'); return [s.key, s.chords, s.chordSource, s.chordStatus, s.notes, s.bpm, s.title, s.artist, s.status]; }), ['Bm', '[Intro]\n| Bm | F# |  (x2)', 'https://example.org/hc', 'checked', 'bleibt', 75, 'Hotel California', 'Eagles', 'setlist']);
      eq(await pg.evaluate(() => [Store.get('seed-13').key, Store.get('seed-13').chordSource, Store.get('seed-11').chords, Store.get('seed-15').chords, Store.data.songs.length]), ['C', '', '', '', 24], 'abgewählt/unsicher/unbekannt: nichts übernommen, kein neuer Song');
      // über «Import (JSON)» gewählt landet dieselbe Datei ebenfalls in der Vorschau; kaputte Datei → verständliche Meldung
      await pg.click('[data-act=menu]'); await pg.setInputFiles('#importFile', { name: 'akkorde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
      await pg.waitForSelector('#impList'); eq(await pg.locator('#impApply').innerText(), 'Übernehmen (1)'); await pg.click('#dlg [data-act=close]');
      await pg.setInputFiles('#chordFile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{nix') }); await pg.waitForFunction(() => /kein gültiges JSON/.test(document.querySelector('#toast').textContent));
      eq(await pg.evaluate(() => window.__xss), undefined); eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Auftrittsmodus mit Notenblatt: Akkordraster ODER Blatt wählbar, Tasten blättern erst die Seiten, dann zum nächsten Song', async () => {
      const pg = await open(b, D);
      const ids = await pg.evaluate(() => Store.setlist().map(s => s.id));
      await toSheets(pg, ids[0]); await addFile(pg, { name: 'eins.pdf', mimeType: 'application/pdf', buffer: pdf(2) }, 'lead', 'Blatt eins');
      const sid = await pg.evaluate(() => liveSheets(App.current())[0].id);
      await pg.evaluate(() => { const s = App.current(); s.chords = '[Intro]\n| C | G |'; Store.touch(s); });
      await pg.click('[data-act=tab][data-tab=noten]'); await pg.click('section[data-pane=noten] [data-act=stage]'); await pg.waitForSelector('.stage');
      eq(await pg.evaluate(() => [!!document.querySelector('#stageChords'), document.querySelector('#stageView').value, [...document.querySelectorAll('#stageView option')].map(o => o.textContent)]), [true, '', ['Akkordraster', 'Blatt eins']]);
      await pg.selectOption('#stageView', sid); await rendered(pg, 1);
      eq(await pg.evaluate(() => [App.current().stageSheet === liveSheets(App.current())[0].id, !!document.querySelector('#stageChords'), Viewer.stage, document.querySelectorAll('#viewer [data-act=vTool]').length, document.querySelector('#stagePos').textContent]), [true, false, true, 0, '1 / 12']);
      eq(await pg.evaluate(() => Viewer.fit), 'width', 'Standard Seitenbreite (v1.9.1)');
      await pg.click('#vFit');
      ok(await pg.waitForFunction(() => { const st = document.querySelector('#vStack').getBoundingClientRect(), nav = document.querySelector('.snav').getBoundingClientRect(); return st.height > 300 && st.bottom <= nav.top + 2 && document.documentElement.scrollHeight <= window.innerHeight + 2; }, null, { timeout: 8000 }), 'ganze Seite zwischen Kopf und Knöpfen');
      await pg.locator('#stageView').blur();
      await pg.keyboard.press('ArrowRight'); await rendered(pg, 2); eq(await pg.locator('#stagePos').innerText(), '1 / 12', 'erst Seite 2 des Blatts');
      await pg.keyboard.press('PageDown'); await pg.waitForFunction(i => App.songId === i, ids[1]); eq(await pg.evaluate(() => [document.querySelector('#stagePos').textContent, !!Viewer.el, !!document.querySelector('#stageChords'), !!document.querySelector('#stageView')]), ['2 / 12', false, true, false]);
      await pg.keyboard.press('ArrowLeft'); await rendered(pg, 2); eq(await pg.evaluate(() => [App.songId, Viewer.page]), [ids[0], 2], 'zurück landet auf der letzten Seite');
      await pg.keyboard.press('ArrowLeft'); await rendered(pg, 1);
      // ein Abgleich im Hintergrund lässt das Blatt auf seiner Seite stehen
      await pg.keyboard.press('ArrowRight'); await rendered(pg, 2); await pg.evaluate(() => App.refresh()); eq(await pg.evaluate(() => [Viewer.page, !!Viewer.el]), [2, true]);
      await pg.selectOption('#stageView', ''); await pg.waitForSelector('#stageChords'); eq(await pg.evaluate(() => [App.current().stageSheet, !!Viewer.el, document.querySelector('#stageChords .sect').textContent]), ['', false, 'Intro']);
      await pg.locator('#stageView').blur(); await pg.keyboard.press('Escape'); await pg.waitForSelector('#sTitle');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
