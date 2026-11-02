# Astronomie-Prüfung

Prüft die Rechnungen des Lichtmodells gegen unabhängige Astronomie-Software.

```bash
npm install                               # einmalig (acorn für die Code-Entnahme)
pip install skyfield skyfield-data        # Referenz: Skyfield + JPL-Ephemeride DE421 (offline)
npm run test:astro                        # = node tests/astro/dump.js && python3 tests/astro/check.py
Y0=2000 Y1=2040 npm run test:astro        # anderer Zeitraum
python3 tests/astro/check.py --usno       # zusätzlich U.S. Naval Observatory (Internet nötig)
```

1. `extract.js` holt die Astronomie-Funktionen **unverändert** aus `src/marienkirche.html` (Syntaxbaum, mit allen Abhängigkeiten) – geprüft wird also genau der Code, der im Browser läuft.
2. `dump.js` rechnet damit alle Prüffälle → `model.json`.
3. `check.py` rechnet dieselben Fälle mit Skyfield/DE421 und der Zeitzonen-Datenbank (Europe/Berlin), vergleicht und schreibt `report.md` und `report.html`. Rückgabewert 1, wenn eine Grenze überschritten ist.

| Prüfung | Referenz | Grenze |
|---|---|---|
| Höhe und Azimut von Sonne und Mond (Lübeck, mit Lichtbrechung) | Skyfield, topozentrisch, 10 °C / 1010 hPa | 0,03° |
| Auf- und Untergang von Sonne und Mond | Skyfield `find_risings/settings` (oberer Rand, Refraktion 34′) | 60 s |
| Wahrer Mittag (Sonnenuhr zeigt 12 Uhr) | Meridiandurchgang | 30 s |
| Neumond, Viertel, Vollmond | Skyfield `moon_phases` | 90 s |
| Mondfinsternisse: Zeitpunkt, Art, Anzahl | Skyfield `eclipselib` | 120 s |
| Sonnenfinsternisse in Lübeck: Zeitpunkt, Bedeckung, Anzahl | Scheibenüberdeckung aus Skyfield-Örtern | 180 s, 2 % |
| Ortszeit ↔ UTC, Sommerzeit 1981–2040 | Python `zoneinfo` | exakt |

Nicht geprüft: die Astronomische Uhr (historisches Instrument, rechnet absichtlich mit ihren eigenen Übersetzungen).
timeanddate.com bietet keine freie Schnittstelle (nur eine kostenpflichtige API); deren Seiten automatisch auszulesen wäre gegen die Nutzungsbedingungen. Skyfield/DE421 ist genauer als die dort veröffentlichten, auf Minuten gerundeten Werte.
