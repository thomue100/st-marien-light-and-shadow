// Schalter, Karten der Symbolleiste, Aufklappmenüs, Bedienhinweis, Glossar, Ansichtstiefe, Sprachwechsel.
import './year.js'; // Aufbau-Reihenfolge: nach ui/year
import { $, lsSet } from '../core/util.js';
import { applyStaticLang, fmtDeg, LANG, setLang, tr } from '../core/i18n.js';
import { EXPERT, setExpert } from '../core/prefs.js';
import { AXIS_MEASURED } from '../model/measures.js';
import { state } from '../state.js';
import { renderer, requestRender } from '../scene/renderer.js';
import { TINT } from '../scene/shaders.js';
import { applyEnv } from '../model/environment.js';
import { drawYearChart, sdOrient } from '../model/sundial.js';
import { buildSunPath } from '../light/sky.js';
import { updateSun } from '../light/sun.js';
import { BODY_VIEWS, bodyViewName, drawPanoGrid, goView, hintFor, lookToBody } from '../scene/camera.js';
import { relabel, updateLabelsVisibility } from '../scene/labels.js';
import { drawChart, drawCompassStatic } from './readouts.js';
import { buildPresets, goFullMoon, goNewMoon, setAmb, setAxis, setCut, setExp, setPlaying } from './controls.js';
import { showTour, tour } from './tour.js';
import { mtGeo, mtRender, mtSync } from './moontowers.js';
import { LK, lkFill } from './experiments.js';
import { quiz, qzRender } from './quiz.js';
import { updateShare } from './share.js';

document
  .querySelectorAll('#views button')
  .forEach(b =>
    b.addEventListener('click', () =>
      BODY_VIEWS.includes(b.dataset.view) ? lookToBody(b.dataset.view) : goView(b.dataset.view),
    ),
  );
$('#cut').addEventListener('input', e => setCut(+e.target.value));
$('#exp').addEventListener('input', e => setExp(+e.target.value));
$('#amb').addEventListener('input', e => setAmb(+e.target.value));
$('#axis').addEventListener('input', e => setAxis(+e.target.value));
$('#labelsTog').addEventListener('change', e => {
  state.labels = e.target.checked;
  updateLabelsVisibility();
  requestRender();
});
$('#beamsTog').addEventListener('change', e => {
  state.beams = e.target.checked;
  updateSun(true);
});
$('#envTog').addEventListener('change', e => {
  state.env = e.target.checked;
  applyEnv();
  updateSun(true);
});
$('#treeTog').addEventListener('change', e => {
  state.trees = e.target.checked;
  applyEnv();
  updateSun(true);
});
$('#lodTog').addEventListener('change', e => {
  state.lodChurch = e.target.checked;
  applyEnv();
});
$('#sdGo').addEventListener('click', () => goView('sonnenuhr'));
$('#sdMoonGo').addEventListener('click', () => {
  if (!state.moon) {
    state.moon = true;
    $('#moonTog').checked = true;
  }
  goFullMoon();
  goView('sonnenuhr');
});
$('#goFull').addEventListener('click', goFullMoon);
$('#skyGo').addEventListener('click', () => goView('himmel'));
$('#sunLook').addEventListener('click', () => lookToBody('zurSonne'));
$('#moonLook').addEventListener('click', () => lookToBody('zumMond'));
$('#sunChip').addEventListener('click', () => lookToBody('zurSonne'));
$('#moonChip').addEventListener('click', () => lookToBody('zumMond'));
$('#goNew').addEventListener('click', goNewMoon);
$('#moonTog').addEventListener('change', e => {
  state.moon = e.target.checked;
  drawChart();
  drawCompassStatic();
  buildSunPath();
  setExp(state.exp);
  updateSun(true);
});
$('#sunPathTog').addEventListener('change', e => {
  state.sunPath = e.target.checked;
  buildSunPath();
  drawPanoGrid();
});
$('#moonPathTog').addEventListener('change', e => {
  state.moonPath = e.target.checked;
  buildSunPath();
  drawPanoGrid();
});
$('#sdWedge').addEventListener('input', e => {
  state.sdWedge = +e.target.value;
  sdOrient();
  updateSun(true);
});
$('#axisReset').addEventListener('click', () => setAxis(AXIS_MEASURED));
$('#tintTog').addEventListener('change', e => {
  state.tint = e.target.checked;
  TINT.uTintOn.value = e.target.checked ? 1 : 0;
  requestRender();
});
// Karten der Symbolleiste: immer nur eine offen
export function openCard(k) {
  if (document.body.classList.contains('mobile')) phoneOpen(k);
  else
    document.querySelectorAll('.card').forEach(c => {
      c.hidden = c.id !== 'card-' + k;
      c.classList.remove('min');
    });
  const gp = document.getElementById('glPop');
  if (gp) gp.hidden = true;
  document
    .querySelectorAll('button[data-card]')
    .forEach(b => b.setAttribute('aria-expanded', String(b.dataset.card === k)));
  if (typeof mtSync === 'function') mtSync();
  requestRender(); // Randhinweise für Sonne und Mond weichen der Karte aus
  cardShown();
}
/** Meldet die gerade sichtbaren Karten (Ereignis „stm-card“), damit sie ihren Inhalt auffrischen. */
function cardShown() {
  setTimeout(() => {
    for (const c of document.querySelectorAll('.card:not([hidden])'))
      document.dispatchEvent(new CustomEvent('stm-card', { detail: c.id.slice(5) }));
  }, 0);
}
// Symbolleiste und Menüeinträge (Experimente, Über das Modell, Teilen) öffnen Karten
document
  .querySelectorAll('button[data-card]')
  .forEach(b =>
    b.addEventListener('click', () => openCard(b.getAttribute('aria-expanded') === 'true' ? null : b.dataset.card)),
  );
