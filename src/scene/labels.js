// Beschriftungen im Modell.
import './camera.js'; // Aufbau-Reihenfolge: nach scene/camera
import { V3 } from '../three-global.js';
import { rad } from '../astro/index.js';
import { $ } from '../core/util.js';
import { fmtDeg, tr } from '../core/i18n.js';
import { TW } from '../model/measures.js';
import { cur, L, state } from '../state.js';
import { camera } from './renderer.js';
import { insideJS } from './shaders.js';
import { CLK } from '../model/clock.js';
import { SD, sdX, sdZ } from '../model/sundial.js';
import { moonCur } from '../light/sun.js';
import { LM } from '../light/sky.js';
import { lookToBody, tween } from './camera.js';

/* ---------------- Beschriftungen ---------------- */

const LABELS = [
  ['Nordturm', [TW.xc, 90, -14.2], 0, 'North tower'],
  ['Südturm', [TW.xc, 90, 14.4], 0, 'South tower'],
  ['Mittelschiff', [-8, 51, 0], 0, 'Nave'],
  ['Dachreiter', [11.9, 81, 0], 1, 'Ridge turret'],
  ['Sonnenuhr', [sdX, SD.y + 0.9, sdZ], 0, 'Sundial'],
  ['Westfenster', [-51.4, 24, 0], 0, 'West window'],
  ['Briefkapelle', [-29.6, 21, 27.4], 0, 'Briefkapelle'],
  ['Totentanzkapelle', [8.3, 31, -26.5], 0, 'Dance of Death Chapel'],
  ['Südvorhalle', [8.9, 31, 30.2], 0, 'South porch'],
  ['Marientidenkapelle', [47, 33.5, 0], 0, 'Marientiden Chapel'],
  ['Kapellenkranz', [37.5, 28, -12], 0, 'Chapel ring'],
  ['Gedenkkapelle', [TW.x0 - 0.5, 19, 14.4], 0, 'Memorial Chapel'],
  ['Astronomische Uhr', [CLK.x - 0.3, 13.2, CLK.z], 2, 'Astronomical clock'],
];
const labelLayer = $('#labels');
const labelEls = LABELS.map(([t, p, nc, te]) => {
  const el = document.createElement('div');
  el.className = 'lbl'; // auf dem Handy ausgeblendet
  el.textContent = tr(t, te);
  labelLayer.appendChild(el);
  return { el, p: new V3(...p), nc: nc | 0, de: t, en: te };
});
export function relabel() {
  for (const l of labelEls) {
    l.el.textContent = tr(l.de, l.en);
    l.w = 0;
  }
}
export function updateLabelsVisibility() {
  labelLayer.hidden = !(state.labels && state.mode === 'orbit');
}
const pv = new V3();
export function placeLabels() {
  if (labelLayer.hidden) return;
  if (insideJS(camera.position.x, camera.position.y, camera.position.z)) {
    for (const l of labelEls) l.el.style.display = 'none';
    return;
  } // im Innenraum keine Außenbeschriftungen
  const w = labelLayer.clientWidth,
    h = labelLayer.clientHeight,
    capY = state.cut < 60 ? state.cut + 1 : 1e9,
    boxes = [];
  for (const l of labelEls) {
    pv.copy(l.p);
    pv.y = Math.min(pv.y, capY);
    pv.project(camera);
    if (
      (l.nc === 1 && state.cut < 60) ||
      (l.nc === 2 && state.cut >= 60) ||
      pv.z > 1 ||
      pv.z < -1 ||
      Math.abs(pv.x) > 1.1 ||
      Math.abs(pv.y) > 1.1
    ) {
      l.el.style.display = 'none';
      continue;
    }
    const x = ((pv.x + 1) / 2) * w,
      y = ((1 - pv.y) / 2) * h - 8;
    if (!l.w) {
      l.el.style.display = '';
      l.w = l.el.offsetWidth || 80;
      l.h = l.el.offsetHeight || 18;
    }
    const b = [x - l.w / 2 - 3, y - l.h - 2, x + l.w / 2 + 3, y + 2];
    if (boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) {
      l.el.style.display = 'none';
      continue;
    }
    boxes.push(b);
    l.el.style.display = '';
    l.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-100%)';
  }
}

/* ---------------- Randhinweise: Sonne und Mond außerhalb des Bildes ---------------- */

