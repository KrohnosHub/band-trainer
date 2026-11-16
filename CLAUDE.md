# Band-Trainer – Hinweise für Claude

Single-File-PWA (`index.html`) zum Üben am Keyboard in der Band: Akkordraster, Bassline (ABC/abcjs), Stems mit Tempo/Loop, Guide-Videos, Setlist und Auftrittsmodus. Google-Drive-Sync (`drive.file`), gehostet über GitHub Pages direkt von `main` (https://krohnoshub.github.io/band-trainer/).
Aufbau und Abläufe sind bewusst gleich wie bei der Gesangs-App. Ausführliches steht im README (Abschnitt «Einrichtung / Veröffentlichung»); hier nur die verbindlichen Regeln.

## Kommunikation
- Deutsch (Schweizer Schreibweise: «ss» statt Eszett), Du-Form, kurz und konkret. Unsicherheiten offen benennen.
- Vor grösseren Umbauten Vorgehen kurz vorschlagen und bestätigen lassen.

## Jede Änderung an index.html = neue Version
1. **Vorher `git fetch origin main`** und auf dem neuesten Stand aufsetzen.
2. `APP_VERSION` in `index.html` erhöhen (höher als auf `origin/main`, nie doppelt vergeben).
3. Oben im Änderungslog im README einen Eintrag `### vX.Y.Z – …` ergänzen (Test `01-static` prüft das).
4. `python3 tools/finalize.py` – CSP-Hashes der Inline-Skripte sowie `VERSION`/`VENDOR_CACHE` in `sw.js` neu setzen. Ohne das startet die App nicht.
5. Tests: `node tests/run.js` (ca. 1 Min.; Filter z. B. `node tests/run.js 05`). Der Runner findet ein global installiertes Playwright selbst.
6. `python3 tools/check-version.py` – prüft, dass die Version höher als auf `origin/main` ist (läuft auch in der GitHub Action bei PRs).

## Inhalte
- Keine urheberrechtlich geschützten Inhalte ins Repo: keine Songtexte, kein Audio, keine Transkriptionen.
- Nichts erfinden: keine Akkorde, Tonarten, BPM, Basslines oder Video-IDs zu echten Songs aus dem Gedächtnis vorbefüllen. Ausnahmen: das eigene Demo-Beispiel (generischer 12-Takt-Blues) und `SEED_CHORDS` (ab v1.2.0: im Web recherchierte Akkordfolgen mit Quellenangabe, ohne Texte, Status «ungeprüft»). Video-Vorschläge stammen ausschliesslich aus echten API-Treffern.
- Die vorbefüllte Songliste (`SEED`) hat feste IDs (`seed-01` …) und `updatedAt: 0` – IDs nie ändern oder neu vergeben (Sync-Schlüssel).

## Daten und Sync
- Datenformat (`library.json`, `SCHEMA`) nur abwärtskompatibel erweitern; eingehende Daten immer durch `cleanData`/`cleanSong` führen.
- Merge-Regeln nicht aufweichen: pro Song und pro Liste (`lists`, ab v1.3.0) gewinnt das neuere `updatedAt`, gelöschte Listen als Löschmarke `list:<id>`, Löschungen sind Löschmarken (`deleted`), Stems werden pro Slot nach `u` zusammengeführt.
- Scope bleibt `drive.file`; die App fasst nur Dateien an, die sie selbst angelegt hat. Der Ordner wird über seine ID wiedergefunden (darf in Drive verschoben werden).

## Sicherheit
- Strenge CSP im `<meta>`-Tag: keine Inline-Event-Handler (`onclick="…"`), kein `eval`, neue externe Hosts nur bewusst in der CSP ergänzen (Test `01-static` führt eine Liste der erlaubten Hosts).
- Text aus fremden Quellen (Drive, Import, YouTube-/Spotify-API) nie ungefiltert per `innerHTML` einsetzen; `esc()` bzw. `textContent` nutzen, Links nur über `safeUrl()`.
- Keine Client-Secrets oder Tokens ins Repo (Spotify-Secret nur lokal pro Gerät). Der YouTube-API-Schlüssel im `CONFIG`-Block ist ein öffentlicher Browser-Schlüssel (wie in der Gesangs-App) und muss in der Google Cloud Console auf den Ursprung beschränkt sein.

## Commits / PRs
- Commit-Titel mit Version, z. B. `v1.0.1: Kurzbeschreibung`.
- Pull Requests nur auf Wunsch; sonst nach Absprache direkt auf `main`.
