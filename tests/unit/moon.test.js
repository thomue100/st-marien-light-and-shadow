// Mond: Referenzwerte unabhängig berechnet mit Skyfield und der JPL-Ephemeride DE421 (wie in tests/astro/check.py).
// Grenzen wie dort: Höhe/Azimut 0,04°, Auf- und Untergang 60 s, Phasen 180 s.
import { describe, it, expect } from 'vitest';
import { moonPos, moonPhaseTime, moonRiseSet, moonTransitNear, sunPos, localToUtc } from '../../src/astro/index.js';

const at = iso => Date.parse(iso);
const near = (a, b, tol) => expect(Math.abs(a - b), `${a} statt ${b}`).toBeLessThanOrEqual(tol);

describe('Mondstand', () => {
  it('1. Februar 2026, 23:00 UTC (Vollmond hoch im Süden)', () => {
    const m = moonPos(at('2026-02-01T23:00:00Z'));
    near(m.el, 53.819, 0.04);
    near(m.az, 165.51, 0.04);
    expect(m.k).toBeGreaterThan(0.99); // fast voll beleuchtet
  });
  it('12. August 2026 ist Neumond: kaum beleuchtet', () => {
    expect(moonPos(at('2026-08-12T21:00:00Z')).k).toBeLessThan(0.01);
  });
});

describe('Mondphasen', () => {
  it('Vollmond 3. Januar 2026, 10:02:54 UTC', () => {
    near(moonPhaseTime(Date.UTC(2026, 0, 1), 180, 1), at('2026-01-03T10:02:54Z'), 180000);
  });
  it('Letztes Viertel 10. Januar 2026, 15:48:23 UTC', () => {
    near(moonPhaseTime(Date.UTC(2026, 0, 4), 270, 1), at('2026-01-10T15:48:23Z'), 180000);
  });
  it('Neumond 18. Januar 2026, 19:51:58 UTC', () => {
    near(moonPhaseTime(Date.UTC(2026, 0, 1), 0, 1), at('2026-01-18T19:51:58Z'), 180000);
  });
  it('rückwärts suchen findet denselben Vollmond', () => {
    near(moonPhaseTime(Date.UTC(2026, 0, 5), 180, -1), at('2026-01-03T10:02:54Z'), 180000);
  });
});

describe('Mondauf- und -untergang', () => {
  it('12. August 2026: Aufgang 03:00:00 UTC, Untergang 18:53:17 UTC', () => {
    const r = moonRiseSet(localToUtc(2026, 7, 12, 0), localToUtc(2026, 7, 12, 1440));
    near(r.rise, at('2026-08-12T03:00:00Z'), 60000);
    near(r.set, at('2026-08-12T18:53:17Z'), 60000);
  });
});

describe('Mondhöchststand in der Nacht', () => {
  it('liegt bei Nacht (Sonne unter −8°) und höher als zwei Stunden davor und danach', () => {
    const t = moonTransitNear(at('2026-02-01T23:00:00Z'));
    expect(sunPos(t).el).toBeLessThanOrEqual(-8);
    expect(moonPos(t).el).toBeGreaterThan(moonPos(t - 2 * 3600000).el);
    expect(moonPos(t).el).toBeGreaterThan(moonPos(t + 2 * 3600000).el);
  });
});