// In den Außenansichten zeigt ein Hinweis am Bildrand, wo Sonne oder Mond stehen, solange sie nicht im Bild sind
// (wie die Zeiger auf Ziele außerhalb des Bildes in Karten- und Planetariumsprogrammen). Antippen: Blick dorthin.
const MARK_VIEWS = new Set([
  'aussen',
  'westseite',
  'sued',
  'chorost',
  'nord',
  'tuermeost',
  'luft',
  'zurSonne',
  'zumMond',
]);
const markLayer = $('#skyMarks');
const ICON = {
  sun: '<circle r="4.2"/><path d="M0-9v2.6M0 9V6.4M-9 0h2.6M9 0H6.4M-6.4-6.4l1.8 1.8M6.4 6.4 4.6 4.6M-6.4 6.4l1.8-1.8M6.4-6.4 4.6-4.6"/>',
  moon: '<path d="M3.2-7.6A8 8 0 1 0 7.6 3.2 6.2 6.2 0 0 1 3.2-7.6z"/>',
};
const marks = ['sun', 'moon'].map(k => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'skymk ' + k;
  el.id = k === 'sun' ? 'mkSun' : 'mkMoon';
  el.hidden = true;
  el.innerHTML =
    '<svg class="ar" viewBox="-20 -20 40 40" aria-hidden="true"><path d="M14-6 21 0 14 6z"/></svg>' +
    '<svg class="ic" viewBox="-10 -10 20 20" aria-hidden="true">' +
    ICON[k] +
    '</svg><span class="v"></span>';
  el.addEventListener('click', () => lookToBody(k === 'sun' ? 'zurSonne' : 'zumMond'));
  markLayer.appendChild(el);
  return { k, el, v: el.querySelector('.v'), ar: el.querySelector('.ar'), txt: '' };
});
const md = new V3();
function freeArea(W, H) {
  // Bereich für die Hinweise: unter der Titelleiste, über Zeitleiste (und Karte als Unterblatt auf dem Handy);
  // Symbolleiste und Karten am rechten Rand schieben die Hinweise nur auf ihrer Höhe nach links.
  let l = 12,
    t = 12,
    r = W - 12,
    b = H - 12;
  const side = [],
    s = markLayer.getBoundingClientRect();
  for (const el of document.querySelectorAll('.brand, .rail, .timebar, .card:not([hidden]), #freeBtn, #freeMini')) {
    const o = el.getBoundingClientRect();
    if (!o.width || !o.height) continue;
    const ol = o.left - s.left,
      ot = o.top - s.top,
      ob = o.bottom - s.top;
    if (o.width > W * 0.6) {
      if ((ot + ob) / 2 > H / 2)
        b = Math.min(b, ot - 8); // unten (Zeitleiste, Blatt auf dem Handy)
      else t = Math.max(t, ob + 8);
    } else if (ol > W / 2) side.push([ot - 30, ob + 30, ol - 8]);
    else if (ob < H / 2) t = Math.max(t, ob + 8);
  }
  return { box: [l + 24, t + 24, r - 24, b - 24], side };
}
export function placeSkyMarks() {
  const on =
    !state.pano &&
    !tween &&
    state.mode === 'orbit' &&
    MARK_VIEWS.has(state.view) &&
    !document.body.classList.contains('mobile'); // Handy: nur die Sonnenuhr, keine Randhinweise
  const W = markLayer.clientWidth,
    H = markLayer.clientHeight;
  let area = null;
  for (const m of marks) {
    const moon = m.k === 'moon',
      el = moon ? (moonCur ? moonCur.el : -90) : cur.el;
    if (!on || el < -1 || (moon && !state.moon)) {
      m.el.hidden = true;
      continue;
    }
    md.copy(moon ? LM : L).transformDirection(camera.matrixWorldInverse); // Richtung im Kamerabild: x rechts, y oben, -z vorn
    const fy = Math.tan((camera.fov * rad) / 2),
      fx = fy * camera.aspect;
    let sx = md.x / fx,
      sy = md.y / fy;
    if (md.z < 0) {
      sx /= -md.z;
      sy /= -md.z;
      if (Math.abs(sx) < 0.97 && Math.abs(sy) < 0.97) {
        m.el.hidden = true; // im Bild
        continue;
      }
    }
    let dx = sx * W,
      dy = -sy * H;
    if (Math.hypot(dx, dy) < 1e-6) dx = 1; // genau hinter der Kamera: nach rechts zeigen
    area = area || freeArea(W, H);
    const [l, t, r, b] = area.box,
      cx = W / 2,
      cy = H / 2;
    let k = Infinity;
    if (dx > 0) k = Math.min(k, (r - cx) / dx);
    if (dx < 0) k = Math.min(k, (l - cx) / dx);
    if (dy > 0) k = Math.min(k, (b - cy) / dy);
    if (dy < 0) k = Math.min(k, (t - cy) / dy);
    let x = Math.min(r, Math.max(l, cx + dx * k)),
      y = Math.min(b, Math.max(t, cy + dy * k));
    for (const [y0, y1, xl] of area.side) {
      if (y <= y0 || y >= y1 || x <= xl - 24) continue;
      // neben der Symbolleiste: auf kürzestem Weg daneben, darunter oder darüber
      const opt = [[xl - 24, y, x - xl + 24]];
      if (y1 <= b) opt.push([x, y1, y1 - y]);
      if (y0 >= t) opt.push([x, y0, y - y0]);
      [x, y] = opt.sort((p, q) => p[2] - q[2])[0];
    }
    m.el.hidden = false;
    m.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)';
    m.ar.style.transform = 'rotate(' + Math.atan2(dy, dx).toFixed(3) + 'rad)';
    const txt = fmtDeg(el);
    if (txt !== m.txt) {
      m.txt = txt;
      m.v.textContent = txt;
      const lbl = moon
        ? tr(
            'Mond ' + txt + ' hoch, außerhalb des Bildes – zum Mond blicken',
            'Moon at ' + txt + ', outside the view – look at the moon',
          )
        : tr(
            'Sonne ' + txt + ' hoch, außerhalb des Bildes – zur Sonne blicken',
            'Sun at ' + txt + ', outside the view – look at the sun',
          );
      m.el.title = lbl;
      m.el.setAttribute('aria-label', lbl);
    }
  }
}
