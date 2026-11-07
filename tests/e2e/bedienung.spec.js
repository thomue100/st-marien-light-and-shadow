// Bedienung in der Testfassung: Ansichten, Karten, Knöpfe, Tage, Rundgang, Sprache, Ansichtstiefe, Teilen.
import { test, expect, menuItem, openApp, showCard, waitCameraStill } from './helpers.js';

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
  // Karten: 6 über die Symbolleiste, 3 über die Menüs; immer genau eine offen
  await expect(page.locator('.rail .rbtn[data-card]')).toHaveCount(6);
  const cards = await page.locator('button[data-card]').evaluateAll(bs => bs.map(b => b.dataset.card));
  const keys = [...new Set(cards)].sort();
  expect(keys).toEqual(['clock', 'disp', 'exp', 'info', 'light', 'moon', 'sd', 'share', 'sun']);
  for (const k of keys) {
    await showCard(page, k);
    await expect(page.locator('.card:not([hidden])')).toHaveCount(1);
    await page.locator(`#card-${k} .cx`).click();
    await expect(page.locator(`#card-${k}`)).toBeHidden();
  }
});

/** Knopf in einer Karte drücken (Karte vorher öffnen) und die Kamerafahrt abwarten. */
async function press(page, card, sel, wait = true) {
  await showCard(page, card);
  await page.locator(sel).click();
  if (wait) await waitCameraStill(page);
}

test('Karte Mond: Vollmond, Neumond, Sonnenfinsternis', async ({ page }) => {
  await openApp(page, { hash: START });
  const date = page.locator('#date');
  await press(page, 'moon', '#goFull');
  await expect(date).toHaveValue('2026-06-30');
  await expect(page.locator('#timeOut')).toHaveText('01:26');
  await press(page, 'moon', '#goNew');
  await expect(date).toHaveValue('2026-07-14');
  await press(page, 'moon', '#goSolEcl');
  await expect(date).toHaveValue('2026-08-12');
  await expect(page.locator('#viewTxt')).toHaveText('Finsternis');
});

test('Karten Sonnenuhr, Uhr und Licht: Ansichten', async ({ page }) => {
  await openApp(page, { hash: START });
  const view = page.locator('#viewTxt');
  await press(page, 'sd', '#sdMoonGo');
  await expect(page.locator('#date')).toHaveValue('2026-06-30'); // nächster Vollmond
  await expect(view).toHaveText('Sonnenuhr');
  await press(page, 'clock', '#ckDial');
  await expect(view).toHaveText('Uhr: Zifferblatt');
  await press(page, 'clock', '#ckCal');
  await expect(view).toHaveText('Uhr: Kalenderscheibe');
  await press(page, 'light', '#skyGo', false); // Himmelsansicht: wird beim ersten Mal berechnet
  await expect(view).toHaveText('Himmel: Sonnen- und Mondbahn', { timeout: 120_000 });
});

test('Tag vor und zurück, besondere Tage', async ({ page }) => {
  await openApp(page, { hash: START });
  const date = page.locator('#date');
  await page.locator('#dayNext').click();
  await expect(date).toHaveValue('2026-06-22');
  await page.locator('#dayPrev').click();
  await page.locator('#dayPrev').click();
  await expect(date).toHaveValue('2026-06-20');
  const special = ['2026-03-20', '2026-06-21', '2026-08-15', '2026-09-22', '2026-12-21'];
  await page.locator('#tbFold').click(); // „Besondere Tage“ liegen in der zweiten Zeile der Zeitleiste
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
  await menuItem(page, '#discBtn', '#tourBtn');
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
  await page.locator('#langSeg [data-lang="en"]').click();
  await expect(page.locator('#langSeg [data-lang="en"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#viewTxt')).toHaveText('Outside');
  await page.locator('#langSeg [data-lang="de"]').click();
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
  await showCard(page, 'share');
  await expect(page.locator('#shareUrl')).toHaveValue(/#.*d=2026-11-05/);
  await expect(page.locator('#shareUrl')).toHaveValue(/v=aussen/);
});

test('Himmelsansicht aus einer Innenansicht und zurück', async ({ page }) => {
  // Fehler bis November 2026: Die Orbit-Steuerung zog die Kamera in der Himmelsansicht auf den Abstand
  // der Innenansicht zurück, das Panorama zeigte dann das Innere der Kirche statt Himmel und Stadt.
  await openApp(page, { hash: '#d=2026-11-06&t=781&v=schiff&l=de' });
  const pos = () => page.evaluate(() => window.__cam.position.toArray().map(v => Math.round(v)));
  await press(page, 'light', '#skyGo', false);
  await expect(page.locator('#viewTxt')).toHaveText('Himmel: Sonnen- und Mondbahn', { timeout: 120_000 });
  await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
  const sky = await page.evaluate(() => window.__V.himmel.pos.map(v => Math.round(v)));
  expect(await pos()).toEqual(sky);
  await page.evaluate(() => window.__go('schiff'));
  await waitCameraStill(page);
  await expect(page.locator('#viewTxt')).toHaveText('Mittelschiff');
  expect(await pos()).toEqual([-46, 2, 0]);
});

test('Freie Sicht: Taste F, Knopf und Menü; Esc holt die Bedienelemente zurück', async ({ page }) => {
  await openApp(page, { hash: START });
  const ui = ['.brand', '.rail', '.timebar'];
  const visible = async v => {
    for (const sel of ui) await (v ? expect(page.locator(sel)).toBeVisible() : expect(page.locator(sel)).toBeHidden());
  };
  await page.keyboard.press('f');
  await visible(false);
  await expect(page.locator('#freeMini')).toBeVisible();
  await expect(page.locator('#freeTime')).toHaveText('21.06.2026 · 13:00');
  await expect(page.locator('#freeBtn')).toHaveAttribute('aria-pressed', 'true');
  // Abspielen in der Minileiste läuft weiter
  await page.locator('#freePlay').click();
  await expect(page.locator('#freeTime')).not.toHaveText('21.06.2026 · 13:00');
  await page.locator('#freePlay').click();
  await page.keyboard.press('Escape');
  await visible(true);
  await expect(page.locator('#freeMini')).toBeHidden();
  // Knopf oben rechts, dann wieder zurück
  await page.locator('#freeBtn').click();
  await visible(false);
  await page.locator('#freeBtn').click();
  await visible(true);
  // Menü „⋯“
  await menuItem(page, '#moreBtn', '#freeItem');
  await visible(false);
  await page.keyboard.press('f');
  await visible(true);
});

test('Zeitleiste: zweite Zeile aufklappen, Sonne und Mond antippen', async ({ page }) => {
  await openApp(page, { hash: '#d=2026-06-21&t=882&v=aussen&l=de' });
  await expect(page.locator('#tbMore')).toBeHidden();
  await page.locator('#tbFold').click();
  await expect(page.locator('#tbMore')).toBeVisible();
  await expect(page.locator('#speed')).toBeVisible();
  await expect(page.locator('#sumLine')).toHaveText(/besonnt \d+ \/ 73 Fenster/);
  await page.locator('#tbFold').click();
  await expect(page.locator('#tbMore')).toBeHidden();
  await expect(page.locator('#sunChip')).toHaveText('55,8° SW');
  await expect(page.locator('#moonChip')).toHaveText('13,9° OSO · 46 %');
  await page.locator('#sunChip').click();
  await waitCameraStill(page);
  await expect(page.locator('#viewTxt')).toHaveText('Blick zur Sonne');
  await page.locator('#moonChip').click();
  await waitCameraStill(page);
  await expect(page.locator('#viewTxt')).toHaveText('Blick zum Mond');
});
