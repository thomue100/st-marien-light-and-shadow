// Experimente 1–4: Kirche als Sonnenuhr, Sonnenuhr und Armbanduhr, Lichtkalender, Astronomische Uhr und Himmel.
import { test, expect, openApp, setInput, waitCameraStill } from './helpers.js';

async function openExp(page, k) {
  if (await page.locator('#card-exp').isHidden()) await page.locator('.rbtn[data-card="exp"]').click();
  for (const back of await page.locator('.exppanel:not([hidden]) .expback').all()) await back.click();
  await page.locator(`.explink[data-exp="${k}"]`).click();
}
const texts = (page, sel) =>
  page
    .locator(sel)
    .allTextContents()
    .then(a => a.map(s => s.trim()).join(' | '));

test('Experiment 1: die Kirche als Sonnenuhr', async ({ page }) => {
  await openApp(page);
  await openExp(page, 'ks');
  await expect.poll(() => texts(page, '#exp-ks dd')).toBe('59,4° S | 74 m | 59,6° um 13:20 | 17 h 08 min');
  await page.locator('#ksSeg [data-m="11"]').click();
  await expect.poll(() => texts(page, '#exp-ks dd')).toBe('12,2° S | 579 m | 12,8° um 12:15 | 7 h 25 min');
});

test('Experiment 2: Sonnenuhr und Armbanduhr', async ({ page }) => {
  await openApp(page);
  await openExp(page, 'su');
  const now = page.locator('#suNow');
  await expect(now).toContainText(
    'Am 5. November 2026 zeigt die Sonnenuhr 12 Uhr, wenn die Armbanduhr 12:01 MEZ zeigt',
  );
  for (const [k, text, date, time] of [
    [
      'min',
      'Am 3. November 2026 zeigt die Sonnenuhr 12 Uhr, wenn die Armbanduhr 12:01 MEZ zeigt',
      '2026-11-03',
      '12:01',
    ],
    [
      'win',
      'Am 11. Februar 2026 zeigt die Sonnenuhr 12 Uhr, wenn die Armbanduhr 12:31 MEZ zeigt – die Sonnenuhr geht 31 Minuten nach.',
      '2026-02-11',
      '12:31',
    ],
    [
      'sum',
      'Am 26. Juli 2026 zeigt die Sonnenuhr 12 Uhr, wenn die Armbanduhr 13:24 MESZ zeigt – die Sonnenuhr geht 84 Minuten nach.',
      '2026-07-26',
      '13:24',
    ],
  ]) {
    await page.locator(`#suBtns [data-k="${k}"]`).click();
    await expect(now).toContainText(text);
    await expect(page.locator('#date')).toHaveValue(date);
    await expect(page.locator('#timeOut')).toHaveText(time);
  }
  await setInput(page, '#date', '2026-04-15');
  await expect(now).toContainText(
    'Am 15. April 2026 zeigt die Sonnenuhr 12 Uhr, wenn die Armbanduhr 13:17 MESZ zeigt – die Sonnenuhr geht 77 Minuten nach.',
  );
  await expect(page.locator('#timeOut')).toHaveText('13:17');
  expect(await page.evaluate(() => window.__sd.show)).toBeCloseTo(12, 1); // Schatten zeigt 12 Uhr
});

test('Experiment 3: Lichtkalender der Fenster', async ({ page }) => {
  await openApp(page);
  await openExp(page, 'lk');
  const ready = () => page.waitForFunction(() => !window.__LK.busy && !!window.__LK.cur, null, { timeout: 180_000 });
  await ready();
  const sum = page.locator('#lkSum');
  await expect(sum).toHaveText('Direktes Sonnenlicht an 24 von 24 Stichtagen, zusammen etwa 135 Stunden.');
  await expect(page.locator('#lkWin option')).toHaveText([
    'Westfenster (Auferstehungsfenster)',
    'Briefkapelle, Südseite',
    'Hochfenster Südseite des Mittelschiffs',
    'Marientidenkapelle, Ostfenster',
    'Totentanzfenster (Nordseite)',
  ]);
  for (const [i, text] of [
    [1, 'Direktes Sonnenlicht an 24 von 24 Stichtagen, zusammen etwa 101 Stunden.'],
    [2, 'Direktes Sonnenlicht an 24 von 24 Stichtagen, zusammen etwa 215 Stunden.'],
    [3, 'Direktes Sonnenlicht an 24 von 24 Stichtagen, zusammen etwa 116 Stunden.'],
    [4, 'Direktes Sonnenlicht an 12 von 24 Stichtagen, zusammen etwa 43 Stunden.'],
  ]) {
    await page.locator('#lkWin').selectOption(String(i));
    await ready();
    await expect(sum).toHaveText(text);
  }
  // Fingertipp ins Diagramm: Anfang Juni, 19 Uhr → Blick aus dem Westfenster nach innen
  await page.locator('#lkWin').selectOption('0');
  await ready();
  const cv = page.locator('#lkCv');
  const box = await cv.boundingBox();
  const size = await cv.evaluate(c => [c.width, c.height]);
  const L = 34,
    B = 18,
    cw = (size[0] - L - 4) / 72,
    ch = (size[1] - B - 4) / 24;
  const x = L + ((19 * 60 - 240) / 15 + 0.5) * cw,
    y = 2 + (10 + 0.5) * ch;
  await page.mouse.click(box.x + (x * box.width) / size[0], box.y + (y * box.height) / size[1]);
  await waitCameraStill(page);
  await expect(page.locator('#date')).toHaveValue('2026-06-01');
  await expect(page.locator('#timeOut')).toHaveText('19:07');
  await expect(page.locator('#viewTxt')).toHaveText('Fenster von innen');
});

test('Experiment 4: Astronomische Uhr und Himmel', async ({ page }) => {
  await openApp(page);
  await openExp(page, 'au');
  await expect(page.locator('#date')).toHaveValue('2026-11-05');
  await expect(page.locator('#auCmp tr')).toHaveCount(4);
  const note = page.locator('#auNote');
  await expect(note).toContainText('Der Mond der Uhr ist dem Himmel');
  for (const [d, date] of [
    ['1', '2026-11-06'],
    ['30', '2026-12-06'],
    ['365', '2027-12-06'],
  ]) {
    await page.locator(`#auBtns [data-d="${d}"]`).click();
    await expect(page.locator('#date')).toHaveValue(date);
    await expect(note).not.toBeEmpty();
  }
  await page.locator('#langBtn').click();
  await expect(page.locator('#exp-au h3')).toHaveText('Astronomical clock and sky');
});
