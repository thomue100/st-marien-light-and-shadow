// Zeit: Ortszeit Berlin ↔ UTC, Sommerzeit (1916–1918, 1940–1949, seit 1980), Tage der Zeitumstellung

export function lastSundayUtc(y, m) {
  const d = new Date(Date.UTC(y, m + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return Date.UTC(y, m, d.getUTCDate(), 1);
}
// Sommerzeit in Deutschland (MESZ), Umstellung jeweils 01:00 UTC: seit 1996 letzter Sonntag im März bis letzter Sonntag im Oktober,
// 1981–1995 bis zum letzten Sonntag im September, 1980 vom 6. April bis 28. September, 1950–1979 keine Sommerzeit (davor: HIST)
export function dstRange(y) {
  if (y < 1980) return null;
  if (y === 1980) return [Date.UTC(1980, 3, 6, 1), Date.UTC(1980, 8, 28, 1)];
  return [lastSundayUtc(y, 2), lastSundayUtc(y, y < 1996 ? 8 : 9)];
}
// Sommerzeit vor 1980 (Zeitzonen-Datenbank, Regel „Germany“; Lübeck lag in der britischen Zone): 1916–1918 und
// 1940–1949, im Sommer 1947 dazu die Hochsommerzeit (MEHSZ, UTC+3). Je Eintrag [Beginn, Ende, Abstand zu UTC in min].
const U = Date.UTC,
  HIST = [
    [U(1916, 3, 30, 22), U(1916, 8, 30, 23), 120],
    [U(1917, 3, 16, 1), U(1917, 8, 17, 1), 120],
    [U(1918, 3, 15, 1), U(1918, 8, 16, 1), 120],
    [U(1940, 3, 1, 1), U(1942, 10, 2, 1), 120], // durchgehend
    [U(1943, 2, 29, 1), U(1943, 9, 4, 1), 120],
    [U(1944, 3, 3, 1), U(1944, 9, 2, 1), 120],
    [U(1945, 3, 2, 1), U(1945, 8, 16, 1), 120],
    [U(1946, 3, 14, 1), U(1946, 9, 7, 1), 120],
    [U(1947, 3, 6, 2), U(1947, 4, 11, 1), 120],
    [U(1947, 4, 11, 1), U(1947, 5, 29, 0), 180], // Hochsommerzeit
    [U(1947, 5, 29, 0), U(1947, 9, 5, 1), 120],
    [U(1948, 3, 18, 1), U(1948, 9, 3, 1), 120],
    [U(1949, 3, 10, 1), U(1949, 9, 2, 1), 120],
  ];
export function berlinOffsetMin(u) {
  if (u < 3155673600e2) {
    // vor 1980
    for (const h of HIST) if (u >= h[0] && u < h[1]) return h[2];
    return 60;
  }
  const r = dstRange(new Date(u).getUTCFullYear());
  return r && u >= r[0] && u < r[1] ? 120 : 60;
}
export function localToUtc(y, m, d, min) {
  const base = Date.UTC(y, m, d) + min * 60000;
  if (y < 1980) {
    // doppelte Stunde im Herbst: der zweite Durchlauf (kleinerer Abstand); fehlende Stunde im Frühjahr: die Zeit läuft
    // mit dem alten Abstand weiter und erscheint als die Stunde danach
    for (const c of [60, 120, 180]) if (berlinOffsetMin(base - c * 60000) === c) return base - c * 60000;
    for (const c of [60, 120]) if (berlinOffsetMin(base - c * 60000) > c) return base - c * 60000;
    return base - 3600000;
  }
  let u = base - 3600000;
  if (berlinOffsetMin(u) === 120) {
    const u2 = base - 7200000;
    if (berlinOffsetMin(u2) === 120) u = u2;
    else u = dstRange(new Date(u).getUTCFullYear())[0];
  }
  return u;
} // 02:00–02:59 am Umstellungstag im März gibt es nicht: alle diese Minuten zeigen den Umstellungsmoment (03:00 MESZ), so läuft die Zeit nie rückwärts
// Zeitumstellung: Tag der Umstellung erkennen; 02:00–02:59 gibt es im März nicht und im Oktober zweimal (das Modell zeigt dann den zweiten Durchlauf, MEZ)
export function dstInfo(y, m, d, min) {
  const u = localToUtc(y, m, d, min),
    off = berlinOffsetMin(u),
    loc = (u - Date.UTC(y, m, d)) / 60000 + off; // tatsächliche Ortszeit in Minuten ab Mitternacht
  const dr = dstRange(y),
    day0 = t => {
      const q = new Date(t);
      return Date.UTC(q.getUTCFullYear(), q.getUTCMonth(), q.getUTCDate());
    },
    spring = !!dr && Date.UTC(y, m, d) === day0(dr[0]),
    fall = !!dr && Date.UTC(y, m, d) === day0(dr[1]);
  return { utc: u, off, loc, gap: spring && min >= 120 && min < 180, fold: fall && min >= 120 && min < 180 };
}
export function berlinNow() {
  const u = Date.now();
  const l = new Date(u + berlinOffsetMin(u) * 60000);
  return {
    y: l.getUTCFullYear(),
    m: l.getUTCMonth(),
    d: l.getUTCDate(),
    minutes: l.getUTCHours() * 60 + l.getUTCMinutes(),
  };
}
