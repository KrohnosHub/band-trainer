// v1.6.0: Setlist teilen (Text/Druck), Song aus Spotify-Link, Google-Dateiauswahl (gestubbt), Tonhöhe des Playbacks (AudioWorklet, gemessen)
const { launch, open, wav } = require('./fixture.js');
module.exports = async () => {
  const { test, eq, ok } = T;
  const b = await launch(); const D = { width: 1280, height: 800 };
  try {
    await test('Setlist teilen: Text mit Tonart (transponiert), BPM, Sound; Druckansicht mit Akkordblättern', async () => {
      const pg = await open(b, D, { init: () => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); window.__clip = ''; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__clip = t; return Promise.resolve(); } }, configurable: true }); window.print = () => { window.__printed = document.querySelector('#printArea').innerText; }; } });
      await pg.evaluate(() => { const s = Store.get('seed-03'); s.transpose = 2; s.sound.split = 'C3'; s.sound.right = 'Hammond-Orgel'; Store.touch(s); });
      await pg.click('[data-act=filter][data-f=list-setlist]'); await pg.click('[data-act=listShare]'); await pg.waitForSelector('#shareForm');
      await pg.click('[data-act=shareText]'); await pg.waitForFunction(() => window.__clip);
      const txt = await pg.evaluate(() => window.__clip);
      ok(/^Setlist\n1\. Blackwater Swagger – Blackwater Conspiracy \(85 BPM\)/.test(txt), txt.slice(0, 120));
      ok(/Hard to Handle – Black Crowes \(Tonart Db, 104 BPM\)\n   Split C3 · R: Hammond-Orgel/.test(txt), 'transponierte Tonart + Sound: ' + JSON.stringify(txt.slice(txt.indexOf('3.'), txt.indexOf('3.') + 120)));
      eq(txt.split('\n').filter(l => /^\d+\./.test(l)).length, 12);
      await pg.check('#shareForm [name=chords]'); await pg.click('[data-act=sharePrint]'); await pg.waitForFunction(() => window.__printed);
      const pr = await pg.evaluate(() => window.__printed);
      ok(/Setlist/.test(pr) && /12 Songs/.test(pr) && /Hard to Handle/.test(pr), 'Tabelle'); ok(await pg.locator('#printArea .psheet').count() >= 5, 'Akkordblätter');
      ok(await pg.evaluate(() => [...document.querySelectorAll('#printArea .psheet h2')].some(h => /Hard to Handle/.test(h.textContent))));
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Song aus Spotify-Link: Titel/Interpret übernommen, Link als bestätigter Spotify-Titel gespeichert', async () => {
      const pg = await open(b, D, { sp: () => [], cfg: { SPOTIFY_CLIENT_SECRET: 'sec' } });
      await pg.context().route(/^https:\/\/api\.spotify\.com\/v1\/tracks\//, r => r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ name: 'Mein Titel', artists: [{ name: 'Band A' }, { name: 'Gast B' }], duration_ms: 200000 }) }));
      await pg.click('header .addtop'); await pg.fill('#spLinkIn', 'https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=x'); await pg.click('[data-act=spLookup]');
      await pg.waitForFunction(() => document.querySelector('#songForm [name=title]').value === 'Mein Titel');
      eq(await pg.inputValue('#songForm [name=artist]'), 'Band A, Gast B');
      await pg.click('#songForm [type=submit]'); await pg.waitForSelector('#sTitle');
      eq(await pg.evaluate(() => App.current().spotify), { id: '4uLU6hMCjMI75M1A2tKUQC', name: 'Mein Titel', artists: 'Band A, Gast B', auto: false });
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Google-Dateiauswahl (gestubbt): Audiodatei in einen Slot, mehrere Notenblätter auf einmal; Startordner gesetzt', async () => {
      const pg = await open(b, D, { hash: '#/song/demo-blues', cfg: { YOUTUBE_API_KEY: 'BROWSERKEY' }, init: () => {
        localStorage.setItem('bt_hadlogin', '1');
        window.__pk = []; window.gapi = { load: (n, o) => o.callback() };
        const P = { ViewId: { DOCS: 'docs' }, Action: { PICKED: 'picked', CANCEL: 'cancel' }, Feature: { MULTISELECT_ENABLED: 'multi' },
          DocsView: class { constructor() { this.o = {}; } setIncludeFolders() { return this; } setSelectFolderEnabled() { return this; } setMimeTypes(m) { this.o.mime = m; return this; } setParent(p) { this.o.parent = p; return this; } },
          PickerBuilder: class { constructor() { this.o = {}; } addView(v) { this.o.view = v.o; return this; } setOAuthToken(t) { this.o.tok = t; return this; } setDeveloperKey(k) { this.o.key = k; return this; } setAppId(a) { this.o.app = a; return this; } setOrigin() { return this; } setLocale() { return this; } setTitle() { return this; } setCallback(c) { this.cb = c; return this; } enableFeature(f) { this.o.multi = f; return this; }
            build() { const me = this; return { setVisible() { window.__pk.push(me.o); const audio = /audio/.test(me.o.view.mime); setTimeout(() => me.cb({ action: 'picked', docs: audio ? [{ id: 'A1', name: 'bass.wav', mimeType: 'audio/wav' }] : [{ id: 'S1', name: 'a.png', mimeType: 'image/png' }, { id: 'S2', name: 'b.png', mimeType: 'image/png' }] }), 10); } }; } } };
        window.google = { picker: P }; } });
      await pg.evaluate(() => { Cloud.token = 'tok'; Cloud.exp = Date.now() + 3600e3; });
      await pg.evaluate(w => { const bytes = Uint8Array.from(atob(w), c => c.charCodeAt(0)); const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
        Picker.download = async d => new File([/audio/.test(d.mimeType) ? bytes : png], d.name, { type: d.mimeType }); }, wav(2, 8000, 110).toString('base64'));
      await pg.click('[data-act=tab][data-tab=audio]'); await pg.click('[data-act=pickDrive][data-slot=bass]');
      await pg.waitForFunction(() => Player.tracks.bass); eq(await pg.evaluate(() => App.current().stems.bass.name), 'bass.wav');
      await pg.click('[data-act=tab][data-tab=blaetter]'); await pg.click('#sheetAdd summary'); await pg.click('[data-act=sheetDrive]');
      await pg.waitForFunction(() => liveSheets(App.current()).length === 2);
      const pk = await pg.evaluate(() => window.__pk);
      eq([pk[0].view.parent, pk[1].view.parent, pk[1].multi, pk[0].key, pk[0].app], ['1JrlWj9_whlC4JvsSCavczD9rHp7Nhyfe', '13HO6QKgVt98zVcN87VmHJJu3rrEb8i7c', 'multi', 'BROWSERKEY', '159994249880']);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
    await test('Tonhöhe: Worklet verschiebt 440 Hz um +12 HT auf ~880 Hz und −5 HT auf ~330 Hz, 0 HT reicht durch; im Player eingehängt und gespeichert', async () => {
      const pg = await open(b, D, { hash: '#/song/demo-blues' });
      const f = await pg.evaluate(async () => {
        const meas = async st => { const c = new OfflineAudioContext(1, 44100 * 1.5, 44100); await c.audioWorklet.addModule('pitch-worklet.js');
          const o = c.createOscillator(); o.frequency.value = 440; const n = new AudioWorkletNode(c, 'pitch-shifter', { outputChannelCount: [1], processorOptions: { ratio: Math.pow(2, st / 12) } });
          o.connect(n).connect(c.destination); o.start(); const buf = await c.startRendering(), d = buf.getChannelData(0).subarray(44100 * 0.5); let z = 0; for (let i = 1; i < d.length; i++) if (d[i - 1] < 0 && d[i] >= 0) z++; return z; };
        return [await meas(12), await meas(-5), await meas(0)];
      });
      ok(Math.abs(f[0] - 880) < 880 * 0.05, '+12: ' + f[0]); ok(Math.abs(f[1] - 329.6) < 329.6 * 0.06, '−5: ' + f[1]); ok(Math.abs(f[2] - 440) < 5, '0: ' + f[2]);
      await pg.click('[data-act=tab][data-tab=audio]');
      await pg.setInputFiles('#file-original', { name: 'o.wav', mimeType: 'audio/wav', buffer: wav(3, 8000, 220) }); await pg.waitForFunction(() => Player.tracks.original);
      if (await pg.locator('#bMore').isVisible()) await pg.click('#bMore');
      await pg.click('#bPlay'); await pg.click('[data-act=shift][data-d="1"]'); await pg.click('[data-act=shift][data-d="1"]');
      await pg.waitForFunction(() => Player.tracks.original.shift);
      eq(await pg.evaluate(() => App.current().audioShift), 2); ok(/\+2 HT/.test(await pg.locator('#shiftBox').innerText()));
      await pg.evaluate(() => { const s = App.current(); s.transpose = -3; Store.touch(s); UI.shift(); }); await pg.click('[data-act=shift][data-v=chords]');
      eq(await pg.evaluate(() => App.current().audioShift), -3, 'wie Akkorde');
      await pg.reload(); await pg.waitForSelector('#sTitle'); eq(await pg.evaluate(() => App.current().audioShift), -3);
      eq(pg.errs, []); eq(pg.csp, []); await pg.context().close();
    });
  } finally { await b.close(); }
};
