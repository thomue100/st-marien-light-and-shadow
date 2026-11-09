// Handy: Navigation zwischen allen Bildschirmen – jeder Übergang einmal und ein Zufallsspaziergang.
//
// Bildschirme: Startseite · Ablesen · In 3 Schritten erklärt · Rundgang (unten in der Anzeige)
// und darüber gelegt: Mehr entdecken · Alle Ansichten.
// Nach jedem Tipp gelten die Prüfregeln in regeln(): genau ein Bildschirm, immer ein sichtbarer Weg zurück,
// Blickwinkel-Knöpfe passend zur Ansicht, Bild über der Anzeige; Fehler im Browser lassen den Test ohnehin scheitern.
//
// Zufallsspaziergang wiederholen: WALK_SEED=… WALK_STEPS=… npx playwright test handy-navigation
import { test, expect, setToday, TEST_HTML, waitReady } from './helpers.js';

test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

/** Verstöße gegen die Prüfregeln im aktuellen Zustand (leere Liste: alles in Ordnung). */
function regeln(page) {
  return page.evaluate(() => {
    const $ = s => document.querySelector(s),
      vis = el => !!el && el.checkVisibility({ checkVisibilityCSS: true }),
      v = window.__view(),
      fehler = [];
    const start = vis($('#mstart')),
      panel = vis($('#mpanel')),
      main = panel && vis($('#mpMain')),
      steps = panel && vis($('#msteps')),
      tour = panel && vis($('#tour')),
      desk = vis($('#mdesk')),
      list = vis($('#mvsel'));
    // 1. genau ein Bildschirm
    if (start === panel) fehler.push(`Startseite ${start}, Anzeige ${panel}`);
    if (panel && main + steps + tour !== 1)
      fehler.push(`Anzeige: Ablesen ${main}, Schritte ${steps}, Rundgang ${tour}`);
    // 2. immer ein sichtbarer Weg zurück
    const zurueck = list
      ? vis($('#mvBack'))
      : desk
        ? vis($('#mdBack'))
        : start
          ? vis($('#msGo'))
          : steps
            ? vis($('#msPrev'))
            : tour
              ? vis($('#tourEnd')) || vis($('#tourChoice'))
              : vis($('#mHome'));
    if (!zurueck) fehler.push('kein sichtbarer Weg zurück');
    const home = getComputedStyle($('#mHome')).visibility !== 'hidden';
    if (start === home)
      fehler.push(
        `Knopf „Die Sonnenuhr“ ${home ? 'sichtbar' : 'unsichtbar'} ${start ? 'auf' : 'außerhalb'} der Startseite`,
      );
    // 3. Blickwinkel-Knöpfe nur beim Ablesen, genau einer gewählt, passend zur Ansicht
    if (vis($('#mviews')) !== main)
      fehler.push(`Blickwinkel-Knöpfe ${main ? 'fehlen beim Ablesen' : 'sichtbar außerhalb des Ablesens'}`);
    if (main && !window.__moving()) {
      const an = [...document.querySelectorAll('#mviews button')].filter(
        b => vis(b) && b.getAttribute('aria-pressed') === 'true',
      );
      if (an.length !== 1) fehler.push(`${an.length} Blickwinkel gewählt: ${an.map(b => b.dataset.mv).join(', ')}`);
      const soll = v.pano ? 'himmel' : ['sonnenuhr', 'sued'].includes(v.v) ? v.v : null;
      if (soll && an[0] && an[0].dataset.mv !== soll)
        fehler.push(`Ansicht ${v.pano ? 'Himmel' : v.v}, gewählt ist „${an[0].dataset.mv}“`);
      if (!soll && an[0] && an[0].dataset.mv !== v.v) fehler.push(`Ansicht ${v.v}, gewählt ist „${an[0].dataset.mv}“`);
    }
    // 4. Einklappen nur beim Ablesen
    if (panel && vis($('#mpFold')) !== main) fehler.push(`Einklappen ${main ? 'fehlt' : 'sichtbar'}`);
    // 5. das Bild endet über der Anzeige bzw. der Startseite
    const st = $('#stage').getBoundingClientRect(),
      unten = (start ? $('#mstart') : $('#mpanel')).getBoundingClientRect();
    if (st.bottom > unten.top + 1) fehler.push(`Bild reicht ${Math.round(st.bottom - unten.top)} px unter die Anzeige`);
    return fehler;
  });
}

