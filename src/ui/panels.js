// Schalter, Karten der Symbolleiste, Aufklappmenüs, Bedienhinweis, Glossar, Ansichtstiefe, Sprachwechsel.
import './year.js'; // Aufbau-Reihenfolge: nach ui/year
import { $, lsGet, lsSet } from '../core/util.js';
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
import { drawPanoGrid, goView, hintFor } from '../scene/camera.js';
import { relabel, updateLabelsVisibility } from '../scene/labels.js';
import { drawChart, drawCompassStatic } from './readouts.js';
import { buildPresets, goFullMoon, goNewMoon, setAmb, setAxis, setCut, setExp } from './controls.js';
import { showTour, tour } from './tour.js';
import { mtGeo, mtRender, mtSync } from './moontowers.js';
import { LK, lkFill } from './experiments.js';
import { quiz, qzRender } from './quiz.js';
import { updateShare } from './share.js';

document.querySelectorAll('#views button').forEach(b => b.addEventListener('click', () => goView(b.dataset.view)));
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
  document.querySelectorAll('.card').forEach(c => {
    c.hidden = c.id !== 'card-' + k;
    c.classList.remove('min');
  });
  const gp = document.getElementById('glPop');
  if (gp) gp.hidden = true;
  document.querySelectorAll('.rbtn').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.card === k)));
  if (typeof mtSync === 'function') mtSync();
}
document
  .querySelectorAll('.rbtn')
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
document.addEventListener('keydown', e => {
  if (
    e.key === 'Escape' &&
    !e.defaultPrevented &&
    document.querySelector('.card:not([hidden])') &&
    $('#views').hidden &&
    $('#presets').hidden
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
  if (lsGet('stm-raillbl') === '1') return;
  lsSet('stm-raillbl', '1');
  const r = document.querySelector('.rail');
  r.classList.add('lbls');
  setTimeout(() => r.classList.remove('lbls'), 7000);
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
    if (matchMedia('(max-width: 760px)').matches) h.closest('.card').classList.toggle('min');
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
        : tr('eigene', 'custom');
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
$('#langBtn').addEventListener('click', () => {
  setLang(LANG === 'en' ? 'de' : 'en');
  lsSet('stm-lang', LANG);
  refreshLang();
});