document.querySelectorAll('.card .cx').forEach(b => b.addEventListener('click', () => openCard(null)));
// Aufklappmenüs (Ansicht, besondere Tage): schließen bei Klick daneben und mit Esc
function menu(btn, m) {
  const set = o => {
    m.hidden = !o;
    btn.setAttribute('aria-expanded', String(o));
  };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    set(m.hidden);
  });
  m.addEventListener('click', e => {
    if (e.target.closest('button')) set(false);
  });
  document.addEventListener('pointerdown', e => {
    if (!m.hidden && !m.contains(e.target) && !btn.contains(e.target)) set(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !m.hidden) {
      set(false);
      btn.focus();
    }
  });
}
menu($('#viewBtn'), $('#views'));
menu($('#presetBtn'), $('#presets'));
menu($('#discBtn'), $('#discMenu'));
menu($('#moreBtn'), $('#moreMenu'));
/** Ist gerade ein Aufklappmenü offen? (Esc schließt dann zuerst das Menü) */
export const menuOpen = () => ['views', 'presets', 'discMenu', 'moreMenu'].some(id => !$('#' + id).hidden);
document.addEventListener('keydown', e => {
  if (
    e.key === 'Escape' &&
    !e.defaultPrevented &&
    document.querySelector('.card:not([hidden])') &&
    !menuOpen() &&
    !document.body.classList.contains('free')
  )
    openCard(null);
});
// Bedienhinweis nach dem ersten Ziehen oder nach 9 s ausblenden
{
  const hide = () => $('#hint').classList.add('gone');
  renderer.domElement.addEventListener('pointerdown', hide, { once: true });
  setTimeout(hide, 9000);
}
// Nach dem Rundgang bzw. beim ersten freien Erkunden: Bedienhinweis zeigen und die Symbole der Leiste kurz beschriften (einmal je Gerät)
let hintTimer = null;
function showHint(ms) {
  const h = $('#hint');
  h.textContent = hintFor();
  h.classList.remove('gone');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.add('gone'), ms || 8000);
  renderer.domElement.addEventListener('pointerdown', () => h.classList.add('gone'), { once: true });
}
export function introExplore() {
  showHint(9000);
}

/* ---------------- Freie Sicht: alle Bedienelemente aus, nur das Modell ---------------- */

