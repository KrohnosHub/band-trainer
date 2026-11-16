# Band-Trainer

Übungs-App für Keyboard in der Coverband: pro Song Akkordraster für die rechte Hand, Bassline für die linke Hand (Notenbild im Bassschlüssel), Aufnahmen/Stems zum Mitspielen mit Tempo und Loop, Guide-Videos, Notizen, Setlist und Auftrittsmodus. Single-File-HTML-App (`index.html`), installierbar als PWA, offline nutzbar, Abgleich über Google Drive (Scope `drive.file`). Aufbau und Abläufe wie bei der Gesangs-App.

Adresse: **https://krohnoshub.github.io/band-trainer/**

## Einrichtung / Veröffentlichung

Die App besteht aus mehreren Dateien, die **zusammen im Hauptverzeichnis des GitHub-Pages-Repositories** `KrohnosHub/band-trainer` (Branch `main`) liegen:

| Datei / Ordner | Zweck |
|---|---|
| `index.html` | die App (CSP-Hashes der Inline-Skripte stehen im `<meta>`-Tag) |
| `sw.js` | Service Worker (Offline-Betrieb; `VERSION` und `VENDOR_CACHE` werden beim Release gesetzt) |
| `manifest.webmanifest` + `icons/` | Installation als App auf Handy/Tablet («Zum Startbildschirm») |
| `vendor/` | abcjs 6.7.2 lokal (Notensatz + Synth, kein CDN nötig – Voraussetzung für Offline) inkl. Lizenzdatei (MIT) |
| `tests/` | automatisierte Tests (siehe «Tests») |
| `tools/finalize.py` | Release-Hilfsskript (CSP-Hashes + `sw.js`-Version) |
| `tools/check-version.py` | prüft bei Pull Requests, dass die Version erhöht wurde |
| `tools/make-icons.py` | erzeugt die Icons neu (nur bei Änderung des Icons nötig, braucht Pillow) |
| `.github/workflows/tests.yml` | GitHub Action: Testsuite bei jedem Push/Pull Request |
| `CLAUDE.md` | verbindliche Regeln für die Weiterentwicklung mit Claude |

**Erstes Einrichten (einmalig):**

1. Repository `KrohnosHub/band-trainer` auf GitHub anlegen (öffentlich, leer) und diesen Stand nach `main` pushen.
2. Im Repository unter Settings → Pages: «Deploy from a branch», Branch `main`, Ordner `/ (root)`.
3. Google: nichts weiter nötig. Die App verwendet dieselbe OAuth-Client-ID wie die Gesangs-App; der JavaScript-Ursprung `https://krohnoshub.github.io` ist dort bereits eingetragen und gilt für alle Pfade. Dein Google-Konto muss wie bei der Gesangs-App als Testnutzer freigeschaltet sein.
4. YouTube-Vorschläge: Die App verwendet den YouTube-API-Schlüssel der Gesangs-App (gleiches Cloud-Projekt). Falls der Schlüssel in der Cloud Console per HTTP-Verweis auf `…/gesangs-app/*` eingeschränkt ist, dort `https://krohnoshub.github.io/band-trainer/*` ergänzen – sonst meldet die App «YouTube-Suche abgelehnt» und zeigt nur die Suchlinks.
5. App im Browser öffnen, auf Handy/Tablet «Zum Startbildschirm hinzufügen», im Menü (⋯) «Mit Google Drive verbinden».

**Veröffentlichen (pro Version):** GitHub Pages liefert direkt den Stand von `main` aus.

1. Änderung in `index.html` (und ggf. weiteren Dateien); `APP_VERSION` erhöhen und oben im Änderungslog einen Eintrag `### vX.Y.Z – …` ergänzen (sonst schlägt der Test in `01-static` fehl).
2. `python3 tools/finalize.py` – berechnet die CSP-Hashes neu (ohne sie startet die App nicht) und setzt die Version in `sw.js`.
3. `node tests/run.js` (Playwright + Chromium; Dauer ca. 1 Minute, optional Filter wie `node tests/run.js 05`).
4. Commit und Push nach `main`; GitHub Pages veröffentlicht automatisch. Parallel läuft die GitHub Action **«Tests»**: Sie prüft, dass `tools/finalize.py` nichts mehr ändert, und führt die Testsuite aus (Ergebnis im Tab «Actions»).

**Strengerer Ablauf (optional):** Änderungen auf einem Branch machen und per Pull Request nach `main` einspielen; mit einer Branch-Schutzregel («Require status checks to pass», Check `Tests`) lässt sich ein Merge bei roten Tests sperren. Solange direkt auf `main` gepusht wird, veröffentlicht GitHub Pages **vor** dem Testergebnis.

**Updates auf dem Gerät:** Die App lädt eine neue Version beim nächsten Öffnen mit Internet und aktualisiert sich im Leerlauf selbst; sonst erscheint «Neue Version – hier antippen». Im Menü steht die laufende Version; «Neu laden / Update suchen» erzwingt die Prüfung.

## Bedienung

