// Sonne: Referenzwerte unabhängig berechnet mit Skyfield und der JPL-Ephemeride DE421
// (Lübeck 53,8677° N, 10,6850° O, 20 m; Lichtbrechung bei 10 °C und 1010 hPa) – wie in tests/astro/check.py.
// Grenzen wie dort: Höhe/Azimut 0,04°, Auf- und Untergang 60 s, wahrer Mittag 30 s.
import { describe, it, expect } from 'vitest';
import { sunPos, sunDay, trueNoon, localToUtc } from '../../src/astro/index.js';

const at = iso => Date.parse(iso);
const minutesToUtc = (y, m, d, min) => localToUtc(y, m, d, min);   // Minuten ab Mitternacht Ortszeit → UTC (ms)
const near = (a, b, tol) => expect(Math.abs(a - b), `${a} statt ${b}`).toBeLessThanOrEqual(tol);

describe('Sonnenstand', () => {
  it.each([
    ['Sommeranfang, Mittag', '2026-06-21T11:00:00Z', 59.368, 171.396],
    ['Winteranfang, Mittag', '2026-12-21T11:00:00Z', 12.694, 176.403],
    ['Frühlingsanfang, Nachmittag', '2026-03-20T15:00:00Z', 20.408, 239.446],
  ])('%s', (_, iso, el, az) => {
    const s = sunPos(at(iso));
    near(s.el, el, 0.04);
    near(s.az, az, 0.04);
  });
});

describe('Sonnenlauf eines Tages', () => {
  it('21. Juni 2026: Aufgang 02:45:33 UTC, Untergang 19:52:35 UTC', () => {
    const d = sunDay(2026, 5, 21);
    near(minutesToUtc(2026, 5, 21, d.rise), at('2026-06-21T02:45:33Z'), 60000);
    near(minutesToUtc(2026, 5, 21, d.set), at('2026-06-21T19:52:35Z'), 60000);
  });
  it('Höchststand am 21. Juni liegt um den wahren Mittag, über 59°', () => {
    const d = sunDay(2026, 5, 21);
    expect(d.maxEl).toBeGreaterThan(59);
    near(d.maxT, trueNoon(2026, 5, 21), 5);   // Abtastung alle 5 min
  });
});

describe('Wahrer Mittag (Sonnenuhr zeigt 12 Uhr)', () => {
  it('3. November 2026: 11:00:48 UTC = 12:00:48 MEZ', () => {
    near(minutesToUtc(2026, 10, 3, trueNoon(2026, 10, 3)), at('2026-11-03T11:00:48Z'), 30000);
  });
  it('im Laufe des Jahres zwischen etwa 12:00 und 12:35 Uhr MEZ bzw. MESZ (Zeitgleichung und Längengrad)', () => {
    for (let m = 0; m < 12; m++) {
      const n = trueNoon(2026, m, 15);
      expect(n).toBeGreaterThan(11 * 60 + 55);
      expect(n).toBeLessThan(13 * 60 + 40);
    }
  });
});
