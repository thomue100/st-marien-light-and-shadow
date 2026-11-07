// Handy: nur die Sonnenuhr. Oben das Bild, unten eine feste Anzeige (ablesen, Uhrzeit, Datum, Schnellwahl); drei
// Blickwinkel, eine Startseite, „In 3 Schritten erklärt“ und eine Seite „Mehr am Computer“. Alles andere bleibt dem
// Desktop vorbehalten („Link an mich senden“ öffnet denselben Moment am Computer). Am Desktop zeigt eine Anzeige unter der Titelleiste
// ständig, was die Sonnenuhr gerade zeigt.
import './share.js'; // Aufbau-Reihenfolge: nach ui/share
import { dstInfo, localToUtc, LON, sunPos, trueNoon } from '../astro/index.js';
import { $, lsGet, lsSet } from '../core/util.js';
import { fmtT, LANG, tr, tzN } from '../core/i18n.js';
import { cur, state } from '../state.js';
import { camera, renderer, requestRender } from '../scene/renderer.js';
import { sd, setSdHook } from '../model/sundial.js';
import { useMoon } from '../light/sun.js';
import { controls, goView, tween, VIEWS } from '../scene/camera.js';
import { setDate, setMinutes, setPlaying } from './controls.js';
import { openCard, setFree } from './panels.js';
import { tour, tourEnd } from './tour.js';
import { quiz, quizEnd } from './quiz.js';
import { updateShare } from './share.js';

export const PHONE = matchMedia('(max-width: 760px), (max-height: 520px) and (pointer: coarse)');
const LAND = matchMedia('(orientation: landscape)');
const body = document.body,
  panel = $('#mpanel'),
  start = $('#mstart'),
  desk = $('#mdesk'),
  steps = $('#msteps');
export const isPhone = () => body.classList.contains('mobile');

/* ---------------- Ablesen ---------------- */

/** Dauer in Minuten als „1 Std. 14 Min.“ bzw. „1 h 14 min“ */
function fmtDur(min) {
  const a = Math.round(Math.abs(min)),
    h = Math.floor(a / 60),
    m = a % 60;
  if (LANG === 'en') return (h ? h + ' h ' : '') + (m || !h ? m + ' min' : '');
  return (h ? h + ' Std. ' : '') + (m || !h ? m + ' Min.' : '');
}
function sdRead(ok, stateText) {
  const di = dstInfo(state.y, state.m, state.d, state.minutes),
    clock = fmtT(di.loc),
    show = ok ? fmtT(sd.show * 60) : '–',
    lbl = useMoon ? tr('Mondschatten zeigt', 'Moon shadow shows') : tr('Sonnenuhr zeigt', 'Sundial shows');
  // Desktop: Anzeige unter der Titelleiste
  $('#sdPillLbl').textContent = lbl;
  $('#sdPillShow').textContent = show;
  $('#sdPillClock').textContent = clock + ' ' + tzN(di.off);
  $('#sdPill').title = stateText;
  if (!isPhone()) return;
  $('#mpShowLbl').textContent = lbl;
  $('#mpShow').textContent = show;
  $('#mpClock').textContent = clock;
  $('#mpTz').textContent = tzN(di.off);
  let t;
  if (ok && useMoon) t = tr('Im Mondlicht zeigt die Uhr die Mondzeit.', 'In moonlight the dial shows lunar time.');
  else if (ok) {
    const d = di.loc - sd.show * 60;
    t =
      Math.abs(d) < 0.5
        ? tr('Beide zeigen dieselbe Zeit.', 'Both show the same time.')
        : d > 0
          ? tr('Ihre Uhr geht ' + fmtDur(d) + ' vor.', 'Your clock is ' + fmtDur(d) + ' ahead.')
          : tr('Ihre Uhr geht ' + fmtDur(d) + ' nach.', 'Your clock is ' + fmtDur(d) + ' behind.');
  } else
    t =
      cur.el <= 0 && !useMoon
        ? tr('Nacht – kein Schatten auf dem Zifferblatt.', 'Night – no shadow on the dial.')
        : !sd.front
          ? tr('Die Sonne steht hinter der Wand.', 'The sun is behind the wall.')
          : tr('Das Zifferblatt liegt im Schatten.', 'The dial is in shade.');
  $('#mpDiff').textContent = t;
  syncViews();
}
setSdHook(sdRead);
$('#sdPill').addEventListener('click', () => openCard($('#card-sd').hidden ? 'sd' : null));