**Songliste.** Suche, Filter «Alle / Setlist / To Do», «+ Song». 23 Songs der Band sind mit Titel, Interpret und (wo bekannt) BPM vorbefüllt, dazu ein Demo-Song. Tonarten, Akkorde, Basslines und Videos sind bewusst leer – eingetragen wird nur, was du geprüft hast.

**Setlist-Reihenfolge.** Filter «Setlist» → «Reihenfolge»: Einträge am Griff (⠿) ziehen oder mit ▲/▼ verschieben. Die Reihenfolge gilt für die Liste und den Auftrittsmodus und wird synchronisiert.

**Song → Noten.**
- *Akkorde (rechte Hand):* unter «Akkorde bearbeiten» zeilenweise eintragen, ein Takt pro Feld: `| A7 | D7 | A7 | A7 |`. Zeilen ohne `|` sind Abschnittstitel («Strophe», «Refrain»). A−/A+ ändert die Grösse.
- *Transponieren:* −/+ verschiebt die Anzeige in Halbtönen (wird pro Song gespeichert), «♯/♭» wechselt die Schreibweise, «Original» setzt zurück. Die Eingabe bleibt in der Originaltonart; das Notenbild und die Wiedergabe der Bassline folgen. Schreibweise der Akkorde: `C`, `F#`, `Bb`, `Am7`, `D/F#` (deutsches «H» wird nicht erkannt – `B` schreiben).
- *Bassline (linke Hand):* in ABC-Notation eintragen (Kurzhilfe in der App, vollständiges Beispiel im Demo-Song). «Bass anhören» spielt sie ab – online mit E-Bass-Klang (Soundfont von paulrosen.github.io), offline mit einem einfachen Synth-Bass.
- *Wach:* hält den Bildschirm an.

**Song → Audio.** Drei Slots: Original, Bass-Stem, Ohne Bass. Eigene Dateien laden (MP3, M4A, WAV, FLAC, OGG), pro Slot an/aus und Lautstärke, Schnellwahl. Player unten: Tempo 50–100 % ohne Tonhöhenänderung, A-B-Loop, ±5 s, Metronom und Einzähler (brauchen BPM). Stems erzeugst du extern (z. B. Moises, LALAL.AI, Demucs/UVR).

**Song → Videos.**
- *Referenzvideo:* YouTube-Link einfügen, wird eingebettet.
- *Vorschläge:* Beim ersten Öffnen des Tabs sucht die App über die YouTube Data API nach «Titel Interpret keyboard tutorial» und «… bass tutorial» (ergänzt um «… bass cover», falls weniger als drei Treffer) und zeigt je die besten drei Treffer als «Vorschlag». «Ansehen» bettet ein, «Übernehmen» legt den Link unter «Meine Links» ab, «Verwerfen» blendet ihn dauerhaft aus, «Neu suchen» holt frische Treffer. Es werden nur echte API-Treffer gezeigt; sie sind ungeprüft. Die Suche kostet API-Kontingent (pro Song 200–300 von standardmässig 10 000 Einheiten pro Tag, gemeinsam mit der Gesangs-App) – deshalb wird das Ergebnis gespeichert und nicht bei jedem Öffnen neu gesucht.
- *Suchen:* fertige Suchlinks (YouTube, Ultimate Guitar, Songsterr) – funktionieren auch ohne Schlüssel.

**Auftrittsmodus.** «▶ Auftritt» in der Liste (ab dem ersten Setlist-Song) oder im Song: Akkordraster im Vollbild mit Notizen, Bildschirm bleibt wach. Weiter/zurück: wischen, Pfeiltasten, Bild↑/Bild↓, Leertaste (auch Bluetooth-Pedale, die diese Tasten senden) oder die Knöpfe unten. Beenden mit ✕ oder Esc.

**Google Drive.** Menü (⋯) → «Mit Google Drive verbinden». Die App legt beim ersten Anmelden den Ordner **«Band-Trainer»** an (bzw. findet ihn auf einem weiteren Gerät über den Namen) und merkt sich seine ID:

| In Drive | Inhalt |
|---|---|
| `library.json` | Songs (inkl. Akkorde, Basslines, Links, Notizen, Reihenfolge, Transposition) und Einstellungen |
| `Stems/` | Audiodateien, die du pro Slot mit «In Drive sichern» hochlädst |
| `Backups/` | tägliche Sicherung `library-JJJJ-MM-TT.json`, die letzten 14 bleiben |

