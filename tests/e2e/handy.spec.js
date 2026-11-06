// Handy: Startseite, Rundgang mit Wischen, Blatt in drei Stufen mit Reitern, „Mehr“, Sprache.
import { test, expect, openApp, waitReady, setToday, TEST_HTML } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('Startseite: Rundgang mit Fingertext, Stationen wischen, Sprache umschalten', async ({ page }) => {
  await setToday(page);
  await page.goto(TEST_HTML); // ohne Link: Begrüßung als Startseite
  await waitReady(page);
  await expect(page.locator('body')).toHaveClass(/mobile/);
  await expect(page.locator('#tour')).toHaveClass(/welcome/);
  await expect(page.locator('#tourChoice [data-go="tour"]')).toBeVisible();
  await expect(page.locator('#langSeg')).toBeVisible();
  await expect(page.locator('#msheet')).toBeHidden(); // während Begrüßung und Rundgang kein Blatt

  await page.locator('#tourChoice [data-go="tour"]').tap();
  await expect(page.locator('#tourStep')).toHaveText('Station 1 von 8');
  await expect(page.locator('#tourText')).toContainText('Ziehen Sie mit einem Finger');
  // nach links wischen: nächste Station
  const box = await page.locator('#tour').boundingBox();
  const y = box.y + 30;
  await page.mouse.move(box.x + box.width - 30, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, y, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#tourStep')).toHaveText('Station 2 von 8');

  // Sprache: sichtbar oben rechts, auch im Rundgang
  await page.locator('#langSeg [data-lang="en"]').tap();
  await expect(page.locator('#tourStep')).toHaveText('Stop 2 of 8');
  await expect(page.locator('#langSeg [data-lang="en"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#langSeg [data-lang="de"]').tap();
  await expect(page.locator('#tourStep')).toHaveText('Station 2 von 8');
});

test('Blatt: zu, halb, ganz; Reiter mit Karten; „Mehr“ mit Teilen und Desktop-Hinweis; Haus führt zur Startseite', async ({
  page,
}) => {
  await openApp(page, { hash: '#d=2026-06-21&t=882&v=aussen&l=de' });
  const sheet = page.locator('#msheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('.rail')).toBeHidden();
  await expect(sheet).not.toHaveClass(/half|full/);
  await expect(page.locator('#msheet #timeOut')).toHaveText('14:42'); // Zeitleiste steckt im Blatt
  await expect(page.locator('#sunChip')).toBeVisible();

  // Griff: zu → halb → ganz → zu
  await page.locator('#mshHandle').tap();
  await expect(sheet).toHaveClass(/half/);
  await page.locator('#mshHandle').tap();
  await expect(sheet).toHaveClass(/full/);
  await page.locator('#mshHandle').tap();
  await expect(sheet).not.toHaveClass(/half|full/);

  // Reiter
  await page.locator('#mshTabs [data-tab="moon"]').tap();
  await expect(sheet).toHaveClass(/half/);
  await expect(page.locator('#card-moon')).toBeVisible();
  await expect(page.locator('#card-sun')).toBeHidden();
  await page.locator('#mshTabs [data-tab="church"]').tap();
  await expect(page.locator('#card-sd')).toBeVisible();
  await expect(page.locator('#card-clock')).toBeAttached();
  await page.locator('#mshTabs [data-tab="more"]').tap();
  await expect(page.locator('#mshMore')).toBeVisible();
  await expect(page.locator('#mshMore .badge')).toHaveText('Desktop');
  await page.locator('#mshMore button[data-card="share"]').tap();
  await expect(page.locator('#card-share')).toBeVisible();
  await expect(page.locator('#shareUrl')).toHaveValue(/d=2026-06-21/);

  // Karten, die andere Teile öffnen (hier: „Zur Sonne blicken“ aus der Sonnenkarte), bleiben im Blatt
  await page.locator('#mshTabs [data-tab="sun"]').tap();
  await page.locator('#sunLook').tap();
  await expect(page.locator('#viewTxt')).toHaveText('Blick zur Sonne');

  // Haus: zurück zur Startseite
  await page.locator('#homeBtn').tap();
  await expect(page.locator('#tour')).toHaveClass(/welcome/);
  await expect(page.locator('#tourChoice [data-go="free"]')).toBeVisible();
});

test.describe('Querformat', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  test('Blatt als Seitenleiste rechts mit Reitern, Modell links frei', async ({ page }) => {
    await openApp(page, { hash: '#d=2026-06-21&t=882&v=aussen&l=de' });
    const s = await page.locator('#msheet').boundingBox();
    expect(s.x).toBeGreaterThan(400);
    expect(s.height).toBeGreaterThan(380);
    await expect(page.locator('#mshTabs')).toBeVisible();
    await page.locator('#mshTabs [data-tab="moon"]').tap();
    await expect(page.locator('#card-moon')).toBeVisible();
    const free = await page.locator('#freeBtn').boundingBox();
    expect(free.x + free.width).toBeLessThanOrEqual(s.x);
  });
});
