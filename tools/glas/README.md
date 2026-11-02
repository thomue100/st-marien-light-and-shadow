# Fensterbilder

Die Glasmalereien werden als Fotos in den Atlas gelegt (`glassdata` in `src/marienkirche.html`, Schlüssel = Fenstertyp).

| Typ | Fenster | Quelle |
|---|---|---|
| 0 | Westfenster (Auferstehungsfenster, H. G. von Stockhausen) | Foto, Herkunft noch zu klären – möglichst durch eigenes Foto ersetzen |
| 1 | Totentanzfenster rechts („DEO“), A. Mahlau | eigenes Foto 2026, entzerrt |
| 2 | Briefkapelle (J. Schreiter), eine Bahn | eigenes Foto 2026, entzerrt |
| 4 | Tympanon über dem Nordportal (M. Lüpertz) | eigenes Foto 2026, zugeschnitten |
| 5 | Wappenfenster (Marientidenkapelle / Gedenkkapelle im Südturm) | eigenes Foto 2026, entzerrt (ersetzt das Wikimedia-Foto von Arnoldius) |
| 6 | Totentanzfenster links (Papst), A. Mahlau | eigenes Foto 2026, entzerrt |

`entzerren.py` zeigt das Verfahren: Homographie aus den Glaskanten in zwei Höhen (Trapez → Rechteck), dann Scheitel bis Unterkante auf das Seitenverhältnis des Modellfensters.
