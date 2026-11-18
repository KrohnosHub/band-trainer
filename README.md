# Band-Trainer

Übungs-App für Keyboard in der Coverband: pro Song Akkordraster mit Abschnitten für die rechte Hand, Notenblätter (PDF/Scan) mit Freihand-Notizen, Bassline für die linke Hand (Notenbild im Bassschlüssel), Aufnahmen/Stems zum Mitspielen mit Tempo und Loop, Guide-Videos, Notizen, Setlist und Auftrittsmodus. Single-File-HTML-App (`index.html`), installierbar als PWA, offline nutzbar, Abgleich über Google Drive (Scope `drive.file`). Aufbau und Abläufe wie bei der Gesangs-App.

Adresse: **https://krohnoshub.github.io/band-trainer/**

## Einrichtung / Veröffentlichung

Die App besteht aus mehreren Dateien, die **zusammen im Hauptverzeichnis des GitHub-Pages-Repositories** `KrohnosHub/band-trainer` (Branch `main`) liegen:

| Datei / Ordner | Zweck |
|---|---|
| `index.html` | die App (CSP-Hashes der Inline-Skripte stehen im `<meta>`-Tag) |
| `sw.js` | Service Worker (Offline-Betrieb; `VERSION` und `VENDOR_CACHE` werden beim Release gesetzt) |
| `manifest.webmanifest` + `icons/` | Installation als App auf Handy/Tablet («Zum Startbildschirm») |
| `vendor/` | abcjs 6.7.2 (Notensatz + Synth, MIT) und pdf.js 6.3.289 (Notenblätter; inkl. Wasm-Decoder und Ersatzschriften, Apache-2.0) lokal – kein CDN nötig, Voraussetzung für Offline; Lizenzdateien liegen bei |
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
- *Akkorde (rechte Hand):* unter «Akkorde bearbeiten» zeilenweise eintragen, ein Takt pro Feld: `| A7 | D7 | A7 | A7 |`. Abschnitte stehen in eckigen Klammern auf einer eigenen Zeile (`[Intro]`, `[Verse]`; Zeilen ohne `|` gelten ebenfalls als Abschnitt) und werden hervorgehoben. Wiederholungen hinter der Zeile: `| Bm A | E |  (x4)` (auch `x4`, `4x`). A−/A+ ändert die Grösse.
- *Akkord-Quelle und Status:* im selben Bereich eine URL als Quelle und den Status «ungeprüft / geprüft» hinterlegen; der Status erscheint als Badge beim Song und in der Liste.
- *Transponieren:* −/+ verschiebt die Anzeige in Halbtönen (wird pro Song gespeichert), «♯/♭» wechselt die Schreibweise, «Original» setzt zurück. Die Eingabe bleibt in der Originaltonart; das Notenbild und die Wiedergabe der Bassline folgen. Schreibweise der Akkorde: `C`, `F#`, `Bb`, `Am7`, `D/F#` (deutsches «H» wird nicht erkannt – `B` schreiben).
- *Bassline (linke Hand):* in ABC-Notation eintragen (Kurzhilfe in der App, vollständiges Beispiel im Demo-Song). «Bass anhören» spielt sie ab – online mit E-Bass-Klang (Soundfont von paulrosen.github.io), offline mit einem einfachen Synth-Bass.
- *Wach:* hält den Bildschirm an.

