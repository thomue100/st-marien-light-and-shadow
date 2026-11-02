# Tests

Automatische Prüfungen mit einem kopflosen Chromium (puppeteer-core + @sparticuz/chromium, nicht in package.json, da nur zum Testen).

| Datei | Prüft |
|---|---|
| `mk.sh` | erzeugt `test.html` aus `../src/marienkirche.html` mit lokalem three.js und Testhaken |
| `acc.js` + `acc.py` | Sonnen- und Mondstand, Auf-/Untergänge und Mondphasen gegen PyEphem (`pip install ephem`) |
| `dst.js` | Zeitumstellung März/Oktober: angezeigte Ortszeit, UTC-Zeitpunkt, Hinweis |
| `qz2.js` | Quiz komplett durchspielen (richtige/falsche Antworten, Tipp, Überspringen, Fenster antippen) |

Ergebnis des Genauigkeitsvergleichs (Stand v42, 2026–2027): Sonne Höhe/Azimut max. 0,012°, Mond (ohne Refraktion) max. 0,007°, Auf-/Untergang Sonne und Mond max. 44 s (Standarddefinition: oberer Rand, Refraktion 34′), Voll-/Neumond max. 66 s.
| `mt.js` | Assistent „Mond zwischen den Türmen“: Draufsicht, Fingertipp auf die Achse, Terminsuche West/Ost, Kameraansicht |