// Wie der Vollbild- bzw. Ablenkungsfrei-Modus in Karten- und Bildprogrammen: Taste F, Knopf oben rechts oder Menü „⋯“.
// Es bleiben der Knopf zum Zurückholen, eine kleine Leiste mit Datum, Uhrzeit und Abspielen und die Randhinweise für Sonne
// und Mond. Zurück mit F, Esc, dem Knopf oder (Finger) Doppeltipp ins Bild.
let toastTimer = null;
export function setFree(on) {
  document.body.classList.toggle('free', on);
  const b = $('#freeBtn');
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute(
    'aria-label',
    on
      ? tr('Bedienelemente wieder einblenden (F oder Esc)', 'Show the controls again (F or Esc)')
      : tr('Freie Sicht: alle Bedienelemente ausblenden (Taste F)', 'Clear view: hide all controls (key F)'),
  );
  b.title = on ? tr('Bedienelemente einblenden (F)', 'Show controls (F)') : tr('Freie Sicht (F)', 'Clear view (F)');
  $('#freeMini').hidden = !on;
  const t = $('#freeToast');
  clearTimeout(toastTimer);
  t.hidden = !on;
  if (on) {
    t.textContent = matchMedia('(pointer: coarse)').matches
      ? tr(
          'Freie Sicht – zurück mit Doppeltipp oder dem Knopf oben rechts',
          'Clear view – double-tap or use the button top right to return',
        )
      : tr(
          'Freie Sicht – Bedienelemente zurück mit F, Esc oder dem Knopf oben rechts',
          'Clear view – press F, Esc or the button top right to return',
        );
    toastTimer = setTimeout(() => (t.hidden = true), 4500);
    for (const id of ['views', 'presets', 'discMenu', 'moreMenu']) $('#' + id).hidden = true;
    $('#glPop').hidden = true;
  }
  requestRender();
}
$('#freeBtn').addEventListener('click', () => setFree(!document.body.classList.contains('free')));
$('#freeItem').addEventListener('click', () => setFree(true));
$('#freePlay').addEventListener('click', () => setPlaying(!state.playing));
document.addEventListener(
  'keydown',
  e => {
    const tg = e.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    const free = document.body.classList.contains('free');
    if ((e.key === 'f' || e.key === 'F') && !menuOpen()) {
      e.preventDefault();
      setFree(!free);
    } else if (e.key === 'Escape' && free) {
      e.preventDefault();
      e.stopImmediatePropagation(); // nur die Freie Sicht beenden, nicht zugleich Rundgang oder Quiz
      setFree(false);
    }
  },
  true,
);
{
  // Doppeltipp (Finger) ins Bild beendet die Freie Sicht
  let lastTap = 0,
    lx = 0,
    ly = 0;
  renderer.domElement.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || !document.body.classList.contains('free')) return;
    const now = performance.now();
    if (now - lastTap < 320 && Math.hypot(e.clientX - lx, e.clientY - ly) < 30) {
      lastTap = 0;
      setFree(false);
    } else {
      lastTap = now;
      lx = e.clientX;
      ly = e.clientY;
    }
  });
}
// Glossar: Begriffe mit gepunkteter Unterstreichung antippen
const GL = {
  alt: [
    'Höhe',
    'Altitude',
    'Winkel über dem Horizont: 0° liegt am Horizont, 90° genau über Ihnen. Je höher die Sonne, desto kürzer die Schatten.',
    'Angle above the horizon: 0° is on the horizon, 90° straight overhead. The higher the sun, the shorter the shadows.',
  ],
  az: [
    'Azimut',
    'Azimuth',
    'Himmelsrichtung, im Uhrzeigersinn von Norden gezählt: 90° ist Osten, 180° Süden, 270° Westen.',
    'Compass direction, counted clockwise from north: 90° is east, 180° south, 270° west.',
  ],
  age: [
    'Mondalter',
    'Moon age',
    'Tage seit dem letzten Neumond. Nach gut 7 Tagen ist Halbmond, nach etwa 15 Tagen Vollmond, nach 29,5 Tagen wieder Neumond.',
    'Days since the last new moon. After about 7 days it is half moon, after about 15 days full moon, after 29.5 days new moon again.',
  ],
  woz: [
    'Wahre Ortszeit',
    'Apparent solar time',
    'Zeit nach dem Sonnenstand am eigenen Ort: 12 Uhr ist, wenn die Sonne genau im Süden steht. Diese Zeit zeigt die Sonnenuhr.',
    'Time by the sun at your own place: 12 o’clock is when the sun stands due south. This is the time a sundial shows.',
  ],
  tz: [
    'MEZ und MESZ',
    'CET and CEST',
    'Mitteleuropäische Zeit, die gesetzliche Uhrzeit. Sie richtet sich nach dem Sonnenstand auf 15° Ost (Görlitz). Im Sommer gilt die Sommerzeit MESZ, eine Stunde später.',
    'Central European Time, the legal clock time. It follows the sun at 15° east (Görlitz). In summer, daylight saving time (CEST) is one hour ahead.',
  ],
  dl: [
    'Tagesbuchstabe',
    'Day letter',
    'Im Kirchenkalender tragen die Tage des Jahres reihum die Buchstaben A bis G, beginnend mit A am 1. Januar. Die Kalenderscheibe der Uhr zeigt ihn für jeden Tag.',
    'In the church calendar the days of the year carry the letters A to G in turn, starting with A on 1 January. The clock’s calendar disk shows it for every day.',
  ],
  sl: [
    'Sonntagsbuchstabe',
    'Sunday letter',
    'Der Tagesbuchstabe, der in einem Jahr auf die Sonntage fällt. Mit ihm findet man zu jedem Datum den Wochentag; Schaltjahre haben zwei.',
    'The day letter that falls on the Sundays of a year. With it you can find the weekday of any date; leap years have two.',
  ],
  gz: [
    'Goldene Zahl',
    'Golden number',
    'Stellung des Jahres im 19-jährigen Mondzyklus (1 bis 19). Nach 19 Jahren fallen die Mondphasen wieder auf dieselben Kalendertage; daraus berechnet man den Ostertermin.',
    'Position of the year in the 19-year lunar cycle (1 to 19). After 19 years the moon phases fall on the same calendar days again; Easter is computed from it.',
  ],
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-gl]'),
    p = $('#glPop');
  if (!t) {
    if (!p.hidden && !p.contains(e.target)) p.hidden = true;
    return;
  }
  const g = GL[t.dataset.gl];
  if (!g) return;
  if (!p.hidden && p.dataset.k === t.dataset.gl) {
    p.hidden = true;
    return;
  }
  p.dataset.k = t.dataset.gl;
  p.innerHTML = '<b>' + (LANG === 'en' ? g[1] : g[0]) + '</b>' + (LANG === 'en' ? g[3] : g[2]);
  p.hidden = false;
  const r = t.getBoundingClientRect(),
    w = p.offsetWidth,
    h = p.offsetHeight;
  let x = Math.min(innerWidth - w - 12, Math.max(12, r.left)),
    y = r.bottom + 6;
  if (y + h > innerHeight - 8) y = r.top - h - 6;
  p.style.left = x + 'px';
  p.style.top = Math.max(8, y) + 'px';
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $('#glPop').hidden = true;
});
document.querySelectorAll('[data-gl]').forEach(el => {
  el.tabIndex = 0;
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
});
// Karten auf dem Smartphone über die Überschrift ein- und ausklappen, damit die Szene sichtbar wird
document.querySelectorAll('.card .chead h2').forEach(h =>
  h.addEventListener('click', () => {
    if (matchMedia('(max-width: 760px)').matches && !document.body.classList.contains('mobile'))
      h.closest('.card').classList.toggle('min');
  }),
);
/* ---------------- Einfache und erweiterte Ansicht ---------------- */
document.querySelectorAll('.more').forEach(b => b.addEventListener('click', () => setExpert(!EXPERT)));
/* ---------------- Sprache umschalten ---------------- */