**Song → Blätter.**
- *Notenblätter:* pro Song beliebig viele PDFs oder Bilder (Scan, Foto – auf dem Handy bietet die Dateiauswahl auch die Kamera an) mit Bezeichnung und Typ (Leadsheet/Akkorde, Klaviernoten, Bassnoten/Tabs, Sonstiges). «Öffnen» zeigt das Blatt bildschirmfüllend: blättern mit ‹ ›, Wischen, Pfeiltasten oder Bild↑/Bild↓, Zoom −/+, Umschalter «Seitenbreite / Ganze Seite», Esc schliesst.
- *Freihand-Notizen:* Stift, Marker und Radierer (löscht ganze Striche), je vier Farben, Rückgängig. Gespeichert wird pro Blatt und Seite; «Lesen» schaltet zurück auf Scrollen/Blättern.
- *✎:* Bezeichnung und Typ ändern, das Blatt für den Auftrittsmodus wählen oder entfernen.
- *Quellen:* Suchlinks zu Hooktheory TheoryTab, Musicnotes und Sheet Music Direct (jeweils als Google-Suche mit `site:`) sowie Ultimate Guitar. Songtexte und Melodien sind urheberrechtlich geschützt – gekaufte oder selbst gedruckte Blätter als PDF/Scan hinterlegen, nur für den eigenen Gebrauch.

**Song → Audio.** Drei Slots: Original, Bass-Stem, Ohne Bass. Eigene Dateien laden (MP3, M4A, WAV, FLAC, OGG), pro Slot an/aus und Lautstärke, Schnellwahl. Player unten: Tempo 50–100 % ohne Tonhöhenänderung, A-B-Loop, ±5 s, Metronom und Einzähler (brauchen BPM). Stems erzeugst du extern (z. B. Moises, LALAL.AI, Demucs/UVR).

**Song → Videos.**
- *Referenzvideo:* YouTube-Link einfügen, wird eingebettet.
- *Vorschläge:* Beim ersten Öffnen des Tabs sucht die App über die YouTube Data API nach «Titel Interpret keyboard tutorial» und «… bass tutorial» (ergänzt um «… bass cover», falls weniger als drei Treffer) und zeigt je die besten drei Treffer als «Vorschlag». «Ansehen» bettet ein, «Übernehmen» legt den Link unter «Meine Links» ab, «Verwerfen» blendet ihn dauerhaft aus, «Neu suchen» holt frische Treffer. Es werden nur echte API-Treffer gezeigt; sie sind ungeprüft. Die Suche kostet API-Kontingent (pro Song 200–300 von standardmässig 10 000 Einheiten pro Tag, gemeinsam mit der Gesangs-App) – deshalb wird das Ergebnis gespeichert und nicht bei jedem Öffnen neu gesucht.
- *Suchen:* fertige Suchlinks (YouTube, Hooktheory, Musicnotes, Sheet Music Direct, Ultimate Guitar, Songsterr) – funktionieren auch ohne Schlüssel.

**Auftrittsmodus.** «▶ Auftritt» in der Liste (ab dem ersten Setlist-Song) oder im Song: Akkordraster im Vollbild mit Notizen, Bildschirm bleibt wach. Hat ein Song Notenblätter, wählst du oben zwischen «Akkordraster» und einem Blatt (wird pro Song gemerkt); beim Blatt blättern Wischen/Tasten/Pedal zuerst durch dessen Seiten und dann zum nächsten Song. Weiter/zurück: wischen, Pfeiltasten, Bild↑/Bild↓, Leertaste (auch Bluetooth-Pedale, die diese Tasten senden) oder die Knöpfe unten. Beenden mit ✕ oder Esc.

**Google Drive.** Menü (⋯) → «Mit Google Drive verbinden». Die App legt beim ersten Anmelden den Ordner **«Band-Trainer»** an (bzw. findet ihn auf einem weiteren Gerät über den Namen) und merkt sich seine ID:

| In Drive | Inhalt |
|---|---|
| `library.json` | Songs (inkl. Akkorde, Basslines, Links, Notizen, Reihenfolge, Transposition) und Einstellungen |
| `Stems/` | Audiodateien, die du pro Slot mit «In Drive sichern» hochlädst |
| `Notenblätter/` | Notenblätter (PDF/Bild) und daneben pro Blatt die Freihand-Notizen als `….annotations.json`; entsteht mit dem ersten Blatt |
| `Backups/` | tägliche Sicherung `library-JJJJ-MM-TT.json`, die letzten 14 bleiben |

