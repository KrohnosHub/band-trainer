// v1.10.0: Seitenleiste wie Gesangs-App (breit immer sichtbar, Handy als Schublade), «Mehr» + Version unten, Doppelseite ganz
const { launch, open } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch();
  try {
    await test('Breit: Liste bleibt links sichtbar, aktueller Song markiert, «Mehr» und Version unten; Song wechseln direkt aus der Liste', async () => {
      const pg = await open(b, { width: 1366, height: 800 });
      ok(await pg.locator('#side #songList').isVisible() && await pg.locator('.emptymain').isVisible(), 'Liste + leerer Hauptbereich');
      eq(await pg.locator('#sideVer').innerText(), 'Band-Trainer v' + await pg.evaluate(() => APP_VERSION));
      await pg.click('#songList [data-act=open][data-id=seed-12]'); await pg.waitForSelector('#sTitle');
      ok(await pg.locator('#songList').isVisible(), 'Liste bleibt sichtbar'); eq(await pg.locator('#songList li.cur').getAttribute('data-id'), 'seed-12');
      ok(!(await pg.locator('#main [data-act=back]').isVisible()) && !(await pg.locator('#main .sidebtn').isVisible()), 'kein Zurück/☰ nötig');
      const r = await pg.evaluate(() => [document.querySelector('#side').getBoundingClientRect().right <= document.querySelector('#main').getBoundingClientRect().left + 1, document.documentElement.scrollWidth <= innerWidth]);
      eq(r, [true, true], 'nebeneinander, kein Überlauf');
      await pg.evaluate(() => scrollTo(0, 2000)); ok(await pg.locator('#sideVer').isVisible() || await pg.evaluate(() => document.querySelector('#side').scrollHeight > document.querySelector('#side').clientHeight), 'Seitenleiste scrollt separat');
      await pg.click('#side [data-act=menu]'); await pg.waitForSelector('#dlg[open]'); ok(/Version/.test(await pg.locator('#dlg').innerText())); await pg.click('#dlg [data-act=close]');
      await pg.click('#songList [data-act=open][data-id=seed-05]'); await pg.waitForFunction(() => App.songId === 'seed-05'); eq(await pg.locator('#songList li.cur').getAttribute('data-id'), 'seed-05');
      await pg.click('#side .sbfoot [data-act=lexicon]'); await pg.waitForSelector('table.lex'); ok(await pg.locator('#songList').isVisible());
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Handy: Liste ist Startseite; im Song öffnet ☰ die Seitenleiste (mit «Mehr» und Version), Hintergrund/✕ schliesst, Songwahl schliesst', async () => {
      const pg = await open(b, { width: 390, height: 844 });
      ok(await pg.locator('#songList').isVisible() && !(await pg.locator('#main').isVisible()), 'Liste allein');
      ok(await pg.locator('#sideVer').count() === 1);
      await pg.click('#songList [data-act=open][data-id=seed-12]'); await pg.waitForSelector('#sTitle');
      ok(!(await pg.locator('#songList').isVisible()), 'im Song ausgeblendet');
      await pg.click('#main .sidebtn'); ok(await pg.locator('#songList').isVisible() && await pg.locator('#side [data-act=menu]').isVisible(), 'Schublade mit Mehr');
      await pg.click('#side .sideclose'); ok(!(await pg.locator('#songList').isVisible()), '✕ schliesst');
      await pg.click('#main .sidebtn'); await pg.mouse.click(380, 400); ok(!(await pg.locator('#songList').isVisible()), 'Hintergrund schliesst');
      await pg.click('#main .sidebtn'); await pg.click('#songList [data-act=open][data-id=seed-05]'); await pg.waitForFunction(() => App.songId === 'seed-05');
      ok(!(await pg.locator('#songList').isVisible()), 'Songwahl schliesst');
      await pg.click('#main [data-act=back]'); await pg.waitForSelector('#songList'); ok(await pg.locator('#songList').isVisible());
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
