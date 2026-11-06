// Die ausgelieferten Fassungen selbst (ohne Testhaken): Webfassung aus web/ (über vite preview) und die Offline-Datei.
import { test, expect, setToday, waitReady, OFFLINE_HTML } from './helpers.js';

const WEB = 'http://127.0.0.1:4173/';

/** Merkt sich alle Anfragen, die nicht an den eigenen Server bzw. die eigene Datei gehen. */
function foreignRequests(page, allowed) {
  const list = [];
  page.on('request', r => {
    const u = r.url();
    if (!allowed.some(a => u.startsWith(a))) list.push(u);
  });
  return list;
}

test('Webfassung: lädt auf Deutsch, Ansichten über das Menü, keine fremden Server', async ({ page }) => {
  const foreign = foreignRequests(page, [WEB, 'data:', 'blob:']);
  await setToday(page);
  await page.goto(WEB);
  await waitReady(page, false);
  await expect(page).toHaveTitle(/St\. Marien/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.locator('#tourChoice [data-go="free"]').click();
  await expect(page.locator('#views button[data-view]')).toHaveCount(21);
  // je eine Ansicht außen, Himmel (wird beim ersten Mal berechnet), innen und die Uhr; alle Ansichten prüft bedienung.spec.js
  for (const [v, label] of [
    ['luft', 'Luftbild'],
    ['himmel', 'Himmel: Sonnen- und Mondbahn'],
    ['schiff', 'Mittelschiff'],
    ['uhr', 'Astronomische Uhr'],
  ]) {
    await page.locator('#viewBtn').click();
    await page.locator(`#views button[data-view="${v}"]`).click();
    await expect(page.locator('#viewTxt')).toHaveText(label, { timeout: 120_000 });
    await page.waitForTimeout(2000); // Kamerafahrt abwarten
  }
  expect(foreign).toEqual([]);
});

test('Webfassung: Link mit Datum, Ansicht und Sprache', async ({ page }) => {
  await page.goto(WEB + '#d=2026-12-21&t=600&v=luft&l=en');
  await waitReady(page, false);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#date')).toHaveValue('2026-12-21');
  await expect(page.locator('#timeOut')).toHaveText('10:00');
  await expect(page.locator('#viewTxt')).toHaveText('Aerial view');
});

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  test('Webfassung: lädt im Hochformat, Leisten überdecken sich nicht', async ({ page }) => {
    await page.goto(WEB + '#d=2026-06-21&t=780&v=aussen&l=de');
    await waitReady(page, false);
    // Titelleiste, Knopf „Freie Sicht“, Symbolleiste (unten) und Zeitleiste überdecken sich nicht und liegen im Bild
    const boxes = {};
    for (const sel of ['.brand', '#freeBtn', '.rail', '.timebar']) boxes[sel] = await page.locator(sel).boundingBox();
    const sels = Object.keys(boxes);
    for (const [i, a] of sels.entries()) {
      const p = boxes[a];
      expect(p.x, a).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width, a).toBeLessThanOrEqual(390);
      expect(p.y + p.height, a).toBeLessThanOrEqual(844);
      for (const b of sels.slice(i + 1)) {
        const q = boxes[b];
        const overlap = p.x < q.x + q.width && p.x + p.width > q.x && p.y < q.y + q.height && p.y + p.height > q.y;
        expect(overlap, `${a} überdeckt ${b}`).toBe(false);
      }
    }
    await page.locator('#viewBtn').tap();
    const menu = await page.locator('#views').boundingBox();
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(390);
  });
});

test('Offline-Fassung: startet aus der Datei ohne Netz', async ({ page }) => {
  const foreign = foreignRequests(page, [OFFLINE_HTML.split('#')[0], 'data:', 'blob:']);
  await page.goto(OFFLINE_HTML + '#d=2026-06-21&t=780&v=sued&l=de');
  await waitReady(page, false);
  await expect(page.locator('#viewTxt')).toHaveText('Südseite');
  expect(foreign).toEqual([]);
});
