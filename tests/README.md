# Tests

## Unit-Tests

`npm test` prüft die Astronomie-Module in `src/astro/` (Dateien in `unit/`): Sommerzeit gegen die Zeitzonen-Datenbank, Sonnen- und Mondstand, Auf- und Untergänge, wahrer Mittag, Mondphasen und Finsternisse gegen Referenzwerte aus Skyfield/JPL DE421, mit denselben Grenzen wie die ausführliche Prüfung in `astro/`. In WebStorm: Startkonfiguration „Unit-Tests (npm test)“ oder der grüne Pfeil neben einem Test.

## Browser-Tests

Automatische Prüfungen mit einem kopflosen Chromium (puppeteer-core + @sparticuz/chromium, nicht in package.json, da nur zum Testen; @sparticuz/chromium läuft nur unter Linux – die Umstellung auf Playwright folgt).

Vor den Browser-Tests einmal `npm run build:test` ausführen.

| Datei | Prüft |
|---|---|
| `hooks.mjs` | Testhaken: macht interne Namen aller Module als `window.__…` erreichbar (Liste `HOOKS`); `npm run build:test` baut damit `tests/test.html` (eine Datei, wie die Offline-Fassung). Fehlt ein Name, bricht der Testbau ab. |
| `acc.cjs` + `acc.py` | Sonnen- und Mondstand, Auf-/Untergänge und Mondphasen gegen PyEphem (`pip install ephem`) |
| `dst.cjs` | Zeitumstellung März/Oktober: angezeigte Ortszeit, UTC-Zeitpunkt, Hinweis |
| `qz2.cjs` | Quiz komplett durchspielen (richtige/falsche Antworten, Tipp, Überspringen, Fenster antippen) |

Ergebnis des Genauigkeitsvergleichs (Stand v42, 2026–2027): Sonne Höhe/Azimut max. 0,012°, Mond (ohne Refraktion) max. 0,007°, Auf-/Untergang Sonne und Mond max. 44 s (Standarddefinition: oberer Rand, Refraktion 34′), Voll-/Neumond max. 66 s.
| `mt.cjs` | Assistent „Mond zwischen den Türmen“: Draufsicht, Fingertipp auf die Achse, Terminsuche West/Ost, Kameraansicht |
| `exp.cjs` | Experimente 1–4: Sommer/Winter, Sonnenuhr und Armbanduhr, Lichtkalender (alle Fenster, Sprung per Fingertipp), Astronomische Uhr und Himmel |

Bekannt: `exp.cjs` bricht bei Experiment 4 ab (Schaltflächen `#auBtns [data-d]` gibt es nicht mehr); das betrifft schon den Stand v0.51 und wird mit der Umstellung auf Playwright bereinigt.
