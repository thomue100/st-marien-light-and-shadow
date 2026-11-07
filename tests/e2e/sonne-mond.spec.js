// Sonne und Mond in den Außenansichten finden: Randhinweise und „Blick zur Sonne“ / „Blick zum Mond“.
import { test, expect, openApp, showCard, waitCameraStill } from './helpers.js';

// 21. Juni 2026, 14:42 MESZ: Sonne 55,8° hoch im Südwesten, Mond 13,9° im Ostsüdosten – beide außerhalb der Ansicht „Außen“
const START = '#d=2026-06-21&t=882&v=aussen&l=de';

/** Wo steht Sonne oder Mond im Bild? x, y von -1 bis 1; front: vor der Kamera. */
function where(page, which) {
  return page.evaluate(w => {
    const d = (w === 'moon' ? window.__LM : window.__L).clone();
    const v = d.clone().transformDirection(window.__cam.matrixWorldInverse);
    const p = d.add(window.__cam.position).project(window.__cam);
    return { x: p.x, y: p.y, front: v.z < 0 };
  }, which);
}
const inFrame = p => p.front && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95;

test('Randhinweis führt zur Sonne, Kirche und Sonne im Bild, Link stellt den Blick wieder her', async ({
  page,
  browser,
}) => {
  await openApp(page, { hash: START });
  expect(inFrame(await where(page, 'sun'))).toBe(false);
  await expect(page.locator('#mkSun')).toBeVisible();
  await expect(page.locator('#mkSun')).toHaveAttribute('aria-label', /Sonne 55,8° hoch/);
  await expect(page.locator('#mkMoon')).toBeVisible();

  await page.locator('#mkSun').click();
  await waitCameraStill(page);
  await expect(page.locator('#viewTxt')).toHaveText('Blick zur Sonne');
  const sun = await where(page, 'sun');
  expect(inFrame(sun)).toBe(true);
  expect(sun.y).toBeGreaterThan(0); // obere Bildhälfte
  await expect(page.locator('#mkSun')).toBeHidden();
  // Kirche unten im Bild: Spitze des Nordturms
  const tower = await page.evaluate(() => {
    const p = new THREE.Vector3(-44, 120, -14).project(window.__cam);
    return { x: p.x, y: p.y };
  });
  expect(Math.abs(tower.x)).toBeLessThan(0.9);
  expect(tower.y).toBeLessThan(sun.y);
  expect(tower.y).toBeGreaterThan(-0.6);

  // Teilen und den Link neu öffnen
  await showCard(page, 'share');
  await expect(page.locator('#shareUrl')).toHaveValue(/v=zurSonne/); // die Karte füllt den Link gleich nach dem Öffnen
  const url = await page.locator('#shareUrl').inputValue();
  const page2 = await browser.newPage({ viewport: { width: 1400, height: 850 } });
  await openApp(page2, { hash: url.slice(url.indexOf('#')) });
  await expect(page2.locator('#viewTxt')).toHaveText('Blick zur Sonne');
  expect(inFrame(await where(page2, 'sun'))).toBe(true);
  await page2.close();
});

test('Mondkarte: zum Mond blicken; steht er unter dem Horizont, nur ein Hinweis', async ({ page }) => {
  await openApp(page, { hash: START });
  await page.locator('.rail .rbtn[data-card="moon"]').click();
  await page.locator('#moonLook').click();
  await waitCameraStill(page);
  await expect(page.locator('#viewTxt')).toHaveText('Blick zum Mond');
  expect(inFrame(await where(page, 'moon'))).toBe(true);
  await expect(page.locator('#mkMoon')).toBeHidden();
  await expect(page.locator('#mkSun')).toBeVisible(); // die Sonne steht jetzt hinter der Kamera

  // Zeit, zu der der Mond unter dem Horizont steht
  const low = await page.evaluate(() => {
    const A = window.__A;
    for (let m = 0; m < 1440; m += 10) if (A.moonPos(A.localToUtc(2026, 5, 21, m)).el < -3) return m;
    return null;
  });
  expect(low).not.toBeNull();
  await page.evaluate(m => window.__A.setMinutes(m), low);
  await page.locator('#moonLook').click();
  await expect(page.locator('#hint')).toHaveText('Der Mond steht gerade unter dem Horizont.');
  await expect(page.locator('#viewTxt')).toHaveText('Blick zum Mond'); // keine Kamerafahrt
  await expect(page.locator('#mkMoon')).toBeHidden();
});