/** Welcher Bildschirm oben liegt (für Meldungen und die Wahl im Zufallsspaziergang). */
function oben(page) {
  return page.evaluate(() => {
    const vis = s => document.querySelector(s).checkVisibility({ checkVisibilityCSS: true });
    if (vis('#mvsel')) return 'Alle Ansichten';
    if (vis('#mdesk')) return 'Mehr entdecken';
    if (vis('#mstart')) return 'Startseite';
    if (vis('#msteps')) return 'Schritte';
    if (vis('#tour')) return 'Rundgang';
    return 'Ablesen';
  });
}

/** Tippen, auf das Ende der Kamerafahrt warten, dann die Prüfregeln (mit Geduld für Übergänge) anwenden. */
async function tippe(page, sel, log, erwartet) {
  log.push(sel);
  await page.locator(sel).tap({ timeout: 15_000 });
  // Kamerafahrt abwarten, dazu die verzögerten Abgleiche (Blickwinkel nach 0,5 s, Himmelsansicht wird erst vorbereitet)
  await page.waitForFunction(() => !window.__moving(), null, { timeout: 60_000 });
  await page.waitForTimeout(700);
  await page.waitForFunction(() => !window.__moving(), null, { timeout: 60_000 });
  await expect
    .poll(() => regeln(page), { timeout: 15_000, message: 'Prüfregeln nach: ' + log.slice(-10).join(' → ') })
    .toEqual([]);
  if (erwartet) expect(await oben(page), 'nach ' + log.slice(-6).join(' → ')).toBe(erwartet);
}

async function oeffne(page) {
  await setToday(page);
  await page.goto(TEST_HTML); // ohne Link: Startseite
  await waitReady(page);
  await expect.poll(() => regeln(page)).toEqual([]);
}

