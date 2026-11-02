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
| `src/marienkirche.html` | Arbeitsdatei: das ganze Programm in einer Datei; Daten (Umgebung, Uhrbilder, Glasmalereien) als eingebettete JSON-Blöcke |
| `web/` | **Webfassung** zum Hochladen auf den Webserver (aus `src/` erzeugt, siehe `web/LIESMICH.txt`) |
| `tools/build_web.py` | erzeugt `web/` – Code, Stil, Schriften, three.js, Daten und Bilder als eigene Dateien, keine externen Verbindungen |
| `tools/build_offline.py` | erzeugt `dist/St-Marien-Lichtmodell-offline.html` – eine einzige Datei, startet per Doppelklick ohne Server |

## Bauen

```bash
npm install          # three.js r128 und die Schriften (nur zum Bauen nötig)
npm run build        # web/ und dist/St-Marien-Lichtmodell-offline.html
npm run serve        # Webfassung lokal unter http://localhost:8000
```

`src/marienkirche.html` lädt three.js und die Schriften beim direkten Öffnen von CDNs; die beiden gebauten Fassungen kommen ohne fremde Server aus.

## Einbetten in die Website der Kirche

```html
<iframe src="/lichtmodell/" style="width:100%;height:80vh;border:0"
        allow="fullscreen; web-share; clipboard-write" title="St. Marien Lichtmodell"></iframe>
```

## Hinweise

- Fotos der Glasmalereien und der Astronomischen Uhr: Nutzung für dieses Projekt freigegeben; vor einer Weitergabe die Bildrechte prüfen.
- Gebäude der Umgebung: vereinfachte Klötzchen nach Kartendaten.
