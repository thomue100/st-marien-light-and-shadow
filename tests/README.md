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
| `e2e/bedienung.spec.js` | alle Ansichten und Karten (Symbolleiste und Menüs „Entdecken“, „⋯“), Knöpfe in den Karten, Tag vor/zurück, besondere Tage, Rundgang, Sprache, Ansichtstiefe, Teilen, Freie Sicht (F, Esc, Knopf, Doppeltipp), Zeitleiste mit zweiter Zeile und Sonne/Mond-Werten |
| `e2e/handy.spec.js` | Handy (nur die Sonnenuhr): Startseite, Ablesen, drei Blickwinkel, Schnellwahl, „In 3 Schritten erklärt“, „Mehr entdecken“, Sprache, Querformat |
| `e2e/handy-navigation.spec.js` | Handy-Navigation: jeder Übergang zwischen Startseite, Ablesen, Schritten, „Mehr entdecken“, „Alle Ansichten“ und Rundgang einmal, dazu ein Zufallsspaziergang (60 Tipps, bevorzugt selten getippte Knöpfe). Nach jedem Tipp gelten Prüfregeln: genau ein Bildschirm, immer ein sichtbarer Weg zurück, Blickwinkel-Knopf passend zur Ansicht, Bild über der Anzeige. Einen Spaziergang wiederholen: `WALK_SEED=… WALK_STEPS=… npx playwright test handy-navigation` (Startwert steht im Bericht) |
| `e2e/sonne-mond.spec.js` | Sonne und Mond finden: Randhinweise am Bildrand, „Blick zur Sonne“ / „Blick zum Mond“, Link, Mond unter dem Horizont |
| `e2e/webfassung.spec.js` | die ausgelieferten Fassungen ohne Testhaken: Webfassung (Menü, Link, Handy, keine fremden Server) und Offline-Datei |
| `e2e/helpers.js` | gemeinsame Hilfen: Öffnen, Warten auf den Aufbau und auf Kamerafahrten, Fingertipps ins Modell |
| `hooks.mjs` | Testhaken: macht interne Namen aller Module als `window.__…` erreichbar (Liste `HOOKS`); `npm run build:test` baut damit `tests/test.html` (eine Datei, wie die Offline-Fassung). Fehlt ein Name, bricht der Testbau ab. |

Die Software-Grafik lastet den Prozessor stark aus. Auf dem eigenen Rechner laufen die Tests deshalb immer unsichtbar und nur ein Browser zur Zeit; sichtbare Läufe (`--headed`, `--ui`, `--debug`) sind abgeschaltet und brechen mit einer Meldung ab. Am schonendsten ist es, die Tests auf GitHub laufen zu lassen (siehe unten).

Nützlich: `npx playwright test quiz` (nur ein Test, vorher einmal `npm run build && npm run build:test`), `npx playwright show-report tests/.report` (Bericht des letzten Laufs, mit Bildern zu jedem Schritt der fehlgeschlagenen Tests). In WebStorm: Startkonfiguration „Browser-Tests (npm run test:e2e)“.

## Auf GitHub

Alle Prüfungen sind ein Hinweis, keine Sperre: Ein rotes Kreuz verhindert weder das Übernehmen eines Pull Requests noch das Veröffentlichen über Vercel.

- **Code, Unit-Tests, Bau** (`.github/workflows/pruefungen.yml`) läuft automatisch bei jedem Pull Request nach `entwicklung` oder `main`, etwa 20 Sekunden: ESLint, Prettier, Unit-Tests, Bau; dazu die Prüfung, ob der eingecheckte Ordner `web/` zum Quelltext passt (Vercel liefert ihn direkt aus).
- **Browser-Tests** (`.github/workflows/browsertests.yml`) laufen nur von Hand, etwa 16 Minuten: „Actions“ → „Browser-Tests“ → „Run workflow“ → Zweig wählen. Der Bericht liegt danach unter „Actions“ → Lauf → „Artifacts“.

Die ausführliche Astronomie-Prüfung (`.github/workflows/astronomie.yml`) läuft montags, von Hand und bei Pull Requests, die `src/astro/` ändern.

## Von Hand auf dem Handy (vor größeren Übernahmen nach Produktion)

Was ein Programm nicht beurteilen kann – etwa fünf Minuten auf dem Galaxy S23, Vorschau-Link von `entwicklung`:

1. Startseite: alles lesbar, nichts abgeschnitten, Sprache DE/EN wechselt sauber.
2. „Selbst ausprobieren“: Fingergeste erscheint, das Modell schwenkt einmal kurz; Drehen und Zoomen mit den Fingern fühlt sich flüssig an.
3. Ablesen: Schatten auf dem Zifferblatt gut erkennbar; „Sonnenuhr zeigt“ und „Ihre Uhr“ passen zueinander.
4. Zeitschieber mit dem Daumen: lässt sich gut greifen, Schatten folgt ohne Ruckeln; Tag vor/zurück.
5. Schnellwahl Jetzt, 21. Juni, 21. Dez., Vollmond: jeweils ein sinnvolles, nicht dunkles Bild.
6. Himmel: Ziehen dreht den Himmel, zwei Finger zoomen.
7. „In 3 Schritten erklärt“: Texte vollständig lesbar, Bild passt zum Schritt.
8. „Mehr entdecken“ → Rundgang: Stationen lesbar, „mehr“ klappt lange Texte auf; Dachreiter (Steuerkreis zum Gehen).
9. Einklappen ▾/▴: mehr Bild, Uhrzeit bleibt sichtbar.
10. Querformat und Vollbild: Anzeige rechts, nichts überdeckt; „Link an mich senden“ öffnet das Teilen-Menü.
