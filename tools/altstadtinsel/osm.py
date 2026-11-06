# OSM → Bodenkarte im Modellraster (Palettenindex je Pixel), Inselmaske
import os
import json, math, pickle, numpy as np
from lxml import etree
from pyproj import Transformer
from PIL import Image, ImageDraw
W = os.environ.get('INSEL_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))
T = json.load(open(W + '/tf.json')); L = np.array(T['L']); t = np.array(T['t'])
utm = Transformer.from_crs(4326, 25832, always_xy=True)
def to_model(lonlat):
    a = np.array(lonlat)
    e, n = utm.transform(a[:, 0], a[:, 1])
    return np.c_[e - T['E0'], n - T['N0']] @ L.T + t   # (x, z)
# Raster: Modellkoordinaten, quadratisch über die vier Kacheln
corners = np.array([[610000, 5969000], [612000, 5969000], [612000, 5971000], [610000, 5971000]], float)
cm = np.c_[corners[:, 0] - T['E0'], corners[:, 1] - T['N0']] @ L.T + t
X0, X1, Z0, Z1 = cm[:, 0].min(), cm[:, 0].max(), cm[:, 1].min(), cm[:, 1].max()
S = max(X1 - X0, Z1 - Z0); NPX = 2048; RES = S / NPX
X0 = (X0 + X1) / 2 - S / 2; Z0 = (Z0 + Z1) / 2 - S / 2
print('Raster', NPX, 'px,', round(RES, 3), 'm/px, x0', round(X0, 1), 'z0', round(Z0, 1), 'Seite', round(S, 1))
def px(xz): return [((x - X0) / RES, (z - Z0) / RES) for x, z in xz]
# Palette (linear RGB 0..1)
PAL = {
    'land': (0.215, 0.212, 0.198), 'island': (0.30, 0.285, 0.26), 'road': (0.165, 0.165, 0.17),
    'path': (0.36, 0.33, 0.29), 'square': (0.38, 0.35, 0.305), 'green': (0.115, 0.185, 0.075),
    'wood': (0.075, 0.13, 0.055), 'pitch': (0.13, 0.2, 0.095), 'water': (0.045, 0.085, 0.115),
}
IDX = {k: i for i, k in enumerate(PAL)}
nodes, ways, rels = {}, {}, []
for ev, el in etree.iterparse(os.path.join(W, 'map.osm'), tag=('node', 'way', 'relation')):
    tg = {x.get('k'): x.get('v') for x in el.findall('tag')}
    if el.tag == 'node': nodes[el.get('id')] = (float(el.get('lon')), float(el.get('lat')))
    elif el.tag == 'way': ways[el.get('id')] = ([nd.get('ref') for nd in el.findall('nd')], tg)
    else: rels.append(([(m.get('type'), m.get('ref'), m.get('role')) for m in el.findall('member')], tg))
    el.clear()
def coords(refs): return [nodes[r] for r in refs if r in nodes]
def rings_of_rel(members):
    # äußere Wege zu Ringen verketten
    segs = [ways[r][0] for ty, r, role in members if ty == 'way' and r in ways and role in ('outer', '')]
    inner = [ways[r][0] for ty, r, role in members if ty == 'way' and r in ways and role == 'inner']
    def chain(segs):
        segs = [list(s) for s in segs]; rings = []
        while segs:
            cur = segs.pop(0)
            while cur[0] != cur[-1]:
                for i, s in enumerate(segs):
                    if s[0] == cur[-1]: cur += s[1:]; segs.pop(i); break
                    if s[-1] == cur[-1]: cur += s[::-1][1:]; segs.pop(i); break
                else: break
            rings.append(cur)
        return rings
    return chain(segs), chain(inner)
def cls(tg):
    if tg.get('natural') == 'water' or 'water' in tg or tg.get('waterway') in ('riverbank', 'dock') or tg.get('landuse') in ('basin', 'reservoir'): return 'water'
    if tg.get('natural') in ('wood', 'scrub') or tg.get('landuse') == 'forest': return 'wood'
    if tg.get('leisure') in ('pitch', 'track'): return 'pitch'
    if tg.get('leisure') in ('park', 'garden', 'playground', 'common') or tg.get('landuse') in ('grass', 'cemetery', 'recreation_ground', 'meadow', 'village_green', 'allotments') or tg.get('natural') == 'grassland': return 'green'
    if tg.get('place') == 'square' or (tg.get('highway') in ('pedestrian', 'footway') and tg.get('area') == 'yes') or tg.get('area:highway') in ('pedestrian', 'footway') or tg.get('amenity') == 'marketplace': return 'square'
    return None
areas = {k: [] for k in PAL}
for wid, (refs, tg) in ways.items():
    c = cls(tg)
    if c and len(refs) > 3 and refs[0] == refs[-1]: areas[c].append((coords(refs), []))
for mem, tg in rels:
    c = cls(tg)
    if c and tg.get('type') == 'multipolygon':
        outer, inner = rings_of_rel(mem)
        for o in outer:
            if len(o) > 3 and o[0] == o[-1]: areas[c].append((coords(o), [coords(i) for i in inner]))
print({k: len(v) for k, v in areas.items() if v})
img = Image.new('L', (NPX, NPX), IDX['land']); dr = ImageDraw.Draw(img)
def fill(c):
    for outer, inners in areas[c]:
        dr.polygon(px(to_model(outer)), fill=IDX[c])
        for i in inners:
            if len(i) > 2: dr.polygon(px(to_model(i)), fill=IDX['land'])
# Wasser zuerst, um die Insel zu finden
fill('water')
water = np.array(img) == IDX['water']
# Insel: Landfläche, die die Kirche (0, 0) enthält – Flutfüllung
from scipy import ndimage
ci = (int((0 - Z0) / RES), int((0 - X0) / RES))
# Dämme und Brückenköpfe bis etwa 45 m Breite schließen (Wasser um 22 px aufweiten), dann füllen und zurückweiten
yy, xx = np.mgrid[-22:23, -22:23]; K = xx ** 2 + yy ** 2 <= 22 * 22
lab, nl = ndimage.label(~ndimage.binary_dilation(water, structure=K))
island = ndimage.binary_dilation(lab == lab[ci], structure=K) & ~water
print('Insel', round(island.sum() * RES * RES / 1e6, 3), 'km²; Anteil am Raster', round(island.mean(), 3))
a = np.array(img); a[island] = IDX['island']; img = Image.fromarray(a); dr = ImageDraw.Draw(img)
for c in ('green', 'wood', 'pitch', 'square'): fill(c)
# Straßen und Wege als Linien
WID = {'primary': 11, 'primary_link': 8, 'secondary': 9, 'secondary_link': 7, 'tertiary': 8, 'residential': 6.5, 'unclassified': 6, 'living_street': 5.5, 'service': 4.5, 'pedestrian': 6}
PATH = {'footway': 2.5, 'path': 2, 'cycleway': 2.5, 'steps': 2.5}
for wid, (refs, tg) in ways.items():
    hw = tg.get('highway')
    if not hw or tg.get('area') == 'yes' or tg.get('tunnel') == 'yes': continue
    w = WID.get(hw) or PATH.get(hw)
    if not w: continue
    p = px(to_model(coords(refs)))
    if len(p) > 1: dr.line(p, fill=IDX['road' if hw in WID and hw != 'pedestrian' else 'path'], width=max(1, round(w / RES)), joint='curve')
fill('water')  # Wasser über Straßen, …
for wid, (refs, tg) in ways.items():  # … Brücken wieder darüber
    hw = tg.get('highway')
    if hw and tg.get('bridge') and (WID.get(hw) or PATH.get(hw)):
        p = px(to_model(coords(refs)))
        if len(p) > 1: dr.line(p, fill=IDX['road' if hw in WID and hw != 'pedestrian' else 'path'], width=max(1, round((WID.get(hw) or PATH.get(hw)) / RES)))
idx = np.array(img)
np.save(W + '/tex.npy', idx); np.save(W + '/island.npy', island)
json.dump({'x0': X0, 'z0': Z0, 'res': RES, 'n': NPX, 'pal': [PAL[k] for k in PAL], 'names': list(PAL)}, open(W + '/tex.json', 'w'))
# Vorschau (sRGB)
pal8 = np.array([[round(255 * (c ** (1 / 2.2))) for c in PAL[k]] for k in PAL], np.uint8)
Image.fromarray(pal8[idx]).resize((1024, 1024)).save(W + '/tex_vorschau.png')