- **Der Ordner darf in Drive verschoben werden, z. B. nach «04_Band».** Die App findet ihn weiterhin: Sie hat ihn selbst erstellt, und seine ID ändert sich beim Verschieben nicht. Bitte nicht umbenennen und die Dateien nicht von Hand bearbeiten. (Der Hinweis erscheint einmalig auch in der App.)
- Abgleich: automatisch kurz nach jeder Änderung, beim Start, beim Zurückkehren in die App und nach Wiederverbindung. Pro Song gewinnt der zuletzt geänderte Stand; Löschungen werden als Löschmarken übertragen. Der Knopf oben rechts zeigt den Zustand («✓ Drive», «● offen», «Offline», «Anmelden») – antippen gleicht sofort ab.
- Offline-first: Ohne Netz oder Anmeldung läuft alles lokal; Änderungen werden gemerkt und später abgeglichen. Das Google-Token gilt ca. 1 Stunde und wird still erneuert; klappt das nicht, genügt ein Tipp.
- Stems: Audiodateien liegen lokal im Browser-Speicher. «In Drive sichern» lädt eine Datei in deinen Drive, auf einem anderen Gerät holt «Aus Drive laden» sie zurück. Nur für den eigenen Gebrauch – Dateien nicht weitergeben.
- Notenblätter: werden beim Abgleich automatisch in den Unterordner «Notenblätter» hochgeladen und auf anderen Geräten automatisch geholt (damit sie am Auftritt offline bereitliegen). Bei den Freihand-Notizen gewinnt pro Blatt der zuletzt geänderte Stand; gleichzeitiges Zeichnen auf zwei Geräten am selben Blatt wird nicht zusammengeführt.
- «Sicherungen» im Menü: Stand eines Tages zurückholen (auch Gelöschtes; Songs, die es nur heute gibt, bleiben).
- Die App sieht in Drive ausschliesslich Dateien, die sie selbst angelegt hat (Scope `drive.file`).

**Export/Import (JSON)** im Menü: Sicherung ohne Drive bzw. Übertrag zwischen Geräten (ohne Audiodateien und Notenblätter).

**Akkorde importieren (JSON)** im Menü: liest eine Datei der Form `{"songs":[{"title":"…","artist":"…","key":"Bm","chords":"[Intro]\n| Bm A | E |","chordSource":"https://…","chordStatus":"ungeprüft"}]}` (`chords` als Text oder als Liste von Zeilen; `chordStatus` «geprüft»/`checked` oder «ungeprüft»/`unchecked`). Die Einträge werden über Titel + Interpret den vorhandenen Songs zugeordnet – unabhängig von Gross-/Kleinschreibung, Satzzeichen, Klammerzusätzen, «The», «&/N/and» und Abkürzungen wie «CCR». Eine Vorschau zeigt pro Eintrag den zugeordneten Song und was sich ändert; überschrieben werden nur Tonart, Akkorde, Akkord-Quelle und Status der angehakten Songs. Weicht der Interpret ab, ist der Eintrag nicht vorausgewählt; ohne Treffer wird nichts angelegt.

## Rechtliches (keine Rechtsberatung)

Das Repository enthält nur Code und ein eigenes, generisches Demo-Beispiel – keine Songtexte, kein Audio, keine Transkriptionen. Audiodateien und Notenblätter stammen aus deinen eigenen, legal erworbenen Dateien und bleiben auf deinem Gerät bzw. in deinem privaten Drive. YouTube wird nur über die offizielle Einbettung und API genutzt. Eigene Akkord- und Bassnotizen gehören in deine Daten, nicht ins öffentliche Repository.

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
| `07-offline` | Service Worker: Start und Notenbild ohne Netz, pdf.js samt Worker/Wasm/Schriften aus dem Cache |
| `08-blaetter` | Notenblätter: Test-PDF über pdf.js rendern, Bild-Upload, Blättern/Zoom/Seitenbreite, Freihand-Notizen speichern/laden, Drive-Abgleich (Attrappe) mit zwei Geräten, Abschnitte + Transponieren, Quellen-Links, Akkord-Import mit Zuordnung und Vorschau, Notenblatt im Auftrittsmodus |

