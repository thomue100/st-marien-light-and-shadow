// Experimente 1–4: Kirche als Sonnenuhr, Sonnenuhr und Armbanduhr, Lichtkalender, Uhr und Himmel.
import { mtGeo, mtSync, mtTopView } from './moontowers.js'; // Aufbau-Reihenfolge: nach ui/moontowers
import { berlinNow, berlinOffsetMin, localToUtc, rad, sunPos, trueNoon } from '../astro/index.js';
import { V3 } from '../three-global.js';
import { $ } from '../core/util.js';
import { dc, fmtDeg, fmtT, LANG, moonPhaseName, pad2, tr, tzN } from '../core/i18n.js';
import { cur, LD, state, sunVec } from '../state.js';
import { occluders, windows } from '../model/geometry.js';
import { CKR, clk, clockUpdate } from '../model/clock.js';
import { envBlocked } from '../model/environment.js';
import { moonAge, sd } from '../model/sundial.js';
import { rc } from '../light/windows.js';
import { moonCur, updateSun } from '../light/sun.js';
import { busyHide, busyShow, busyText, goView, VIEWS } from '../scene/camera.js';
import { day, dirName } from './readouts.js';
import { setDate, setMinutes, setPlaying } from './controls.js';
import { yearStop, yr } from './year.js';
import { ckClockSign, ckFmtDay, ckHM, ckSign, ckSkySign, ckWrap } from './clockcard.js';

