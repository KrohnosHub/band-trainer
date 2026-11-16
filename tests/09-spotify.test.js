// Spotify (ab v1.2.0): automatische Verknüpfung pro Song (gestubbte Spotify-API), manuelles Einfügen, neuer Song, Akkord-Vorbelegung, «+ Song» oben
const { launch, open } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  const tr = (id, name, artist, pop) => ({ id: id.padEnd(22, '0'), name, artists: [{ name: artist }], popularity: pop || 50 });
  // Pro Suche: zuerst falsche Interpreten/Cover, dann der echte Titel (auch «- Remastered»)
  const sp = q => {
    if (/Wicked Game/.test(q)) return [tr('cover1', 'Wicked Game', 'Tenacious D', 90), tr('wicked', 'Wicked Game', 'Chris Isaak', 70), tr('wicked2', 'Wicked Game - Live', 'Chris Isaak', 20)];
    if (/Have You Ever Seen the Rain/.test(q)) return [tr('ccr', 'Have You Ever Seen The Rain', 'Creedence Clearwater Revival', 80)];
    if (/Old Time Rock N Roll/.test(q)) return [tr('seger', 'Old Time Rock & Roll - 2011 Remaster', 'Bob Seger', 60)];
    if (/Mein neuer Song/.test(q)) return [tr('neu', 'Mein neuer Song', 'Testband', 10)];
    return [tr('falsch', 'Irgendwas', 'Jemand anders', 99)];
  };
  const spOf = (pg, id) => pg.evaluate(i => Store.get(i).spotify, id);
  try {
    await test('Automatisch im Hintergrund: nur Treffer mit passendem Interpret und Titel, als «Vorschlag»; sonst kein Link', async () => {
      const pg = await open(b, D, { sp, cfg: { SPOTIFY_CLIENT_SECRET: 'sec' } });
      await pg.waitForFunction(() => Store.data.songs.filter(s => !s.isDemo).every(s => s.spTried) && !Spotify.queue, null, { timeout: 20000 });
      eq((await spOf(pg, 'seed-12')).id, 'wicked'.padEnd(22, '0'), 'Original statt Cover/Live');
      eq((await spOf(pg, 'seed-12')).auto, true);
      eq((await spOf(pg, 'seed-13')).id, 'ccr'.padEnd(22, '0'), 'Abkürzung CCR erkannt');
      eq((await spOf(pg, 'seed-17')).id, 'seger'.padEnd(22, '0'), 'Remaster-Zusatz und «N Roll» toleriert');
      eq(await spOf(pg, 'seed-01'), null, 'falscher Interpret wird nicht verknüpft');
      eq(await pg.evaluate(() => Store.get('demo-blues').spTried), 0, 'Demo nie gesucht');
      ok(await pg.locator('#songList .badge.sp').count() >= 3, 'Spotify-Badge in der Liste');
      // Einmalig: nach Neuladen keine erneute Suche
      const n = pg.spQueries.length; await pg.reload(); await pg.waitForSelector('#songList li'); await pg.waitForTimeout(3200); eq(pg.spQueries.length, n);
      // Song-Ansicht: Player eingebettet, übernehmen, entfernen
      await pg.evaluate(() => { location.hash = '#/song/seed-12'; }); await pg.waitForSelector('#sTitle');
      await pg.click('[data-act=tab][data-tab=videos]');
      eq(await pg.locator('#spBox iframe').getAttribute('src'), 'https://open.spotify.com/embed/track/' + 'wicked'.padEnd(22, '0') + '?utm_source=generator');
      eq(await pg.locator('#spBox .badge.sug').innerText(), 'Vorschlag');
      await pg.click('[data-act=spAccept]'); eq((await spOf(pg, 'seed-12')).auto, false); eq(await pg.locator('#spBox .badge.sug').count(), 0);
      await pg.click('[data-act=spDel]'); eq(await spOf(pg, 'seed-12'), null); eq(await pg.locator('#spBox iframe').count(), 0);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Manuell: Link einfügen (auch intl-Pfad), ungültiger Link abgelehnt; ohne Zugangsdaten nur externer Suchlink', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-01' });
      await pg.waitForSelector('#sTitle'); await pg.click('[data-act=tab][data-tab=videos]');
      ok(/Zugangsdaten fehlen/.test(await pg.locator('#spBox').innerText())); eq(await pg.locator('#spBox [data-act=spRun]').count(), 0);
      eq(await pg.locator('#spBox a').getAttribute('href'), 'https://open.spotify.com/search/Blackwater%20Swagger%20Blackwater%20Conspiracy');
      await pg.click('#spBox ~ details summary'); await pg.fill('#spUrl', 'https://example.com/nix'); await pg.locator('#spUrl').dispatchEvent('change');
      eq(await spOf(pg, 'seed-01'), null);
      await pg.fill('#spUrl', 'https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=abc'); await pg.locator('#spUrl').dispatchEvent('change');
      eq(await spOf(pg, 'seed-01'), { id: '4uLU6hMCjMI75M1A2tKUQC', name: '', artists: '', auto: false });
      eq(await pg.locator('#spBox iframe').count(), 1); eq(pg.spQueries, []);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Neuer Song über «+ Song» oben: wird angelegt und sofort mit Spotify verknüpft', async () => {
      const pg = await open(b, { width: 390, height: 844 }, { sp, cfg: { SPOTIFY_CLIENT_SECRET: 'sec' } });
      ok(await pg.locator('header .addtop').isVisible(), '«+ Song» in der Kopfzeile sichtbar');
      await pg.click('header .addtop'); await pg.fill('#songForm [name=title]', 'Mein neuer Song'); await pg.fill('#songForm [name=artist]', 'Testband');
      await pg.click('#songForm [type=submit]'); await pg.waitForSelector('#sTitle');
      await pg.waitForFunction(() => App.current() && App.current().spotify);
      eq(await pg.evaluate(() => [App.current().title, App.current().spotify.id]), ['Mein neuer Song', 'neu'.padEnd(22, '0')]);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Akkorde vorbelegt: neue Installation und bestehende Daten (leere Akkorde) einmalig, ungeprüft; vorhandene bleiben', async () => {
      let pg = await open(b, D);
      eq(await pg.evaluate(() => { const s = Store.get('seed-12'); return [s.key, /\[Intro\]/.test(s.chords), s.chordStatus, !!s.chordSource]; }), ['Bm', true, 'unchecked', true]);
      eq(await pg.evaluate(() => Store.get('seed-01').chords), '', 'ohne Quelle bleibt leer');
      await pg.context().close();
      // Bestand aus v1.1: eigene Akkorde bei seed-02 bleiben, leere werden ergänzt
      pg = await open(b, D, { init: () => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('bandtrainer.data.v1', JSON.stringify({ schema: 2, songs: [{ id: 'seed-02', title: 'Free Fallin', artist: 'Tom Petty', chords: '| C |', updatedAt: 5 }, { id: 'seed-12', title: 'Wicked Game', artist: 'Chris Isaak', chords: '', updatedAt: 5 }], deleted: {}, settings: {} })); } } });
      eq(await pg.evaluate(() => [Store.get('seed-02').chords, /\[Intro\]/.test(Store.get('seed-12').chords), Store.get('seed-12').updatedAt > 5]), ['| C |', true, true]);
      await pg.evaluate(() => { const s = Store.get('seed-12'); s.chords = ''; Store.persist(); }); await pg.reload(); await pg.waitForSelector('#app > *');
      eq(await pg.evaluate(() => Store.get('seed-12').chords), '', 'nur einmalig – absichtlich geleerte Akkorde kommen nicht zurück');
      await pg.context().close();
    });
  } finally { await b.close(); }
};