/* ---------------- Blickwinkel: Zifferblatt · Kirche · Himmel ---------------- */

// zusätzliche Blickwinkel aus „Mehr entdecken“: erscheinen als vierter Knopf, sobald man einen gewählt hat
const EXTRA = { dachreiter: ['Dachreiter', 'Ridge turret'], uhr: ['Uhr', 'Clock'] };
function syncViews() {
  const xb = $('#mvExtra');
  if (xb.dataset.mv) xb.textContent = tr(...EXTRA[xb.dataset.mv]);
  body.classList.toggle('mv-sd', !state.pano && state.view === 'sonnenuhr'); // Nahansicht: ohne Beschriftung
  for (const b of document.querySelectorAll('#mviews button'))
    b.setAttribute(
      'aria-pressed',
      String(b.dataset.mv === 'himmel' ? !!state.pano : !state.pano && state.view === b.dataset.mv),
    );
}
for (const b of document.querySelectorAll('#mviews button'))
  b.addEventListener('click', () => {
    goView(b.dataset.mv);
    gesture(b.dataset.mv);
    // die Himmelsansicht wird beim ersten Mal erst vorbereitet: Auswahl sofort zeigen, danach am Zustand abgleichen
    for (const x of document.querySelectorAll('#mviews button')) x.setAttribute('aria-pressed', String(x === b));
    setTimeout(syncViews, 500);
  });

/* ---------------- Drehen zeigen: kurzer Schwenk und eingeblendete Fingergeste ---------------- */

// Beim ersten Mal je Art des Blickwinkels erscheint mitten im Bild ein wischender Finger mit kurzem Text; er verschwindet
// bei der ersten Berührung oder nach 4 s. Bei „Selbst ausprobieren“ schwenkt das Modell zudem einmal kurz hin und zurück.
const GEST = {
  orbit: ['Mit einem Finger drehen · mit zwei zoomen', 'One finger: turn · two fingers: zoom'],
  pano: ['Ziehen: Himmel drehen · zwei Finger: zoomen', 'Drag: turn the sky · two fingers: zoom'],
  walk: ['Ziehen: umsehen · Steuerkreis: gehen', 'Drag: look around · circle: walk'],
};
const gestKind = v => (v === 'himmel' ? 'pano' : VIEWS[v] && VIEWS[v].mode === 'inside' ? 'walk' : 'orbit');
let gestTimer = 0,
  nudgeOn = false;
function gestHide() {
  clearTimeout(gestTimer);
  $('#mgest').hidden = true;
}
export function gesture(v, nudge) {
  const k = gestKind(v);
  if (lsGet('stm-gest-' + k) !== '1') {
    lsSet('stm-gest-' + k, '1');
    $('#mgestTxt').textContent = tr(...GEST[k]).replace(' · ', '\n'); // zwei Zeilen
    $('#mgest').hidden = false;
    clearTimeout(gestTimer);
    gestTimer = setTimeout(gestHide, 4000);
  }
  if (nudge && k === 'orbit' && !matchMedia('(prefers-reduced-motion: reduce)').matches) swing();
}
/** einmal sanft um die Hochachse hin und zurück schwenken (±15°, 1,6 s), sobald die Kamerafahrt beendet ist */
function swing() {
  const A = (15 * Math.PI) / 180,
    T = 1600,
    up = new THREE.Vector3(0, 1, 0);
  let t0 = null,
    prev = 0;
  nudgeOn = true;
  const step = now => {
    if (!nudgeOn) return;
    if (tween) return requestAnimationFrame(step); // erst nach der Kamerafahrt
    if (t0 === null) t0 = now;
    const t = Math.min(1, (now - t0) / T),
      a = A * Math.sin(Math.PI * t),
      off = camera.position.clone().sub(controls.target);
    off.applyAxisAngle(up, a - prev);
    prev = a;
    camera.position.copy(controls.target).add(off);
    controls.update();
    requestRender();
    if (t < 1) requestAnimationFrame(step);
    else nudgeOn = false;
  };
  requestAnimationFrame(step);
}
renderer.domElement.addEventListener('pointerdown', () => {
  nudgeOn = false; // wer selbst dreht, braucht keinen Schwenk und keinen Hinweis mehr
  gestHide();
});

