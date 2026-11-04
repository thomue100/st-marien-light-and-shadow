# Tests

Automatische Prüfungen mit einem kopflosen Chromium (puppeteer-core + @sparticuz/chromium, nicht in package.json, da nur zum Testen; @sparticuz/chromium läuft nur unter Linux – die Umstellung auf Playwright folgt).

Vor den Browser-Tests einmal `npm run build:test` ausführen.

| Datei | Prüft |
|---|---|
| `hooks.mjs` | Testhaken (macht interne Werte als `window.__…` erreichbar); `npm run build:test` baut damit `tests/test.html` (eine Datei, wie die Offline-Fassung) |
| `acc.js` + `acc.py` | Sonnen- und Mondstand, Auf-/Untergänge und Mondphasen gegen PyEphem (`pip install ephem`) |
| `dst.js` | Zeitumstellung März/Oktober: angezeigte Ortszeit, UTC-Zeitpunkt, Hinweis |
| `qz2.js` | Quiz komplett durchspielen (richtige/falsche Antworten, Tipp, Überspringen, Fenster antippen) |

Ergebnis des Genauigkeitsvergleichs (Stand v42, 2026–2027): Sonne Höhe/Azimut max. 0,012°, Mond (ohne Refraktion) max. 0,007°, Auf-/Untergang Sonne und Mond max. 44 s (Standarddefinition: oberer Rand, Refraktion 34′), Voll-/Neumond max. 66 s.
| `mt.js` | Assistent „Mond zwischen den Türmen“: Draufsicht, Fingertipp auf die Achse, Terminsuche West/Ost, Kameraansicht |
| `exp.js` | Experimente 1–4: Sommer/Winter, Sonnenuhr und Armbanduhr, Lichtkalender (alle Fenster, Sprung per Fingertipp), Astronomische Uhr und Himmel |

Bekannt: `exp.js` bricht bei Experiment 4 ab (Schaltflächen `#auBtns [data-d]` gibt es nicht mehr); das betrifft schon den Stand v0.51 und wird mit der Umstellung auf Playwright bereinigt.
