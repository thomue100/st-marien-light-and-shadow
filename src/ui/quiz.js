// Quiz: fünf Aufgaben, die man im Modell löst.
import './experiments.js'; // Aufbau-Reihenfolge: nach ui/experiments
import { berlinNow, berlinOffsetMin, eclipseScan, localToUtc, sunPos, trueNoon } from '../astro/index.js';
import { $ } from '../core/util.js';
import { fmtT, LANG, tr } from '../core/i18n.js';
import { state } from '../state.js';
import { camera, cutPlane, renderer } from '../scene/renderer.js';
import { occluders, windows } from '../model/geometry.js';
import { dayOfYear, sd } from '../model/sundial.js';
import { rc } from '../light/windows.js';
import { goView } from '../scene/camera.js';
import { eclWhen, setDate, setMinutes, setPlaying, updateEclText } from './controls.js';
import { yearStop, yr } from './year.js';
import { menuOpen, openCard } from './panels.js';
import { CK_MON, CK_MON_EN } from './clockcard.js';
import { tour, tourEnd, tourGo } from './tour.js';

/* ---------------- Quiz: fünf Aufgaben, die man im Modell löst ---------------- */
// Arten: set = Zustand einstellen, das Modell prüft laufend; mc = ablesen und wählen; pick = Fenster antippen
export const fmtDateL = ms => {
  const l = new Date(ms + berlinOffsetMin(ms) * 60000);
  return LANG === 'en'
    ? l.getUTCDate() + ' ' + CK_MON_EN[l.getUTCMonth()] + ' ' + l.getUTCFullYear()
    : l.getUTCDate() + '. ' + CK_MON[l.getUTCMonth()] + ' ' + l.getUTCFullYear();
};
const QZ = [
  {
    kind: 'set',
    view: 'aussen',
    min: 13 * 60,
    q: () => [
      tr('Die Kirche als Sonnenuhr', 'The church as a sundial'),
      tr(
        'Stellen Sie unten das Datum so ein, dass der Schatten der Türme um 13 Uhr am kürzesten ist.',
        'Use the date below to find the day on which the towers’ shadow at 1 pm is shortest.',
      ),
    ],
    hint: () => {
      goView('aussen');
      return tr(
        'Die Sonne steht mittags am höchsten, wenn der Sommer beginnt. Unter »Besondere Tage« finden Sie den Sommeranfang.',
        'The midday sun is highest at the start of summer. »Special days« lists the summer solstice.',
      );
    },
    check: () => !state.playing && Math.abs(dayOfYear() - 171) <= 10,
    solve: () => setDate(state.y, 5, 21),
    ok: () =>
      tr(
        'Richtig: um den 21. Juni steht die Sonne mittags gut 59° hoch, der 125 m hohe Turm wirft dann nur rund 73 m Schatten. Am 21. Dezember sind es bei knapp 13° Sonnenhöhe über 550 m. So zeigt die ganze Kirche mit ihrem Schatten Tageszeit und Jahreszeit an.',
        'Correct: around 21 June the midday sun stands about 59° high and the 125 m tower casts only about 73 m of shadow. On 21 December, at barely 13°, it is more than 550 m. With its shadow the whole church shows the time of day and the season.',
      ),
  },
  {
    kind: 'mc',
    view: 'sonnenuhr',
    q: () => [
      tr('Die Sonnenuhr', 'The sundial'),
      tr(
        'Fliegen Sie zur Sonnenuhr am Südturm. Welche Jahreszahl steht auf der Platte?',
        'Fly to the sundial on the south tower. Which year is written on the plate?',
      ),
    ],
    opts: () => [
      ['1561', 0],
      ['1968', 1],
      ['2002', 0],
    ],
    hint: () => {
      goView('sonnenuhr');
      return tr('Schauen Sie in die obere rechte Ecke der Platte.', 'Look at the upper right corner of the plate.');
    },
    ok: () =>
      tr(
        'Richtig: rechts oben steht 1968, links »REN« – wahrscheinlich für »renoviert«. Die Zahl nennt also eine Erneuerung, nicht das Alter der Sonnenuhr.',
        'Correct: 1968 is at the top right, »REN« at the top left – probably for »renovated«. So the year marks a renewal, not the age of the sundial.',
      ),
    no: () =>
      tr(
        'Nicht ganz. Schauen Sie noch einmal genau auf die Platte, oben rechts.',
        'Not quite. Have another close look at the plate, top right.',
      ),
  },
  {
    kind: 'set',
    view: 'sonnenuhr',
    min: 11 * 60,
    m: 4,
    d: 10,
    card: 'sd',
    q: () => [
      tr('Wahre Zeit und Uhrzeit', 'True time and clock time'),
      tr(
        'Es ist der 10. Mai. Stellen Sie die Uhrzeit so ein, dass der Schatten auf der Sonnenuhr genau 12 Uhr zeigt.',
        'It is 10 May. Set the time so that the shadow on the sundial shows exactly 12 o’clock.',
      ),
    ],
    hint: () => {
      goView('sonnenuhr');
      if (matchMedia('(min-width: 900px)').matches) openCard('sd');
      return tr(
        'Ziehen Sie den Zeitregler langsam; die Karte »Sonnenuhr« zeigt die Ablesung in Minuten.',
        'Move the time slider slowly; the »Sundial« card shows the reading to the minute.',
      );
    },
    check: () => !state.playing && sd.show !== null && sd.lit && Math.abs(sd.show - 12) <= 5 / 60,
    solve: () => {
      let m = state.minutes;
      for (let k = 0; k < 3; k++) {
        const p = sunPos(localToUtc(state.y, state.m, state.d, m)),
          w = (((12 + p.H / 15) % 24) + 24) % 24;
        m += (12 - w) * 60;
      }
      setMinutes(Math.round(m));
      $('#time').value = String(Math.round(m));
    },
    ok: () => {
      const off = berlinOffsetMin(localToUtc(state.y, state.m, state.d, state.minutes)),
        when = fmtT(state.minutes);
      return tr(
        'Richtig: die Sonnenuhr zeigt 12 Uhr, Ihre Armbanduhr aber schon ' +
          when +
          ' Uhr. Die Sonnenuhr richtet sich nach der Sonne: 12 Uhr ist, wenn die Sonne genau im Süden steht. Unsere Uhren richten sich dagegen nach dem Sonnenstand in Görlitz an der polnischen Grenze. Lübeck liegt weiter westlich, deshalb steht die Sonne hier erst etwa eine Viertelstunde später im Süden' +
          (off === 120 ? ' – und im Sommer kommt noch eine Stunde Sommerzeit dazu.' : '.'),
        'Correct: the sundial shows 12 o’clock, but your watch already says ' +
          when +
          '. The sundial follows the sun: 12 o’clock is when the sun stands due south. Our clocks, however, follow the position of the sun at Görlitz on the Polish border. Lübeck lies further west, so the sun reaches due south here about a quarter of an hour later' +
          (off === 120 ? ' – and in summer there is an extra hour of daylight saving time.' : '.'),
      );
    },
  },
  {
    kind: 'mc',
    view: 'uhr',
    ecl: true,
    today: true,
    q: () => [
      tr('Finsternisse', 'Eclipses'),
      tr(
        'Von heute an gerechnet: Wann ist die nächste Sonnenfinsternis, die man in Lübeck sehen kann?',
        'Counting from today: when is the next solar eclipse that can be seen from Lübeck?',
      ),
    ],
    opts: () => {
      const e = quiz.ecl;
      return [
        [fmtDateL(e.s.max), 1],
        [fmtDateL(e.l.max), 0],
        [fmtDateL(e.s2.max), 0],
      ];
    },
    hint: () => {
      qzToday();
      openCard('moon');
      setTimeout(updateEclText, 0);
      return tr(
        'Die Karte »Mond« nennt die nächsten Finsternisse; unter »Besondere Tage« springen Sie direkt hin.',
        'The »Moon« card lists the next eclipses; »Special days« takes you straight there.',
      );
    },
    ok: () => {
      const e = quiz.ecl.s,
        l = fmtDateL(quiz.ecl.l.max),
        s2 = fmtDateL(quiz.ecl.s2.max);
      return (
        tr('Richtig: ', 'Correct: ') +
        eclWhen(e.max) +
        tr(
          ', die Sonne ist dann zu ' +
            Math.round(e.cover * 100) +
            ' % bedeckt. Am ' +
            l +
            ' ist eine Mondfinsternis, am ' +
            s2 +
            ' die übernächste Sonnenfinsternis. Die Kalenderscheibe der Astronomischen Uhr verzeichnet für jedes Jahr die Finsternisse.',
          ', when ' +
            Math.round(e.cover * 100) +
            ' % of the sun will be covered. ' +
            l +
            ' is a lunar eclipse, ' +
            s2 +
            ' the solar eclipse after that. The calendar disc of the astronomical clock lists the eclipses of every year.',
        )
      );
    },
    no: () =>
      tr(
        'Nicht ganz – vielleicht eine Mondfinsternis oder eine spätere? Die Karte »Mond« hilft.',
        'Not quite – perhaps a lunar eclipse or a later one? The »Moon« card helps.',
      ),
  },
  {
    kind: 'pick',
    view: 'schiff',
    q: () => [
      tr('Ein Fenster mit Totenkopf', 'A window with a skull'),
      tr(
        'Eines der Fenster zeigt einen Totenkopf. Suchen Sie es und tippen Sie darauf.',
        'One of the windows shows a skull. Find it and tap it.',
      ),
    ],
    hint: () => {
      goView('totenkopf');
      return tr(
        'Suchen Sie in der Totentanzkapelle, über einer Tür.',
        'Look in the Dance of Death chapel, above a door.',
      );
    },
    test: w => w.type === 4,
    solve: () => goView('totenkopf'),
    near: w =>
      w.type === 1 || w.type === 6
        ? tr(
            'Das sind die großen Totentanzfenster von Alfred Mahlau – ganz nah dran. Gesucht ist ein kleineres Fenster.',
            'These are Alfred Mahlau’s large Dance of Death windows – very close. You are looking for a smaller one.',
          )
        : tr('Dieses Fenster ist es nicht.', 'Not this window.'),
    ok: () =>
      tr(
        'Richtig: das Oberlicht über dem Nordportal der Totentanzkapelle hat Markus Lüpertz 2002 gestaltet. Es liegt auf der Nordseite – direkte Sonne erreicht es nur an Sommerabenden in sehr flachem Winkel, sonst leuchtet es im Himmelslicht.',
        'Correct: Markus Lüpertz designed the light above the north portal of the Dance of Death chapel in 2002. It faces north – direct sun reaches it only at a very flat angle on summer evenings; otherwise it glows in skylight.',
      ),
  },
];
export const quiz = { i: null, score: 0, done: [], t0: 0, state: 'ask', fb: null, order: null, timer: null };
export function quizStart() {
  if (tour.i !== null) tourEnd();
  if (state.playing) setPlaying(false);
  if (yr.on) {
    yearStop();
    state.speed = 30;
    $('#speed').value = '30';
  }
  openCard(null);
  const n = berlinNow(),
    t = Date.UTC(n.y, n.m, n.d),
    s = eclipseScan(t, 1, 's')[0],
    s2 = s ? eclipseScan(s.max + 864e5, 1, 's')[0] : null,
    l = eclipseScan(t, 60, 'l').find(e => e.visible && e.type !== 'penumbral' && e.max >= t);
  quiz.ecl = s && s2 && l ? { s, s2, l } : null;
  quiz.list = QZ.filter(q => !q.ecl || quiz.ecl);
  quiz.score = 0;
  quiz.done = [];
  document.body.classList.add('quizzing');
  qzGo(0);
}
// Finsternis-Aufgabe: Modell auf heute stellen, damit Karte »Mond« und »Besondere Tage« dieselbe Finsternis nennen wie die Antworten
function qzToday() {
  if (state.playing) setPlaying(false);
  const n = berlinNow();
  state.minutes = n.minutes;
  setDate(n.y, n.m, n.d);
  qzDay();
}
// Quiz bei Tageslicht: steht die Sonne zur eingestellten Zeit tiefer als 8°, auf den wahren Mittag stellen (sonst ist das Modell dunkel)
function qzDay() {
  const s = sunPos(localToUtc(state.y, state.m, state.d, state.minutes));
  if (s.el >= 8) return;
  const m = Math.round(trueNoon(state.y, state.m, state.d));
  setMinutes(m);
  $('#time').value = String(m);
}
function qzSetup(q) {
  const n = berlinNow();
  if (state.playing) setPlaying(false);
  if (q.today) qzToday();
  if (q.min !== undefined) {
    state.minutes = q.min;
    setDate(n.y, q.m !== undefined ? q.m : n.m, q.d !== undefined ? q.d : n.d);
  } else qzDay();
  if (q.view && state.view !== q.view) goView(q.view);
  openCard(null);
}
function qzGo(i) {
  quiz.i = i;
  quiz.state = 'ask';
  quiz.fb = null;
  quiz.picked = null;
  quiz.t0 = performance.now();
  quiz.order = null;
  $('#qzHint').classList.remove('hot');
  if (i < quiz.list.length) qzSetup(quiz.list[i]);
  qzRender();
  const f = i < quiz.list.length ? $('#qzHint') : $('#qzNext');
  f.focus({ preventScroll: true });
}
export function qzRender() {
  const el = $('#quiz'),
    i = quiz.i,
    N = quiz.list.length;
  el.hidden = false;
  const opts = $('#qzOpts'),
    fb = $('#qzFb');
  opts.innerHTML = '';
  $('#qzEnd').textContent = tr('Beenden', 'End');
  if (i >= N) {
    const k = quiz.score,
      t =
        k === N
          ? tr('Sonnenuhr-Meister', 'Sundial master')
          : k >= N - 2
            ? tr('Sonnenuhr-Kenner', 'Sundial expert')
            : tr('Entdecker', 'Explorer');
    $('#qzStep').textContent = tr('Quiz · Ergebnis', 'Quiz · Result');
    $('#qzTitle').textContent = t + ': ' + k + tr(' von ', ' of ') + N;
    $('#qzText').textContent =
      k === N
        ? tr(
            'Alle Aufgaben gelöst – Sie kennen Sonnenuhr, Uhr und Licht von St. Marien.',
            'All tasks solved – you know the sundial, the clock and the light of St. Mary’s.',
          )
        : tr(
            'Gut gemacht! Übersprungene Aufgaben können Sie jederzeit wiederholen oder im Modell selbst nachspüren.',
            'Well done! You can repeat skipped tasks at any time or explore them yourself in the model.',
          );
    fb.hidden = true;
    $('#qzHint').hidden = $('#qzSkip').hidden = true;
    $('#qzEnd').hidden = true;
    [
      ['free', tr('Selbst entdecken', 'Explore on my own'), 'btn'],
      ['again', tr('Quiz wiederholen', 'Repeat the quiz'), 'chip'],
      ['tour', tr('Rundgang', 'Guided tour'), 'chip'],
    ].forEach(([g, l, c]) => {
      const b = document.createElement('button');
      b.className = c;
      b.textContent = l;
      b.dataset.go = g;
      opts.appendChild(b);
    });
    $('#qzNext').hidden = true;
    return;
  }
  const q = quiz.list[i],
    [ti, tx] = q.q();
  $('#qzStep').textContent =
    tr('Quiz · Aufgabe ', 'Quiz · Task ') +
    (i + 1) +
    tr(' von ', ' of ') +
    N +
    ' · ' +
    quiz.score +
    tr(' gelöst', ' solved');
  $('#qzTitle').textContent = ti;
  $('#qzText').textContent = tx;
  const shown = quiz.state !== 'ask';
  $('#qzHint').hidden = $('#qzSkip').hidden = shown;
  $('#qzEnd').hidden = false;
  $('#qzHint').textContent = tr('Tipp', 'Hint');
  $('#qzSkip').textContent = tr('Überspringen', 'Skip');
  $('#qzNext').hidden = !shown;
  $('#qzNext').textContent = i === N - 1 ? tr('Ergebnis', 'Result') : tr('Weiter', 'Next');
  if (q.kind === 'mc') {
    const o = q.opts(); // Reihenfolge einmal pro Aufgabe mischen, beim Sprachwechsel beibehalten
    if (!quiz.order) {
      quiz.order = o.map((_, k) => k);
      for (let a = o.length - 1; a > 0; a--) {
        const b = Math.floor(Math.random() * (a + 1));
        [quiz.order[a], quiz.order[b]] = [quiz.order[b], quiz.order[a]];
      }
    }
    quiz.order.forEach(k => {
      const op = o[k],
        b = document.createElement('button');
      b.className = 'chip';
      b.textContent = op[0];
      b.dataset.go = 'opt';
      b.dataset.k = k;
      b.dataset.ok = op[1] ? '1' : '0';
      if (shown && op[1]) b.classList.add('ok');
      if (quiz.picked === k) b.classList.add('no');
      b.disabled = shown;
      opts.appendChild(b);
    });
  }
  if (quiz.fb) {
    fb.hidden = false;
    fb.textContent = quiz.fb[1]();
    fb.classList.toggle('no', quiz.fb[0] === 'no');
  } else fb.hidden = true;
}
function qzSolve(ok) {
  const q = quiz.list[quiz.i];
  quiz.state = ok ? 'ok' : 'skip';
  if (ok) {
    quiz.score++;
    quiz.done.push(quiz.i);
  } else if (q.solve) q.solve();
  quiz.fb = ok ? ['ok', q.ok] : ['skip', () => tr('Lösung: ', 'Answer: ') + q.ok().replace(/^(Richtig|Correct): /, '')];
  qzRender();
  $('#qzNext').focus({ preventScroll: true });
}
export function quizEnd() {
  if (quiz.i === null) return;
  quiz.i = null;
  $('#quiz').hidden = true;
  document.body.classList.remove('quizzing');
}
$('#qzOpts').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const g = b.dataset.go;
  if (g === 'opt') {
    if (quiz.state !== 'ask') return;
    if (b.dataset.ok === '1') qzSolve(true);
    else {
      quiz.picked = +b.dataset.k;
      quiz.fb = ['no', quiz.list[quiz.i].no];
      qzRender();
    }
    return;
  }
  if (g === 'free') {
    quizEnd();
    if (state.view !== 'sued') goView('sued');
  } else if (g === 'again') quizStart();
  else if (g === 'tour') {
    quizEnd();
    tourGo(0);
  }
});
$('#qzHint').addEventListener('click', () => {
  const q = quiz.list[quiz.i];
  const h = q.hint();
  quiz.fb = ['hint', () => h];
  $('#qzHint').classList.remove('hot');
  qzRender();
});
$('#qzSkip').addEventListener('click', () => {
  quiz.picked = null;
  qzSolve(false);
});
$('#qzNext').addEventListener('click', () => {
  quiz.picked = null;
  qzGo(quiz.i + 1);
});
$('#qzEnd').addEventListener('click', quizEnd);
$('#quizBtn').addEventListener('click', quizStart);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && quiz.i !== null && !menuOpen() && !document.querySelector('.card:not([hidden])')) quizEnd();
});
// Einstell-Aufgaben laufend prüfen; nach 60 s auf den Tipp hinweisen
setInterval(() => {
  if (quiz.i === null || quiz.i >= quiz.list.length || quiz.state !== 'ask') return;
  const q = quiz.list[quiz.i];
  if (q.kind === 'set' && q.check()) qzSolve(true);
  else if (performance.now() - quiz.t0 > 60000) $('#qzHint').classList.add('hot');
}, 400);
// Fenster antippen: kurzer Tipp ohne Ziehen, Strahl gegen Fensterglas und Mauerwerk
{
  let pd = null;
  const panes = new Map();
  windows.forEach(w => {
    panes.set(w.paneIn, w);
    if (w.paneOut) panes.set(w.paneOut, w);
  });
  renderer.domElement.addEventListener('pointerdown', e => {
    pd = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  // Toleranz: Finger zittern und tippen länger als eine Maus klickt; Strahl in der Mitte und im Kreis um den Tippunkt, ein Fenster knapp hinter Laibung oder Rahmen zählt
  const objs = () => [...panes.keys(), ...occluders];
  function paneAt(x, y, r) {
    const nd = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, (-(y - r.top) / r.height) * 2 + 1);
    rc.setFromCamera(nd, camera);
    const hits = rc.intersectObjects(objs(), false).filter(h => cutPlane.distanceToPoint(h.point) >= 0);
    if (!hits.length) return null;
    const h0 = hits[0];
    for (const h of hits) {
      if (h.distance - h0.distance > 0.8) break;
      const w = panes.get(h.object);
      if (w) return w;
    }
    return null;
  }
  addEventListener('pointerup', e => {
    const p = pd;
    pd = null;
    if (!p || quiz.i === null || quiz.i >= quiz.list.length || quiz.state !== 'ask' || state.pano) return;
    const q = quiz.list[quiz.i];
    if (q.kind !== 'pick') return;
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > (touch ? 24 : 12) || performance.now() - p.t > 1500) return;
    const r = renderer.domElement.getBoundingClientRect(),
      far = rc.far;
    rc.far = 600;
    let w = paneAt(e.clientX, e.clientY, r);
    if (!w) {
      const rad = touch ? 20 : 10,
        found = new Map();
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4,
          x = paneAt(e.clientX + rad * Math.cos(a), e.clientY + rad * Math.sin(a), r);
        if (x) found.set(x, (found.get(x) || 0) + 1);
      }
      for (const [x, n] of found) if (!w || n > found.get(w) || q.test(x)) w = x;
    }
    rc.far = far;
    if (!w) {
      quiz.fb = [
        'no',
        () =>
          tr(
            'Tippen Sie direkt auf ein Fenster. Die Glasbilder sind von innen zu sehen.',
            'Tap directly on a window. The stained glass is visible from inside.',
          ),
      ];
      qzRender();
      return;
    }
    if (q.test(w)) qzSolve(true);
    else {
      quiz.fb = ['no', () => q.near(w)];
      qzRender();
    }
  });
}