/* ---------------- Experimente 1–4: Kirche als Sonnenuhr, Sonnenuhr und Armbanduhr, Lichtkalender, Uhr und Himmel ---------------- */
var expReady = false; // erst nach dem Aufbau aktualisieren (updateReadouts läuft schon vorher)
export function setExpReady(v) {
  expReady = v;
}
const expPanel = k => !$('#card-exp').hidden && !$('#exp-' + k).hidden;
export function expOpen(k) {
  if (state.playing) setPlaying(false);
  if (yr.on) {
    yearStop();
    state.speed = 30;
    $('#speed').value = '30';
  }
  if (k === 'mt') {
    mtGeo();
    mtSync();
    mtTopView();
  } else if (k === 'ks') ksSet(5);
  else if (k === 'su') {
    suGo('today');
  } else if (k === 'lk') {
    lkFill();
    lkRun();
  } else if (k === 'au') {
    auGo(0);
  }
  expTick();
}
export function expTick() {
  if (!expReady) return;
  try {
    if (expPanel('ks')) {
      const sh = cur.el > 0.5 ? Math.round(TOWER_H / Math.tan(cur.el * rad)) : null;
      $('#ksEl').textContent =
        cur.el > -0.3 ? fmtDeg(cur.el) + ' ' + dirName(cur.az) : tr('unter dem Horizont', 'below the horizon');
      $('#ksSh').textContent = sh === null ? '–' : sh > 3000 ? tr('über 3 km', 'over 3 km') : dc(String(sh)) + ' m';
      $('#ksMax').textContent = fmtDeg(day.maxEl) + tr(' um ', ' at ') + fmtT(day.maxT);
      $('#ksLen').textContent =
        day.rise !== null && day.set !== null
          ? Math.floor((day.set - day.rise) / 60) + ' h ' + pad2(Math.round((day.set - day.rise) % 60)) + ' min'
          : '–';
      document
        .querySelectorAll('#ksSeg [data-m]')
        .forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.m === state.m && state.d === 21)));
    }
    if (expPanel('su')) suText();
    if (expPanel('au')) auTable();
    if (expPanel('lk')) {
      if (LK.cur && LK.cur.y !== state.y && !LK.busy) lkRun();
      else lkDraw();
    }
  } catch (e) {
    console.warn(e);
  }
}
const TOWER_H = 124.95;
// 1 Kirche als Sonnenuhr
function ksSet(m) {
  const keep = state.view === 'luft';
  state.minutes = state.minutes >= 8 * 60 && state.minutes <= 16 * 60 && keep ? state.minutes : 13 * 60;
  setDate(state.y, m, 21);
  if (!keep) goView('luft');
  expTick();
}
document.querySelectorAll('#ksSeg [data-m]').forEach(b =>
  b.addEventListener('click', () => {
    if (state.playing) setPlaying(false);
    ksSet(+b.dataset.m);
  }),
);
$('#ksPlay').addEventListener('click', () => {
  if (state.playing) {
    setPlaying(false);
    return;
  }
  if (day.rise !== null) setMinutes(Math.max(0, Math.floor(day.rise) - 20));
  state.speed = 60;
  $('#speed').value = '60';
  setPlaying(true);
});
// 2 Sonnenuhr und Armbanduhr (wahrer Mittag: trueNoon in src/astro/sun.js)
let suYear = null;
function suScan(y) {
  if (suYear && suYear.y === y) return suYear;
  const r = { y, min: null, win: null, sum: null };
  for (let t = Date.UTC(y, 0, 1); t < Date.UTC(y + 1, 0, 1); t += 864e5) {
    const dd = new Date(t),
      m = dd.getUTCMonth(),
      d = dd.getUTCDate(),
      n = trueNoon(y, m, d),
      off = berlinOffsetMin(localToUtc(y, m, d, n)),
      diff = n - 720,
      e = { m, d, n, diff };
    if (!r.min || Math.abs(diff) < Math.abs(r.min.diff)) r.min = e;
    if (off === 60 && (!r.win || diff > r.win.diff)) r.win = e;
    if (off === 120 && (!r.sum || diff > r.sum.diff)) r.sum = e;
  }
  return (suYear = r);
}
function suGo(k) {
  if (state.playing) setPlaying(false);
  let y = state.y,
    m,
    d;
  if (k === 'today') {
    const n = berlinNow();
    y = n.y;
    m = n.m;
    d = n.d;
  } else {
    const r = suScan(state.y)[k];
    m = r.m;
    d = r.d;
  }
  state.minutes = Math.round(trueNoon(y, m, d));
  setDate(y, m, d);
  if (state.view !== 'sonnenuhr') goView('sonnenuhr');
  expTick();
}
document.querySelectorAll('#suBtns [data-k]').forEach(b => b.addEventListener('click', () => suGo(b.dataset.k)));
let suLastDay = null;
function suText() {
  const key = state.y + '-' + state.m + '-' + state.d; // Datum geändert: wieder auf den wahren Mittag stellen
  if (suLastDay !== null && suLastDay !== key && !state.playing) {
    suLastDay = key;
    state.minutes = Math.round(trueNoon(state.y, state.m, state.d));
    updateSun(true);
    return;
  }
  suLastDay = key;
  const n = trueNoon(state.y, state.m, state.d),
    off = berlinOffsetMin(localToUtc(state.y, state.m, state.d, n)),
    diff = Math.round(n - 720);
  const day = ckFmtDay(state.d, state.m) + ' ' + state.y,
    lit = sd.lit
      ? ''
      : tr(
          ' Im Modell liegt die Sonnenuhr dann im Schatten eines Nachbarhauses; das Modell rechnet den Stabschatten trotzdem.',
          ' In the model the sundial then lies in the shadow of a neighbouring house; the model still computes the rod’s shadow.',
        );
  $('#suNow').textContent =
    tr(
      'Am ' + day + ' zeigt die Sonnenuhr 12 Uhr, wenn die Armbanduhr ' + fmtT(n) + ' ' + tzN(off) + ' zeigt – ',
      'On ' + day + ' the sundial shows 12 o’clock when the watch shows ' + fmtT(n) + ' ' + tzN(off) + ' – ',
    ) +
    (Math.abs(diff) < 0.5
      ? tr('fast genau gleich.', 'almost exactly the same.')
      : tr(
          'die Sonnenuhr geht ' +
            Math.abs(diff) +
            (Math.abs(diff) === 1 ? ' Minute ' : ' Minuten ') +
            (diff > 0 ? 'nach' : 'vor') +
            '.',
          'the sundial is ' +
            Math.abs(diff) +
            (Math.abs(diff) === 1 ? ' minute ' : ' minutes ') +
            (diff > 0 ? 'behind' : 'ahead') +
            '.',
        )) +
    lit;
}
// 3 Lichtkalender eines Fensters
export const LK = { busy: false, cache: {}, sel: 0, list: [] };
export function lkFill() {
  if (LK.list.length) return;
  const pick = (f, score) => {
    let b = null,
      bs = -1e9;
    windows.forEach((w, i) => {
      if (f(w)) {
        const sc = score(w);
        if (sc > bs) {
          bs = sc;
          b = i;
        }
      }
    });
    return b;
  };
  const cand = [
    [
      'Westfenster (Auferstehungsfenster)',
      'West window (Resurrection window)',
      pick(
        w => w.type === 0,
        w => w.apex,
      ),
    ],
    [
      'Briefkapelle, Südseite',
      'Briefkapelle, south side',
      pick(
        w => w.type === 2,
        w => -Math.abs(w.center.x + 28.65) - Math.abs(w.center.y - 7.5),
      ),
    ],
    [
      'Hochfenster Südseite des Mittelschiffs',
      'South clerestory window of the nave',
      pick(
        w => w.type < 0 && w.outN.z > 0.9,
        w => w.center.y * 10 - Math.abs(w.center.x),
      ),
    ],
    [
      'Marientidenkapelle, Ostfenster',
      'Marientiden Chapel, east window',
      pick(
        w => w.type === 5 && w.center.x > 40,
        w => w.outN.x,
      ),
    ],
    [
      'Totentanzfenster (Nordseite)',
      'Dance of Death window (north side)',
      pick(
        w => w.type === 1,
        w => w.apex,
      ),
    ],
  ];
  LK.list = cand.filter(c => c[2] !== null);
  const sl = $('#lkWin');
  sl.innerHTML = '';
  LK.list.forEach((c, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = LANG === 'en' ? c[1] : c[0];
    sl.appendChild(o);
  });
  sl.value = String(LK.sel);
}
$('#lkWin').addEventListener('change', e => {
  LK.sel = +e.target.value;
  lkRun();
});
const LK_COLS = 72,
  LK_T0 = 4 * 60,
  LK_ROWS = 24,
  _lkL = new V3(),
  _lkSave = new V3();