export function refreshLang() {
  applyStaticLang();
  buildPresets();
  relabel();
  drawChart();
  drawCompassStatic();
  drawYearChart();
  sdOrient();
  $('#playTxt').textContent = state.playing ? tr('Anhalten', 'Pause') : tr('Tagesverlauf', 'Play day');
  {
    const vb = document.querySelector('#views button[data-view="' + state.view + '"]');
    $('#viewTxt').textContent = state.pano
      ? tr('Himmel: Sonnen- und Mondbahn', 'Sky: paths of sun and moon')
      : vb
        ? vb.textContent
        : bodyViewName(state.view) || tr('eigene', 'custom');
  }
  $('#hint').textContent = hintFor();
  setCut(state.cut);
  setExp(state.exp);
  setAmb(state.amb);
  $('#axisOut').textContent = fmtDeg(state.axis);
  $('#sdWedgeOut').textContent = fmtDeg(state.sdWedge);
  if (state.pano) drawPanoGrid();
  if (tour.i !== null) showTour();
  if (quiz.i !== null) qzRender();
  mtGeo();
  mtRender();
  if (LK.list.length) {
    LK.list = [];
    lkFill();
  }
  updateShare();
  updateSun(true);
}
// Sprache: Umschalter „DE | EN“, immer sichtbar in der Titelleiste
document.querySelectorAll('#langSeg button').forEach(b =>
  b.addEventListener('click', () => {
    if (b.dataset.lang === LANG) return;
    setLang(b.dataset.lang);
    lsSet('stm-lang', LANG);
    refreshLang();
  }),
);

/* ---------------- Handy: ein Blatt mit Zeit, Reitern und Karten ---------------- */

// Auf dem Handy füllt das Modell den Bildschirm; Zeitleiste und Karten wandern in ein Blatt unten (im Querformat rechts),
// das sich in drei Stufen aufziehen lässt: zu (nur Zeit), halb (Reiter mit Karten), ganz.
export const PHONE = matchMedia('(max-width: 760px), (max-height: 520px) and (pointer: coarse)');
const LAND = matchMedia('(orientation: landscape)');
const sheet = $('#msheet');
const TABCARDS = { sun: ['sun'], moon: ['moon'], church: ['sd', 'clock'], more: ['light', 'disp'] };
const TABOF = { sun: 'sun', moon: 'moon', sd: 'church', clock: 'church' };
let shState = 'peek',
  shTab = 'sun';
