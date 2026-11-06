# CityGML LoD2 → Gebäude mit Dach-, Wand- und Grundflächen (UTM 32, NHN)
import os
import sys, pickle, numpy as np
W = os.environ.get('INSEL_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))
from lxml import etree
NS = {'gml': 'http://www.opengis.net/gml', 'bldg': 'http://www.opengis.net/citygml/building/1.0'}
B = '{http://www.opengis.net/citygml/building/1.0}'
G = '{http://www.opengis.net/gml}'
KIND = {'RoofSurface': 1, 'WallSurface': 0, 'GroundSurface': 2}
out = {}
for f in sys.argv[1:]:
    for ev, el in etree.iterparse(f, tag=B + 'Building'):
        if el.getparent().tag.endswith('cityObjectMember') is False and el.getparent().tag != '{http://www.opengis.net/citygml/1.0}cityObjectMember':
            continue
        bid = el.get(G + 'id')
        polys = []
        for sname, k in KIND.items():
            for s in el.iter(B + sname):
                for poly in s.iter(G + 'Polygon'):
                    rings = []
                    for ring in [poly.find('gml:exterior', NS)] + poly.findall('gml:interior', NS):
                        if ring is None: continue
                        pl = ring.find('.//gml:posList', NS)
                        a = np.array(pl.text.split(), dtype=float).reshape(-1, 3)
                        rings.append(a)
                    if rings: polys.append((k, rings))
        out[bid] = polys
        el.clear()
        while el.getprevious() is not None: del el.getparent()[0]
pickle.dump(out, open(os.path.join(W, 'bld.pkl'), 'wb'))
print(len(out), 'Gebäude', sum(len(p) for p in out.values()), 'Flächen')