Nicht automatisiert prüfbar (einmal von Hand auf den echten Geräten testen): echte Google-Anmeldung und Drive, echte YouTube-Treffer, die Suchlinks zu den Noten-Quellen, Zeichnen mit Stift/Finger und Kamera-Aufnahme auf Handy/Tablet, Soundfont-Klang, Tempoänderung ohne Tonhöhenänderung nach Gehör, Wake Lock/Vollbild auf iOS/Android, Installation als PWA.

## Änderungslog

### v1.9.0 – Notenblätter: Seitenbreite als Standard, Zwei-Seiten-Ansicht
- Hochgeladene Blätter öffnen immer im Modus «Lesen» und in **Seitenbreite** (vorher wurde die zuletzt gewählte Ansicht gemerkt). Im Auftrittsmodus weiterhin ganze Seite, damit beim Spielen nichts gescrollt werden muss. Umschalten wie bisher per Knopf.
- **Zwei Seiten nebeneinander** (Knopf ▯▯, wie in der Gesangs-App): im Querformat (Tablet quer, Desktop) Seiten paarweise 1–2, 3–4 …; Blättern springt um zwei Seiten, Notizen sind auf beiden Seiten sichtbar. Beim Zeichnen (Stift/Marker/Radierer) automatisch einseitig. Die Einstellung wird gemerkt und gilt auch im Auftrittsmodus.

### v1.8.2 – Akkorde auf Tablet und Desktop kleiner
- Standardgrösse der Akkorde in der Song-Ansicht und im Auftrittsmodus ab 600 px Breite um zwei A−-Stufen verkleinert (×0,7). Handy unverändert (v1.8.1); A−/A+ wie bisher.

### v1.8.1 – Akkorde am Handy kompakter
- In der Akkordansicht und im Auftrittsmodus sind Schrift, Kacheln, Abstände und Abschnittstitel unter 600 px Breite deutlich kleiner (Auftrittsmodus ca. ⅓ kleiner). Mit A−/A+ lässt sich weiter verkleinern (bis 50 %) oder vergrössern.

### v1.8.0 – Akkorde anhören (Klavier, Orgel, Gitarre, Hammond)
- **▶ im Akkord-Lexikon** (pro Zeile), im Antipp-Fenster eines Akkords und auf den Voicing-Karten: Der Akkord erklingt zuerst zusammen, danach die Töne einzeln aufsteigend (Arpeggio abschaltbar).
- **Vier Klänge** (im Lexikon wählbar, gemerkt): **Klavier** – Samples «Salamander Grand Piano V3» (CC BY 3.0, wie in der Gesangs-App); **Orgel (leise)** – echte Pfeifenorgel, leise Registrierung (VSCO 2 CE, CC0, wie Notator «Orgel – sanft»); **Gitarre** – gezupfte Saite (Karplus-Strong, wie Gesangs-App); **Hammond** – Synthese nach Registerzügen (Standard 888000000, im Song die Registerzüge aus dem Sound-Setup), mit Perkussion, Tastenklick und Chorus-Vibrato.
- Samples (`samples/piano`, `samples/organ`, je mit LICENSE.txt) werden erst beim ersten Anhören geladen und danach offline zwischengespeichert.