- **Der Ordner darf in Drive verschoben werden, z. B. nach «04_Band».** Die App findet ihn weiterhin: Sie hat ihn selbst erstellt, und seine ID ändert sich beim Verschieben nicht. Bitte nicht umbenennen und die Dateien nicht von Hand bearbeiten. (Der Hinweis erscheint einmalig auch in der App.)
- Abgleich: automatisch kurz nach jeder Änderung, beim Start, beim Zurückkehren in die App und nach Wiederverbindung. Pro Song gewinnt der zuletzt geänderte Stand; Löschungen werden als Löschmarken übertragen. Der Knopf oben rechts zeigt den Zustand («✓ Drive», «● offen», «Offline», «Anmelden») – antippen gleicht sofort ab.
- Offline-first: Ohne Netz oder Anmeldung läuft alles lokal; Änderungen werden gemerkt und später abgeglichen. Das Google-Token gilt ca. 1 Stunde und wird still erneuert; klappt das nicht, genügt ein Tipp.
- Stems: Audiodateien liegen lokal im Browser-Speicher. «In Drive sichern» lädt eine Datei in deinen Drive, auf einem anderen Gerät holt «Aus Drive laden» sie zurück. Nur für den eigenen Gebrauch – Dateien nicht weitergeben.
- «Sicherungen» im Menü: Stand eines Tages zurückholen (auch Gelöschtes; Songs, die es nur heute gibt, bleiben).
- Die App sieht in Drive ausschliesslich Dateien, die sie selbst angelegt hat (Scope `drive.file`).

**Export/Import (JSON)** im Menü: Sicherung ohne Drive bzw. Übertrag zwischen Geräten (ohne Audiodateien).

## Rechtliches (keine Rechtsberatung)

Das Repository enthält nur Code und ein eigenes, generisches Demo-Beispiel – keine Songtexte, kein Audio, keine Transkriptionen. Audiodateien stammen aus deinen eigenen, legal erworbenen Dateien und bleiben auf deinem Gerät bzw. in deinem privaten Drive. YouTube wird nur über die offizielle Einbettung und API genutzt. Eigene Akkord- und Bassnotizen gehören in deine Daten, nicht ins öffentliche Repository.

## Tests

`node tests/run.js [Filter]` startet einen eigenen lokalen Server und führt alle `tests/*.test.js` mit Playwright/Chromium aus. Voraussetzung: Playwright (global `npm i -g playwright` oder lokal `npm install --no-save playwright@1 && npx playwright install chromium`). Google und YouTube werden gestubbt (Token-Client-Attrappe, Drive-API als In-Memory-Attrappe in `tests/fixture.js`); es gehen keine Anfragen nach aussen.

| Datei | prüft |
|---|---|
| `01-static` | Version/Änderungslog, CSP-Hashes und erlaubte Hosts, keine Inline-Handler/CDN, `sw.js`-Version, Pflichtdateien, Konfiguration |
| `02-app` | Songliste, Suche/Filter, Anlegen/Bearbeiten/Löschen, Setlist-Reihenfolge (▲▼ und Ziehen), Import, Handy-Hochformat 390×844 |
| `03-player` | WAV-Stems laden (IndexedDB), Wiedergabe, Tempo, A-B-Loop, Mischung, Metronom, Entfernen |
| `04-noten` | ABC-Notenbild, Akkordraster, Transponieren, Bass-Wiedergabe (Oszillator-Ersatz), Auftrittsmodus |
| `05-sync` | Anmelden, Ordner/Unterordner, Merge zweier Geräte, Löschmarken, Offline → später abgleichen, 401, stille Anmeldung, Stems hoch/runter, Sicherungen (14 behalten, Wiederherstellen) |
| `06-videos` | Vorschläge aus der (gestubbten) YouTube-API, übernehmen/verwerfen/neu suchen, ohne Schlüssel und bei API-Fehler |
| `07-offline` | Service Worker: Start und Notenbild ohne Netz |

Nicht automatisiert prüfbar (einmal von Hand auf den echten Geräten testen): echte Google-Anmeldung und Drive, echte YouTube-Treffer, Soundfont-Klang, Tempoänderung ohne Tonhöhenänderung nach Gehör, Wake Lock/Vollbild auf iOS/Android, Installation als PWA.

## Änderungslog

### v1.0.0 – Erste einsatzbereite Version (16.11.2026)
- Aus dem Prototyp 0.1.0: Songliste (23 Songs + Demo), Player mit bis zu drei Stems, Tempo/Loop/Metronom/Einzähler, Akkordraster, Bassline in ABC mit Notenbild und Wiedergabe, YouTube-Einbettung, Link-Liste, Suchlinks, Export/Import.
- Neu: PWA mit Service Worker (Offline-Start, abcjs lokal in `vendor/`), strenge CSP ohne Inline-Handler.
- Neu: Google-Drive-Sync (`drive.file`): Ordner «Band-Trainer» mit `library.json`, «Stems» und «Backups»; Merge pro Song nach Änderungszeit, Löschmarken, offline-first, stille Re-Anmeldung, tägliche Sicherung (14 Stück) mit Wiederherstellen.
- Neu: Stems pro Slot «In Drive sichern» / «Aus Drive laden».
- Neu: Guide-Video-Vorschläge über die YouTube Data API (übernehmen/verwerfen).
- Neu: Setlist-Reihenfolge (Ziehen oder ▲/▼) und Auftrittsmodus (Vollbild, Wischen/Tasten, Bildschirm wach).
- Neu: Transponieren der Akkordanzeige pro Song (inkl. Notenbild und Bass-Wiedergabe).
- «Waiting for the Thunder» (Blackberry Smoke) und «Have You Ever Seen the Rain» (CCR) sind bestätigt – Hinweis «Angabe prüfen» entfernt.
