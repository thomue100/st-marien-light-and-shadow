# St. Marien zu Lübeck – Licht und Schatten

Interaktives 3D-Modell der Marienkirche zu Lübeck (three.js r128). Es zeigt Sonnen- und Mondlicht zu jeder Stunde des Jahres:

1. **die Kirche als riesige Sonnenuhr** – der Schatten der Türme über die Stadt,
2. **die Sonnenuhr am Südturm** (in 16 m Höhe) mit wahrer Ortszeit, Zeitgleichung und Mondzeit,
3. **die Astronomische Uhr** mit Kalenderscheibe und Finsternissen,
4. **das Licht im Kirchenraum** – Lichtbahnen durch die Fenster und die farbigen Glasmalereien.

Dazu gibt es einen geführten Rundgang (8 Stationen), ein Quiz mit 5 Aufgaben, die im Modell gelöst werden, den Jahreslauf im Zeitraffer, eine Himmelsansicht mit Sonnen- und Mondbahn, „Blick zur Sonne“ und „Blick zum Mond“ (mit Hinweisen am Bildrand, wenn Sonne oder Mond außerhalb des Bildes stehen), die „Freie Sicht“ ohne Bedienelemente (Taste F) sowie eine deutsche und eine englische Oberfläche.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Seitengerüst: alle Bedienelemente (Markup) |
| `src/app.js` | Render-Schleife und Start (lädt über die Aufbau-Reihenfolge alle anderen Module) |
| `src/core/` | `loader.js` (Ladeanzeige), `util.js` (Helfer), `i18n.js` (Sprache, Zahlen- und Zeitformat), `prefs.js` (einfache/erweiterte Bedienung) |
| `src/state.js` | gemeinsamer Zustand: Datum, Uhrzeit, Ansicht, Schalter; Sonnenstand und Lichtrichtung |
| `src/scene/` | `renderer.js` (Renderer, Szene, „neu zeichnen“), `textures.js`, `shaders.js`, `materials.js`, `camera.js` (Ansichten, Steuerung, Blick zu Sonne und Mond), `labels.js` (Beschriftungen, Randhinweise für Sonne und Mond) |
| `src/model/` | `measures.js` (Maße der Kirche), `geometry.js` (Bauteile, Fensterliste), `church.js`, `clock.js` (Astronomische Uhr), `environment.js` (Umgebung), `sundial.js` (Sonnenuhr) |
| `src/ui/` | Bedienoberfläche: `readouts.js` (Tagesdiagramm, Kompass, Anzeigen), `controls.js` (Datum, Uhrzeit, besondere Tage, Regler), `year.js` (Jahr im Zeitraffer), `panels.js` (Schalter, Karten, Menüs, Glossar, Sprachwechsel), `clockcard.js` (Karte Astronomische Uhr), `tour.js` (Rundgang), `moontowers.js` (Mond zwischen den Türmen), `experiments.js`, `quiz.js`, `share.js` (Teilen, Bild speichern) |
| `src/light/` | `sky.js` (Sonne, Mond, Himmel, Bahnen), `windows.js` (Licht durch die Fenster), `sun.js` (Licht anwenden, Finsternisse) |
| `src/astro/` | Astronomie ohne 3D und ohne Seite: `time.js` (Ortszeit, Sommerzeit), `sun.js`, `moon.js`, `eclipses.js`, `common.js` (Ort Lübeck, Umrechnungen) |
| `src/three-global.js` | three.js r128 aus npm, bereitgestellt als globales `THREE` |
| `src/data.js` | lädt Glasmalereien, Uhrbilder, Uhrendaten und Umgebung |
| `src/styles/` | `app.css` (Gestaltung), `fonts.css` (Schriften) |
| `src/data/` | `uhr.json` (Kalender- und Finsternisdaten der Astronomischen Uhr), `umgebung.json` (LoD2-Gebäude, Gelände, Bäume; Altstadtinsel mit Bodenkarte aus OpenStreetMap) |
| `src/assets/` | `glas/` Glasmalereien (Dateiname = Fenstertyp), `uhr/` Bilder der Astronomischen Uhr, `fonts/` Schriften mit Lizenz |
| `public/` | wird unverändert in die Webfassung kopiert (`.htaccess`, `LIESMICH.txt`) |
| `web/` | **Webfassung** zum Hochladen auf den Webserver (erzeugt mit `npm run build:web`, siehe `web/LIESMICH.txt`) |
| `tests/` | Prüfungen: `unit/` Unit-Tests (Vitest), `e2e/` Browser-Tests (Playwright), `astro/` Vergleich mit Skyfield – siehe `tests/README.md` |
| `tools/` | Aufbereitung von Daten: `altstadtinsel/` (LoD2-Kacheln und OpenStreetMap → Umgebung der ganzen Altstadtinsel), `glas/` (Fotos der Glasfenster entzerren) |
| `vite.config.mjs` | Bauanleitung für Web-, Offline- und Testfassung |