### v1.7.0 – Akkord-Lexikon, Töne direkt an den Akkorden
- **Akkord-Lexikon** (Symbol ♫ in der Kopfzeile der Songliste, Link unter dem Akkordraster): alle gängigen Akkordtypen – Dur, Moll, Powerchord, vermindert, übermässig, sus2/sus4, 6, m6, 7, maj7, m7, m(maj7), halbvermindert (m7♭5), vermindert-sept (dim7), 7sus4, add9, 6/9, 9, m9, maj9, 7♭9, 7♯9, 11, m11, 13 – mit Tönen, Aufbau (1 ♭3 5 …), alternativen Schreibweisen und Klaviatur (Zeile antippen). Grundton frei wählbar (auch ♯/♭).
- **Töne an den Akkord-Kacheln:** Mit der Maus auf einen Akkord zeigen = Tooltip mit den Tönen (z. B. «C: C E G»); antippen = kleines Fenster mit Tönen, Aufbau und Klaviatur (nochmals tippen oder daneben schliesst). Funktioniert auch transponiert und bei Folgen ohne Taktstriche.
- Töne werden nach Stufen geschrieben (E♭-Moll = E♭ G♭ B♭, C°7 enthält B𝄫); dieselbe Akkordtabelle nutzen Voicing-Hilfe und Bassline-Vorschlag. «6/9» wird nicht mehr als Slash-Akkord missverstanden.

### v1.6.0 – Setlist teilen/PDF, Song aus Spotify-Link, Dateien aus Drive, Tonhöhe des Playbacks
- **Teilen / PDF** (bei gewählter Liste): Setlist als Text teilen (Teilen-Menü des Handys bzw. Zwischenablage) oder als Druckansicht – im Druckdialog «Als PDF speichern». Wählbar: Tonart (wie angezeigt, inkl. Transponieren), BPM, Sound-Setup, Notizen, Akkordblätter anhängen (je Song eine Seite).
- **Song aus Spotify-Link:** Im Song-Dialog Spotify-Link einfügen → «Übernehmen» füllt Titel und Interpret (braucht Spotify-Zugangsdaten); der Link wird als bestätigter Spotify-Titel gespeichert.
- **Aus Drive wählen:** Audiodateien (pro Slot «Aus Drive») und Notenblätter («Aus Drive wählen», mehrere auf einmal) direkt aus deiner Drive-Ablage übernehmen; die Auswahl startet in «04_Band/Audio & Stems» bzw. «04_Band/Noten & Tabs». Technisch: Google-Dateiauswahl (Picker) – gibt der App genau die gewählten Dateien frei, Scope bleibt `drive.file`. **Voraussetzung:** Im Google-Cloud-Projekt muss die «Google Picker API» aktiviert und für den Browser-Schlüssel erlaubt sein.
- **Tonhöhe Audio** (Player → «Tempo»): Playback in Halbtönen verschieben (−12 … +12), unabhängig vom Tempo; «= Akkorde» übernimmt die Transposition der Akkordanzeige. Läuft als AudioWorklet (`pitch-worklet.js`) in Echtzeit – Klang für Übezwecke gut, leichte Artefakte möglich.

