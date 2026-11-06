// Finsternisse von Lübeck aus. Referenz: Skyfield/DE421 (eclipselib für Mondfinsternisse; Sonnenfinsternis über die
// Überdeckung der Sonnen- und Mondscheibe vom Beobachtungsort). Grenzen wie in tests/astro/check.py.
import { describe, it, expect } from 'vitest';
import { eclipseScan, circleCover } from '../../src/astro/index.js';

const at = iso => Date.parse(iso);
const near = (a, b, tol) => expect(Math.abs(a - b), `${a} statt ${b}`).toBeLessThanOrEqual(tol);
const list = eclipseScan(Date.UTC(2026, 0, 1), 5, 'sl');

describe('Finsternisse ab 2026', () => {
  it('Reihenfolge und Art', () => {
    expect(list.map(e => e.kind + ':' + e.type)).toEqual([
      'l:total',
      's:partial',
      'l:partial',
      'l:penumbral',
      'l:penumbral',
    ]);
  });
  it('totale Mondfinsternis 3. März 2026, 11:33:41 UTC – in Lübeck nicht zu sehen (Mond unter dem Horizont)', () => {
    near(list[0].max, at('2026-03-03T11:33:41Z'), 120000);
    expect(list[0].visible).toBe(false);
  });
  it('partielle Sonnenfinsternis 12. August 2026: größte Bedeckung 85 % um 18:07 UTC, tief im Westen', () => {
    const s = list[1];
    near(s.max, at('2026-08-12T18:07:00Z'), 180000);
    near(s.cover, 0.8498, 0.02);
    expect(s.el).toBeGreaterThan(0);
  });
  it('partielle Mondfinsternis 28. August 2026, 04:12:53 UTC – sichtbar', () => {
    near(list[2].max, at('2026-08-28T04:12:53Z'), 120000);
    expect(list[2].visible).toBe(true);
  });
  it('Halbschatten-Mondfinsternisse 20. Februar und 18. Juli 2027', () => {
    near(list[3].max, at('2027-02-20T23:12:54Z'), 120000);
    near(list[4].max, at('2027-07-18T16:02:59Z'), 120000);
  });
  it('nur Sonnenfinsternisse suchen', () => {
    expect(eclipseScan(Date.UTC(2026, 0, 1), 1, 's')[0].max).toBe(list[1].max);
  });
});

describe('Überdeckung zweier Kreise', () => {
  it('Grenzfälle', () => {
    expect(circleCover(1, 1, 2)).toBe(0); // berühren sich nur
    expect(circleCover(1, 1.1, 0)).toBe(1); // ganz bedeckt
    expect(circleCover(1, 0.5, 0)).toBeCloseTo(0.25, 12); // ringförmig: Flächenverhältnis
    expect(circleCover(1, 1, 1)).toBeCloseTo(0.391, 3); // halb versetzt
  });
});
