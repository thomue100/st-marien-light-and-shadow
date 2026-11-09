// Bedienung von Datum und Uhrzeit: Regler, Tag vor/zurück, besondere Tage (Vollmond, Finsternisse), Abspielen; Schnitt, Belichtung, Achse.
import { computeDay, drawCompassStatic, MON_EN, WD, WD_EN } from './readouts.js'; // Aufbau-Reihenfolge: nach ui/readouts
import {
  berlinNow,
  berlinOffsetMin,
  eclipseScan,
  localToUtc,
  lunarEclipseAt,
  moonPhaseTime,
  moonPos,
  moonTransitNear,
  sunPos,
} from '../astro/index.js';
import { V3 } from '../three-global.js';
import { $, smooth } from '../core/util.js';
import { dc, fmtDeg, LANG, pad2, tr, tzN } from '../core/i18n.js';
import { cur, state, sunVec } from '../state.js';
import { cutPlane, renderer, requestRender } from '../scene/renderer.js';
import { TINT } from '../scene/shaders.js';
import { sdOrient } from '../model/sundial.js';
import { buildSunPath } from '../light/sky.js';
import { updateSun } from '../light/sun.js';
import { goView, panoMarks, VIEWS } from '../scene/camera.js';
import { yearStart, yearStop, yr, yrBuild, yrMark, yrMez } from './year.js';

