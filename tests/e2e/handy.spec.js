// Handy: nur die Sonnenuhr – Startseite, Ablesen, drei Blickwinkel, Schnellwahl, „In 3 Schritten erklärt“,
// „Mehr am Computer“, Querformat.
import { test, expect, openApp, setToday, TEST_HTML, waitReady } from './helpers.js';

test.use({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
const MAI = '#d=2026-05-10&t=649&v=sonnenuhr&l=de'; // 10. Mai 2026, 10:49 MESZ: Zifferblatt besonnt

test('Startseite: Sonnenuhr im Mittelpunkt, Sprache sichtbar, „Selbst ausprobieren“ führt zum Ablesen', async ({
  page,
}) => {
  await setToday(page);
  await page.goto(TEST_HTML); // ohne Link: Startseite
  await waitReady(page);
  await expect(page.locator('body')).toHaveClass(/mobile/);
  await expect(page.locator('#mstart')).toBeVisible();
  await expect(page.locator('#msH')).toHaveText('Die Sonnenuhr');
  await expect(page.locator('#mpanel')).toBeHidden();
  await expect(page.locator('#mviews')).toBeHidden();
  await expect(page.locator('#tour')).toBeHidden(); // kein Rundgang auf dem Handy
  for (const sel of ['.brand', '.rail', '#freeBtn', '.card']) await expect(page.locator(sel).first(), sel).toBeHidden();

  await page.locator('#langSeg [data-lang="en"]').tap();
  await expect(page.locator('#msH')).toHaveText('The Sundial');
  await expect(page.locator('#msGo')).toHaveText('Try it yourself');
  await page.locator('#langSeg [data-lang="de"]').tap();

  await page.locator('#msGo').tap();
  await expect(page.locator('#mpanel')).toBeVisible();
  await expect(page.locator('#mviews [data-mv="sonnenuhr"]')).toHaveAttribute('aria-pressed', 'true');
  // Das Bild endet über der Anzeige
  const st = await page.locator('#stage').boundingBox(),
    pn = await page.locator('#mpanel').boundingBox();
  expect(st.y + st.height).toBeLessThanOrEqual(pn.y + 1);
  await page.locator('#mHome').tap();
  await expect(page.locator('#mstart')).toBeVisible();
});

test('Ablesen: Sonnenuhr und Uhr, drei Blickwinkel, Schnellwahl', async ({ page }) => {
  await openApp(page, { hash: MAI });
  await expect(page.locator('#mpClock')).toHaveText('10:49');
  await expect(page.locator('#mpTz')).toHaveText('MESZ');
  await expect(page.locator('#mpShow')).toHaveText(/^09:3\d$/);
  await expect(page.locator('#mpDiff')).toHaveText(/^Ihre Uhr geht 1 Std\. 1\d Min\. vor\.$/);

  // Kirche: nur die Beschriftung der Sonnenuhr, keine Randhinweise
  await page.locator('#mviews [data-mv="sued"]').tap();
  await expect(page.locator('#mviews [data-mv="sued"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.lbl.lsd')).toBeVisible();
  expect(await page.locator('.lbl:visible').count()).toBe(1);
  await expect(page.locator('.skymk:visible')).toHaveCount(0);
  // Himmel
  await page.locator('#mviews [data-mv="himmel"]').tap();
  await expect(page.locator('#mviews [data-mv="himmel"]')).toHaveAttribute('aria-pressed', 'true');

  // Schnellwahl: 21. Dezember mittags, zurück zum Zifferblatt
  await page.locator('.mpquick [data-q="dec"]').tap();
  await expect(page.locator('#date')).toHaveValue('2026-12-21');
  await expect(page.locator('#mpTz')).toHaveText('MEZ');
  await expect(page.locator('#mviews [data-mv="sonnenuhr"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.mpquick [data-q="jun"]').tap();
  await expect(page.locator('#date')).toHaveValue('2026-06-21');
  await page.locator('.mpquick [data-q="full"]').tap();
  await expect(page.locator('#mpShowLbl')).toHaveText(/Mondschatten zeigt|Sonnenuhr zeigt/);
  await expect(page.locator('#date')).not.toHaveValue('2026-06-21');
});

test('In 3 Schritten erklärt: Schatten, Zeitunterschied vorgerechnet, Sommer und Winter', async ({ page }) => {
  await setToday(page);
  await page.goto(TEST_HTML);
  await waitReady(page);
  await page.locator('#msSteps').tap();
  await expect(page.locator('#msteps')).toBeVisible();
  await expect(page.locator('#mpMain')).toBeHidden();
  await expect(page.locator('#msNum')).toHaveText('Schritt 1 von 3');
  await expect(page.locator('#date')).toHaveValue('2026-05-10');

  await page.locator('#msNext').tap();
  await expect(page.locator('#msNum')).toHaveText('Schritt 2 von 3');
  // 10:49 MESZ − 60 − 17 + Zeitgleichung = wahre Ortszeit 09:35
  const tab = page.locator('.mstab');
  await expect(tab).toContainText('10:49');
  await expect(tab).toContainText('− 60');
  await expect(tab).toContainText('− 17');
  await expect(tab.locator('.sum').first()).toHaveText('09:35');

  await page.locator('#msNext').tap();
  await expect(page.locator('#msNum')).toHaveText('Schritt 3 von 3');
  await expect(page.locator('#date')).toHaveValue('2026-06-21');
  await page.locator('#msBody [data-n="11"]').tap();
  await expect(page.locator('#date')).toHaveValue('2026-12-21');
  await page.locator('#msNext').tap(); // Fertig
  await expect(page.locator('#msteps')).toBeHidden();
  await expect(page.locator('#mpMain')).toBeVisible();

  // „Warum?“ springt direkt zu Schritt 2
  await page.locator('#mpWhy').tap();
  await expect(page.locator('#msNum')).toHaveText('Schritt 2 von 3');
  await page.locator('#msPrev').tap();
  await expect(page.locator('#msNum')).toHaveText('Schritt 1 von 3');
  await page.locator('#msPrev').tap(); // Schließen
  await expect(page.locator('#mpMain')).toBeVisible();
});

test('Mehr entdecken: Dachreiter und Uhr auf dem Handy, was es am Computer gibt, Link senden', async ({ page }) => {
  await openApp(page, { hash: MAI });
  await page.locator('#mpMore').tap();
  await expect(page.locator('#mdesk')).toBeVisible();
  await expect(page.locator('#mdesk .mdlist li')).toHaveCount(4);
  await expect(page.locator('#sendLink')).toBeVisible();
  await expect(page.locator('#mdesk button')).toHaveCount(5); // Zurück, Rundgang, Dachreiter, Uhr, Link senden
  await expect(page.locator('#mvExtra')).toBeHidden();
  await page.locator('#mdBack').tap();
  await expect(page.locator('#mdesk')).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/mobile/);
  // Dachreiter: vierter Blickwinkel erscheint, zurück über „Zifferblatt“
  await page.locator('#mpMore').tap();
  await page.locator('.mdgo[data-go="dachreiter"]').tap();
  await expect(page.locator('#mvExtra')).toHaveText('Dachreiter');
  await expect(page.locator('#mvExtra')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#mviews [data-mv="sonnenuhr"]').tap();
  await expect(page.locator('#mviews [data-mv="sonnenuhr"]')).toHaveAttribute('aria-pressed', 'true');
});

test.describe('Querformat', () => {
  test.use({ viewport: { width: 740, height: 340 }, isMobile: true, hasTouch: true });
  test('Anzeige als Seitenleiste rechts, Bild links frei', async ({ page }) => {
    await openApp(page, { hash: MAI });
    const p = await page.locator('#mpanel').boundingBox(),
      st = await page.locator('#stage').boundingBox(),
      lang = await page.locator('#langSeg').boundingBox(),
      mv = await page.locator('#mviews').boundingBox();
    expect(p.x).toBeGreaterThan(360);
    expect(p.height).toBeGreaterThan(330);
    expect(st.x + st.width).toBeLessThanOrEqual(p.x + 1);
    expect(lang.x + lang.width).toBeLessThanOrEqual(p.x);
    expect(mv.x + mv.width).toBeLessThanOrEqual(p.x);
    await expect(page.locator('#mpClock')).toHaveText('10:49');
  });
});