test('Jeder Übergang einmal: Startseite, Ablesen, Schritte, Mehr entdecken, Alle Ansichten, Rundgang', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const log = [];
  const t = (sel, erwartet) => tippe(page, sel, log, erwartet);
  await oeffne(page);
  expect(await oben(page)).toBe('Startseite');

  // Startseite ⇄ Ablesen
  await t('#msGo', 'Ablesen');
  await t('#mHome', 'Startseite');
  // Startseite → Schritte; alle drei Schritte vor und zurück, Fertig → Ablesen
  await t('#msSteps', 'Schritte');
  await t('#msNext', 'Schritte');
  await t('#msNext', 'Schritte');
  await t('#msBody [data-n="11"]', 'Schritte');
  await t('#msBody [data-n="5"]', 'Schritte');
  await t('#msPrev', 'Schritte');
  await t('#msNext', 'Schritte');
  await t('#msNext', 'Ablesen'); // Fertig
  // Ablesen → „Warum?“ (Schritt 2) → Schließen über Zurück
  await t('#mpWhy', 'Schritte');
  await expect(page.locator('#msNum')).toHaveText('Schritt 2 von 3');
  await t('#msPrev', 'Schritte');
  await t('#msPrev', 'Ablesen'); // Schließen
  // Schritte → Startseite über den Knopf oben
  await t('#mpWhy', 'Schritte');
  await t('#mHome', 'Startseite');

  // Startseite → Mehr entdecken → Zurück führt auf die Startseite zurück
  await t('#msDesk', 'Mehr entdecken');
  await t('#mdBack', 'Startseite');
  // Startseite → Mehr entdecken → Alle Ansichten → Zurück → Mehr entdecken → Zurück
  await t('#msDesk', 'Mehr entdecken');
  await t('.mdgo[data-go="views"]', 'Alle Ansichten');
  await t('#mvBack', 'Mehr entdecken');
  // Alle Ansichten → eine der festen Ansichten: vierter Knopf „Ansichten ▾“ führt zur Liste zurück
  await t('.mdgo[data-go="views"]', 'Alle Ansichten');
  await t('#mvList [data-view="sued"]', 'Ablesen');
  await expect(page.locator('#mvExtra')).toHaveText('Ansichten');
  await t('#mvExtra', 'Alle Ansichten');
  await t('#mvBack', 'Ablesen');
  // … und eine weitere Ansicht aus der Liste: erscheint als vierter Knopf
  await t('#mvExtra', 'Alle Ansichten');
  await t('#mvList [data-view="schiff"]', 'Ablesen');
  await expect(page.locator('#mvExtra')).toHaveAttribute('aria-pressed', 'true');
  // gewählter vierter Knopf öffnet die Liste
  await t('#mvExtra', 'Alle Ansichten');
  await t('#mvBack', 'Ablesen');
  // die drei festen Blickwinkel
  await t('#mviews [data-mv="himmel"]', 'Ablesen');
  await t('#mviews [data-mv="sued"]', 'Ablesen');
  await t('#mviews [data-mv="sonnenuhr"]', 'Ablesen');

  // Ablesen → Mehr entdecken → Dachreiter: die eingestellte Zeit bleibt
  await t('.mpquick [data-q="dec"]', 'Ablesen');
  const vorher = await page.evaluate(() => window.__view());
  await t('#mpMore', 'Mehr entdecken');
  await t('.mdgo[data-go="dachreiter"]', 'Ablesen');
  const nachher = await page.evaluate(() => window.__view());
  expect([nachher.v, nachher.m, nachher.d, nachher.min]).toEqual(['dachreiter', vorher.m, vorher.d, vorher.min]);
  await t('#mpMore', 'Mehr entdecken');
  await t('.mdgo[data-go="uhr"]', 'Ablesen');
  await expect(page.locator('#mvExtra')).toHaveText('Uhr');
  // zurück auf die Startseite: der vierte Knopf verschwindet
  await t('#mHome', 'Startseite');
  await t('#msGo', 'Ablesen');
  await expect(page.locator('#mvExtra')).toBeHidden();

  // Einklappen und wieder ausklappen; die Startseite klappt immer aus
  await t('#mpFold', 'Ablesen');
  await expect(page.locator('body')).toHaveClass(/mpfold/);
  await t('#mpFold', 'Ablesen');
  await expect(page.locator('body')).not.toHaveClass(/mpfold/);
  await t('#mpFold', 'Ablesen');
  await t('#mHome', 'Startseite');
  await expect(page.locator('body')).not.toHaveClass(/mpfold/);

  // Rundgang: Weiter, Zurück, Beenden → Ablesen
  await t('#msDesk', 'Mehr entdecken');
  await t('.mdgo[data-go="tour"]', 'Rundgang');
  await expect(page.locator('#tourStep')).toHaveText('Station 1 von 8');
  await t('#tourNext', 'Rundgang');
  await t('#tourPrev', 'Rundgang');
  await t('#tourEnd', 'Ablesen');
  // bis zur letzten Station; dort die drei Wege
  const bisZumEnde = async () => {
    await t('#mpMore', 'Mehr entdecken');
    await t('.mdgo[data-go="tour"]', 'Rundgang');
    for (let i = 1; i < 8; i++) await t('#tourNext', 'Rundgang');
    await expect(page.locator('#tourStep')).toHaveText('Station 8 von 8');
  };
  await bisZumEnde();
  await t('#tourChoice [data-go="free"]', 'Ablesen'); // Selbst ausprobieren: 21. Juni, 12:00 am Zifferblatt
  expect(await page.evaluate(() => window.__view())).toMatchObject({
    v: 'sonnenuhr',
    pano: false,
    m: 5,
    d: 21,
    min: 720,
  });
  await bisZumEnde();
  await t('#tourChoice [data-go="more"]', 'Mehr entdecken');
  await t('#mdBack', 'Ablesen');
  await bisZumEnde();
  await t('#tourChoice [data-go="tour"]', 'Rundgang'); // wiederholen
  await expect(page.locator('#tourStep')).toHaveText('Station 1 von 8');
  // Rundgang → Startseite über den Knopf oben
  await t('#mHome', 'Startseite');
});