export function gotoInstant(ms, minutes) {
  const off = berlinOffsetMin(ms),
    l = new Date(ms + off * 60000);
  state.minutes = minutes !== undefined ? minutes : l.getUTCHours() * 60 + l.getUTCMinutes();
  setDate(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
}
// Vollmond am Nachmittag: die Nacht danach zählt noch
export function goFullMoon() {
  const nf = moonPhaseTime(localToUtc(state.y, state.m, state.d, state.minutes) - 12 * 3600000, 180, 1);
  if (nf !== null) gotoInstant(moonTransitNear(nf));
}
// Finsternisse: nächste von Lübeck aus sichtbare ab dem eingestellten Tag (Mondfinsternisse mit Kernschatten)
const eclCache = { key: null, s: null, l: null };
function nextEclipses() {
  const t = Date.UTC(state.y, state.m, state.d),
    key = state.y + '-' + state.m + '-' + state.d;
  if (eclCache.key === key) return eclCache;
  eclCache.key = key;
  eclCache.s = eclipseScan(t, 6, 's').find(e => e.cover >= 0.005) || null; // streifende Finsternisse unter 0,5 % Bedeckung nicht nennen eclCache.l=eclipseScan(t,60,'l').find(e=>e.visible&&e.type!=='penumbral'&&e.max>=t)||null;
  for (const k of ['s', 'l']) if (eclCache[k] && eclCache[k].max > DATE_MAX + 864e5) eclCache[k] = null; // nur innerhalb des wählbaren Zeitraums
  return eclCache;
}
export function eclWhen(ms) {
  const off = berlinOffsetMin(ms),
    l = new Date(ms + off * 60000),
    hm = pad2(l.getUTCHours()) + ':' + pad2(l.getUTCMinutes());
  return LANG === 'en'
    ? WD_EN[l.getUTCDay()] +
        ' ' +
        l.getUTCDate() +
        ' ' +
        MON_EN[l.getUTCMonth()] +
        ' ' +
        l.getUTCFullYear() +
        ', ' +
        hm +
        ' ' +
        tzN(off)
    : WD[l.getUTCDay()] +
        ' ' +
        l.getUTCDate() +
        '.' +
        (l.getUTCMonth() + 1) +
        '.' +
        l.getUTCFullYear() +
        ', ' +
        hm +
        ' ' +
        tzN(off);
}
function eclText(e) {
  if (!e) return '–';
  if (e.kind === 's')
    return (
      tr('Sonnenfinsternis ', 'Solar eclipse ') +
      eclWhen(e.max) +
      ' · ' +
      Math.round(e.cover * 100) +
      tr(' % bedeckt', ' % covered') +
      (e.endEl !== null && e.endEl < -0.6
        ? tr(', Sonnenuntergang vor dem Ende', ', sun sets before the end')
        : e.startEl < -0.6
          ? tr(', beginnt vor Sonnenaufgang', ', begins before sunrise')
          : '')
    );
  return (
    (e.type === 'total'
      ? tr('Totale Mondfinsternis ', 'Total lunar eclipse ')
      : tr('Partielle Mondfinsternis ', 'Partial lunar eclipse ')) +
    eclWhen(e.max) +
    (e.type === 'partial'
      ? ' · ' + Math.round(lunarEclipseAt(e.max).uCover * 100) + tr(' % im Kernschatten', ' % in the umbra')
      : '') +
    (e.el < 0 ? tr(', Mond beim Maximum unter dem Horizont', ', moon below the horizon at maximum') : '')
  );
}
export function updateEclText() {
  if ($('#card-moon').hidden) return;
  const n = nextEclipses();
  $('#mEcl').textContent = eclText(n.s) + ' · ' + eclText(n.l);
}
export function goEclipse(e) {
  if (!e) return;
  if (e.kind === 'l' && !state.moon) {
    state.moon = true;
    $('#moonTog').checked = true;
  }
  if (state.playing) setPlaying(false);
  gotoInstant(e.max);
  const p = e.kind === 's' ? sunPos(e.max) : moonPos(e.max),
    dir = sunVec(Math.max(p.el, 0.8), p.az, new V3());
  VIEWS.finsternis = {
    pos: [11.9, 135, 0],
    dir: [dir.x, dir.y, dir.z],
    mode: 'inside',
    cut: 60,
    exp: e.kind === 's' ? 1.0 : 1.25,
    fov: e.kind === 's' ? 10 : 7,
  }; // Blick von oberhalb der Turmspitzen zur Sonne bzw. zum Mond
  goView('finsternis');
}
$('#goSolEcl').addEventListener('click', () => goEclipse(nextEclipses().s));
$('#goLunEcl').addEventListener('click', () => goEclipse(nextEclipses().l));
document.addEventListener('stm-card', e => e.detail === 'moon' && updateEclText());
export function goNewMoon() {
  const nn = moonPhaseTime(localToUtc(state.y, state.m, state.d, state.minutes) + 3600000, 0, 1);
  if (nn !== null) gotoInstant(nn, 22 * 60);
}
export function setMinutes(m) {
  state.minutes = m;
  updateSun();
  if (state.pano) panoMarks();
  if (yr.on) {
    yr.mez = yrMez();
    yrBuild();
  }
}
// Wählbarer Zeitraum = Jahre der Kalenderscheibe der Astronomischen Uhr
export const DATE_MIN = Date.UTC(1911, 0, 1),
  DATE_MAX = Date.UTC(2080, 11, 31);
function clampYMD(y, m, d) {
  let t = Date.UTC(+y || 2026, +m || 0, +d || 1);
  if (+y >= 0 && +y < 100) t = DATE_MIN;
  if (!isFinite(t)) t = Date.UTC(2026, 0, 1);
  t = Math.min(DATE_MAX, Math.max(DATE_MIN, t));
  const q = new Date(t);
  return [q.getUTCFullYear(), q.getUTCMonth(), q.getUTCDate()];
}
export function setDate(y, m, d) {
  [y, m, d] = clampYMD(y, m, d);
  state.y = y;
  state.m = m;
  state.d = d;
  {
    const v = y + '-' + pad2(m + 1) + '-' + pad2(d),
      el = $('#date');
    if (el.value !== v) el.value = v;
  }
  computeDay();
  updateSun(true);
  // computeDay zeichnet die Himmelsansicht noch mit der alten Mondposition; Ring um den Mond erst jetzt nachziehen
  if (state.pano) panoMarks();
}
export function setCut(v) {
  state.cut = v;
  $('#cut').value = v;
  cutPlane.constant = v >= 60 ? 500 : v;
  $('#cutOut').textContent = v >= 60 ? tr('aus', 'off') : dc(v.toFixed(1)) + ' m';
  requestRender();
}
export function setExp(v) {
  state.exp = v;
  $('#exp').value = v;
  renderer.toneMappingExposure = v * (1 + 0.15 * (1 - smooth(-7, -1.5, cur.el)) * (state.moon ? 1 : 0));
  $('#expOut').textContent = dc(v.toFixed(2));
  requestRender();
}
export function setAmb(v) {
  state.amb = v;
  $('#amb').value = v;
  TINT.uAmbIn.value = v;
  $('#ambOut').textContent = Math.round(v * 100) + ' %';
  requestRender();
}
export function setAxis(v) {
  state.axis = v;
  $('#axis').value = v;
  $('#axisOut').textContent = fmtDeg(v);
  drawCompassStatic();
  buildSunPath();
  sdOrient();
  updateSun(true);
}

// Während des Tippens (Jahr Ziffer für Ziffer: 0002, 0020, 0202, 2026) nichts zurücksetzen; erst ein gültiges Datum im Bereich übernehmen, beim Verlassen begrenzen
function dateApply(final) {
  const el = $('#date'),
    p = el.value.split('-').map(Number),
    ok = p.length === 3 && p.every(Number.isFinite) && p[0] > 0;
  if (!ok) {
    if (final) el.value = state.y + '-' + pad2(state.m + 1) + '-' + pad2(state.d);
    return;
  }
  const t = Date.UTC(p[0], p[1] - 1, p[2]);
  if (!final && (p[0] < 1000 || t < DATE_MIN || t > DATE_MAX)) return; // Date.UTC macht aus 0019 das Jahr 1919
  if (final && p[0] === state.y && p[1] - 1 === state.m && p[2] === state.d) return;
  const yOld = state.y;
  setDate(p[0], p[1] - 1, p[2]);
  if (yr.on) {
    if (state.y !== yOld) yrBuild();
    else yrMark();
  }
}
$('#date').addEventListener('change', () => dateApply(false));
$('#date').addEventListener('blur', () => dateApply(true));
$('#date').addEventListener('keydown', e => {
  if (e.key === 'Enter') dateApply(true);
});
$('#time').addEventListener('input', e => setMinutes(+e.target.value));
function stepDay(k) {
  const t = new Date(Date.UTC(state.y, state.m, state.d) + k * 864e5);
  setDate(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  if (yr.on) yrMark();
}
$('#dayPrev').addEventListener('click', () => stepDay(-1));
$('#dayNext').addEventListener('click', () => stepDay(1));
$('#nowBtn').addEventListener('click', () => {
  const n = berlinNow();
  state.minutes = n.minutes;
  setDate(n.y, n.m, n.d);
});
const presetsEl = $('#presets');
export function buildPresets() {
  presetsEl.innerHTML = '';
  [
    ['Frühlingsanfang', 'Spring equinox', 2, 20],
    ['Sommeranfang', 'Summer solstice', 5, 21],
    ['Mariä Himmelfahrt', 'Assumption Day', 7, 15],
    ['Herbstanfang', 'Autumn equinox', 8, 22],
    ['Winteranfang', 'Winter solstice', 11, 21],
  ].forEach(([t, te, m, d]) => {
    const b = document.createElement('button');
    b.setAttribute('role', 'menuitem');
    b.textContent = LANG === 'en' ? te + ', ' + d + ' ' + MON_EN[m] : t + ' ' + d + '.' + (m + 1) + '.';
    b.addEventListener('click', () => setDate(state.y, m, d));
    presetsEl.appendChild(b);
  });
  for (const k of ['s', 'l']) {
    const b = document.createElement('button');
    b.setAttribute('role', 'menuitem');
    b.dataset.ecl = k;
    b.textContent =
      k === 's'
        ? tr('Nächste Sonnenfinsternis', 'Next solar eclipse')
        : tr('Nächste Mondfinsternis', 'Next lunar eclipse');
    b.addEventListener('click', () => goEclipse(nextEclipses()[k]));
    presetsEl.appendChild(b);
  }
}
$('#presetBtn').addEventListener('click', () => {
  const n = nextEclipses();
  presetsEl.querySelectorAll('button[data-ecl]').forEach(b => {
    const e = n[b.dataset.ecl];
    if (!e) return;
    const l = new Date(e.max + berlinOffsetMin(e.max) * 60000);
    b.textContent =
      (b.dataset.ecl === 's' ? tr('Sonnenfinsternis ', 'Solar eclipse ') : tr('Mondfinsternis ', 'Lunar eclipse ')) +
      (LANG === 'en'
        ? l.getUTCDate() + ' ' + MON_EN[l.getUTCMonth()] + ' ' + l.getUTCFullYear()
        : l.getUTCDate() + '.' + (l.getUTCMonth() + 1) + '.' + l.getUTCFullYear());
  });
});
buildPresets();
export function setPlaying(p) {
  state.playing = p;
  $('#playTxt').textContent = p
    ? tr('Anhalten', 'Pause')
    : yr.on
      ? tr('Jahreslauf', 'Play year')
      : tr('Tagesverlauf', 'Play day');
  $('#playIcon').innerHTML = p ? '<path d="M2 1h3v10H2zM7 1h3v10H7z"/>' : '<path d="M2 1l9 5-9 5z"/>';
  $('#freePlay svg').innerHTML = $('#playIcon').innerHTML;
  $('#freePlay').setAttribute('aria-label', p ? tr('Anhalten', 'Pause') : tr('Tagesverlauf abspielen', 'Play the day'));
  if (!p) updateSun(true);
}
$('#play').addEventListener('click', () => setPlaying(!state.playing));
$('#speed').addEventListener('change', e => {
  const v = e.target.value;
  if (v[0] === 'y') {
    state.speed = 0;
    yearStart(+v.slice(1));
  } else {
    state.speed = +v;
    yearStop();
  }
});
