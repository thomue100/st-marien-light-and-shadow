# Altstadtinsel: LoD2-Gebäude außerhalb von 200 m, Gelände, Bodenkarte (OSM) und Fernraster für die Verschattung
import os
# → neue Einträge „far“ in src/data/umgebung.json (gzip + Base64)
import json, base64, gzip, pickle, math, numpy as np
from scipy.spatial import cKDTree
from scipy.interpolate import griddata
from scipy import ndimage
import mapbox_earcut as earcut

W = os.environ.get('INSEL_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))
ENVF = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../src/data/umgebung.json')
env = json.load(open(ENVF))
T = json.load(open(W + '/tf.json')); L = np.array(T['L']); t = np.array(T['t']); TY = T['ty']
TX = json.load(open(W + '/tex.json')); X0, Z0, RES, NPX = TX['x0'], TX['z0'], TX['res'], TX['n']
tex = np.load(W + '/tex.npy'); island = np.load(W + '/island.npy')
bld = pickle.load(open(W + '/bld.pkl', 'rb'))
CHURCH = 'DESHPDHK000039f8'
NEAR = 200.0
TALL = 12.0  # Modellhöhe (≈ 25 m NHN): darüber wirft ein Gebäude Schatten bis zur Kirche und geht ins Fernraster

def model(a):  # UTM (E, N, NHN) → Modell (x, y, z)
    xz = np.c_[a[:, 0] - T['E0'], a[:, 1] - T['N0']] @ L.T + t
    return np.c_[xz[:, 0], a[:, 2] + TY, xz[:, 1]]

def b64gz(arr):
    return base64.b64encode(gzip.compress(np.ascontiguousarray(arr).tobytes(), 9, mtime=0)).decode()

# vorhandene Nahbereichs-Gebäude (zum Aussortieren doppelter Gebäude)
Mnear = np.frombuffer(base64.b64decode(env['bld']['pos']), dtype='<i2').reshape(-1, 3) / 100
near_tree = cKDTree(Mnear)
isl_d = ndimage.binary_dilation(island, iterations=8)  # Gebäude am Ufer mitnehmen

def on_island(x, z):
    i, j = int((x - X0) / RES), int((z - Z0) / RES)
    return 0 <= i < NPX and 0 <= j < NPX and isl_d[j, i]

def newell(p):
    n = np.zeros(3)
    for a, b in zip(p, np.roll(p, -1, 0)):
        n += [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]
    l = np.linalg.norm(n)
    return n / l if l > 1e-9 else None

groups = {g: {c: {'v': {}, 'pos': [], 'idx': []} for c in ('wall', 'roof', 'flat')} for g in ('low', 'tall')}
ground_pts = []
tall_tris = []
stats = {'gesamt': 0, 'insel': 0, 'nah_doppelt': 0, 'kirche': 0}
for bid, polys in bld.items():
    stats['gesamt'] += 1
    mp = [(k, [model(r) for r in rings]) for k, rings in polys]
    for k, rings in mp:
        if k == 2: ground_pts.append(rings[0])
    if bid == CHURCH: stats['kirche'] += 1; continue
    allv = np.concatenate([r[0] for k, r in mp if k != 2]) if any(k != 2 for k, _ in mp) else None
    if allv is None: continue
    cx, cz = allv[:, 0].mean(), allv[:, 2].mean()
    if not on_island(cx, cz): continue
    dd, _ = near_tree.query(allv, distance_upper_bound=0.05)
    if np.isfinite(dd).mean() > 0.5: stats['nah_doppelt'] += 1; continue
    stats['insel'] += 1
    g = 'tall' if allv[:, 1].max() > TALL else 'low'
    for k, rings in mp:
        if k == 2: continue
        p0 = rings[0][:-1] if np.allclose(rings[0][0], rings[0][-1]) else rings[0]
        n = newell(p0)
        if n is None or len(p0) < 3: continue
        c = 'wall' if k == 0 else ('flat' if abs(n[1]) >= 0.985 else 'roof')
        ax = int(np.argmax(np.abs(n)))
        keep = [i for i in range(3) if i != ax]
        ring_pts = [p0] + [(r[:-1] if np.allclose(r[0], r[-1]) else r) for r in rings[1:]]
        flat = np.concatenate(ring_pts)
        ends = np.cumsum([len(r) for r in ring_pts]).astype(np.uint32)
        try:
            tri = earcut.triangulate_float64(flat[:, keep], ends)
        except Exception:
            continue
        G = groups[g][c]
        q = np.round(flat * 10).astype(np.int32)
        ids = []
        for v in map(tuple, q):
            if v not in G['v']:
                G['v'][v] = len(G['pos']); G['pos'].append(v)
            ids.append(G['v'][v])
        ids = np.array(ids)
        G['idx'].extend(ids[np.asarray(tri, dtype=np.int64)].tolist())
        if g == 'tall' and k == 1:
            tall_tris.append(flat[np.asarray(tri, dtype=np.int64)].reshape(-1, 3, 3))
print(stats)

far = {'scale': 10, 'tall': TALL}
tot_v = tot_t = 0
for g, cl in groups.items():
    for c, G in cl.items():
        pos = np.array(G['pos'], np.int16).reshape(-1, 3)
        idx = np.array(G['idx'], np.uint32)
        big = len(pos) > 65535
        far[g + '_' + c] = {'pos': b64gz(pos.astype('<i2')), 'idx': b64gz(idx.astype('<u4' if big else '<u2')), 'i32': int(big)}
        tot_v += len(pos); tot_t += len(idx) // 3
        print(g, c, 'Ecken', len(pos), 'Dreiecke', len(idx) // 3)
print('zusammen Ecken', tot_v, 'Dreiecke', tot_t)

# Gelände: Bodenhöhen aus den Grundflächen der LoD2-Gebäude, 8-m-Raster, Wasser auf Wasserstand
GS = 8.0
gx0 = -NEAR - GS * math.ceil((-NEAR - X0) / GS)
gz0 = -NEAR - GS * math.ceil((-NEAR - Z0) / GS)
gn = int(math.ceil((X0 + NPX * RES - gx0) / GS)) + 1
gm = int(math.ceil((Z0 + NPX * RES - gz0) / GS)) + 1
gp = np.concatenate(ground_pts)
gp = gp[::3]
gx, gz = np.meshgrid(gx0 + np.arange(gn) * GS, gz0 + np.arange(gm) * GS)
h = griddata(gp[:, [0, 2]], gp[:, 1], (gx, gz), method='linear')
hn = griddata(gp[:, [0, 2]], gp[:, 1], (gx, gz), method='nearest')
h = np.where(np.isnan(h), hn, h)
h = ndimage.gaussian_filter(h, 1.0)
WATER = 0.5 + TY  # Wasserstand etwa 0,5 m NHN
ti = np.clip(((gx - X0) / RES).astype(int), 0, NPX - 1)
tj = np.clip(((gz - Z0) / RES).astype(int), 0, NPX - 1)
wat = tex[tj, ti] == TX['names'].index('water')
wat = ndimage.binary_erosion(wat, iterations=0) if False else wat
h = np.where(wat, WATER, np.maximum(h, WATER + 0.6))
# im Nahbereich (±200 m) liegt das genaue Gelände; dort das Fernraster an dessen Rand anschließen und darunter absenken
gn0, gs0, base = env['gn'], env['gstep'], env['base']
gb = base64.b64decode(env['ground'])
eg = (np.frombuffer(gb, '<u2').astype(float) / 100 + base).reshape(gn0, gn0)
inside = (np.abs(gx) <= NEAR + 1e-6) & (np.abs(gz) <= NEAR + 1e-6)
ii = np.clip(np.round((gx + NEAR) / gs0).astype(int), 0, gn0 - 1)
jj = np.clip(np.round((gz + NEAR) / gs0).astype(int), 0, gn0 - 1)
edge = inside & ((np.abs(np.abs(gx) - NEAR) < 1e-6) | (np.abs(np.abs(gz) - NEAR) < 1e-6))
h = np.where(inside, eg[jj, ii] - 0.6, h)
h = np.where(edge, eg[jj, ii], h)
# Übergang: erste Ringe außerhalb sanft an den Nahbereich angleichen
far['ground'] = {'x0': gx0, 'z0': gz0, 'step': GS, 'nx': gn, 'nz': gm, 'base': -20.0,
                 'h': b64gz(np.round((h - (-20.0)) * 100).astype('<u2'))}
print('Gelände', gn, 'x', gm, 'Höhen', round(float(h.min()), 2), round(float(h.max()), 2))

# Bodenkarte (Palettenindex, 2048²)
far['tex'] = {'x0': X0, 'z0': Z0, 'size': NPX * RES, 'n': NPX, 'pal': TX['pal'], 'idx': b64gz(tex.astype(np.uint8))}

# Fernraster für die Verschattung: 2-m-Zellen, nur hohe Bauten außerhalb des Nahbereichs
FS = 2.0
if tall_tris:
    tris = np.concatenate(tall_tris)
    cells = {}
    for tr in tris:
        xs, zs = tr[:, 0], tr[:, 2]
        i0, i1 = int(math.floor(xs.min() / FS)), int(math.ceil(xs.max() / FS))
        j0, j1 = int(math.floor(zs.min() / FS)), int(math.ceil(zs.max() / FS))
        a, b, c = tr
        den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
        if abs(den) < 1e-9: continue
        for i in range(i0, i1 + 1):
            for j in range(j0, j1 + 1):
                px, pz = (i + 0.5) * FS, (j + 0.5) * FS
                if abs(px) <= NEAR and abs(pz) <= NEAR: continue
                l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / den
                l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / den
                l3 = 1 - l1 - l2
                if min(l1, l2, l3) < -0.02: continue
                y = l1 * a[1] + l2 * b[1] + l3 * c[1]
                if y > TALL and y > cells.get((i, j), -1e9): cells[(i, j)] = y
    ks = np.array(list(cells.keys()), np.int16)
    hs = np.round((np.array(list(cells.values())) + 20) * 100).astype('<u2')
    far['shade'] = {'step': FS, 'i': b64gz(ks[:, 0].astype('<i2')), 'j': b64gz(ks[:, 1].astype('<i2')), 'h': b64gz(hs), 'base': -20.0,
                    'max': float(max(cells.values()))}
    print('Fernraster', len(cells), 'Zellen, höchste', round(max(cells.values()), 1))

env['far'] = far
json.dump(env, open(ENVF, 'w'), separators=(',', ':'))
import os
print('umgebung.json', round(os.path.getsize(ENVF) / 1e6, 2), 'MB; davon far', round(len(json.dumps(far)) / 1e6, 2), 'MB')
for k, v in far.items():
    if isinstance(v, dict): print('  ', k, round(len(json.dumps(v)) / 1e3), 'KB')