async function lkRun() {
  if (LK.busy) return;
  const c = LK.list[LK.sel];
  if (!c) return;
  const w = windows[c[2]],
    key = c[2] + '-' + state.y + '-' + (state.env ? 1 : 0) + (state.trees ? 1 : 0);
  if (!LK.cache[key]) {
    LK.busy = true;
    busyShow(tr('Lichtkalender wird berechnet …', 'Computing the light calendar …'));
    await new Promise(r => setTimeout(r, 30));
    const g = new Float32Array(LK_ROWS * LK_COLS);
    _lkSave.copy(LD);
    let tick = performance.now();
    for (let r = 0; r < LK_ROWS; r++) {
      const m = r >> 1,
        d = r & 1 ? 15 : 1;
      for (let k = 0; k < LK_COLS; k++) {
        const mi = LK_T0 + k * 15,
          sp = sunPos(localToUtc(state.y, m, d, mi));
        if (sp.el <= 0) {
          g[r * LK_COLS + k] = -1;
          continue;
        }
        sunVec(sp.el, sp.az, _lkL);
        if (_lkL.dot(w.outN) <= 0.01) {
          g[r * LK_COLS + k] = 0;
          continue;
        }
        LD.copy(_lkL);
        let ok = 0;
        for (const o of w.occ) {
          rc.set(o, _lkL);
          if (!envBlocked(o) && rc.intersectObjects(occluders, false).length === 0) ok++;
        }
        g[r * LK_COLS + k] = ok / w.occ.length;
      }
      if (performance.now() - tick > 150) {
        LD.copy(_lkSave);
        busyText(
          tr('Lichtkalender wird berechnet … ', 'Computing the light calendar … ') +
            Math.round(((r + 1) / LK_ROWS) * 100) +
            ' %',
        );
        await new Promise(res => setTimeout(res, 0));
        tick = performance.now();
      }
    }
    LD.copy(_lkSave);
    LK.cache[key] = g;
    busyHide();
    LK.busy = false;
  }
  LK.cur = { g: LK.cache[key], w, y: state.y };
  lkDraw();
  lkSum();
}
function lkSum() {
  const g = LK.cur.g;
  let any = new Set(),
    hrs = 0;
  for (let r = 0; r < LK_ROWS; r++) {
    let lit = false;
    for (let k = 0; k < LK_COLS; k++) {
      const v = g[r * LK_COLS + k];
      if (v > 0.3) {
        lit = true;
        hrs += 0.25;
      }
    }
    if (lit) any.add(r);
  }
  $('#lkSum').textContent = any.size
    ? tr(
        'Direktes Sonnenlicht an ' + any.size + ' von 24 Stichtagen, zusammen etwa ' + Math.round(hrs) + ' Stunden.',
        'Direct sunlight on ' + any.size + ' of 24 sample days, about ' + Math.round(hrs) + ' hours in all.',
      )
    : tr(
        'An keinem der 24 Stichtage fällt direktes Sonnenlicht durch dieses Fenster.',
        'On none of the 24 sample days does direct sunlight fall through this window.',
      );
}
function lkDraw() {
  const cv = $('#lkCv');
  if (!cv || !LK.cur) return;
  const g = cv.getContext('2d'),
    W = cv.width,
    H = cv.height,
    L = 34,
    B = 18,
    cw = (W - L - 4) / LK_COLS,
    ch = (H - B - 4) / LK_ROWS,
    dk = matchMedia('(prefers-color-scheme: dark)').matches;
  g.clearRect(0, 0, W, H);
  g.font = '11px "IBM Plex Mono", monospace';
  g.fillStyle = dk ? '#cfc6bb' : '#5e5852';
  for (let r = 0; r < LK_ROWS; r++)
    for (let k = 0; k < LK_COLS; k++) {
      const v = LK.cur.g[r * LK_COLS + k];
      g.fillStyle =
        v < 0
          ? dk
            ? '#1d2230'
            : '#3a4152'
          : v <= 0
            ? dk
              ? '#4a4640'
              : '#d9d4cb'
            : 'rgba(232,170,40,' + (0.35 + 0.65 * v) + ')';
      g.fillRect(L + k * cw, 2 + r * ch, Math.ceil(cw), Math.ceil(ch));
    }
  g.fillStyle = dk ? '#cfc6bb' : '#5e5852';
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  const MON =
    LANG === 'en'
      ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      : ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  for (let m = 0; m < 12; m++) g.fillText(MON[m], L - 4, 2 + (2 * m + 1) * ch);
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (let h = 6; h <= 21; h += 3) {
    const x = L + ((h * 60 - LK_T0) / 15) * cw;
    g.fillText(String(h), x, H - B + 3);
    g.fillRect(x - 0.5, H - B - 2, 1, 3);
  }
  const row = Math.min(23, state.m * 2 + (state.d >= 15 ? 1 : 0)),
    x = L + ((state.minutes - LK_T0) / 15) * cw; // aktueller Zeitpunkt
  if (x >= L && x <= W - 4) {
    g.strokeStyle = dk ? '#fff' : '#9b3a26';
    g.lineWidth = 2;
    g.strokeRect(x - cw, 2 + row * ch, 2 * cw, ch);
  }
}
$('#lkCv').addEventListener('click', e => {
  if (!LK.cur) return;
  const cv = $('#lkCv'),
    b = cv.getBoundingClientRect(),
    x = ((e.clientX - b.left) * cv.width) / b.width,
    y = ((e.clientY - b.top) * cv.height) / b.height;
  const L = 34,
    B = 18,
    cw = (cv.width - L - 4) / LK_COLS,
    ch = (cv.height - B - 4) / LK_ROWS,
    k = Math.floor((x - L) / cw),
    r = Math.floor((y - 2) / ch);
  if (k < 0 || k >= LK_COLS || r < 0 || r >= LK_ROWS) return;
  if (state.playing) setPlaying(false);
  state.minutes = LK_T0 + k * 15 + 7;
  setDate(state.y, r >> 1, r & 1 ? 15 : 1);
  lkView();
});
function lkView() {
  const w = LK.cur.w,
    back = Math.min(16, Math.max(7, w.hw * 5)),
    P = w.center.clone().addScaledVector(w.inward, back);
  P.y = Math.max(1.7, Math.min(P.y, w.bottom + 1.7));
  const D = w.center.clone().sub(P).normalize();
  VIEWS.lkIn = { pos: P.toArray(), dir: D.toArray(), mode: 'inside', cut: 60, exp: 1.6, fov: 70 };
  goView('lkIn');
}
// 4 Astronomische Uhr und Himmel (nur Vergleich, die Uhr selbst bleibt unverändert)
function auGo(dd) {
  if (state.playing) setPlaying(false);
  if (dd === 0) {
    const n = berlinNow();
    state.minutes = n.minutes;
    setDate(n.y, n.m, n.d);
  } else {
    const t = new Date(Date.UTC(state.y, state.m, state.d) + dd * 864e5);
    setDate(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  }
  if (state.view !== 'uhrblatt') goView('uhrblatt');
  clockUpdate(null, true);
  expTick();
}
document.querySelectorAll('#auBtns [data-d]').forEach(b => b.addEventListener('click', () => auGo(+b.dataset.d)));
function auTable() {
  const st = clk.st;
  if (!st) return;
  const sp = sunPos(st.utc),
    woz = 12 + sp.H / 15,
    m = moonCur,
    ageSky = moonAge(st.utc);
  const rows = [
    [tr('Sonne: Zeit', 'Sun: time'), ckHM(st.hrs) + ' ' + tzN(st.off), ckHM(woz) + tr(' WOZ', ' AST')],
    [tr('Sonne im Sternbild', 'Sun in constellation'), ckSign(ckClockSign(st)), ckSign(ckSkySign(st.utc))],
    [
      tr('Mondalter', 'Moon age'),
      dc(st.age.toFixed(1)) + tr(' Tage', ' d'),
      ageSky !== null ? dc(ageSky.toFixed(1)) + tr(' Tage', ' d') : '–',
    ],
    [tr('Mondphase', 'Moon phase'), moonPhaseName((st.age / CKR.MC) * 360), m ? moonPhaseName(m.elong) : '–'],
  ];
  $('#auCmp').innerHTML = rows
    .map(r => '<tr><th scope="row">' + r[0] + '</th><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>')
    .join('');
  const dm = ageSky !== null ? ckWrap(st.age - ageSky) * 24 : null;
  $('#auNote').textContent =
    dm === null
      ? ''
      : Math.abs(dm) < 0.5
        ? tr(
            'Der Mond der Uhr stimmt heute fast genau mit dem Himmel überein.',
            'Today the clock’s moon almost exactly matches the sky.',
          )
        : tr(
            'Der Mond der Uhr ist dem Himmel ' +
              dc(Math.abs(dm).toFixed(1)) +
              ' Stunden ' +
              (dm > 0 ? 'voraus' : 'hinterher') +
              '.',
            'The clock’s moon is ' +
              Math.abs(dm).toFixed(1) +
              ' hours ' +
              (dm > 0 ? 'ahead of' : 'behind') +
              ' the sky.',
          );
}
