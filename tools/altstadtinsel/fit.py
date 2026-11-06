# Lage UTM 32 (Gitter, NHN) → Modell, sauber: 2D-ICP (Kabsch), dann Höhenversatz über 3D-Treffer
import os
import json, base64, pickle, numpy as np, math
from scipy.spatial import cKDTree
W = os.environ.get('INSEL_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))
d = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../src/data/umgebung.json')))
M = np.frombuffer(base64.b64decode(d['bld']['pos']), dtype='<i2').reshape(-1, 3) / 100
bld = pickle.load(open(W + '/bld.pkl', 'rb'))
U = np.unique(np.concatenate([r for p in bld.values() for k, rs in p if k != 2 for r in rs[:1]]).round(3), axis=0)
E0, N0 = 610802.0, 5970140.0
U = U[np.hypot(U[:, 0] - E0, U[:, 1] - N0) < 300]
Us = U[::12]
d2 = np.c_[U[:, 0] - E0, U[:, 1] - N0]
Mt2 = cKDTree(M[:, [0, 2]])
def Rm(th):  # x = dE sin + dN cos, z = dE cos − dN sin
    return np.array([[math.sin(th), math.cos(th)], [math.cos(th), -math.sin(th)]])
best = None
ds = np.c_[Us[:, 0] - E0, Us[:, 1] - N0]
for deg in np.arange(97.0, 101.01, 0.25):
    A = ds @ Rm(math.radians(deg)).T
    for tx in range(-30, 31, 1):
        for tz in range(-30, 31, 1):
            dd, _ = Mt2.query(A + [tx, tz], distance_upper_bound=0.4)
            sc = np.isfinite(dd).sum()
            if best is None or sc > best[0]: best = (sc, deg, tx, tz)
print('Grobsuche', best)
L = Rm(math.radians(best[1])); t = np.array(best[2:], float)
for thr in [1.0, 0.5, 0.2, 0.1, 0.1, 0.1, 0.05, 0.05]:
    P = d2 @ L.T + t
    dd, ii = Mt2.query(P, distance_upper_bound=thr)
    ok = np.isfinite(dd)
    A, B = P[ok], M[ii[ok]][:, [0, 2]]
    ca, cb = A.mean(0), B.mean(0)
    u, s, vt = np.linalg.svd((A - ca).T @ (B - cb))
    R = vt.T @ u.T
    if np.linalg.det(R) < 0: vt[-1] *= -1; R = vt.T @ u.T
    L = R @ L; t = R @ t + cb - R @ ca
P = d2 @ L.T + t
dd, ii = Mt2.query(P, distance_upper_bound=0.1)
ok = np.isfinite(dd)
print('2D: Treffer', ok.sum(), 'Median', round(float(np.median(dd[ok])), 4), '95 %', round(float(np.percentile(dd[ok], 95)), 4), 'Maßstab', np.linalg.svd(L)[1].round(6))
# Höhe: 3D-Treffer für Kandidaten
Mt3 = cKDTree(M)
for ty in [-13.0]:
    P3 = np.c_[P[:, 0], U[:, 2] + ty, P[:, 1]]
    dd3, _ = Mt3.query(P3, distance_upper_bound=0.15)
    print('ty', ty, '3D-Treffer', np.isfinite(dd3).sum(), 'Median', np.median(dd3[np.isfinite(dd3)]).round(4))
# feiner Höhenversatz
P3 = np.c_[P[:, 0], U[:, 2] - 13.0, P[:, 1]]
dd3, ii3 = Mt3.query(P3, distance_upper_bound=0.3)
ok3 = np.isfinite(dd3)
ty = -13.0 + float(np.median(M[ii3[ok3]][:, 1] - P3[ok3][:, 1]))
print('ty fein', round(ty, 4))
json.dump({'E0': E0, 'N0': N0, 'L': L.tolist(), 't': t.tolist(), 'ty': ty}, open(W + '/tf.json', 'w'))
print('L', L.round(6).tolist(), 't', t.round(3).tolist(), 'Winkel', math.degrees(math.atan2(L[0, 0], L[0, 1])).__round__(4))
