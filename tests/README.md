# Tests

## Unit-Tests

`npm test` prüft die Astronomie-Module in `src/astro/` (Dateien in `unit/`): Sommerzeit gegen die Zeitzonen-Datenbank, Sonnen- und Mondstand, Auf- und Untergänge, wahrer Mittag, Mondphasen und Finsternisse gegen Referenzwerte aus Skyfield/JPL DE421, mit denselben Grenzen wie die ausführliche Prüfung in `astro/`. In WebStorm: Startkonfiguration „Unit-Tests (npm test)“ oder der grüne Pfeil neben einem Test.

## Browser-Tests (Playwright)

`npm run test:e2e` baut Web-, Offline- und Testfassung und spielt dann die Bedienung in Chromium durch (Dateien in `e2e/`). Die Tests laufen mit Software-Grafik (SwiftShader), also auch ohne Grafikkarte, z. B. auf GitHub. Jeder Test scheitert, sobald im Browser eine Fehlermeldung erscheint. „Heute“ ist in allen Tests fest der 5. November 2026, damit Termine (Quiz, Terminsuche) nicht vom Testtag abhängen.

| Datei | Prüft |
|---|---|
| `e2e/zeitumstellung.spec.js` | Zeitumstellung März/Oktober: angezeigte Ortszeit, Zeitzone, UTC-Zeitpunkt, Hinweis |
| `e2e/quiz.spec.js` | Quiz komplett: einstellen, ablesen, falsche und richtige Antworten, Tipp, Fenster im Modell antippen |
| `e2e/mond-tuerme.spec.js` | Mond zwischen den Türmen: Standort per Fingertipp, Terminsuche West/Ost, Blick vom Standort |
| `e2e/experimente.spec.js` | Experimente 1–4 mit den berechneten Werten (Schattenlänge, Zeitgleichung, Lichtkalender, Uhr und Himmel) |
| `e2e/bedienung.spec.js` | alle Ansichten und Karten, Knöpfe in den Karten, Tag vor/zurück, besondere Tage, Rundgang, Sprache, Ansichtstiefe, Teilen |
| `e2e/webfassung.spec.js` | die ausgelieferten Fassungen ohne Testhaken: Webfassung (Menü, Link, Handy, keine fremden Server) und Offline-Datei |
| `e2e/helpers.js` | gemeinsame Hilfen: Öffnen, Warten auf den Aufbau und auf Kamerafahrten, Fingertipps ins Modell |
| `hooks.mjs` | Testhaken: macht interne Namen aller Module als `window.__…` erreichbar (Liste `HOOKS`); `npm run build:test` baut damit `tests/test.html` (eine Datei, wie die Offline-Fassung). Fehlt ein Name, bricht der Testbau ab. |

Nützlich: `npx playwright test quiz` (nur ein Test), `npm run test:e2e:ui` (Tests im Fenster ansehen, Schritt für Schritt), `npx playwright show-report tests/.report` (Bericht des letzten Laufs). In WebStorm: Startkonfiguration „Browser-Tests (npm run test:e2e)“ oder der grüne Pfeil neben einem Test (Playwright-Unterstützung ist eingebaut).

## Auf GitHub

Bei jedem Pull Request nach `entwicklung` oder `main` laufen automatisch (`.github/workflows/pruefungen.yml`):

1. **Code, Unit-Tests, Bau:** ESLint, Prettier, Unit-Tests, Bau; dazu die Prüfung, ob der eingecheckte Ordner `web/` zum Quelltext passt (Vercel liefert ihn direkt aus).
2. **Browser-Tests (Playwright):** alle Tests aus `e2e/`; der Bericht liegt danach unter „Actions“ → Lauf → „Artifacts“.

Die ausführliche Astronomie-Prüfung (`.github/workflows/astronomie.yml`) läuft montags, von Hand und bei Pull Requests, die `src/astro/` ändern.
