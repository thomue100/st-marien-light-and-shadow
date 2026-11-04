# St. Marien zu Lübeck – Licht und Schatten

Interaktives 3D-Modell der Marienkirche zu Lübeck (three.js r128). Es zeigt Sonnen- und Mondlicht zu jeder Stunde des Jahres:

1. **die Kirche als riesige Sonnenuhr** – der Schatten der Türme über die Stadt,
2. **die Sonnenuhr am Südturm** (in 16 m Höhe) mit wahrer Ortszeit, Zeitgleichung und Mondzeit,
3. **die Astronomische Uhr** mit Kalenderscheibe und Finsternissen,
4. **das Licht im Kirchenraum** – Lichtbahnen durch die Fenster und die farbigen Glasmalereien.

Dazu gibt es einen geführten Rundgang (8 Stationen), ein Quiz mit 5 Aufgaben, die im Modell gelöst werden, den Jahreslauf im Zeitraffer, eine Himmelsansicht mit Sonnen- und Mondbahn sowie eine deutsche und eine englische Oberfläche.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Seitengerüst: alle Bedienelemente (Markup) |
| `src/app.js` | das Programm (noch in einem Stück; wird in den nächsten Umbauschritten in Module aufgeteilt) |
| `src/astro/` | Astronomie ohne 3D und ohne Seite: `time.js` (Ortszeit, Sommerzeit), `sun.js`, `moon.js`, `eclipses.js`, `common.js` (Ort Lübeck, Umrechnungen) |
| `src/three-global.js` | three.js r128 aus npm, bereitgestellt als globales `THREE` |
| `src/data.js` | lädt Glasmalereien, Uhrbilder, Uhrendaten und Umgebung |
| `src/styles/` | `app.css` (Gestaltung), `fonts.css` (Schriften) |
| `src/data/` | `uhr.json` (Kalender- und Finsternisdaten der Astronomischen Uhr), `umgebung.json` (LoD2-Gebäude, Gelände, Bäume) |
| `src/assets/` | `glas/` Glasmalereien (Dateiname = Fenstertyp), `uhr/` Bilder der Astronomischen Uhr, `fonts/` Schriften mit Lizenz |
| `public/` | wird unverändert in die Webfassung kopiert (`.htaccess`, `LIESMICH.txt`) |
| `web/` | **Webfassung** zum Hochladen auf den Webserver (erzeugt mit `npm run build:web`, siehe `web/LIESMICH.txt`) |
| `tests/` | Prüfungen: `unit/` Unit-Tests (Vitest), `astro/` Vergleich mit Skyfield, Browser-Tests – siehe `tests/README.md` |
| `vite.config.mjs` | Bauanleitung für Web-, Offline- und Testfassung |

## Entwickeln

Voraussetzung: Node.js 20.19 oder neuer (22 LTS empfohlen).

```bash
npm install            # einmalig: Vite und three.js
npm run dev            # Entwicklungsserver unter http://localhost:5173 – lädt bei jeder gespeicherten Änderung neu
npm run build          # web/ und dist/St-Marien-Licht-und-Schatten-offline.html
npm run preview        # gebaute Webfassung lokal unter http://localhost:8000 ansehen
npm test               # Unit-Tests (Astronomie, Zeitumstellung) – dauert etwa 2 Sekunden
```

In WebStorm stehen dieselben Befehle oben rechts in der Liste der Startkonfigurationen (Ordner `.run/`).

- **Webfassung** (`web/`): Programm, Gestaltung, Schriften, Daten und Bilder als eigene Dateien, keine Verbindungen zu fremden Servern. Die Pfade sind relativ, die Fassung läuft daher in jedem Unterordner.
- **Offline-Fassung** (`dist/…-offline.html`): alles in einer einzigen Datei, startet per Doppelklick ohne Server.
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
