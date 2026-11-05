// Karte „Astronomische Uhr“: Vergleich Uhr und Himmel, Vorschau von Zifferblatt und Kalenderscheibe.
import './panels.js'; // Aufbau-Reihenfolge: nach ui/panels
import { eclipseScan, nrm360, rad, sunEcl, sunPos } from '../astro/index.js';
import { $ } from '../core/util.js';
import { dc, LANG, moonPhaseName, pad2, tr, tzN } from '../core/i18n.js';
import { CK, CK_DE, CK_EN, CK_IAU, CK_N, CK_W, ckLeap, CKR, clk, clockUpdate } from '../model/clock.js';
import { moonAge } from '../model/sundial.js';
import { moonCur } from '../light/sun.js';
import { goView } from '../scene/camera.js';
import { goEclipse } from './controls.js';

/* ---------------- Karte: Astronomische Uhr ---------------- */

export const CK_MON = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
export const CK_MON_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const CK_ECL = [
  ['totale Mondfinsternis', 'total lunar eclipse'],
  ['partielle Mondfinsternis', 'partial lunar eclipse'],
  ['totale Sonnenfinsternis', 'total solar eclipse'],
  ['partielle Sonnenfinsternis', 'partial solar eclipse'],
];
function ckEaster(y) {
  const a = y % 19,
    b = Math.floor(y / 100),
    c = y % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31),
    da = ((h + l - 7 * m + 114) % 31) + 1;
  return [da, mo - 1];
}
export function ckFmtDay(d, m) {
  return LANG === 'en' ? d + ' ' + CK_MON_EN[m] : d + '. ' + CK_MON[m];
}
export function ckSign(name) {
  return LANG === 'en' ? CK_EN[name] : CK_DE[name];
}
export function ckClockSign(st) {
  // Sternbild unter dem Sonnenzeiger, nach Behrens' Scheibe (Breiten wie am Himmel)
  const rel = (st.aSun - st.aZod) / rad;
  let o = nrm360(-90 + CK_W[0] / 2 - rel);
  for (let k = 0; k < CK_W.length; k++) {
    if (o < CK_W[k]) return CK_N[k];
    o -= CK_W[k];
  }
  return CK_N[0];
}
export function ckSkySign(utc) {
  const yrs = (utc - Date.UTC(2000, 0, 1, 12)) / (365.25 * 864e5),
    lam = nrm360(sunEcl(utc).lam - 0.01397 * yrs);
  let n = CK_IAU[CK_IAU.length - 1][0];
  for (const [k, s] of CK_IAU) if (lam >= s) n = k;
  return n;
}
export const ckWrap = d => {
  const M = CKR.MC;
  return ((((d + M / 2) % M) + M) % M) - M / 2;
}; // Unterschied im Mondalter über den Neumond hinweg (−½ … +½ Monat)
export const ckHM = h => {
  h = ((h % 24) + 24) % 24;
  let H = Math.floor(h),
    M = Math.round((h - H) * 60);
  if (M === 60) {
    H = (H + 1) % 24;
    M = 0;
  }
  return pad2(H) + ':' + pad2(M);
};
function ckDiff(min) {
  const a = Math.abs(Math.round(min)),
    h = Math.floor(a / 60),
    m = a % 60;
  return h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min';
}
const ckEcl = { key: null };
export function updateClockCard() {
  const st = clk.st;
  if (!st || $('#card-clock').hidden) return;
  const y = st.y,
    idx = st.doy - 1 + (!ckLeap(y) && st.mo >= 2 ? 1 : 0),
    dd = CK && CK.day ? CK.day[idx] : null,
    ci = CK && CK.cal ? CK.cal[y - CK.y0] : null;
  $('#ckDate').textContent = ckFmtDay(st.d, st.mo) + ' ' + y;
  $('#ckLetter').textContent = dd ? dd[0] : '–';
  $('#ckSaint').textContent = dd
    ? dd[1].charAt(0) +
      dd[1]
        .slice(1)
        .toLowerCase()
        .replace(/([ .-])(\S)/g, (m, a, b) => a + b.toUpperCase())
    : '–';
  $('#ckSun').textContent = ci ? ci[0].replace(',', ' / ') : '–';
  $('#ckGold').textContent = String(ci ? ci[1] : (y % 19) + 1);
  const ea = ckEaster(y);
  $('#ckEaster').textContent = ckFmtDay(ea[0], ea[1]);
  const ecl = CK && CK.ecl ? CK.ecl[String(y)] : null,
    lo = CK && CK.ecl ? Math.min(...Object.keys(CK.ecl).map(Number)) : 0,
    hi = CK && CK.ecl ? Math.max(...Object.keys(CK.ecl).map(Number)) : 0;
  const ek = y + LANG;
  if (ckEcl.key !== ek) {
    ckEcl.key = ek;
    const el = $('#ckEcl'); // Einträge der Kalenderscheibe; ein Klick zeigt die berechnete Finsternis im Modell
    if (ecl && ecl.length) {
      el.innerHTML = '';
      ecl.forEach(e => {
        const b = document.createElement('button');
        b.className = 'elnk';
        b.title = tr('Im Modell zeigen', 'Show in the model');
        b.textContent =
          (LANG === 'en'
            ? e[0] + ' ' + CK_MON_EN[e[1] - 1].slice(0, 3) + ' ' + e[2]
            : e[0] + '.' + e[1] + '. ' + e[2] + ' Uhr') +
          ' · ' +
          CK_ECL[e[3]][LANG === 'en' ? 1 : 0];
        b.addEventListener('click', () => {
          const t = Date.UTC(y, e[1] - 1, e[0], 12),
            c = eclipseScan(t - 3 * 86400000, 3, 'sl')
              .filter(x => Math.abs(x.max - t) < 2.5 * 86400000)
              .sort((a, b) => Math.abs(a.max - t) - Math.abs(b.max - t))[0];
          if (c) goEclipse(c);
        });
        el.appendChild(b);
      });
    } else
      el.textContent =
        y >= lo && y <= hi
          ? tr('keine in ' + y, 'none in ' + y)
          : tr('nur für ' + lo + '–' + hi + ' eingetragen', 'only listed for ' + lo + '–' + hi);
  }
  // Uhr gegen Himmel
  const sp = sunPos(st.utc),
    woz = 12 + sp.H / 15,
    m = moonCur,
    ageSky = moonAge(st.utc),
    sC = ckClockSign(st),
    sS = ckSkySign(st.utc);
  const rows = [
    [tr('Sonne: Zeit', 'Sun: time'), ckHM(st.hrs) + ' ' + tzN(st.off), ckHM(woz) + tr(' WOZ', ' AST')],
    [tr('Sonne im Sternbild', 'Sun in constellation'), ckSign(sC), ckSign(sS)],
    [
      tr('Mondalter', 'Moon age'),
      dc(st.age.toFixed(1)) + tr(' Tage', ' d'),
      ageSky !== null ? dc(ageSky.toFixed(1)) + tr(' Tage', ' d') : '–',
    ],
    [tr('Mondphase', 'Moon phase'), moonPhaseName((st.age / CKR.MC) * 360), m ? moonPhaseName(m.elong) : '–'],
  ];
  $('#ckCmp').innerHTML = rows
    .map(
      r =>
        '<tr><th scope="row">' +
        r[0] +
        '</th><td>' +
        r[1] +
        '</td><td' +
        (r[1] !== r[2] && r[0] !== rows[0][0] && r[0] !== rows[2][0] ? ' class="dif"' : '') +
        '>' +
        r[2] +
        '</td></tr>',
    )
    .join('');
  const dt = (st.hrs - woz) * 60,
    dm = ageSky !== null ? ckWrap(st.age - ageSky) * 24 * 60 : null;
  {
    const r = $('#ckRange'),
      y0 = CK ? CK.y0 : 1911,
      y1 = CK && CK.cal ? CK.y0 + CK.cal.length - 1 : 2080,
      out = !ci;
    r.hidden = !out;
    if (out)
      r.textContent = tr(
        'Die Kalenderscheibe der Uhr ist für ' +
          y0 +
          '–' +
          y1 +
          ' beschriftet. Für ' +
          y +
          ' stehen dort keine Sonntagsbuchstaben und keine Finsternisse; die Zeiger laufen weiter wie gebaut.',
        'The clock’s calendar disk is inscribed for ' +
          y0 +
          '–' +
          y1 +
          '. For ' +
          y +
          ' it shows no Sunday letters and no eclipses; the hands keep running as built.',
      );
  }
  $('#ckNote').textContent =
    tr(
      'Die Uhr zeigt die gesetzliche Zeit; die wahre Ortszeit (WOZ) der Sonne liegt ',
      'The clock shows civil time; apparent solar time (AST) is ',
    ) +
    ckDiff(dt) +
    (dt >= 0 ? tr(' dahinter.', ' behind.') : tr(' davor.', ' ahead.')) +
    (dm !== null
      ? tr(' Der Mond der Uhr ', ' The clock’s moon is ') +
        (Math.abs(dm) < 30
          ? tr('stimmt fast genau', 'almost exact')
          : ckDiff(dm) + (dm > 0 ? tr(' voraus', ' ahead') : tr(' zurück', ' behind'))) +
        tr(
          '; Behrens rechnet mit 6940 : 6705 statt mit dem wechselnden wahren Mondlauf.',
          '; Behrens uses a fixed 6940 : 6705 ratio, the real moon’s motion varies.',
        )
      : '');
  ckDrawDisc($('#ckMini'), clk.mini);
  if (!$('#ckZoom').hidden) ckDrawDisc($('#ckBig'), clk.mini);
  $('#ckZoomBtn').setAttribute(
    'aria-label',
    clk.mini === 'cal'
      ? tr('Kalenderscheibe vergrößern', 'Enlarge the calendar disk')
      : tr('Zifferblatt vergrößern', 'Enlarge the dial'),
  );
}
// Vorschaubild: Zifferblatt oder Kalenderscheibe, je nach gewählter Ansicht; Antippen vergrößert
clk.mini = 'dial';
function ckDrawDisc(cv, mode) {
  if (!cv) return;
  const g = cv.getContext('2d'),
    W = cv.width;
  g.clearRect(0, 0, W, W);
  if (mode === 'cal' && clk.img.kalender && clk.st) {
    g.save();
    g.translate(W / 2, W / 2);
    g.beginPath();
    g.arc(0, 0, W / 2, 0, 2 * Math.PI);
    g.clip();
    g.rotate(clk.st.aCal);
    g.drawImage(clk.img.kalender, -W / 2, -W / 2, W, W);
    g.restore();
    g.beginPath();
    g.moveTo(0, W / 2 - W * 0.032);
    g.lineTo(W * 0.075, W / 2);
    g.lineTo(0, W / 2 + W * 0.032);
    g.closePath();
    g.fillStyle = '#e0b040';
    g.fill();
    g.lineWidth = Math.max(1, W / 256);
    g.strokeStyle = '#5a3d0c';
    g.stroke();
  } // fester Zeiger links weist auf den Tag
  else if (clk.canvas) g.drawImage(clk.canvas, 0, 0, W, W);
}
function ckMiniSet(m) {
  clk.mini = m;
  ckDrawDisc($('#ckMini'), m);
  if (!$('#ckZoom').hidden) ckZoomOpen();
}
function ckZoomOpen() {
  const z = $('#ckZoom');
  z.hidden = false;
  ckDrawDisc($('#ckBig'), clk.mini);
  $('#ckZoomTxt').textContent =
    clk.mini === 'cal'
      ? tr('Kalenderscheibe am ', 'Calendar disk on ') +
        $('#ckDate').textContent +
        tr(' – der Zeiger links weist auf den Tag.', ' – the pointer on the left marks the day.')
      : tr('Zifferblatt am ', 'Dial on ') + $('#ckDate').textContent;
  $('#ckZoomX').focus({ preventScroll: true });
}
function ckZoomClose() {
  const z = $('#ckZoom');
  if (z.hidden) return;
  z.hidden = true;
  $('#ckZoomBtn').focus({ preventScroll: true });
}
$('#ckZoomBtn').addEventListener('click', ckZoomOpen);
$('#ckZoom').addEventListener('click', ckZoomClose);
document.addEventListener(
  'keydown',
  e => {
    if (e.key === 'Escape' && !$('#ckZoom').hidden) {
      e.stopImmediatePropagation();
      ckZoomClose();
    }
  },
  true,
);
$('#ckGo').addEventListener('click', () => goView('uhr'));
$('#ckDial').addEventListener('click', () => {
  ckMiniSet('dial');
  goView('uhrblatt');
});
$('#ckCal').addEventListener('click', () => {
  ckMiniSet('cal');
  goView('uhrkalender');
});
document.querySelector('.rbtn[data-card="clock"]').addEventListener('click', () =>
  setTimeout(() => {
    clockUpdate(null, true);
    updateClockCard();
  }, 0),
);
