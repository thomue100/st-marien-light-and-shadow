// Zeitumstellung: angezeigte Ortszeit, Zeitzone, UTC-Zeitpunkt und Hinweis an den Umstellungstagen.
import { test, expect, openApp } from './helpers.js';

const VOR = 'Zeitumstellung: Die Uhr springt von 2 auf 3 Uhr – 2:00 bis 2:59 gibt es heute nicht';
const ZURUECK = 'Zeitumstellung: 2–3 Uhr gibt es heute zweimal – gezeigt wird der zweite Durchlauf (MEZ)';

// [Jahr, Monat (0–11), Tag, Regler in Minuten] → [Anzeige, Zone, UTC, Hinweis zur Umstellung]
const FAELLE = [
  [
    [2026, 0, 15, 720],
    ['12:00', 'MEZ', '11:00', null],
  ],
  [
    [2026, 6, 15, 720],
    ['12:00', 'MESZ', '10:00', null],
  ],
  [
    [2026, 2, 29, 90],
    ['01:30', 'MEZ', '00:30', null],
  ],
  [
    [2026, 2, 29, 119],
    ['01:59', 'MEZ', '00:59', null],
  ],
  [
    [2026, 2, 29, 120],
    ['03:00', 'MESZ', '01:00', VOR],
  ],
  [
    [2026, 2, 29, 150],
    ['03:00', 'MESZ', '01:00', VOR],
  ],
  [
    [2026, 2, 29, 179],
    ['03:00', 'MESZ', '01:00', VOR],
  ],
  [
    [2026, 2, 29, 180],
    ['03:00', 'MESZ', '01:00', null],
  ],
  [
    [2026, 2, 29, 200],
    ['03:20', 'MESZ', '01:20', null],
  ],
  [
    [2026, 9, 25, 90],
    ['01:30', 'MESZ', '23:30', null],
  ],
  [
    [2026, 9, 25, 150],
    ['02:30', 'MEZ', '01:30', ZURUECK],
  ],
  [
    [2026, 9, 25, 200],
    ['03:20', 'MEZ', '02:20', null],
  ],
  [
    [2027, 2, 28, 150],
    ['03:00', 'MESZ', '01:00', VOR],
  ],
  [
    [2030, 9, 27, 150],
    ['02:30', 'MEZ', '01:30', ZURUECK],
  ],
];

test('Zeitumstellung im März und Oktober', async ({ page }) => {
  await openApp(page);
  for (const [[y, m, d, min], [anzeige, zone, utc, hinweis]] of FAELLE) {
    const r = await page.evaluate(
      ([y, m, d, min]) => {
        const A = window.__A;
        A.setDate(y, m, d);
        A.setMinutes(min);
        const $ = s => document.querySelector(s);
        return {
          anzeige: $('#timeOut').textContent,
          zone: $('#tzName').textContent,
          utc: new Date(A.dstInfo(y, m, d, min).utc).toISOString().slice(11, 16),
          hinweis: $('#night').hidden ? '' : $('#night').textContent,
        };
      },
      [y, m, d, min],
    );
    const fall = `${d}.${m + 1}.${y}, Regler ${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
    expect(r.anzeige, fall).toBe(anzeige);
    expect(r.zone, fall).toBe(zone);
    expect(r.utc, fall).toBe(utc);
    if (hinweis) expect(r.hinweis, fall).toBe(hinweis);
    else expect(r.hinweis, fall).not.toMatch(/Zeitumstellung/);
  }
});
