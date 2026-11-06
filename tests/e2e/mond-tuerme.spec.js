// Experiment „Mond zwischen den Türmen“: Standort per Fingertipp, Terminsuche von Westen und Osten, Kameraansicht.
import { test, expect, openApp, setInput, toScreen, waitCameraStill } from './helpers.js';

const waitSearch = page =>
  page.waitForFunction(() => !window.__MZT.busy && !!window.__MZT.res, null, { timeout: 180_000 });

test('Mond zwischen den Türmen: Standort wählen und Termine suchen', async ({ page }) => {
  await openApp(page);
  await page.locator('.rbtn[data-card="exp"]').click();
  await page.locator('.explink[data-exp="mt"]').click();
  await waitCameraStill(page);
  await expect(page.locator('#viewTxt')).toHaveText('Draufsicht: Standort wählen');

  // Fingertipp 1000 m westlich der Türme
  const p = await toScreen(page, -43.85 - 1000, 0, 0);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => page.evaluate(() => window.__MZT.side + ' ' + window.__MZT.dist)).toBe('w 1000');
  await expect(page.locator('#mtGeo')).toContainText('Von dort erscheinen die Turmspitzen 7,3° hoch');

  // Termine von Westen (ab „heute“, 5.11.2026)
  await page.locator('#mtFind').click();
  await waitSearch(page);
  await expect(page.locator('#mtSum')).toHaveText(
    '9 Termine in den sechs Monaten ab 5. November 2026, zum Ansehen antippen:',
  );
  const res = page.locator('#mtRes button');
  await expect(res).toHaveCount(9);
  await expect(res.first()).toContainText('Do 5.11.2026, 03:35 MEZ');
  await expect(res.nth(1)).toContainText('Do 19.11.2026, 14:24 MEZ');
  await res.first().click();
  await waitCameraStill(page);
  await expect(page.locator('#viewTxt')).toHaveText('Blick vom Standort');
  await expect(page.locator('#timeOut')).toHaveText('03:35');
  await expect(page.locator('#date')).toHaveValue('2026-11-05');

  // Von Osten, 500 m
  if (await page.locator('#card-exp').isHidden()) await page.locator('.rbtn[data-card="exp"]').click();
  await page.locator('#mtSide [data-side="e"]').click();
  await setInput(page, '#mtDist', 500, 'input');
  await page.evaluate(() => (window.__MZT.res = null));
  await page.locator('#mtFind').click();
  await waitSearch(page);
  await expect(page.locator('#mtSum')).toHaveText(
    '19 Termine in den sechs Monaten ab 5. November 2026, zum Ansehen antippen:',
  );
  await expect(res.first()).toContainText('So 22.11.2026, 03:41 MEZ');
});
