// Guide-Videos: Vorschläge über die (gestubbte) YouTube Data API, übernehmen/verwerfen; ohne Schlüssel/bei Fehler bleiben die Suchlinks
const { launch, open } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  const item = (id, title, ch) => ({ id: { videoId: id }, snippet: { title, channelTitle: ch, thumbnails: { medium: { url: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' } } } });
  const yt = q => /keyboard tutorial/.test(q) ? [item('KEYS0000001', 'Keys &amp; <b>Piano</b> Lesson', 'Kanal K'), item('KEYS0000002', 'Keys 2', 'K'), { id: { videoId: 'zu-kurz' }, snippet: { title: 'ungültig' } }, item('KEYS0000003', 'Keys 3', 'K'), item('KEYS0000004', 'Keys 4', 'K'), item('KEYS0000005', 'Keys 5', 'K')]
    : /bass tutorial/.test(q) ? [item('BASS0000001', 'Bass Lesson', 'Kanal B'), item('KEYS0000001', 'doppelt', 'K')]
    : [item('COVR0000001', 'Bass Cover 1', 'C'), item('COVR0000002', 'Bass Cover 2', 'C'), item('COVR0000003', 'Bass Cover 3', 'C')];
  const vids = pg => pg.evaluate(() => [...document.querySelectorAll('#sugBox [data-act=sugAccept]')].map(e => e.dataset.vid));
  try {
    await test('Vorschläge: je 3 Treffer Keyboard/Bass, als «Vorschlag» markiert; übernehmen, verwerfen, neu suchen', async () => {
      const pg = await open(b, D, { yt, cfg: { YOUTUBE_API_KEY: 'TESTKEY' }, hash: '#/song/seed-01' });
      await pg.waitForSelector('#sTitle'); eq(pg.ytQueries, [], 'keine Anfrage vor dem Öffnen des Tabs');
      await pg.click('[data-act=tab][data-tab=videos]'); await pg.waitForFunction(() => document.querySelectorAll('#sugBox .sugg').length === 6);
      eq(pg.ytQueries, ['Blackwater Swagger Blackwater Conspiracy keyboard tutorial', 'Blackwater Swagger Blackwater Conspiracy bass tutorial', 'Blackwater Swagger Blackwater Conspiracy bass cover']);
      eq(await vids(pg), ['KEYS0000001', 'KEYS0000002', 'KEYS0000003', 'BASS0000001', 'COVR0000001', 'COVR0000002']);
      eq(await pg.locator('#sugBox .badge.sug').count(), 6); eq(await pg.locator('#sugBox .badge.sug').first().innerText(), 'Vorschlag');
      eq(await pg.evaluate(() => [document.querySelector('#sugBox .ti').textContent, document.querySelector('#sugBox .ti b'), document.querySelector('#sugBox img').getAttribute('src')]), ['Keys & <b>Piano</b> Lesson', null, 'https://i.ytimg.com/vi/KEYS0000001/mqdefault.jpg'], 'Titel als Text, nicht als HTML');
      eq(await pg.evaluate(() => App.current().links.length), 0, 'nichts ungefragt übernommen');
      // Ansehen bettet ein (youtube-nocookie)
      await pg.locator('#sugBox [data-act=embed]').first().click();
      eq(await pg.locator('#ytBox iframe').getAttribute('src'), 'https://www.youtube-nocookie.com/embed/KEYS0000001?playsinline=1&rel=0');
      // Übernehmen
      await pg.locator('#sugBox [data-act=sugAccept]').first().click();
      eq(await pg.evaluate(() => App.current().links.map(l => [l.label, l.url, l.kind])), [['Keys & <b>Piano</b> Lesson', 'https://www.youtube.com/watch?v=KEYS0000001', 'keys']]);
      eq(await pg.locator('#linkList .link').count(), 1); eq((await vids(pg)).length, 5);
      // Verwerfen
      await pg.click('#sugBox [data-act=sugDismiss][data-vid="BASS0000001"]');
      eq(await pg.evaluate(() => App.current().suggest.dismissed), ['BASS0000001']); eq((await vids(pg)).includes('BASS0000001'), false);
      // Neu suchen: Übernommenes und Verworfenes kommt nicht wieder, es rücken andere echte Treffer nach
      const n = pg.ytQueries.length; await pg.click('[data-act=sugRun]'); await pg.waitForFunction(k => document.querySelectorAll('#sugBox .sugg').length === 6 && !Suggest.busy.size, n);
      eq(await vids(pg), ['KEYS0000002', 'KEYS0000003', 'KEYS0000004', 'COVR0000001', 'COVR0000002', 'COVR0000003']);
      // bleibt gespeichert, kein erneuter API-Aufruf beim Wiederöffnen
      const q = pg.ytQueries.length; await pg.waitForTimeout(100); await pg.reload(); await pg.waitForSelector('#sTitle'); await pg.click('[data-act=tab][data-tab=videos]');
      eq((await vids(pg)).length, 6); await pg.waitForTimeout(300); eq(pg.ytQueries.length, q, 'aus dem Speicher, kein neuer API-Aufruf');
      // Demo-Song: keine Suche
      await pg.evaluate(() => { location.hash = '#/song/demo-blues'; }); await pg.waitForFunction(() => App.songId === 'demo-blues' && document.querySelector('#sugBox')); await pg.waitForTimeout(300);
      eq(pg.ytQueries.length, q); ok(/keine Vorschläge/.test(await pg.locator('#sugBox').innerText()));
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Ohne Schlüssel bzw. bei API-Fehler: verständlicher Hinweis, Suchlinks wie bisher', async () => {
      let pg = await open(b, D, { yt, hash: '#/song/seed-05' });
      await pg.waitForSelector('#sTitle'); await pg.click('[data-act=tab][data-tab=videos]'); await pg.waitForTimeout(300);
      eq(pg.ytQueries, []); ok(/nicht eingerichtet/.test(await pg.locator('#sugBox').innerText()), 'Hinweis ohne Schlüssel');
      const links = await pg.evaluate(() => [...document.querySelectorAll('#searchBox a')].map(a => a.href));
      eq(links.length, 10); eq(links[0], 'https://www.youtube.com/results?search_query=Hotel%20California%20Eagles%20keyboard%20tutorial'); ok(links.every(l => /^https:\/\/(www\.youtube\.com\/results|www\.ultimate-guitar\.com|www\.songsterr\.com|www\.google\.com\/search\?q=site%3A)/.test(l)), 'nur Suchlinks');
      await pg.context().close();
      pg = await open(b, D, { yt: () => ({ status: 403 }), cfg: { YOUTUBE_API_KEY: 'TESTKEY' }, hash: '#/song/seed-05' });
      await pg.waitForSelector('#sTitle'); await pg.click('[data-act=tab][data-tab=videos]');
      await pg.waitForFunction(() => /nicht verfügbar/.test(document.querySelector('#sugBox').textContent));
      ok(/Tageskontingent|freigegeben/.test(await pg.locator('#sugBox').innerText()), 'Fehlertext');
      eq(await pg.evaluate(() => [document.querySelectorAll('#sugBox .sugg').length, App.current().suggest, document.querySelectorAll('#searchBox a').length]), [0, null, 10]);
      eq(pg.errs, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