/** Zufallszahlen mit festem Startwert (mulberry32): derselbe Startwert ergibt denselben Spaziergang. */
function zufall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Alle Knöpfe, die man auf dem obersten Bildschirm gerade antippen kann – als eindeutige Selektoren. */
function knoepfe(page) {
  return page.evaluate(() => {
    const vis = el => el.checkVisibility({ checkVisibilityCSS: true }),
      layer = vis(document.querySelector('#mvsel'))
        ? ['#mvsel']
        : vis(document.querySelector('#mdesk'))
          ? ['#mdesk']
          : ['#mtop', '#mviews', '#mpanel', '#mstart'],
      // nicht im Spaziergang: Abspielen (Dauerbetrieb), Vollbild und Link senden (Browser-Rechte), Menüs der Zeitleiste
      aus = new Set(['play', 'mFs', 'sendLink', 'presetBtn', 'tbMore', 'tourMore']),
      sel = b => {
        if (b.id) return '#' + b.id;
        const d = b.dataset;
        if (b.closest('#mviews') && d.mv) return `#mviews [data-mv="${d.mv}"]`;
        if (b.closest('#mvList') && d.view) return `#mvList [data-view="${d.view}"]`;
        if (b.classList.contains('mdgo')) return `.mdgo[data-go="${d.go}"]`;
        if (b.closest('.mpquick') && d.q) return `.mpquick [data-q="${d.q}"]`;
        if (b.closest('#tourChoice') && d.go) return `#tourChoice [data-go="${d.go}"]`;
        if (b.closest('#msBody') && d.n) return `#msBody [data-n="${d.n}"]`;
        if (b.closest('#langSeg') && d.lang) return `#langSeg [data-lang="${d.lang}"]`;
        return null;
      };
    const out = [];
    for (const l of layer)
      for (const b of document.querySelectorAll(l + ' button')) {
        if (!vis(b) || b.disabled || aus.has(b.id)) continue;
        const s = sel(b);
        if (s && !out.includes(s)) out.push(s);
      }
    return out;
  });
}

test('Zufallsspaziergang: nach jedem Tipp gelten alle Prüfregeln', async ({ page }) => {
  const seed = Number(process.env.WALK_SEED || 20261109),
    n = Number(process.env.WALK_STEPS || 60);
  test.setTimeout(120_000 + n * 12_000);
  test.info().annotations.push({ type: 'Zufallsspaziergang', description: `WALK_SEED=${seed} WALK_STEPS=${n}` });
  const rnd = zufall(seed),
    log = [],
    getippt = new Map();
  await oeffne(page);
  const besucht = new Set();
  for (let i = 0; i < n; i++) {
    const k = await knoepfe(page);
    expect(k.length, 'kein Knopf auf ' + (await oben(page))).toBeGreaterThan(0);
    // Knöpfe, die noch selten getippt wurden, kommen öfter dran – so erreicht der Spaziergang auch entlegene Bildschirme
    const w = k.map(x => 1 / (1 + (getippt.get(x) || 0)) ** 2),
      sum = w.reduce((a, b) => a + b);
    let r = rnd() * sum,
      j = 0;
    while (r > w[j] && j < k.length - 1) r -= w[j++];
    const s = k[j];
    getippt.set(s, (getippt.get(s) || 0) + 1);
    besucht.add(await oben(page));
    await tippe(page, s, log);
  }
  test.info().annotations.push({ type: 'besucht', description: [...besucht].join(', ') });
  // ein Spaziergang dieser Länge kommt überall hin
  expect([...besucht].sort()).toEqual(
    ['Ablesen', 'Alle Ansichten', 'Mehr entdecken', 'Rundgang', 'Schritte', 'Startseite'].sort(),
  );
});
