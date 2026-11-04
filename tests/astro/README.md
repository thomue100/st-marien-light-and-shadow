# Astronomie-Prüfung

Prüft die Rechnungen des Lichtmodells gegen unabhängige Astronomie-Software.

```bash
npm install                               # einmalig
pip install skyfield skyfield-data ephem  # Referenz: Skyfield + JPL-Ephemeride DE421 (bis 2053), danach PyEphem
npm run test:astro                        # = node tests/astro/dump.mjs && python tests/astro/check.py
Y0=2041 Y1=2080 npm run test:astro        # anderer Zeitraum (Standard 2000–2040)
python3 tests/astro/check.py --usno       # zusätzlich U.S. Naval Observatory (Internet nötig)
```

1. `dump.mjs` importiert die Astronomie-Module aus `src/astro/` – geprüft wird also genau der Code, der im Browser läuft – und rechnet damit alle Prüffälle → `model.json`.
2. `check.py` rechnet dieselben Fälle mit Skyfield/DE421 (Zeitachse UT1) und der Zeitzonen-Datenbank (Europe/Berlin); Termine nach September 2053 (Ende von DE421) mit PyEphem, vergleicht und schreibt `report.md` und `report.html`. Rückgabewert 1, wenn eine Grenze überschritten ist.

| Prüfung | Referenz | Grenze |
|---|---|---|
| Höhe und Azimut von Sonne und Mond (Lübeck, mit Lichtbrechung) | Skyfield, topozentrisch, 10 °C / 1010 hPa | 0,04° (PyEphem 0,05°) |
| Auf- und Untergang von Sonne und Mond | Skyfield `find_risings/settings` (oberer Rand, Refraktion 34′) | 60 s |
| Wahrer Mittag (Sonnenuhr zeigt 12 Uhr) | Meridiandurchgang | 30 s |
| Neumond, Viertel, Vollmond | Skyfield `moon_phases` | 180 s (PyEphem 240 s) |
| Mondfinsternisse: Zeitpunkt, Art, Anzahl | Skyfield `eclipselib` | 120 s |
| Sonnenfinsternisse in Lübeck: Zeitpunkt, Bedeckung, Anzahl | Scheibenüberdeckung aus Skyfield-Örtern | 180 s, 2 % (Finsternisse am Horizont und streifende unter 1 % nur vermerkt) |
| Ortszeit ↔ UTC, Sommerzeit 1911–2080 | Python `zoneinfo` | exakt |

Nicht geprüft: die Astronomische Uhr (historisches Instrument, rechnet absichtlich mit ihren eigenen Übersetzungen).
timeanddate.com bietet keine freie Schnittstelle (nur eine kostenpflichtige API); deren Seiten automatisch auszulesen wäre gegen die Nutzungsbedingungen. Skyfield/DE421 ist genauer als die dort veröffentlichten, auf Minuten gerundeten Werte.

## Ergebnisse 1911–2080

Der wählbare Zeitraum der Anwendung (1911–2080, wie die Kalenderscheibe der Astronomischen Uhr) ist vollständig geprüft – alle Prüfungen bestanden:
[1911–1930](report-1911-1930.md) · [1931–1999](report-1931-1999.md) · [2000–2040](report-2000-2040.md) · [2041–2080](report-2041-2080.md).

Größte Abweichungen: Örter 0,03° (gegen PyEphem 0,042°), Auf-/Untergang 52 s, wahrer Mittag 3 s, Mondphasen 170 s (PyEphem 184 s), Mondfinsternisse 100 s, Sonnenfinsternisse 114 s und 1 % Bedeckung, Sommerzeit ohne Abweichung.
