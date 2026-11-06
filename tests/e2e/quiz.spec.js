// Quiz komplett durchspielen: einstellen, ablesen, Tipp, falsche und richtige Antworten, Fenster antippen.
import { test, expect, openApp, setInput, waitCameraStill, windowCenter } from './helpers.js';

test('Quiz: alle fünf Aufgaben lösen', async ({ page }) => {
  await openApp(page, { explore: false });
  const step = page.locator('#qzStep'),
    fb = page.locator('#qzFb'),
    next = page.locator('#qzNext');
  const option = t => page.locator('#qzOpts button', { hasText: t });
  await page.locator('#tourChoice [data-go="quiz"]').click();

  // 1 Die Kirche als Sonnenuhr: Datum einstellen, bis der Schatten am kürzesten ist
  await expect(step).toHaveText('Quiz · Aufgabe 1 von 5 · 0 gelöst');
  await setInput(page, '#date', '2027-03-01');
  await expect(step).toContainText('0 gelöst');
  await setInput(page, '#date', '2027-06-25');
  await expect(step).toContainText('1 gelöst');
  await expect(fb).toContainText('Richtig: um den 21. Juni');

  // 2 Die Sonnenuhr: Jahreszahl ablesen – erst falsch, dann Tipp, dann richtig
  await next.click();
  await expect(step).toHaveText('Quiz · Aufgabe 2 von 5 · 1 gelöst');
  await option('2002').click();
  await expect(fb).toHaveText('Nicht ganz. Schauen Sie noch einmal genau auf die Platte, oben rechts.');
  await expect(option('2002')).toHaveClass(/no/);
  await page.locator('#qzHint').click();
  await option('1968').click();
  await expect(step).toContainText('2 gelöst');
  await expect(option('1968')).toHaveClass(/ok/);

  // 3 Wahre Ortszeit: Uhrzeit verschieben, bis die Sonnenuhr 12 zeigt
  await next.click();
  await expect(step).toHaveText('Quiz · Aufgabe 3 von 5 · 2 gelöst');
  for (let m = 770; m <= 830 && (await next.isHidden()); m += 2) {
    await setInput(page, '#time', m, 'input');
    await page.waitForTimeout(300);
  }
  await expect(step).toContainText('3 gelöst');
  await expect(fb).toContainText('Richtig: die Sonnenuhr zeigt 12 Uhr');

  // 4 Finsternisse: nächste in Lübeck sichtbare Sonnenfinsternis (ab „heute“ = 5.11.2026)
  await next.click();
  await expect(step).toHaveText('Quiz · Aufgabe 4 von 5 · 3 gelöst');
  await expect(page.locator('#qzOpts button')).toHaveCount(3);
  await page.locator('#qzOpts button[data-ok="0"]').first().click();
  await expect(fb).toContainText('Nicht ganz – vielleicht eine Mondfinsternis');
  await expect(step).toContainText('3 gelöst');
  await expect(page.locator('#qzOpts button[data-ok="1"]')).toHaveText('2. August 2027');
  await page.locator('#qzOpts button[data-ok="1"]').click();
  await expect(step).toContainText('4 gelöst');
  await expect(fb).toContainText('31 %');

  // 5 Fenster mit Totenkopf: Tipp, dann das Fenster im Modell antippen
  await next.click();
  await expect(step).toHaveText('Quiz · Aufgabe 5 von 5 · 4 gelöst');
  await page.locator('#qzHint').click();
  await expect(fb).toContainText('Totentanzkapelle');
  await waitCameraStill(page); // Kamera fährt zur Totentanzkapelle
  const p = await windowCenter(page, 4);
  await page.mouse.click(p.x, p.y);
  await expect(step).toContainText('5 gelöst');
  await expect(fb).toContainText('Markus Lüpertz');

  // Ergebnis und zurück zum freien Erkunden
  await next.click();
  await expect(step).toHaveText('Quiz · Ergebnis');
  await expect(page.locator('#qzTitle')).toHaveText('Sonnenuhr-Meister: 5 von 5');
  await page.locator('#qzOpts [data-go="free"]').click();
  await expect(page.locator('#quiz')).toBeHidden();
});
