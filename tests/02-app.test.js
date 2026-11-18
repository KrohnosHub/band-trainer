// Songliste, Anlegen/Bearbeiten/Löschen, Setlist-Reihenfolge, Import, Handy-Ansicht
const { launch, open } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 }, M = { width: 390, height: 844 };
  const count = pg => pg.locator('#songList > li[data-id]').count();
  try {
    await test('Liste: 23 Songs + Demo, bestätigte Titel ohne «Angabe prüfen», Suche und Filter', async () => {
      const pg = await open(b, D);
      eq(await count(pg), 24);
      const txt = await pg.locator('#songList').innerText();
      ok(/Waiting for the Thunder/.test(txt) && /Blackberry Smoke/.test(txt) && /Have You Ever Seen the Rain/.test(txt) && /CCR/.test(txt), 'bestätigte Titel');
      eq(await pg.locator('.badge.warn').count(), 0, 'kein Prüfhinweis');
      eq(await pg.evaluate(() => Store.data.songs.filter(s => s.uncertain).length), 0);
      // nichts Erfundenes vorbefüllt: nur das Demo hat Tonart/Akkorde/Bassline/Video
      eq(await pg.evaluate(() => Store.data.songs.filter(s => !s.isDemo && (s.bassAbc || s.youtubeUrl || s.links.length || (s.chords && (!SEED_CHORDS[s.id] || s.chords !== SEED_CHORDS[s.id].chords || s.chordStatus !== 'unchecked')))).length), 0, 'nur recherchierte, ungeprüfte Akkorde vorbelegt');
      // Autofill-Schutz: gesperrt bis zum Antippen; Werte ohne Fokus (Browser-Autofill) werden ignoriert
      eq(await pg.evaluate(() => { const q = document.querySelector('#q'); const ro = q.readOnly; q.value = 'cba857fdd8fc'; q.dispatchEvent(new Event('input', { bubbles: true })); return [ro, q.value, App.query]; }), [true, '', '']);
      await pg.click('#q');
      await pg.fill('#q', 'hotel'); eq(await count(pg), 1);
      await pg.fill('#q', '');
      await pg.click('#tabLists').then(() => pg.click('[data-act=filter][data-f=list-setlist]')); eq(await count(pg), 12);
      ok(/^1\./.test(await pg.locator('#songList li .t').first().innerText()), 'Setlist nummeriert');
      await pg.click('#tabLists').then(() => pg.click('[data-act=filter][data-f=list-todo]')); eq(await count(pg), 11);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Song anlegen, bearbeiten, löschen (Löschmarke); Daten überstehen Neuladen; HTML wird nicht ausgeführt', async () => {
      const pg = await open(b, D);
      await pg.click('[data-act=add]');
      await pg.fill('#songForm [name=title]', '<img src=x onerror=window.__xss=1> Testsong'); await pg.fill('#songForm [name=artist]', 'Testband'); await pg.fill('#songForm [name=bpm]', '120');
      await pg.check('#songForm [name=lst][value=list-setlist]'); await pg.click('#songForm [type=submit]');
      await pg.waitForSelector('#sTitle');
      const id = await pg.evaluate(() => App.songId);
      ok(/Testsong/.test(await pg.locator('#sTitle').innerText()) && /120 BPM/.test(await pg.locator('#sSub').innerText()), 'Kopfzeile');
      eq(await pg.evaluate(i => Store.list('list-setlist').songs.indexOf(i), id), 12, 'hinten in der Setlist');
      await pg.click('header [data-act=edit]'); await pg.fill('#songForm [name=key]', 'Em'); await pg.click('#songForm [type=submit]');
      ok(/Tonart Em/.test(await pg.locator('#sSub').innerText()), 'Tonart');
      await pg.click('[data-act=tab][data-tab=info]'); await pg.fill('#notesIn', 'Orgel-Sound, Split bei C3'); await pg.waitForTimeout(700);
      await pg.reload(); await pg.waitForSelector('#sTitle');
      eq(await pg.evaluate(i => [Store.get(i).notes, Store.get(i).key], id), ['Orgel-Sound, Split bei C3', 'Em']);
      await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForSelector('#songList'); eq(await count(pg), 25);
      eq(await pg.evaluate(() => window.__xss), undefined, 'kein XSS über den Titel');
      await pg.click(`[data-act=open][data-id="${id}"]`); await pg.waitForSelector('#sTitle');
      pg.once('dialog', d => d.accept());
      await pg.click('header [data-act=edit]'); await pg.click('[data-act=delete]');
      await pg.waitForSelector('#songList'); eq(await count(pg), 24);
      ok(await pg.evaluate(i => Store.data.deleted[i] > 0 && !Store.get(i), id), 'Löschmarke gesetzt');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Setlist-Reihenfolge: Hoch/Runter und Ziehen, bleibt gespeichert', async () => {
      const pg = await open(b, D);
      await pg.click('#tabLists').then(() => pg.click('[data-act=filter][data-f=list-setlist]')); await pg.click('[data-act=reorder]');
      const ids = () => pg.evaluate(() => Store.setlist().map(s => s.id));
      const a = await ids();
      await pg.click(`[data-act=down][data-id="${a[0]}"]`);
      eq((await ids()).slice(0, 3), [a[1], a[0], a[2]], 'runter');
      await pg.click(`[data-act=up][data-id="${a[2]}"]`);
      eq((await ids()).slice(0, 3), [a[1], a[2], a[0]], 'hoch');
      ok(await pg.locator('#songList li').first().locator('[data-act=up]').isDisabled(), 'erster: hoch gesperrt');
      // Ziehen: ersten Eintrag unter den dritten
      const h = await pg.locator('#songList li .handle').first().boundingBox(), t = await pg.locator('#songList li').nth(2).boundingBox();
      await pg.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await pg.mouse.down();
      await pg.mouse.move(h.x + h.width / 2, t.y + t.height * 0.8, { steps: 6 }); await pg.mouse.up();
      eq((await ids()).slice(0, 3), [a[2], a[0], a[1]], 'gezogen');
      const now = await ids(); await pg.reload(); await pg.waitForSelector('#songList'); eq(await ids(), now, 'gespeichert');
      eq(pg.errs, []); await pg.context().close();
    });
    await test('Import: neuerer Stand gewinnt, älterer nicht; Prototyp-Export wird bereinigt', async () => {
      const pg = await open(b, D);
      const r = await pg.evaluate(() => {
        const s1 = Store.get('seed-01'); s1.notes = 'lokal'; Store.touch(s1);
        const out = IO.merge(cleanData({ songs: [
          { id: 'seed-01', title: 'Blackwater Swagger', updatedAt: 5, notes: 'alt' },
          { id: 'seed-02', title: 'Free Fallin', artist: 'Tom Petty', updatedAt: Date.now() + 1000, notes: 'neu', links: [{ url: 'javascript:alert(1)', label: 'x' }, { url: 'https://example.org/a', label: 'ok', kind: '__proto__' }] },
          { id: 'x1', title: 'Neuer Song', updatedAt: 7, bpm: 9999, transpose: 99 }, { id: '__proto__', title: 'böse' }, { title: 'ohne id' } ] }));
        return [out, Store.get('seed-01').notes, Store.get('seed-02').notes, Store.get('seed-02').links.map(l => [l.url, l.kind]), Store.get('x1').bpm, Store.get('x1').transpose, Store.data.songs.length];
      });
      eq(r, [{ added: 1, updated: 1 }, 'lokal', 'neu', [['https://example.org/a', 'other']], null, 11, 25]);
      eq(pg.errs, []); await pg.context().close();
    });
    await test('Listen (v1.3.0): Status → Listen migriert, neue Liste anlegen, Songs wählen/entfernen, umbenennen, löschen; Favoriten', async () => {
      // Bestand v1.2 (Status + Reihenfolge) wird zu «Setlist»/«To Do» mit fester ID und gleicher Reihenfolge
      let pg = await open(b, D, { init: () => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('bandtrainer.data.v1', JSON.stringify({ schema: 3, songs: [
        { id: 'seed-02', title: 'Free Fallin', artist: 'Tom Petty', status: 'setlist', order: 1, updatedAt: 5 }, { id: 'seed-03', title: 'Hard to Handle', artist: 'Black Crowes', status: 'setlist', order: 0, updatedAt: 5 },
        { id: 'seed-14', title: 'Heroes', artist: 'David Bowie', status: 'todo', updatedAt: 5 }], deleted: {}, settings: {} })); } } });
      eq(await pg.evaluate(() => Store.data.lists.map(l => [l.id, l.name, l.songs])), [['list-setlist', 'Setlist', ['seed-03', 'seed-02']], ['list-todo', 'To Do', ['seed-14']]]);
      await pg.context().close();
      pg = await open(b, D);
      // Neue Liste: anlegen → Auswahl öffnet sich direkt
      await pg.click('#tabLists'); await pg.click('[data-act=listNew]'); await pg.fill('#listForm [name=name]', 'Probe Freitag'); await pg.click('#listForm [type=submit]');
      await pg.waitForSelector('#pickForm');
      await pg.fill('#pickQ', 'hotel'); ok(await pg.locator('#pickForm label[data-t*="hotel"]').isVisible() && !(await pg.locator('#pickForm label[data-t*="wicked"]').isVisible()), 'Filter in der Auswahl');
      await pg.check('#pickForm [value=seed-05]'); await pg.fill('#pickQ', ''); await pg.check('#pickForm [value=seed-12]'); await pg.click('#pickForm [type=submit]');
      const lid = await pg.evaluate(() => App.filter);
      eq(await pg.evaluate(i => Store.list(i).songs, lid), ['seed-05', 'seed-12']); eq(await count(pg), 2);
      ok(/Probe Freitag\s*2 Songs/.test(await pg.locator('#chipBox').innerText()));
      // Entfernen über Reihenfolge-Ansicht (✕), umbenennen, Song-Dialog zeigt Listen-Häkchen
      await pg.click('[data-act=reorder]'); await pg.click('[data-act=listOut][data-id=seed-05]'); eq(await pg.evaluate(i => Store.list(i).songs, lid), ['seed-12']);
      await pg.click('[data-act=listRename]'); await pg.fill('#listForm [name=name]', 'Probe Sa'); await pg.click('#listForm [type=submit]');
      ok(/Probe Sa\s*1 Songs/.test(await pg.locator('#chipBox').innerText()));
      await pg.click('[data-act=reorder]'); await pg.click('[data-act=open][data-id=seed-12]'); await pg.waitForSelector('#sTitle'); await pg.click('header [data-act=edit]');
      ok(await pg.locator(`#songForm [name=lst][value="${lid}"]`).isChecked() && await pg.locator('#songForm [name=lst][value=list-setlist]').isChecked(), 'Listen-Häkchen');
      await pg.uncheck(`#songForm [name=lst][value="${lid}"]`); await pg.click('#songForm [type=submit]'); eq(await pg.evaluate(i => Store.list(i).songs, lid), []);
      // Favorit: Stern in der Song-Ansicht und in der Liste, Filter «Favoriten»
      await pg.click('#sFav'); eq(await pg.evaluate(() => [Store.get('seed-12').fav, document.querySelector('#sFav').textContent]), [true, '★']);
      await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForSelector('#songList');
      await pg.click('#tabSongs'); if (await pg.evaluate(() => App.filter === 'fav')) await pg.click('[data-act=filter][data-f=all]'); await pg.click('#songList [data-act=fav][data-id=seed-01]');
      await pg.click('[data-act=filter][data-f=fav]'); eq(await count(pg), 2);
      ok(await pg.locator('#songList li[data-id=seed-01] .favb.on').isVisible());
      eq(await pg.evaluate(() => { const c = getComputedStyle(document.querySelector('#songList li[data-id=seed-01] .favb.on')); return [c.backgroundColor, c.color !== c.backgroundColor]; }), ['rgba(0, 0, 0, 0)', true], 'nur Stern, kein farbiger Kasten');
      // Zwei Zeilen pro Titel, keine Indikatoren
      eq(await pg.evaluate(() => [document.querySelectorAll('#songList .m').length, document.querySelectorAll('#songList .song .badge').length]), [0, 0]);
      // Liste löschen (Songs bleiben); Löschmarke gesetzt; nach Neuladen weg
      await pg.click("#tabLists"); if (await pg.evaluate(() => App.filter !== "lists")) await pg.click("#tabLists"); await pg.click(`[data-act=filter][data-f="${lid}"]`); pg.once('dialog', d => d.accept()); await pg.click('[data-act=listDel]');
      eq(await pg.evaluate(i => [!!Store.list(i), Store.data.deleted['list:' + i] > 0, Store.data.songs.length, App.filter], lid), [false, true, 24, 'lists'], 'zurück zur Listen-Übersicht');
      await pg.reload(); await pg.waitForSelector('#songList'); eq(await pg.evaluate(i => !!Store.list(i), lid), false);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Listen-Abgleich: pro Liste gewinnt der neuere Stand, gelöschte Liste bleibt gelöscht, alter Stand ohne Listen verliert nichts', async () => {
      const pg = await open(b, D);
      const r = await pg.evaluate(() => {
        const t = Date.now();
        const A = { songs: [], deleted: {}, lists: [{ id: 'list-a', name: 'A neu', songs: ['seed-01'], updatedAt: t - 1000 }, { id: 'list-b', name: 'B', songs: [], updatedAt: t - 5000 }] };
        const B = { songs: [], deleted: { 'list:list-b': t - 3000 }, lists: [{ id: 'list-a', name: 'A alt', songs: [], updatedAt: t - 2000 }, { id: 'list-c', name: 'C', songs: ['seed-02'], updatedAt: t - 9000 }] };
        const m = mergeData(A, B), m2 = mergeData({ songs: [], deleted: {}, lists: null }, A);
        return [m.lists.map(l => l.id + ':' + l.name), m2.lists.length];
      });
      eq(r, [['list-a:A neu', 'list-c:C'], 2]);
      await pg.context().close();
    });
    await test('Handy-Hochformat (390×844): nichts läuft seitlich über, Player bedienbar', async () => {
      const pg = await open(b, M);
      const over = () => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(await over() <= 0, 'Liste zu breit: ' + await over());
      await pg.click('#tabLists').then(() => pg.click('[data-act=filter][data-f=list-setlist]')); await pg.click('[data-act=reorder]'); ok(await over() <= 0, 'Reihenfolge zu breit');
      await pg.click('#tabSongs'); if (await pg.evaluate(() => App.filter === 'fav')) await pg.click('[data-act=filter][data-f=all]');
      await pg.click('[data-act=open][data-id="demo-blues"]'); await pg.waitForSelector('#abcOut svg');
      for (const t of ['noten', 'audio', 'videos', 'info']) { await pg.click(`[data-act=tab][data-tab=${t}]`); ok(await over() <= 0, 'Tab ' + t + ' zu breit: ' + await over()); }
      ok(await pg.locator('#bPlay').isVisible(), 'Play sichtbar');
      ok(!(await pg.locator('#rate').isVisible()), 'Tempo zunächst eingeklappt');
      await pg.click('#bMore'); ok(await pg.locator('#rate').isVisible(), 'Tempo ausklappbar');
      const bb = await pg.locator('#bPlay').boundingBox(); ok(bb.height >= 44 && bb.y + bb.height <= 844, 'Play gross genug und im Bild');
      await pg.click('[data-act=tab][data-tab=noten]'); await pg.click('section[data-pane=noten] [data-act=stage]'); await pg.waitForSelector('.stage'); ok(await over() <= 0, 'Auftritt zu breit');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
