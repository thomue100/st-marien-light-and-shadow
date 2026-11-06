// Sonne: Stand am Himmel, Auf- und Untergang, wahrer Mittag; genauere Länge für Finsternisse
import { AU_KM, LAT, LON, nrm360, rad } from './common.js';
import { localToUtc } from './time.js';

export function sunPos(ms) {
  const n = ms / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * n) * rad;
  const q = 280.459 + 0.98564736 * n;
  const lam = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.00000036 * n) * rad;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const gmst = (((18.697374558 + 24.06570982441908 * n) % 24) + 24) % 24;
  const H = (gmst * 15 + LON) * rad - ra,
    phi = LAT * rad;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(
    -Math.cos(dec) * Math.sin(H),
    Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.cos(H) * Math.sin(phi),
  );
  let e = el / rad;
  if (e > -1.5) {
    e += 1.02 / Math.tan((e + 10.3 / (e + 5.11)) * rad) / 60;
  }
  return { el: e, az: (((az / rad) % 360) + 360) % 360, H: ((((H / rad) % 360) + 540) % 360) - 180 };
}
// Sonne geozentrisch (wie sunPos): λ, Rektaszension, Abstand in km
export function sunEcl(ms) {
  const n = ms / 86400000 + 2440587.5 - 2451545.0,
    g = (357.529 + 0.98560028 * n) * rad,
    q = 280.459 + 0.98564736 * n;
  const lam = nrm360(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)),
    R = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * AU_KM;
  const eps = (23.439 - 0.00000036 * n) * rad,
    ra = Math.atan2(Math.cos(eps) * Math.sin(lam * rad), Math.cos(lam * rad)) / rad;
  return { lam, R, ra: nrm360(ra) };
}
// Sonne genauer nach Meeus Kap. 25 (wahre Länge + Aberration, ohne Nutation wie beim Mond), Zeit TT ≈ UT + ΔT.
export function deltaT(ms) {
  const q = new Date(ms),
    y = q.getUTCFullYear() + (q.getUTCMonth() + 0.5) / 12; // Espenak & Meeus (NASA), Polynome 1900–2150
  if (y < 1920) {
    const t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t * t * t - 0.000197 * t * t * t * t;
  }
  if (y < 1941) {
    const t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t * t * t;
  }
  if (y < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - (t * t) / 233 + (t * t * t) / 2547;
  }
  if (y < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - (t * t) / 260 - (t * t * t) / 718;
  }
  if (y < 2005) {
    const t = y - 2000;
    return (
      63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t * t * t + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5
    );
  }
  if (y < 2050) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u - 0.5628 * (2150 - y);
}
export function sunPrecise(ms) {
  const T = (ms / 86400000 + 2440587.5 - 2451545.0 + deltaT(ms) / 86400) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T,
    M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad,
    e = 0.016708634 - 0.000042037 * T;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  const nu = M + C * rad,
    R = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(nu));
  return { lam: nrm360(L0 + C - 0.00569), R: R * AU_KM, T };
}
// Sonnenlauf eines Tages: Höhe alle 5 min, Auf- und Untergang (oberer Rand, mit Refraktion: scheinbare Höhe −0,27°), Höchststand. Minuten ab Mitternacht Ortszeit
export function sunDay(y, m, d) {
  const c = [];
  let maxEl = -90,
    maxT = 0;
  for (let mi = 0; mi <= 1440; mi += 5) {
    const s = sunPos(localToUtc(y, m, d, mi));
    c.push(s);
    if (s.el > maxEl) {
      maxEl = s.el;
      maxT = mi;
    }
  }
  let rise = null,
    set = null;
  const TH = -0.27;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1].el,
      b = c[i].el;
    if (a < TH && b >= TH && rise === null) rise = (i - 1) * 5 + (5 * (TH - a)) / (b - a);
    if (a >= TH && b < TH) set = (i - 1) * 5 + (5 * (TH - a)) / (b - a);
  }
  return { c, rise, set, maxEl, maxT };
}
// Wahrer Mittag: Augenblick, in dem die Sonnenuhr 12 Uhr zeigt, als Uhrzeit (Minuten ab Mitternacht Ortszeit)
export function trueNoon(y, m, d) {
  let mm = 720;
  for (let k = 0; k < 3; k++) {
    const p = sunPos(localToUtc(y, m, d, mm)),
      w = (((12 + p.H / 15) % 24) + 24) % 24;
    mm += (12 - w) * 60;
  }
  return mm;
}
