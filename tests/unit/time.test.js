// Zeit: Ortszeit Berlin ↔ UTC und Sommerzeit.
// Referenz ist die Zeitzonen-Datenbank des Browsers bzw. von Node (Intl, Europe/Berlin) und die gesetzlichen Regeln.
import { describe, it, expect } from 'vitest';
import { dstRange, berlinOffsetMin, localToUtc, dstInfo, lastSundayUtc } from '../../src/astro/index.js';

// Abstand Berlin–UTC in Minuten laut Zeitzonen-Datenbank
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' });
const tzdbOffsetMin = u => {
  const name = fmt.formatToParts(new Date(u)).find(p => p.type === 'timeZoneName').value; // "GMT+1" / "GMT+2"
  return Number(name.replace('GMT', '')) * 60;
};

describe('Sommerzeit-Regeln', () => {
  it('2026: 29. März bis 25. Oktober, jeweils 01:00 UTC', () => {
    expect(dstRange(2026)).toEqual([Date.UTC(2026, 2, 29, 1), Date.UTC(2026, 9, 25, 1)]);
  });
  it('1981–1995 endete die Sommerzeit Ende September', () => {
    expect(dstRange(1995)).toEqual([Date.UTC(1995, 2, 26, 1), Date.UTC(1995, 8, 24, 1)]);
  });
  it('1980: Sonderregel 6. April bis 28. September', () => {
    expect(dstRange(1980)).toEqual([Date.UTC(1980, 3, 6, 1), Date.UTC(1980, 8, 28, 1)]);
  });
  it('vor 1980 keine Sommerzeit', () => {
    expect(dstRange(1979)).toBeNull();
    expect(berlinOffsetMin(Date.UTC(1975, 6, 1))).toBe(60);
  });
  it('letzter Sonntag eines Monats', () => {
    expect(lastSundayUtc(2027, 2)).toBe(Date.UTC(2027, 2, 28, 1));
    expect(lastSundayUtc(2027, 9)).toBe(Date.UTC(2027, 9, 31, 1));
  });
});

describe('Abstand zu UTC stimmt mit der Zeitzonen-Datenbank überein', () => {
  it('an jeder Umstellung 1980–2040 (je eine Sekunde davor und danach) und zur Jahresmitte', () => {
    for (let y = 1980; y <= 2040; y++) {
      const [a, b] = dstRange(y);
      for (const u of [a - 1000, a, b - 1000, b, Date.UTC(y, 0, 15, 12), Date.UTC(y, 6, 15, 12)]) {
        expect(berlinOffsetMin(u), new Date(u).toISOString()).toBe(tzdbOffsetMin(u));
      }
    }
  });
});

describe('Ortszeit → UTC', () => {
  it('Winter: 12:00 MEZ = 11:00 UTC', () => {
    expect(localToUtc(2026, 0, 15, 720)).toBe(Date.UTC(2026, 0, 15, 11));
  });
  it('Sommer: 12:00 MESZ = 10:00 UTC', () => {
    expect(localToUtc(2026, 6, 15, 720)).toBe(Date.UTC(2026, 6, 15, 10));
  });
  it('Umstellung im März: 02:00–02:59 gibt es nicht', () => {
    const i = dstInfo(2026, 2, 29, 150);
    expect(i.gap).toBe(true);
    expect(i.fold).toBe(false);
    expect(dstInfo(2026, 2, 29, 119).off).toBe(60); // 01:59 MEZ
    expect(dstInfo(2026, 2, 29, 180).off).toBe(120); // 03:00 MESZ
    expect(localToUtc(2026, 2, 29, 180)).toBe(Date.UTC(2026, 2, 29, 1));
  });
  it('Umstellung im Oktober: 02:00–02:59 gibt es zweimal, das Modell nimmt den zweiten Durchlauf (MEZ)', () => {
    const i = dstInfo(2026, 9, 25, 150);
    expect(i.fold).toBe(true);
    expect(i.off).toBe(60);
    expect(i.utc).toBe(Date.UTC(2026, 9, 25, 1, 30));
  });
  it('Ortszeit und UTC passen an jedem Tag zueinander (2026, stündlich)', () => {
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 864e5) {
      const d = new Date(t);
      for (let min = 0; min < 1440; min += 60) {
        const i = dstInfo(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), min);
        if (i.gap) continue;
        expect(i.utc + i.off * 60000 - t, d.toISOString().slice(0, 10) + ' ' + min).toBe(min * 60000);
      }
    }
  });
});