const homes = [];
export function setSheet(st) {
  if (PHONE.matches && LAND.matches) st = 'half'; // Querformat: Seitenleiste, immer mit Reitern
  shState = st;
  sheet.classList.toggle('half', st === 'half');
  sheet.classList.toggle('full', st === 'full');
  $('#mshHandle').setAttribute('aria-expanded', String(st !== 'peek'));
  requestRender();
}
function showTab(t, only) {
  shTab = t;
  document
    .querySelectorAll('#mshTabs button')
    .forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  document.querySelectorAll('#mshBody .card').forEach(c => {
    const k = c.id.slice(5);
    c.hidden = only ? k !== only : !TABCARDS[t].includes(k);
  });
  $('#mshMore').hidden = !(t === 'more' && !only);
  $('#mshBody').scrollTop = 0;
  cardShown();
}
function phoneOpen(k) {
  if (!k) return showTab(shTab);
  const t = TABOF[k] || 'more';
  showTab(t, TABCARDS[t].includes(k) ? null : k);
  if (shState === 'peek') setSheet('half');
  const c = $('#card-' + k);
  if (c && t === 'church') c.scrollIntoView({ block: 'nearest' });
}
document.querySelectorAll('#mshTabs button').forEach(b =>
  b.addEventListener('click', () => {
    showTab(b.dataset.tab);
    document
      .querySelectorAll('button[data-card]')
      .forEach(x => x.setAttribute('aria-expanded', String(TABCARDS[b.dataset.tab].includes(x.dataset.card))));
    if (shState === 'peek') setSheet('half');
  }),
);
{
  // Griff: antippen schaltet weiter (zu → halb → ganz → zu), ziehen nach oben oder unten wechselt die Stufe
  const h = $('#mshHandle'),
    order = ['peek', 'half', 'full'];
  let y0 = null,
    moved = false;
  h.addEventListener('pointerdown', e => {
    y0 = e.clientY;
    moved = false;
    h.setPointerCapture(e.pointerId);
  });
  h.addEventListener('pointermove', e => {
    if (y0 !== null && Math.abs(e.clientY - y0) > 12) moved = true;
  });
  h.addEventListener('pointerup', e => {
    if (y0 === null) return;
    const dy = e.clientY - y0,
      i = order.indexOf(shState);
    y0 = null;
    if (!moved) return setSheet(order[(i + 1) % 3]);
    if (dy < -30) setSheet(order[Math.min(2, i + 1)]);
    else if (dy > 30) setSheet(order[Math.max(0, i - 1)]);
  });
}
$('#sendLink').addEventListener('click', async () => {
  // Link auf den aktuellen Stand, um ihn am Computer zu öffnen: Teilen-Menü des Handys, sonst in die Zwischenablage
  updateShare();
  const url = $('#shareUrl').value || location.href,
    title = tr('St. Marien – Licht und Schatten', "St. Mary's – Light and Shadow");
  try {
    if (navigator.share) return await navigator.share({ title, url });
    await navigator.clipboard.writeText(url);
    $('#sendLink').textContent = tr('Link kopiert', 'Link copied');
    setTimeout(() => ($('#sendLink').textContent = tr('Link an mich senden', 'Send me the link')), 2500);
  } catch (e) {}
});
export function applyPhone() {
  const m = PHONE.matches;
  document.body.classList.toggle('mobile', m);
  sheet.hidden = !m;
  if (m && !homes.length) {
    const tb = $('.timebar'),
      cards = [...document.querySelectorAll('.card')];
    for (const el of [tb, ...cards]) homes.push([el, el.parentNode, el.nextSibling]);
    $('#mshTime').appendChild(tb);
    for (const c of cards) $('#mshBody').insertBefore(c, $('#mshMore'));
    showTab(shTab);
  } else if (!m && homes.length) {
    for (const [el, p, n] of homes.reverse()) p.insertBefore(el, n);
    homes.length = 0;
    $('#mshMore').hidden = true;
    openCard(null);
  }
  if (m) setSheet(shState);
  requestRender();
}
PHONE.addEventListener('change', applyPhone);
LAND.addEventListener('change', () => PHONE.matches && setSheet(LAND.matches ? 'half' : 'peek'));
applyPhone();
