// Gemeinsame Hilfen für die Browser-Tests.
import { test as base, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** Testfassung mit Testhaken (npm run build:test) */
export const TEST_HTML = pathToFileURL(path.join(ROOT, 'tests/test.html')).href;
/** Offline-Fassung (npm run build:offline) */
export const OFFLINE_HTML = pathToFileURL(path.join(ROOT, 'dist/St-Marien-Licht-und-Schatten-offline.html')).href;
/** „Heute“ ist in allen Tests fest der 5. November 2026, 12:01 MEZ – so hängen Termine (Quiz, Suche) nicht vom Testtag ab. */
export const TODAY = new Date('2026-11-05T12:01:00+01:00');

/**
 * test mit automatischer Fehlerprüfung: Jede Fehlermeldung im Browser (Ausnahme oder console.error) lässt den Test scheitern.
 */
export const test = base.extend({
  browserErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', e => errors.push('Ausnahme: ' + e.message));
      page.on('console', m => {
        if (m.type() === 'error') errors.push('console.error: ' + m.text());
      });
      await use(errors);
      expect(errors, 'Fehlermeldungen im Browser').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Wartet, bis das Modell aufgebaut ist (Ladeanzeige fertig). */
export async function waitReady(page, hooks = true) {
  await page.waitForFunction(
    h => (!h || !!window.__dbg) && document.getElementById('loader')?.classList.contains('done'),
    hooks,
    { timeout: 180_000 },
  );
}

/**
 * Stellt die Uhr des Browsers auf TODAY; die Zeit läuft von dort normal weiter.
 * (Playwrights page.clock hält auch requestAnimationFrame an – dann zeichnet das Modell nicht mehr.)
 */
export async function setToday(page, when = TODAY) {
  await page.addInitScript(t => {
    const RealDate = Date,
      off = t - RealDate.now();
    class TestDate extends RealDate {
      constructor(...a) {
        super(...(a.length ? a : [RealDate.now() + off]));
      }
      static now() {
        return RealDate.now() + off;
      }
    }
    window.Date = TestDate;
  }, when.getTime());
}

/** Öffnet die Testfassung, wartet auf den Aufbau und wählt „Selbst erkunden“. */
export async function openApp(page, { hash = '', explore = true } = {}) {
  await setToday(page);
  await page.goto(TEST_HTML + hash);
  await waitReady(page);
  if (explore) await page.evaluate(() => document.querySelector('#tourChoice [data-go="free"]')?.click());
}

/** Wert eines Datums- oder Zeitreglers setzen wie per Hand (löst das passende Ereignis aus). */
export async function setInput(page, sel, value, event = 'change') {
  await page.evaluate(
    ([s, v, ev]) => {
      const el = document.querySelector(s);
      el.value = v;
      el.dispatchEvent(new Event(ev));
    },
    [sel, String(value), event],
  );
}

/** Wartet, bis eine Kamerafahrt vorbei ist und danach ein Bild gezeichnet wurde. */
export async function waitCameraStill(page) {
  await page.waitForFunction(() => !window.__moving(), null, { timeout: 60_000 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Bildschirmpunkt eines Punktes im Modell (x, y, z in Metern), z. B. für Fingertipps. */
export async function toScreen(page, x, y, z) {
  return page.evaluate(
    ([x, y, z]) => {
      const v = new THREE.Vector3(x, y, z).project(window.__cam);
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    [x, y, z],
  );
}

/** Bildschirmpunkt der Mitte eines Fensters eines bestimmten Typs. */
export async function windowCenter(page, type) {
  const c = await page.evaluate(t => {
    const w = window.__win.find(w => w.type === t);
    return [w.center.x, w.center.y, w.center.z];
  }, type);
  return toScreen(page, ...c);
}

/**
 * Karte öffnen wie ein Nutzer: über die Symbolleiste, sonst über das passende Menü
 * (Experimente unter „Entdecken“, Über das Modell und Teilen unter „⋯“).
 */
export async function showCard(page, k) {
  if (await page.locator(`#card-${k}`).isVisible()) return;
  const rail = page.locator(`.rail .rbtn[data-card="${k}"]`);
  if (await rail.count()) await rail.click();
  else {
    await page.locator(k === 'exp' ? '#discBtn' : '#moreBtn').click();
    await page.locator(`.dmenu button[data-card="${k}"]`).click();
  }
  await expect(page.locator(`#card-${k}`)).toBeVisible();
}

/** Eintrag in einem Menü der Titelleiste wählen. */
export async function menuItem(page, menuBtn, sel) {
  await page.locator(menuBtn).click();
  await page.locator(sel).click();
}
