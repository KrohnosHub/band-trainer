// Google-Drive-Abgleich gegen eine Drive-Attrappe: Anmelden, Ordner, library.json, Merge, Löschmarken, Offline, Stems, Sicherungen
const { launch, open, wav, FakeDrive } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  const signIn = async pg => { await pg.click('[data-act=menu]'); await pg.click('[data-act=signIn]'); await pg.waitForFunction(() => !!localStorage.getItem('bt_libId')); await pg.settle(); };
  const setNotes = (pg, id, txt) => pg.evaluate(([i, t]) => { const s = Store.get(i); s.notes = t; Store.touch(s); }, [id, txt]);
  try {
    await test('Erstes Anmelden: Ordner «Band-Trainer» mit library.json, «Stems», «Backups»; Hinweis «04_Band» einmalig; Scope drive.file', async () => {
      const drive = new FakeDrive(); const pg = await open(b, D, { drive });
      eq(await pg.locator('#syncState').innerText(), 'Nur lokal');
      await signIn(pg);
      eq(await pg.evaluate(() => window.__auth.cfg), { client_id: '159994249880-flb4nhh2aq51tspov0d7nv787hir84e5.apps.googleusercontent.com', scope: 'https://www.googleapis.com/auth/drive.file' });
      const root = drive.byName('Band-Trainer'); eq(root.length, 1); eq(root[0].parents, ['root']);
      const kids = drive.live(f => f.parents[0] === root[0].id).map(f => f.name).sort();
      eq(kids, ['Backups', 'Stems', 'library.json']);
      const lib = drive.json('library.json'); eq([lib.app, lib.songs.length, typeof lib.settings.theme], ['band-trainer', 24, 'string']);
      ok(drive.live(f => /^library-\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).length === 1, 'Tages-Sicherung angelegt');
      const hint = await pg.locator('#dlg').innerText(); ok(/04_Band/.test(hint) && /verschieben/.test(hint) && /Band-Trainer/.test(hint), 'Ordner-Hinweis: ' + hint.slice(0, 80));
      await pg.click('#dlg [data-act=close]');
      eq(await pg.locator('#syncState').innerText(), '✓ Drive');
      eq(await pg.evaluate(() => [localStorage.getItem('bt_folderId'), localStorage.getItem('bt_dirty')]), [root[0].id, null]);
      // Ordner in Drive nach «04_Band» verschoben: gleiche ID → wird weiter gefunden, kein zweiter Ordner
      const band = drive.add({ name: '04_Band', mimeType: 'application/vnd.google-apps.folder' }); root[0].parents = [band.id];
      await setNotes(pg, 'seed-01', 'nach dem Verschieben'); await pg.syncNow();
      eq([drive.byName('Band-Trainer').length, drive.json('library.json').songs.find(s => s.id === 'seed-01').notes], [1, 'nach dem Verschieben']);
      // Neuladen: gespeichertes Token → Abgleich ohne Fenster, Hinweis kommt nicht noch einmal
      const calls = await pg.evaluate(() => window.__auth.calls.length);
      await pg.reload(); await pg.waitForSelector('#songList'); await pg.settle();
      eq(await pg.evaluate(() => [document.querySelector('#dlg').open, Cloud.tokenValid(), window.__auth.calls.length]), [false, true, 0]); ok(calls === 1, 'nur eine Token-Anfrage');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Zwei Geräte: Merge pro Song nach updatedAt, Löschungen als Löschmarken, Einstellungen', async () => {
      const drive = new FakeDrive();
      const A = await open(b, D, { drive }); await signIn(A); await A.click('#dlg [data-act=close]');
      await setNotes(A, 'seed-01', 'von A'); await A.syncNow();
      const B = await open(b, D, { drive }); await signIn(B);
      eq(drive.byName('Band-Trainer').length, 1, 'Gerät B findet den Ordner per Name, legt keinen zweiten an');
      eq(await B.evaluate(() => Store.get('seed-01').notes), 'von A');
      await B.click('#dlg [data-act=close]');
      // B löscht seed-02, ändert seed-03; A ändert gleichzeitig seed-04 und (älter) seed-03
      await setNotes(A, 'seed-03', 'A alt'); await setNotes(A, 'seed-04', 'nur A');
      await B.waitForTimeout(30);
      await B.evaluate(() => { Store.remove('seed-02'); const s = Store.get('seed-03'); s.notes = 'B neu'; Store.touch(s); Store.data.settings.theme = 'light'; Store.saveSettings(); });
      await A.syncNow(); await B.syncNow(); await A.syncNow();
      const state = pg => pg.evaluate(() => [!!Store.get('seed-02'), Store.get('seed-03').notes, Store.get('seed-04').notes, Store.data.songs.length, Store.data.settings.theme, document.documentElement.dataset.theme]);
      eq(await state(A), [false, 'B neu', 'nur A', 23, 'light', 'light']); eq(await state(B), [false, 'B neu', 'nur A', 23, 'light', 'light']);
      ok(drive.json('library.json').deleted['seed-02'] > 0, 'Löschmarke in library.json');
      eq(await A.locator('#songList > li[data-id]').count(), 23, 'Liste auf A aufgefrischt');
      // nach dem Löschen neu bearbeiteter Song lebt weiter (neueres updatedAt schlägt Löschmarke)
      eq(await A.evaluate(() => { const m = mergeData({ songs: [cleanSong({ id: 'q', title: 'Q', updatedAt: 50 })], deleted: {} }, { songs: [], deleted: { q: Date.now() - 1000 } }); const n = mergeData({ songs: [cleanSong({ id: 'q', title: 'Q', updatedAt: Date.now() })], deleted: {} }, { songs: [], deleted: { q: Date.now() - 1000 } }); return [m.songs.length, n.songs.length, Object.keys(n.deleted).length]; }), [0, 1, 0]);
      // Abgleich ohne Änderungen lädt nichts hoch
      const up = drive.log.filter(l => /^(PATCH|POST) \/upload/.test(l)).length; await A.syncNow(); await B.syncNow();
      eq(drive.log.filter(l => /^(PATCH|POST) \/upload/.test(l)).length, up, 'kein unnötiger Upload');
      // offener Song auf B: Änderung von A erscheint, ohne die Ansicht zu verlassen
      await B.evaluate(() => { location.hash = '#/song/seed-05'; }); await B.waitForSelector('#sTitle');
      await A.evaluate(() => { const s = Store.get('seed-05'); s.chords = '| C | G |'; s.key = 'C'; Store.touch(s); }); await A.syncNow(); await B.syncNow();
      eq(await B.evaluate(() => [[...document.querySelectorAll('#chordOut .bar')].map(e => e.textContent), document.querySelector('#chordsIn').value, document.querySelector('#sSub').textContent.includes('Tonart C')]), [['C', 'G'], '| C | G |', true]);
      eq(A.errs, []); eq(B.errs, []); await A.context().close(); await B.context().close();
    });
    await test('Offline-first: Änderungen werden gemerkt und nach Wiederverbindung abgeglichen; 401 → «Anmelden»; stille Anmeldung', async () => {
      const drive = new FakeDrive(); const pg = await open(b, D, { drive }); await signIn(pg); await pg.click('#dlg [data-act=close]');
      await pg.context().setOffline(true); await pg.waitForFunction(() => !navigator.onLine);
      await setNotes(pg, 'seed-06', 'offline geschrieben'); await pg.waitForTimeout(300);
      eq(await pg.evaluate(() => [localStorage.getItem('bt_dirty'), document.querySelector('#syncState').textContent]), ['1', 'Offline · offen']);
      await pg.reload().catch(() => {});   // ohne Service Worker lädt die Seite offline nicht neu – Zustand bleibt in localStorage
      await pg.context().setOffline(false); await pg.goto(process.env.BASE); await pg.waitForSelector('#songList');
      await pg.waitForFunction(() => !localStorage.getItem('bt_dirty'), null, { timeout: 8000 }); await pg.settle();
      eq(drive.json('library.json').songs.find(s => s.id === 'seed-06').notes, 'offline geschrieben');
      // online-Ereignis löst den Abgleich aus
      await pg.context().setOffline(true); await pg.waitForFunction(() => !navigator.onLine); await setNotes(pg, 'seed-07', 'zweite Runde');
      await pg.context().setOffline(false);
      await pg.waitForFunction(() => !localStorage.getItem('bt_dirty'), null, { timeout: 10000 });
      eq(drive.json('library.json').songs.find(s => s.id === 'seed-07').notes, 'zweite Runde');
      // abgelaufene Sitzung (401): Token weg, Status «Anmelden», Daten bleiben vorgemerkt
      await pg.settle(); drive.failNext = 1; await setNotes(pg, 'seed-08', 'trotz 401'); await pg.evaluate(() => Cloud.syncAll(true)); await pg.settle();
      eq(await pg.evaluate(() => [Cloud.tokenValid(), document.querySelector('#syncState').textContent, localStorage.getItem('bt_dirty')]), [false, 'Anmelden', '1']);
      // stille Anmeldung: prompt none + Konto-Hinweis; danach automatisch abgeglichen
      await pg.evaluate(() => { window.__auth.calls.length = 0; });
      eq(await pg.evaluate(() => Cloud.trySilentToken()), true); await pg.settle();
      eq(await pg.evaluate(() => [window.__auth.calls[0].prompt, window.__auth.calls[0].hint, Cloud.tokenValid(), localStorage.getItem('bt_dirty')]), ['none', 'test@example.com', true, null]);
      eq(drive.json('library.json').songs.find(s => s.id === 'seed-08').notes, 'trotz 401');
      eq(await pg.evaluate(() => Cloud.trySilentToken()), false, 'gültiges Token → nichts zu tun');
      // Browser blockiert das Hintergrund-Fenster → false, Pause, App bleibt benutzbar
      await pg.evaluate(() => { window.__auth.mode = 'fail'; Cloud.dropToken(); window.__auth.calls.length = 0; });
      eq(await pg.evaluate(async () => [await Cloud.trySilentToken(), await Cloud.trySilentToken(), window.__auth.calls.length]), [false, false, 1]);
      // Abmelden: lokal weiter nutzbar, kein Abgleich mehr
      await pg.evaluate(() => { window.__auth.mode = 'ok'; }); await pg.click('[data-act=menu]'); await pg.click('[data-act=signOut]');
      eq(await pg.evaluate(() => [Cloud.hadLogin(), document.querySelector('#syncState').textContent, Store.data.songs.length]), [false, 'Nur lokal', 24]);
      eq(pg.errs, []); await pg.context().close();
    });
    await test('Stems: «In Drive sichern» (klein = Multipart, gross = Resumable), auf zweitem Gerät «Aus Drive laden»; Entfernen räumt Drive auf', async () => {
      const drive = new FakeDrive();
      const A = await open(b, D, { drive, hash: '#/song/seed-01' }); await A.waitForSelector('#sTitle');
      await A.click('[data-act=tab][data-tab=audio]');
      const small = wav(2, 8000, 110), big = wav(50, 44100, 220);
      await A.setInputFiles('#file-bass', { name: 'bass stem.wav', mimeType: 'audio/wav', buffer: small }); await A.waitForFunction(() => Player.tracks.bass);
      eq(await A.locator('[data-act=stemUp]').count(), 0, 'ohne Drive-Verbindung kein Sichern-Knopf');
      await A.evaluate(() => { location.hash = '#/'; }); await A.waitForSelector('#songList'); await signIn(A); await A.click('#dlg [data-act=close]');
      await A.evaluate(() => { location.hash = '#/song/seed-01'; }); await A.waitForFunction(() => Player.tracks.bass); await A.click('[data-act=tab][data-tab=audio]');
      await A.setInputFiles('#file-original', { name: 'original.wav', mimeType: 'audio/wav', buffer: big }); await A.waitForFunction(() => Player.tracks.original);
      await A.click('[data-act=stemUp][data-slot=bass]'); await A.waitForFunction(() => App.current().stems.bass.driveId);
      await A.click('[data-act=stemUp][data-slot=original]'); await A.waitForFunction(() => App.current().stems.original.driveId, null, { timeout: 20000 });
      const stems = drive.byName('Stems')[0], up = drive.live(f => f.parents[0] === stems.id);
      eq(up.map(f => [f.name, f.body.length]).sort(), [['seed-01__bass__bass stem.wav', small.length], ['seed-01__original__original.wav', big.length]]);
      eq(drive.resumable, 1, 'grosse Datei per Resumable-Upload');
      ok(Buffer.compare(up.find(f => /bass/.test(f.name)).body, small) === 0, 'Inhalt unverändert in Drive');
      ok(/In Drive gesichert/.test(await A.locator('[data-stem=bass] .drv').innerText()), 'Anzeige gesichert');
      await A.syncNow();
      // Gerät B
      const B = await open(b, D, { drive }); await signIn(B); await B.click('#dlg [data-act=close]');
      await B.evaluate(() => { location.hash = '#/song/seed-01'; }); await B.waitForSelector('#sTitle'); await B.click('[data-act=tab][data-tab=audio]');
      ok(/nicht auf diesem Gerät/.test(await B.locator('[data-stem=bass] .fn').innerText()), 'Hinweis auf B');
      eq(await B.evaluate(() => !!Player.tracks.bass), false);
      await B.click('[data-act=stemDown][data-slot=bass]'); await B.waitForFunction(() => Player.tracks.bass && Player.duration() > 1.5);
      eq(await B.evaluate(async () => { const r = await IDB.get('seed-01:bass'); return [r.name, r.size, r.blob.type]; }), ['bass stem.wav', small.length, 'audio/wav']);
      await B.click('#bPlay'); await B.waitForFunction(() => Player.playing && Player.time() > 0.2); await B.click('#bPlay');
      // B entfernt den Bass-Stem → Drive-Kopie im Papierkorb, A verliert die lokale Datei beim nächsten Öffnen
      B.once('dialog', d => d.accept()); await B.click('[data-act=stemDel][data-slot=bass]'); await B.syncNow();
      eq(drive.live(f => f.parents[0] === stems.id).map(f => f.name), ['seed-01__original__original.wav']);
      await A.syncNow(); await A.reload(); await A.waitForFunction(() => Player.tracks.original);
      eq(await A.evaluate(async () => [!!Player.tracks.bass, App.current().stems.bass.deleted, (await IDB.get('seed-01:bass')) || null]), [false, true, null]);
      eq(A.errs, []); eq(B.errs, []); await A.context().close(); await B.context().close();
    });
    await test('Sicherungen: täglich eine, die letzten 14 bleiben; Wiederherstellen holt Gelöschtes zurück', async () => {
      const drive = new FakeDrive(); const pg = await open(b, D, { drive }); await signIn(pg); await pg.click('#dlg [data-act=close]');
      const bk = drive.byName('Backups')[0], lib = drive.json('library.json');
      const old = JSON.parse(JSON.stringify(lib)); old.songs.find(s => s.id === 'seed-10').notes = 'Stand von früher';
      for (let d = 1; d <= 20; d++) drive.add({ name: 'library-2026-01-' + String(d).padStart(2, '0') + '.json', parents: [bk.id], mimeType: 'application/json', body: Buffer.from(JSON.stringify(old)) });
      eq(await pg.evaluate(() => Cloud.autoBackup()), false, 'heute schon gesichert → nichts zu tun');
      eq(await pg.evaluate(() => Cloud.autoBackup(true)), true);
      const names = drive.live(f => f.parents[0] === bk.id).map(f => f.name).sort();
      eq(names.length, 14); ok(names.includes('library-2026-01-20.json') && !names.includes('library-2026-01-07.json') && /^library-20\d\d/.test(names[13]), 'älteste entfernt: ' + names.join(','));
      // Wiederherstellen
      await pg.evaluate(() => { Store.remove('seed-11'); const s = Store.get('seed-10'); s.notes = 'heute'; Store.touch(s); }); await pg.syncNow();
      await pg.click('[data-act=menu]'); await pg.click('[data-act=backups]'); await pg.waitForSelector('#bkList [data-act=restore]');
      eq(await pg.locator('#bkList [data-act=restore]').count(), 14);
      pg.once('dialog', d => d.accept()); await pg.click('#bkList [data-act=restore][data-name="library-2026-01-20.json"]');
      await pg.waitForFunction(() => !!Store.get('seed-11')); await pg.syncNow();
      eq(await pg.evaluate(() => [Store.get('seed-10').notes, !!Store.get('seed-11'), Store.data.songs.length]), ['Stand von früher', true, 24]);
      ok(drive.json('library.json').songs.some(s => s.id === 'seed-11'), 'wiederhergestellter Song wieder in Drive');
      eq(pg.errs, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