/* ---------------- Schnellwahl ---------------- */

function goNoon(m, d) {
  setDate(state.y, m, d);
  setMinutes(Math.round(trueNoon(state.y, m, d)));
}
for (const b of document.querySelectorAll('.mpquick button'))
  b.addEventListener('click', () => {
    setPlaying(false);
    const q = b.dataset.q;
    if (q === 'now') $('#nowBtn').click();
    else if (q === 'jun') goNoon(5, 21);
    else if (q === 'dec') goNoon(11, 21);
    else if (q === 'full') $('#sdMoonGo').click(); // nächster Vollmond, Blick auf das Zifferblatt
    if (q !== 'full' && (state.view !== 'sonnenuhr' || state.pano)) goView('sonnenuhr');
    syncViews();
  });

/* ---------------- In 3 Schritten erklärt ---------------- */

const ms = { i: null };
/** Wahre Ortszeit und ihre Zerlegung für den eingestellten Zeitpunkt, in Minuten */
function wozParts() {
  const di = dstInfo(state.y, state.m, state.d, state.minutes),
    H = sunPos(localToUtc(state.y, state.m, state.d, state.minutes)).H,
    woz = Math.round((((720 + H * 4) % 1440) + 1440) % 1440),
    dst = di.off - 60,
    lon = Math.round(4 * (15 - LON)),
    eot = woz - (Math.round(di.loc) - dst - lon); // gerundet so, dass die Zeilen aufgehen
  return { loc: Math.round(di.loc), dst, lon, eot, woz, tz: tzN(di.off) };
}
/** Hinweis, wenn der Schatten im Modell um Minuten von der wahren Ortszeit abweicht (Ablesegenauigkeit) */
function readNote(woz) {
  if (!(sd.show !== null && sd.lit && !useMoon)) return '';
  let d = Math.round(sd.show * 60) - woz;
  d = ((((d + 720) % 1440) + 1440) % 1440) - 720;
  if (Math.abs(d) < 1) return '';
  return (
    '<p class="msnote">' +
    tr(
      'Der Schatten im Modell zeigt ' +
        fmtT(sd.show * 60) +
        ' – auf ein, zwei Minuten genau abzulesen ist bei Sonnenuhren normal.',
      'The shadow in the model shows ' +
        fmtT(sd.show * 60) +
        ' – reading a sundial to within a minute or two is normal.',
    ) +
    '</p>'
  );
}
const sgn = v => (v < 0 ? '− ' : v > 0 ? '+ ' : '± ') + Math.abs(v);
const STEPS = [
  {
    t: ['Der Schatten zeigt die Stunde', 'The shadow tells the hour'],
    go() {
      goView('sonnenuhr');
      setDate(state.y, 4, 10);
      setMinutes(8 * 60);
      setPlaying(true);
    },
    body: () =>
      '<p>' +
      tr(
        'Der Stab der Sonnenuhr steht parallel zur Erdachse und zeigt zum Himmelsnordpol. Sein Schatten wandert im Lauf des Tages über die Stundenlinien – sehen Sie zu: Der 10. Mai läuft gerade ab.',
        'The rod of the sundial is parallel to the Earth’s axis and points to the north celestial pole. Its shadow moves across the hour lines during the day – watch: 10 May is running now.',
      ) +
      '</p>',
  },
  {
    t: ['Warum sie anders geht als Ihre Uhr', 'Why it differs from your clock'],
    go(from) {
      if (from === 0) {
        setPlaying(false);
        setMinutes(10 * 60 + 49);
      } else setPlaying(false);
      if (state.view !== 'sonnenuhr') goView('sonnenuhr');
    },
    body() {
      const p = wozParts(),
        row = (a, b, c) =>
          '<span class="' + (c || '') + '">' + a + '</span><span class="' + (c || '') + '">' + b + '</span>';
      return (
        '<div class="mstab">' +
        row(fmtT(p.loc), tr('Ihre Uhr', 'Your clock') + ' (' + p.tz + ')') +
        (p.dst ? row('− ' + p.dst, tr('Sommerzeit abziehen', 'Remove summer time'), 'mu') : '') +
        row(
          '− ' + p.lon,
          tr(
            'Lübeck liegt westlich des 15. Längengrads, nach dem die MEZ rechnet',
            'Lübeck lies west of 15° E, the meridian of Central European Time',
          ),
          'mu',
        ) +
        row(
          sgn(p.eot),
          tr(
            'Zeitgleichung: Die Erde läuft nicht gleichmäßig um die Sonne',
            'Equation of time: the Earth does not orbit the sun at an even pace',
          ),
          'mu',
        ) +
        row(fmtT(p.woz), tr('Sonnenuhr: wahre Ortszeit', 'Sundial: apparent solar time'), 'sum') +
        '</div>' +
        readNote(p.woz)
      );
    },
  },
  {
    t: ['Sommer und Winter', 'Summer and winter'],
    go() {
      setPlaying(false);
      if (state.view !== 'sonnenuhr') goView('sonnenuhr');
      goNoon(5, 21);
    },
    body: () =>
      '<p>' +
      tr(
        'Mittags steht die Sonne am 21. Juni fast 60° hoch, am 21. Dezember nur knapp 13°. Der Schatten des Stabes wird kürzer oder länger – die Stunde liest man trotzdem an derselben Linie ab.',
        'At noon the sun stands almost 60° high on 21 June, but barely 13° on 21 December. The rod’s shadow gets shorter or longer – yet the hour is read on the same line.',
      ) +
      '</p><p class="msbtnrow"><button class="chip" data-n="5">' +
      tr('21. Juni', '21 June') +
      '</button><button class="chip" data-n="11">' +
      tr('21. Dezember', '21 December') +
      '</button></p>',
  },
];
function stepRender() {
  const s = STEPS[ms.i];
  $('#msNum').textContent = tr('Schritt ', 'Step ') + (ms.i + 1) + tr(' von 3', ' of 3');
  document.querySelectorAll('#msDots i').forEach((d, k) => d.classList.toggle('on', k <= ms.i));
  $('#msTitle').textContent = s.t[LANG === 'en' ? 1 : 0];
  $('#msBody').innerHTML = s.body();
  for (const b of $('#msBody').querySelectorAll('[data-n]'))
    b.addEventListener('click', () => {
      goNoon(+b.dataset.n, 21);
      for (const x of $('#msBody').querySelectorAll('[data-n]')) x.setAttribute('aria-pressed', String(x === b));
    });
  const first = $('#msBody').querySelector('[data-n]');
  if (first) first.setAttribute('aria-pressed', 'true');
  $('#msPrev').textContent = ms.i ? tr('Zurück', 'Back') : tr('Schließen', 'Close');
  $('#msNext').textContent = ms.i < 2 ? tr('Weiter', 'Next') : tr('Fertig', 'Done');
  syncViews();
}
export function stepsGo(i, from) {
  showStart(false);
  ms.i = i;
  steps.hidden = false;
  $('#mpMain').hidden = true;
  STEPS[i].go(from);
  stepRender();
}
function stepsEnd() {
  ms.i = null;
  setPlaying(false);
  steps.hidden = true;
  $('#mpMain').hidden = false;
}
$('#msPrev').addEventListener('click', () => (ms.i ? stepsGo(ms.i - 1, ms.i) : stepsEnd()));
$('#msNext').addEventListener('click', () => (ms.i < 2 ? stepsGo(ms.i + 1, ms.i) : stepsEnd()));
$('#mpWhy').addEventListener('click', () => stepsGo(1));