### Aufbau-Reihenfolge der Module

Die Module bauen das Modell beim Laden der Seite in einer festen Reihenfolge auf – derselben wie früher in der einen großen Datei:

`core/loader → core/util → core/i18n → core/prefs → model/measures → state → scene/renderer → scene/textures → scene/shaders → scene/materials → model/geometry → model/church → model/clock → model/environment → model/sundial → light/sky → light/windows → light/sun → scene/camera → scene/labels → ui/readouts → ui/controls → ui/year → ui/panels → ui/clockcard → ui/tour → ui/moontowers → ui/experiments → ui/quiz → ui/share → ui/phone → app`

Dafür importiert jedes Modul **als Erstes seinen Vorgänger** (Kommentar „Aufbau-Reihenfolge“), `app.js` als Erstes `ui/phone.js`. Ein neues Modul fügt man an der passenden Stelle in diese Kette ein (Vorgänger als ersten Import, Nachfolger importiert das neue Modul als Erstes). Darüber hinaus dürfen sich Module gegenseitig importieren, auch „vorwärts“ (z. B. ruft `light/sun.js` die Kamera auf). Zwei Regeln:

- **Beim Laden** nur benutzen, was weiter vorn in der Reihenfolge steht. Funktionen aus späteren Modulen erst aufrufen, wenn alles aufgebaut ist (in Ereignissen oder ab dem Start in `app.js`).
- **Variablen eines anderen Moduls nicht neu zuweisen** (`LANG = …` geht dort nicht). Dafür gibt es Setter im Modul selbst, z. B. `setLang()`, `setExpert()`, `requestRender()` (statt früher `dirty = true`), `setMoonMag()`, `setExpReady()`.

## Entwickeln

Voraussetzung: Node.js 20.19 oder neuer (22 LTS empfohlen).

```bash
npm install            # einmalig: Vite und three.js
npm run dev            # Entwicklungsserver unter http://localhost:5173 – lädt bei jeder gespeicherten Änderung neu
npm run build          # web/ und dist/St-Marien-Licht-und-Schatten-offline.html
npm run preview        # gebaute Webfassung lokal unter http://localhost:8000 ansehen
npm test               # Unit-Tests (Astronomie, Zeitumstellung) – dauert etwa 2 Sekunden
npm run test:e2e       # Browser-Tests (Playwright): baut alles, spielt die Bedienung unsichtbar durch, etwa 20 Minuten – lieber auf GitHub
npm run lint           # ESLint: findet Fehler wie vertippte oder fehlende Namen
npm run format         # Prettier: formatiert den Code einheitlich (npm run format:check prüft nur)
```

In WebStorm stehen dieselben Befehle oben rechts in der Liste der Startkonfigurationen (Ordner `.run/`).

WebStorm erkennt ESLint und Prettier an ihren Konfigurationsdateien (`eslint.config.mjs`, `.prettierrc.json`):

- **ESLint:** Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint → „Automatic ESLint configuration“. Fehler werden dann direkt im Editor rot unterstrichen.
- **Prettier:** Settings → Languages & Frameworks → JavaScript → Prettier → „Automatic Prettier configuration“ und „Run on save“. Dann formatiert WebStorm jede Datei beim Speichern.
- Reine Formatierungs-Commits stehen in `.git-blame-ignore-revs`; GitHub blendet sie bei „Blame“ aus. Für die Kommandozeile einmalig `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

- **Webfassung** (`web/`): Programm, Gestaltung, Schriften, Daten und Bilder als eigene Dateien, keine Verbindungen zu fremden Servern. Die Pfade sind relativ, die Fassung läuft daher in jedem Unterordner.
- **Offline-Fassung** (`dist/…-offline.html`): alles in einer einzigen Datei, startet per Doppelklick ohne Server.
- **Browser:** Chrome, Edge und Firefox ab Version 89, Safari ab 15 (alle seit 2021) – die Module laden mit `await` auf oberster Ebene.
- `web/` wird mit eingecheckt, weil der Webserver (Vercel) diesen Ordner direkt ausliefert. Nach einer Änderung also `npm run build:web` ausführen und `web/` mit committen.

## Zweige

- `main` – **Produktion**: was hier liegt, ist öffentlich.
- `entwicklung` – Testfassung; Vercel baut dafür eine Vorschau.
- Änderungen entstehen auf eigenen Zweigen und kommen per Pull Request nach `entwicklung`. Nach `main` nur nach Freigabe.

## Einbetten in die Website der Kirche

```html
<iframe src="/licht-und-schatten/" style="width:100%;height:80vh;border:0"
        allow="fullscreen; web-share; clipboard-write" title="St. Marien – Licht und Schatten"></iframe>
```

## Hinweise

- Fotos der Glasmalereien und der Astronomischen Uhr: Nutzung für dieses Projekt freigegeben; vor einer Weitergabe die Bildrechte prüfen.
- Gebäude der Umgebung: vereinfachte Klötzchen nach Kartendaten.
