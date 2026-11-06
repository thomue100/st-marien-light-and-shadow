# Altstadtinsel: Umgebungsdaten aufbereiten

Erzeugt den Eintrag `far` in `src/data/umgebung.json`: die LoD2-Gebäude der Lübecker Altstadtinsel außerhalb des
Nahbereichs (200 m um die Kirche), das Gelände (8-m-Raster), eine Bodenkarte aus OpenStreetMap (Wasser, Grün, Plätze,
Straßen) und ein 2-m-Fernraster der hohen Bauten für die Verschattung. Der Nahbereich (`bld`, `occ`, `ground` …) bleibt
unverändert.

## Eingaben (im Arbeitsordner `work/`, nicht im Repository)

- LoD2-Kacheln (CityGML, LVermGeo SH, Portal OpenGBD): `LoD2_32_610_5969_1_SH.xml`, `LoD2_32_610_5970_1_SH.xml`,
  `LoD2_32_611_5969_1_SH.xml`, `LoD2_32_611_5970_1_SH.xml`
- OpenStreetMap-Export der Altstadt als `map.osm` (openstreetmap.org → Exportieren, Bereich etwa 53,859–53,876 N,
  10,674–10,703 O)

## Ablauf

```bash
pip install lxml numpy scipy pyproj pillow mapbox_earcut
cd tools/altstadtinsel
python3 parse.py work/LoD2_*.xml   # Gebäude, Dach-, Wand- und Grundflächen → work/bld.pkl
python3 fit.py                     # Lage UTM → Modell an den vorhandenen Nahbereichs-Gebäuden (≈ 4 mm, Höhe −13,0 m)
python3 osm.py                     # Bodenkarte 2048² und Inselmaske → work/tex.npy, work/island.npy
python3 build_env.py               # schreibt env.far in src/data/umgebung.json
```

Danach `npm run build` (Web- und Offline-Fassung). Anderer Arbeitsordner: Umgebungsvariable `INSEL_WORK`.

Die Insel ist die Landfläche um die Kirche, die von Wasser umschlossen ist; Dämme und Brückenköpfe bis etwa 45 m
Breite (Mühlendamm, Hüxterdamm) werden dafür rechnerisch geschlossen. Kartendaten © OpenStreetMap-Mitwirkende (ODbL).
