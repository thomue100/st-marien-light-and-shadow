// Bedienung in der Testfassung: Ansichten, Karten, Knöpfe, Tage, Rundgang, Sprache, Ansichtstiefe, Teilen.
import { test, expect, openApp, waitCameraStill } from './helpers.js';

const START = '#d=2026-06-21&t=780&v=aussen&l=de';

test('Alle Ansichten und alle Karten', async ({ page }) => {
  await openApp(page, { hash: START });
  // Ansichten: jede lässt sich einstellen; die Ansichten im Menü heißen oben wie im Menü
  const menu = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('#views button[data-view]')].map(b => [b.dataset.view, b.textContent.trim()]),
    ),
  );
  const views = await page.evaluate(() => Object.keys(window.__V));
  expect(views.length).toBeGreaterThanOrEqual(20);
  for (const v of views) {
    await page.evaluate(v => window.__go(v, true), v);
    if (menu[v]) await expect(page.locator('#viewTxt'), v).toHaveText(menu[v]);
  }
  // Ansicht über das Menü wählen (mit Kamerafahrt)
  await page.locator('#viewBtn').click();
  await expect(page.locator('#views')).toBeVisible();
  await page.locator('#views button[data-view="sued"]').click();
  await waitCameraStill(page);
  await expect(page.locator('#viewTxt')).toHaveText('Südseite');
  // Karten der Symbolleiste: immer genau eine offen
  const cards = await page.locator('.rail .rbtn[data-card]').evaluateAll(bs => bs.map(b => b.dataset.card));
  expect(cards).toHaveLength(9);
  for (const k of cards) {
    await page.locator(`.rail .rbtn[data-card="${k}"]`).click();
    await expect(page.locator(`#card-${k}`)).toBeVisible();
    await expect(page.locator('.card:not([hidden])')).toHaveCount(1);
    await page.locator(`.rail .rbtn[data-card="${k}"]`).click();
    await expect(page.locator(`#card-${k}`)).toBeHidden();
  }
});

test('Knöpfe in den Karten, Tag vor und zurück, besondere Tage', async ({ page }) => {
  await openApp(page, { hash: START });
  const date = page.locator('#date'),
    view = page.locator('#viewTxt');
  const press = async (card, sel) => {
    if (await page.locator(`#card-${card}`).isHidden()) await page.locator(`.rail .rbtn[data-card="${card}"]`).click();
    await page.locator(sel).click();
    await waitCameraStill(page);
  };
  await press('moon', '#goFull');
  await expect(date).toHaveValue('2026-06-30');
  await expect(page.locator('#timeOut')).toHaveText('01:26');
  await press('moon', '#goNew');
  await expect(date).toHaveValue('2026-07-14');
  await press('moon', '#goSolEcl');
  await expect(date).toHaveValue('2026-08-12');
  await expect(view).toHaveText('Finsternis');
  await press('sd', '#sdMoonGo');
  await expect(date).toHaveValue('2026-08-28');
  await expect(view).toHaveText('Sonnenuhr');
  await press('clock', '#ckDial');
  await expect(view).toHaveText('Uhr: Zifferblatt');
  await press('clock', '#ckCal');
  await expect(view).toHaveText('Uhr: Kalenderscheibe');
  await press('light', '#skyGo');
  await expect(view).toHaveText('Himmel: Sonnen- und Mondbahn');

  await page.locator('#dayNext').click();
  await expect(date).toHaveValue('2026-08-29');
  await page.locator('#dayPrev').click();
  await page.locator('#dayPrev').click();
  await expect(date).toHaveValue('2026-08-27');
  const special = ['2026-03-20', '2026-06-21', '2026-08-15', '2026-09-22', '2026-12-21'];
  for (const [i, d] of special.entries()) {
    await page.locator('#presetBtn').click();
    await page.locator('#presets button').nth(i).click();
    await expect(date).toHaveValue(d);
  }
});

test('Rundgang, Sprache, Ansichtstiefe und Teilen', async ({ page }) => {
  await openApp(page, { hash: START });
  // Rundgang: acht Stationen
  const dates = [
    '2026-05-10',
    '2026-05-10',
    '2026-06-21',
    '2026-06-21',
    '2026-05-10',
    '2026-06-21',
    '2026-11-25',
    '2026-11-05',
  ];
  await page.locator('#tourBtn').click();
  for (let k = 1; k <= 8; k++) {
    if (k > 1) await page.locator('#tourNext').click();
    await expect(page.locator('#tourStep')).toContainText(`Station ${k} von 8`);
    await expect(page.locator('#date')).toHaveValue(dates[k - 1]);
    await expect(page.locator('#tourTitle')).not.toBeEmpty();
  }
  await page.keyboard.press('Escape'); // an der letzten Station gibt es statt „Beenden“ eine Auswahl
  await expect(page.locator('#tour')).toBeHidden();

  // Sprache
  await page.evaluate(() => window.__go('aussen', true));
  await page.locator('#langBtn').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#viewTxt')).toHaveText('Outside');
  await page.locator('#langBtn').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('#viewTxt')).toHaveText('Außen');

  // Einfache und erweiterte Ansicht
  const expert = () => page.evaluate(() => document.body.classList.contains('expert'));
  const before = await expert();
  await page.locator('.rail .rbtn[data-card="light"]').click();
  const more = page.locator('#card-light .more');
  await more.click();
  expect(await expert()).toBe(!before);
  await more.click();
  expect(await expert()).toBe(before);
  await page.locator('.rail .rbtn[data-card="light"]').click();

  // Teilen: Link enthält Datum, Uhrzeit und Ansicht
  await page.locator('.rail .rbtn[data-card="share"]').click();
  await expect(page.locator('#shareUrl')).toHaveValue(/#.*d=2026-11-05/);
  await expect(page.locator('#shareUrl')).toHaveValue(/v=aussen/);
});
