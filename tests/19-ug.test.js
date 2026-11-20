// v1.14.0: Ultimate-Guitar-Link pro Song (hinterlegen, prüfen, öffnen, im Song-Dialog, im Auftrittsmodus, entfernen)
const { launch, open } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  try {
    await test('UG-Link: ohne Link Suche; hinterlegen (nur ultimate-guitar.com), Knopf öffnet die Seite, Song-Dialog, Auftrittsmodus, entfernen', async () => {
      const pg = await open(b, D, { hash: '#/song/seed-12' }); await pg.waitForSelector('#sTitle');
      ok(/search\.php/.test(await pg.locator('#ugBox a').getAttribute('href')), 'Suche ohne Link');
      await pg.click('[data-act=ugEdit]'); await pg.fill('#ugForm [name=u]', 'https://example.com/tab'); await pg.click('#ugForm [type=submit]');
      ok(await pg.locator('#ugForm').isVisible(), 'fremde Adresse abgelehnt');
      const u = 'https://www.ultimate-guitar.com/pro/?artist=Chris+Isaak&song=Wicked+Game&tab_id=1962957&official_tabs=1';
      await pg.fill('#ugForm [name=u]', u); await pg.click('#ugForm [type=submit]');
      eq(await pg.evaluate(() => App.current().ugUrl), u); eq(await pg.locator('#ugBox a.ug').getAttribute('href'), u); eq(await pg.locator('#ugBox a.ug').getAttribute('target'), '_blank');
      await pg.click('header [data-act=edit]'); eq(await pg.inputValue('#songForm [name=ugurl]'), u);
      await pg.fill('#songForm [name=ugurl]', 'javascript:alert(1)'); await pg.click('#songForm [type=submit]'); ok(await pg.locator('#songForm').isVisible(), 'ungültig im Dialog abgelehnt');
      await pg.fill('#songForm [name=ugurl]', 'https://tabs.ultimate-guitar.com/tab/chris-isaak/wicked-game-chords-11066'); await pg.click('#songForm [type=submit]');
      eq(await pg.evaluate(() => App.current().ugUrl), 'https://tabs.ultimate-guitar.com/tab/chris-isaak/wicked-game-chords-11066');
      await pg.evaluate(() => { location.hash = '#/stage/seed-12'; }); await pg.waitForSelector('.stage');
      ok(/ultimate-guitar/.test(await pg.locator('.stage a[aria-label="In Ultimate Guitar öffnen"]').getAttribute('href')));
      await pg.evaluate(() => { location.hash = '#/song/seed-12'; }); await pg.waitForSelector('#sTitle');
      await pg.click('[data-act=ugEdit]'); await pg.click('#ugForm [data-act=ugDel]'); eq(await pg.evaluate(() => App.current().ugUrl), '');
      eq(await pg.evaluate(() => cleanSong({ id: 'x', title: 't', ugUrl: 'http://ultimate-guitar.com/x' }).ugUrl), '', 'nur https');
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