### v1.5.0 – Sound-Setup, Voicing-Hilfe, Bassline-Vorschlag
- **Sound-Setup pro Song** (Tab «Noten»): Split-Punkt, Sound links/rechts (mit Vorschlagsliste), Orgel-Registerzüge (9 Ziffern 0–8, als Balken dargestellt) und Sound-Notizen. Erscheint im Auftrittsmodus gross unter dem Titel.
- **Griffe · Voicing-Hilfe:** Jeder Akkord des Songs einmal auf einer Mini-Klaviatur – rechte Hand als Umkehrung mit möglichst kleinen Wegen zum vorherigen Akkord (Voice Leading, Lage F3–C6), linke Hand Grundton bzw. Basston bei Slash-Akkorden. Folgt dem Transponieren. Akkorde mit unbekanntem Zusatz werden genannt statt falsch dargestellt.
- **Bassline-Vorschlag:** Unter «Bassline bearbeiten» aus den Akkorden eine Bassline erzeugen – Stile Rock-Achtel, Grundton–Quinte, Country «Boom-Chick», Blues-Shuffle, Walking. Ergibt ABC im Bassschlüssel (Lage E2–D#3, Akkordsymbole über den Noten, Abschnitte als Kommentar), sofort anhörbar. Generiert, keine Transkription – als Startpunkt; vorhandene Bassline wird nur nach Rückfrage ersetzt.

### v1.4.0 – Takt-Raster, Abschnitts-Loops, Metronom im Songtakt, mitlaufendes Akkordraster
- **Takt-Raster** (Player → «Tempo»): Beim Abspielen auf eine «1» tippen («1 tippen»). Das erste Tippen legt Takt 1 fest (am besten die erste «1» des Songs); weiteres Tippen auf irgendeine «1» korrigiert nur die Phase. Feinjustierung ◀ ▶ (20 ms), Taktart 4/4 · 3/4 · 6/4. Grundlage ist die BPM-Angabe des Songs.
- **Abschnitte:** «+ Abschnitt» setzt an der aktuellen Stelle eine Marke (mit Raster auf den Takt gerundet; Namen aus dem Akkordblatt oder Intro/Strophe/Refrain/…). Antippen springt hin, ⟲ spielt den Abschnitt in Schleife (bis zum nächsten Abschnitt bzw. Songende), ✎ zum Umbenennen, Verschieben, Löschen.
- **Metronom im Songtakt:** Mit Raster und geladenem Audio klickt das Metronom genau auf den Schlägen des Songs (auch bei reduziertem Tempo), Betonung auf der 1. Ohne Raster wie bisher frei nach BPM.
- **Mitlaufendes Akkordraster:** Der aktuelle Takt wird im Akkordraster hervorgehoben und bei Bedarf ins Bild gescrollt; Anzeige «Takt n · Abschnitt». Mit Abschnittsmarken wird der passende Abschnitt im Akkordblatt gesucht (auch Strophe = Verse, Refrain = Chorus) – so stimmt es auch, wenn das Blatt jeden Abschnitt nur einmal aufführt. Ohne Marken läuft es linear über die ausgeschriebenen Takte (Wiederholungen mitgezählt). Funktioniert für Akkordzeilen mit Taktstrichen «|»; «Mitlaufen» lässt sich ausschalten.

### v1.3.1 – Favoriten-Stern korrigiert
- Ein Favorit zeigte einen farbigen Kasten statt des Sterns (allgemeiner «aktiv»-Knopfstil griff). Jetzt nur noch ein gelber, ausgefüllter Stern ★ – in der Übersicht und in der Song-Ansicht, hell und dunkel.

### v1.3.0 – Eigene Listen, Favoriten, kompakte Übersicht
- **Listen:** Statt der festen Status «Setlist»/«To Do» gibt es frei anlegbare Listen («+ Liste»). Pro Liste: Songs wählen (Häkchen-Auswahl mit Filter), Reihenfolge (Ziehen, ▲/▼, ✕ zum Entfernen), Umbenennen, Liste löschen (Songs bleiben). Ein Song kann in mehreren Listen stehen; im Song-Dialog per Häkchen. Der Auftrittsmodus spielt die gewählte Liste (sonst die erste). Bisherige Daten werden automatisch zu den Listen «Setlist» und «To Do» (gleiche Reihenfolge).
- **Favoriten:** Stern ☆/★ in der Übersicht und in der Song-Ansicht, Filter «★ Favoriten» (wie in der Gesangs-App).
- **Übersicht:** Zwei Zeilen pro Titel (Titel / Interpret); BPM, Tonart, Akkord-Status, Spotify usw. stehen nur noch in der Song-Ansicht.
- **Sync:** Listen werden pro Liste nach dem neueren Stand abgeglichen, gelöschte Listen als Löschmarke. Datenformat SCHEMA 4 (abwärtskompatibel).

### v1.2.2 – Transponieren auch ohne Taktstriche, YouTube mit Premium
- **Akkorde:** Akkordfolgen ohne Taktstriche (z. B. «A – D/F# G – D/F# A (x2)», so bei vielen recherchierten Songs) werden jetzt als einzelne Akkorde erkannt, transponiert und als Kacheln angezeigt; vorher galten sie als Abschnittstitel und blieben unverändert. Hinweise wie «Über Verse-Folge» oder «(wiederholen)» bleiben normaler Text.
- **YouTube:** Einbettung über youtube.com statt youtube-nocookie.com, damit die Anmeldung im Browser (YouTube Premium, werbefrei) gilt. Zusätzlich Knopf «In YouTube öffnen» unter jedem Video – öffnet die YouTube-App, falls der Browser die Anmeldung in Einbettungen blockiert.

### v1.2.1 – Automatisch mit Drive verbunden, Suchfeld ohne Autofill, kompakter am Handy
- **Drive:** Ist auf demselben Gerät/Browser die Gesangs-App angemeldet, verbindet sich der Band-Trainer jetzt still und automatisch mit demselben Konto (gleicher Ursprung, gleicher OAuth-Client) – ohne Tippen. Das Google-Skript wird immer schon beim Start geladen, damit «Mit Google Drive verbinden» das Fenster direkt im ersten Tipp öffnet (vorher teils vom Popup-Blocker geschluckt → mehrfaches Tippen nötig). Konto-Hinweis aus der Gesangs-App wird mitbenutzt. Nach «Abmelden» im Band-Trainer wird nicht mehr automatisch verbunden.
- **Suchfeld:** Der Browser hat dort gespeicherte Zugangsdaten (Spotify-Client-ID) eingefüllt, auch nach dem Löschen wieder. Das Suchfeld ist jetzt für Autofill gesperrt (erst beim Antippen beschreibbar, Eingaben ohne Fokus werden ignoriert); das Spotify-Secret-Feld ist kein Passwortfeld mehr, damit der Browser es nicht als Login speichert.
- **Song-Ansicht:** Die Reiter (Noten, Blätter, Audio, Videos, Info) bleiben beim Scrollen oben sichtbar.
- **Handy:** Schrift, Knöpfe, Karten und Listeneinträge kompakter (unter 600 px Breite).
- **Guide-Videos:** Vorschläge getrennt in «Piano / Keyboard» und «Bass», kleinere Vorschaubilder, Titel max. zwei Zeilen, kompakte Knöpfe (Verwerfen als ✕); Spotify-Player in kompakter Höhe.

### v1.2.0 – Spotify pro Song, Akkorde vorbelegt, «+ Song» gut sichtbar
- **Spotify:** Jeder Song (auch neu angelegte oder umbenannte) wird automatisch mit dem passenden Spotify-Titel verknüpft – nur wenn Interpret und Titel passen (Abkürzungen wie «CCR», Zusätze wie «Remaster» werden erkannt), sonst bleibt der Song ohne Link. Automatische Treffer sind «Vorschlag» und lassen sich übernehmen, neu suchen oder entfernen. Spotify-Player im Tab «Videos», Badge «Spotify» in der Liste, Link auch von Hand einfügbar.
- **Zugangsdaten:** Client-Credentials wie in der Gesangs-App. Auf demselben Gerät/Browser werden die dort gespeicherten Spotify-Zugangsdaten mitbenutzt (gleicher Ursprung `krohnoshub.github.io`); sonst unter «Daten & Einstellungen → Spotify» eintragen (nur lokal gespeichert, nie im Code oder in Drive).
- **Akkorde vorbelegt:** Für 19 der 23 Songs sind recherchierte Akkordfolgen pro Abschnitt hinterlegt (keine Texte, auf klingende Tonart umgerechnet, Quelle verlinkt, Status «ungeprüft»). Bestehende Geräte erhalten sie einmalig für Songs mit leerem Akkordfeld; vorhandene eigene Akkorde bleiben unverändert.
- **«+ Song»** zusätzlich oben in der Kopfzeile der Songliste; der Knopf unten rechts heisst jetzt «+ Neuer Song».

### v1.1.0 – Notenblätter (PDF/Scan), Abschnitte in Akkorden, Quellen-Links, Akkord-Import (16.11.2026)
- Neu: Tab «Blätter» – mehrere PDFs oder Bilder (Scan/Foto) pro Song mit Bezeichnung und Typ; Anzeige über pdf.js (lokal in `vendor/`, offline), Blättern per Wischen/Tasten, Zoom, Seitenbreite/ganze Seite. Viewer und Zeichnen aus der Gesangs-App übernommen und reduziert.
- Neu: Freihand-Notizen auf den Blättern (Stift, Marker, Radierer, Rückgängig), pro Seite gespeichert.
- Neu: Drive-Abgleich der Blätter in den Unterordner «Notenblätter» (automatisch hoch und auf anderen Geräten herunter), Notizen als JSON neben der Datei; Merge pro Blatt nach Änderungszeit wie bei den Stems, Löschungen als Löschmarken.
- Neu: Auftrittsmodus zeigt wahlweise das Akkordraster oder ein Notenblatt; Tasten/Wischen blättern erst die Seiten, dann zum nächsten Song.
- Neu: Akkordfeld mit Abschnitten (`[Intro]`, `[Verse]`) und Wiederholungen (`(x4)`); Abschnitte hervorgehoben, im Auftrittsmodus gross. Transponieren unverändert.
- Neu: pro Song «Akkord-Quelle» (URL) und Status «ungeprüft / geprüft» als Badge.
- Neu: «Akkorde importieren (JSON)» mit unscharfer Zuordnung über Titel + Interpret und Vorschau; überschreibt nur Tonart, Akkorde, Quelle und Status.
- Neu: Suchlinks zu Hooktheory TheoryTab, Musicnotes und Sheet Music Direct (Google-Suche mit `site:`), Hinweis zum Urheberrecht.
- Technik: Datenformat `SCHEMA` 3 (neue Felder `sheets`, `stageSheet`, `chordSource`, `chordStatus`; abwärtskompatibel). CSP um `'wasm-unsafe-eval'` ergänzt (nur WebAssembly für die Bild-Decoder von pdf.js, kein JS-`eval`); Service Worker hält pdf.js vorab bereit (`vendor/` jetzt ca. 3,5 MB).

### v1.0.0 – Erste einsatzbereite Version (16.11.2026)
- Aus dem Prototyp 0.1.0: Songliste (23 Songs + Demo), Player mit bis zu drei Stems, Tempo/Loop/Metronom/Einzähler, Akkordraster, Bassline in ABC mit Notenbild und Wiedergabe, YouTube-Einbettung, Link-Liste, Suchlinks, Export/Import.
- Neu: PWA mit Service Worker (Offline-Start, abcjs lokal in `vendor/`), strenge CSP ohne Inline-Handler.
- Neu: Google-Drive-Sync (`drive.file`): Ordner «Band-Trainer» mit `library.json`, «Stems» und «Backups»; Merge pro Song nach Änderungszeit, Löschmarken, offline-first, stille Re-Anmeldung, tägliche Sicherung (14 Stück) mit Wiederherstellen.
- Neu: Stems pro Slot «In Drive sichern» / «Aus Drive laden».
- Neu: Guide-Video-Vorschläge über die YouTube Data API (übernehmen/verwerfen).
- Neu: Setlist-Reihenfolge (Ziehen oder ▲/▼) und Auftrittsmodus (Vollbild, Wischen/Tasten, Bildschirm wach).
- Neu: Transponieren der Akkordanzeige pro Song (inkl. Notenbild und Bass-Wiedergabe).
- «Waiting for the Thunder» (Blackberry Smoke) und «Have You Ever Seen the Rain» (CCR) sind bestätigt – Hinweis «Angabe prüfen» entfernt.