/* ---------------- Startseite und „Mehr am Computer“ ---------------- */

export function showStart(on) {
  start.hidden = !on;
  panel.hidden = on;
  sizeVars();
  if (on) {
    if (ms.i !== null) stepsEnd();
    // zurück auf der Startseite: der zusätzliche Blickwinkel (Dachreiter, Uhr) verschwindet wieder
    const xb = $('#mvExtra');
    xb.hidden = true;
    xb.dataset.mv = '';
    xb.textContent = '';
    // Startseite immer mit besonntem Zifferblatt: 21. Juni, 12:00 (sonst ist das Bild abends und im Winter dunkel)
    setPlaying(false);
    setDate(state.y, 5, 21);
    setMinutes(12 * 60);
    if (state.view !== 'sonnenuhr' || state.pano) goView('sonnenuhr');
    syncViews();
  }
  requestRender();
}
$('#mHome').addEventListener('click', () => showStart(true));
$('#msGo').addEventListener('click', () => {
  showStart(false);
  goView('sonnenuhr');
  syncViews();
  gesture('sonnenuhr', true);
});
$('#msSteps').addEventListener('click', () => stepsGo(0));
const openDesk = on => {
  desk.hidden = !on;
  if (on) $('#mdBack').focus();
};
$('#mpMore').addEventListener('click', () => openDesk(true));
for (const b of document.querySelectorAll('.mdgo'))
  b.addEventListener('click', () => {
    const v = b.dataset.go,
      xb = $('#mvExtra');
    openDesk(false);
    if (ms.i !== null) stepsEnd();
    showStart(false);
    setPlaying(false);
    $('#nowBtn').click(); // heute, jetzt – zum Vergleich mit dem Blick vor Ort
    goView(v);
    gesture(v);
    xb.dataset.mv = v;
    xb.hidden = false;
    syncViews();
  });
