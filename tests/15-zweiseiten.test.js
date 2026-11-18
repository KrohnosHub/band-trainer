// v1.9.0: Notenblatt öffnet in «Lesen» + Seitenbreite, Zwei-Seiten-Ansicht (Querformat, Paare, Blättern um 2, beim Zeichnen einseitig, gemerkt)
const { launch, open } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch();
  const pdf3 = () => { // kleine 3-seitige PDF (Text «Seite n»)
    const objs = [], add = s => { objs.push(s); return objs.length; };
    const pages = [1, 2, 3].map(n => n);
    add('<< /Type /Catalog /Pages 2 0 R >>'); add('PAGES');
    const kids = [];
    for (const n of pages) { const c = `BT /F1 48 Tf 72 700 Td (Seite ${n}) Tj ET`; const ci = add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`); kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${ci} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>`)); }
    objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
    let out = '%PDF-1.4\n', offs = []; objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const x = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
    return Buffer.from(out, 'latin1');
  };
  const openSheet = async (pg, init) => {
    await pg.waitForSelector('#sTitle'); await pg.click('[data-act=tab][data-tab=blaetter]'); await pg.click('#sheetAdd summary');
    await pg.setInputFiles('#sheetFile', { name: 'noten.pdf', mimeType: 'application/pdf', buffer: pdf3() });
    await pg.waitForSelector('#sheetList [data-act=sheetOpen]'); await pg.click('#sheetList [data-act=sheetOpen]');
    await pg.waitForFunction(() => Viewer.ready && Viewer.pageCv);
  };
  try {
    await test('Öffnet in «Lesen» + Seitenbreite (alte globale Einstellung ignoriert), Umstellung wird pro Blatt gemerkt', async () => {
      const pg = await open(b, { width: 1280, height: 800 }, { hash: '#/song/seed-05', init: () => localStorage.setItem('bt_fit', 'page') });
      await openSheet(pg);
      eq(await pg.evaluate(() => [Viewer.fit, Viewer.tool, document.querySelector('#vFit').textContent]), ['width', 'view', 'Seitenbreite']);
      ok(await pg.evaluate(() => Math.abs(document.querySelector('#vStack').offsetWidth - document.querySelector('#vWrap').clientWidth) < 30), 'volle Breite');
      await pg.click('#vFit'); eq(await pg.evaluate(() => [Viewer.fit, document.querySelector('#vFit').textContent]), ['page', 'Ganze Seite']);
      await pg.click('[data-act=vClose]'); await pg.click('#sheetList [data-act=sheetOpen]'); await pg.waitForFunction(() => Viewer.ready);
      eq(await pg.evaluate(() => Viewer.fit), 'page', 'pro Blatt gemerkt');
      await pg.click('#vFit'); await pg.click('[data-act=vClose]'); await pg.reload(); await pg.waitForSelector('#sTitle'); await pg.click('[data-act=tab][data-tab=blaetter]');
      await pg.click('#sheetList [data-act=sheetOpen]'); await pg.waitForFunction(() => Viewer.ready); eq(await pg.evaluate(() => Viewer.fit), 'width', 'zurückgestellt bleibt gemerkt');
      // anderes Blatt startet in Seitenbreite, auch wenn dieses auf «Ganze Seite» steht
      await pg.click('#vFit'); await pg.click('[data-act=vClose]');
      await pg.setInputFiles('#sheetFile', { name: 'zwei.pdf', mimeType: 'application/pdf', buffer: pdf3() }); await pg.waitForFunction(() => document.querySelectorAll('#sheetList [data-act=sheetOpen]').length === 2);
      await pg.click('#sheetList [data-act=sheetOpen] >> nth=1'); await pg.waitForFunction(() => Viewer.ready); eq(await pg.evaluate(() => Viewer.fit), 'width', 'anderes Blatt');
      eq(pg.errs, []); await pg.context().close();
    });
    await test('Zwei Seiten: im Querformat Paare 1–2, 3; Blättern um zwei; beim Zeichnen einseitig; im Hochformat einseitig; gemerkt', async () => {
      const pg = await open(b, { width: 1280, height: 800 }, { hash: '#/song/seed-05' });
      await openSheet(pg);
      await pg.click('#vSpread'); await pg.waitForFunction(() => !document.querySelector('#vStack2').hidden);
      eq(await pg.locator('#vPos').innerText(), '1–2 / 3');
      eq(await pg.evaluate(() => [Viewer.curFit(), document.querySelector('#vFit').textContent]), ['page', 'Ganze Seiten'], 'Doppelseite standardmässig ganz');
      ok(await pg.evaluate(() => document.querySelector('#vStack').getBoundingClientRect().height <= document.querySelector('#vWrap').clientHeight + 1), 'beide Seiten ganz sichtbar');
      await pg.click('#vFit'); await pg.waitForTimeout(300); eq(await pg.evaluate(() => Viewer.curFit()), 'width');
      const r = await pg.evaluate(() => { const a = document.querySelector('#vStack').getBoundingClientRect(), b2 = document.querySelector('#vStack2').getBoundingClientRect(); return [Math.abs(a.top - b2.top) < 2, b2.left > a.right, b2.right <= innerWidth + 1]; });
      eq(r, [true, true, true], 'nebeneinander, passt in die Breite');
      await pg.click('#vNext'); await pg.waitForFunction(() => Viewer.page === 3 && document.querySelector('#vStack2').hidden); eq(await pg.locator('#vPos').innerText(), '3 / 3');
      await pg.click('#vPrev'); await pg.waitForFunction(() => Viewer.page === 1);
      await pg.click('[data-act=vTool][data-tool=pen]'); await pg.waitForFunction(() => document.querySelector('#vStack2').hidden); eq(await pg.locator('#vPos').innerText(), '1 / 3', 'Zeichnen = einseitig');
      await pg.click('[data-act=vTool][data-tool=view]'); await pg.waitForFunction(() => !document.querySelector('#vStack2').hidden);
      eq(await pg.evaluate(() => localStorage.getItem('bt_spread')), '1');
      await pg.setViewportSize({ width: 600, height: 900 }); await pg.evaluate(() => Viewer.render()); await pg.waitForFunction(() => document.querySelector('#vStack2').hidden);
      eq(await pg.locator('#vPos').innerText(), '1 / 3', 'Hochformat einseitig');
      eq(pg.errs, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