$('#msDesk').addEventListener('click', () => openDesk(true));
$('#mdBack').addEventListener('click', () => openDesk(false));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !desk.hidden) openDesk(false);
});
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
/* ---------------- Vollbild (ohne Adress- und Navigationsleiste des Browsers) ---------------- */

// Android-Browser erlauben das für Webseiten, Safari auf dem iPhone nicht – dort bleibt der Knopf ausgeblendet
// (als App vom Startbildschirm geöffnet, fehlen die Leisten ohnehin).
{
  const fs = $('#mFs'),
    de = document.documentElement,
    can = !!(document.fullscreenEnabled && de.requestFullscreen),
    sync = () => {
      const on = !!document.fullscreenElement;
      fs.setAttribute('aria-pressed', String(on));
      fs.classList.toggle('on', on);
    };
  fs.hidden = !can;
  fs.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else de.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  });
  document.addEventListener('fullscreenchange', sync);
}

/* ---------------- Umschalten zwischen Handy und Desktop ---------------- */

const homes = [];
export function applyPhone() {
  const m = PHONE.matches;
  if (m === isPhone() && homes.length > 0 === m) return;
  body.classList.toggle('mobile', m);
  $('#mtop').hidden = $('#mviews').hidden = !m;
  if (m) {
    if (tour.i !== null) tourEnd();
    if (quiz.i !== null) quizEnd();
    setFree(false);
    openCard(null);
    for (const el of [$('.timebar'), $('#langSeg')]) homes.push([el, el.parentNode, el.nextSibling]);
    $('#mpTime').appendChild($('.timebar'));
    $('#mtop').appendChild($('#langSeg'));
    if (start.hidden) panel.hidden = false;
  } else {
    for (const [el, p, n] of homes.reverse()) p.insertBefore(el, n);
    homes.length = 0;
    if (ms.i !== null) stepsEnd();
    panel.hidden = start.hidden = desk.hidden = true;
  }
  // die Bühne (und damit das Bild) endet über der Anzeige: Größe der Anzeige als CSS-Variable
  sizeVars();
  if (state.view) goView(state.pano ? 'himmel' : state.view, true); // beim Laden setzt app.js die Ansicht
  requestRender();
}
function sizeVars() {
  const r = document.documentElement.style,
    m = isPhone(),
    land = LAND.matches,
    el = !start.hidden ? start : panel;
  r.setProperty('--mph', m && !land ? Math.ceil(el.offsetHeight) + 'px' : '0px');
  r.setProperty('--mpw', m && land ? Math.ceil(el.offsetWidth) + 'px' : '0px');
}
new ResizeObserver(sizeVars).observe(panel);
new ResizeObserver(sizeVars).observe(start);
PHONE.addEventListener('change', applyPhone);
LAND.addEventListener('change', sizeVars);
applyPhone();
