// Geführter Rundgang (8 Stationen).
import { ckFmtDay } from './clockcard.js'; // Aufbau-Reihenfolge: nach ui/clockcard
import { berlinNow, berlinOffsetMin, localToUtc, moonPhaseTime, moonTransitNear, sunPos } from '../astro/index.js';
import { $, lsGet, lsSet } from '../core/util.js';
import { fmtT, LANG, tr, tzN } from '../core/i18n.js';
import { state } from '../state.js';
import { clockUpdate } from '../model/clock.js';
import { goView } from '../scene/camera.js';
import { setDate, setPlaying } from './controls.js';
import { yearStop, yr } from './year.js';
import { introExplore, menuOpen, openCard } from './panels.js';
import { quiz, quizEnd, quizStart } from './quiz.js';

/* ---------------- Geführter Rundgang ---------------- */

// Stationen: Datum (Monat 0-basiert, Jahr = aktuelles), Uhrzeit in Minuten, Ansicht. Station „moon“ sucht die nächste Vollmondnacht.
const TOUR = [
  {
    m: 4,
    d: 10,
    t: 15 * 60,
    v: 'aussen',
    de: [
      'St. Marien zu Lübeck',
      'Willkommen! Das Modell zeigt die Marienkirche und wie Sonne und Mond sie zu jeder Stunde des Jahres beleuchten. Ziehen Sie mit der Maus, um die Kirche zu drehen, mit dem Mausrad zoomen Sie. Unten stellen Sie Datum und Uhrzeit ein.',
    ],
    en: [
      "St. Mary's, Lübeck",
      "Welcome! The model shows St. Mary's Church and how sun and moon light it at any hour of the year. Drag with the mouse to turn the church, use the wheel to zoom. Set date and time in the bar at the bottom.",
    ],
    // Handy: Fingergesten statt Maus
    deT: 'Willkommen! Das Modell zeigt die Marienkirche und wie Sonne und Mond sie zu jeder Stunde des Jahres beleuchten. Ziehen Sie mit einem Finger, um die Kirche zu drehen, mit zwei Fingern verschieben und zoomen Sie. Unten stellen Sie Datum und Uhrzeit ein.',
    enT: "Welcome! The model shows St. Mary's Church and how sun and moon light it at any hour of the year. Drag with one finger to turn the church, use two fingers to move and zoom. Set date and time in the panel at the bottom.",
  },
  {
    m: 4,
    d: 10,
    t: 10 * 60 + 30,
    v: 'sonnenuhr',
    play: 10,
    de: [
      'Die Sonnenuhr',
      'Am Südpfeiler vor der Briefkapelle hängt die Sonnenuhr. Die Zeit läuft jetzt: Sehen Sie, wie der Schatten des Stabes über die Stunden wandert. Sie zeigt die wahre Ortszeit; im Sommer geht unsere Uhr ihr gut eine Stunde voraus.',
    ],
    en: [
      'The sundial',
      'The sundial hangs on the south buttress in front of the Briefkapelle. Time is running now: watch the shadow of the rod move across the hours. It shows apparent solar time; in summer our clocks are more than an hour ahead of it.',
    ],
  },
  {
    m: 5,
    d: 21,
    t: 14 * 60,
    v: 'totentanz',
    de: [
      'Die Totentanzfenster',
      'Die Fenster von Alfred Mahlau in der Totentanzkapelle liegen auf der Nordseite. Direktes Sonnenlicht fällt hier kaum hinein; die Farben leuchten im gleichmäßigen Himmelslicht. Sie erinnern an den Lübecker Totentanz, der 1942 in der Kirche verbrannte.',
    ],
    en: [
      'The Dance of Death windows',
      'Alfred Mahlau’s windows in the Dance of Death Chapel face north. Hardly any direct sunlight reaches them; their colours glow in the even light of the sky. They recall the Lübeck Dance of Death painting that burned in the church in 1942.',
    ],
  },
  {
    m: 5,
    d: 21,
    t: 11 * 60 + 40,
    v: 'uhr',
    play: 10,
    card: 'clock',
    de: [
      'Die Astronomische Uhr',
      'An der Ostwand derselben Kapelle steht die Astronomische Uhr von Paul Behrens, 13,45 Meter hoch. Die Zeit läuft: Der goldene Sonnenzeiger umrundet das 24-Stunden-Zifferblatt einmal am Tag, der Mondzeiger etwas langsamer. Darunter dreht sich die Kalenderscheibe einmal im Jahr.',
    ],
    en: [
      'The astronomical clock',
      "On the east wall of the same chapel stands Paul Behrens' astronomical clock, 13.45 metres tall. Time is running: the golden sun hand circles the 24-hour dial once a day, the moon hand a little slower. Below, the calendar disk turns once a year.",
    ],
  },
  {
    m: 4,
    d: 10,
    t: 17 * 60,
    v: 'dachreiter',
    de: [
      'Auf dem Dachreiter',
      'Ein Blick, wie man ihn sonst nur bei den atemberaubenden Turm- und Gewölbeführungen genießen kann: aus der Laterne des Dachreiters, gut 50 Meter hoch, über das Kupferdach zu den Türmen. Ziehen Sie zum Umsehen; mit W/A/S/D oder den Pfeiltasten gehen Sie in der Laterne umher.',
    ],
    en: [
      'On the ridge turret',
      'A view you can otherwise only enjoy on the breathtaking tower and vault tours: from the lantern of the ridge turret, over 50 metres up, across the copper roof to the towers. Drag to look around; W/A/S/D or the arrow keys walk you around the lantern.',
    ],
    deT: 'Ein Blick, wie man ihn sonst nur bei den atemberaubenden Turm- und Gewölbeführungen genießen kann: aus der Laterne des Dachreiters, gut 50 Meter hoch, über das Kupferdach zu den Türmen. Ziehen Sie zum Umsehen; mit dem Steuerkreis unten links gehen Sie in der Laterne umher.',
    enT: 'A view you can otherwise only enjoy on the breathtaking tower and vault tours: from the lantern of the ridge turret, over 50 metres up, across the copper roof to the towers. Drag to look around; the control pad at the bottom left walks you around the lantern.',
  },
  {
    m: 5,
    d: 21,
    t: 13 * 60,
    v: 'himmel',
    de: [
      'Der Weg von Sonne und Mond',
      'Am längsten Tag des Jahres steigt die Sonne in Lübeck fast 60 Grad hoch und zieht einen weiten Bogen von Nordost nach Nordwest. Gestrichelt sehen Sie den Lauf des Mondes vom Aufgang bis zum Untergang, der Ring zeigt, wo er gerade steht. Die Zahlen sind die Uhrzeiten. Schalten Sie einen Tag weiter: Der Mond geht dann rund 50 Minuten später auf.',
    ],
    en: [
      'The paths of sun and moon',
      'On the longest day the sun climbs almost 60 degrees above Lübeck and sweeps a wide arc from north-east to north-west. The dashed line is the moon’s course from rise to set; the ring shows where it is now. The numbers are clock times. Step one day ahead: the moon then rises about 50 minutes later.',
    ],
  },
  {
    moon: true,
    v: 'aussen',
    de: [
      'Vollmondnacht',
      'Das ist die nächste Vollmondnacht. Auch das Mondlicht fällt durch die Fenster, und sogar die Sonnenuhr wirft dann einen Schatten. Sie zeigt allerdings die »Mondzeit«, die das Modell in wahre Zeit umrechnet.',
    ],
    en: [
      'Full-moon night',
      'This is the next full-moon night. Moonlight falls through the windows too, and even the sundial casts a shadow. It then shows “lunar time”, which the model converts to true time.',
    ],
  },
  {
    v: 'sued',
    now: true,
    choice: true,
    de: [
      'Wie geht es weiter?',
      'Das Modell zeigt wieder den heutigen Tag. Testen Sie Ihr Wissen in einem Quiz mit fünf Aufgaben, die Sie im Modell lösen, probieren Sie Experimente zu Sonne, Sonnenuhr, Licht und Mond aus – oder erkunden Sie selbst: Rechts finden Sie die Bereiche, oben unter „Entdecken“ Quiz und Experimente und daneben weitere Ansichten.',
    ],
    en: [
      'What next?',
      'The model is back at today. Test yourself in a quiz with five tasks you solve in the model, try experiments on sun, sundial, light and moon – or explore on your own: on the right you find the panels, at the top “Explore” holds the quiz and experiments, next to it more views.',
    ],
    deT: 'Das Modell zeigt wieder den heutigen Tag. Testen Sie Ihr Wissen in einem Quiz mit fünf Aufgaben, die Sie im Modell lösen – oder erkunden Sie selbst: Unten im Blatt finden Sie Sonne, Mond, Kirche und mehr, oben weitere Ansichten. Die Experimente machen am Computer oder Tablet am meisten Freude.',
    enT: 'The model is back at today. Test yourself in a quiz with five tasks you solve in the model – or explore on your own: the panel at the bottom holds sun, moon, church and more, at the top you choose more views. The experiments work best on a computer or tablet.',
  },
];
export const tour = { i: null };
function tourApply(s) {
  if (state.playing) setPlaying(false);
  if (yr.on) {
    yearStop();
    $('#speed').value = '30';
    state.speed = 30;
  }
  openCard(null);
  if (s.moon) {
    const nf = moonPhaseTime(Date.now() - 12 * 3600000, 180, 1);
    if (nf !== null) {
      const t = moonTransitNear(nf),
        off = berlinOffsetMin(t),
        l = new Date(t + off * 60000);
      state.minutes = l.getUTCHours() * 60 + l.getUTCMinutes();
      setDate(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
    }
  } else if (s.now) {
    const n = berlinNow();
    const sp = sunPos(localToUtc(n.y, n.m, n.d, n.minutes));
    state.minutes = sp.el > 3 ? n.minutes : 12 * 60 + 30;
    setDate(n.y, n.m, n.d);
  } else {
    state.minutes = s.t;
    setDate(berlinNow().y, s.m, s.d);
  }
  goView(s.v);
  if (s.card && matchMedia('(min-width: 900px)').matches)
    setTimeout(() => {
      if (tour.i !== null && TOUR[tour.i] === s) {
        openCard(s.card);
        clockUpdate(null, true);
      }
    }, 1300);
  if (s.play) {
    state.speed = s.play;
    $('#speed').value = String(s.play);
    setTimeout(() => {
      if (tour.i !== null && TOUR[tour.i] === s) setPlaying(true);
    }, 1300);
  }
}
export function showTour() {
  const el = $('#tour'),
    i = tour.i;
  el.hidden = false;
  el.classList.toggle('welcome', i < 0); // Begrüßung: auf dem Handy als Startseite
  document.body.classList.add('touring');
  if (i < 0) {
    $('#tourStep').textContent = tr('Rundgang', 'Guided tour');
    $('#tourTitle').textContent = tr('Willkommen in St. Marien', "Welcome to St. Mary's");
    $('#tourText').textContent = tr(
      'Möchten Sie einen kurzen Rundgang in acht Stationen machen? Er dauert etwa zwei Minuten.',
      'Would you like a short tour in eight stops? It takes about two minutes.',
    );
    $('#tourEnd').textContent = tr('Selbst erkunden', 'Explore on my own');
    $('#tourPrev').hidden = true;
    $('#tourNext').textContent = tr('Rundgang starten', 'Start the tour');
    tourChoice([
      ['tour', tr('Rundgang starten', 'Start the tour')],
      ['quiz', tr('Quiz: 5 Aufgaben', 'Quiz: 5 tasks')],
      ['free', tr('Selbst erkunden', 'Explore on my own')],
    ]);
    return;
  }
  const s = TOUR[i],
    txt = LANG === 'en' ? s.en : s.de,
    touch = document.body.classList.contains('mobile');
  $('#tourStep').textContent = tr('Station ', 'Stop ') + (i + 1) + tr(' von ', ' of ') + TOUR.length;
  $('#tourTitle').textContent = txt[0];
  $('#tourText').textContent = (touch && (LANG === 'en' ? s.enT : s.deT)) || txt[1];
  $('#tourEnd').textContent = tr('Beenden', 'End');
  $('#tourPrev').hidden = i === 0;
  $('#tourPrev').textContent = tr('Zurück', 'Back');
  $('#tourNext').textContent = i === TOUR.length - 1 ? tr('Fertig', 'Done') : tr('Weiter', 'Next');
  tourChoice(
    s.choice
      ? [
          ['quiz', tr('Quiz starten', 'Start the quiz')],
          ['exp', tr('Experimente', 'Experiments')],
          ['free', tr('Selbst entdecken', 'Explore on my own')],
          ['tour', tr('Rundgang wiederholen', 'Repeat the tour')],
        ]
      : null,
  );
  tourWhen();
  tourFit();
}
// Wahl statt Weiter: am Anfang (Willkommen) und an der letzten Station
function tourChoice(list) {
  const c = $('#tourChoice'),
    bt = $('#tour .tbtns');
  c.hidden = !list;
  $('#tourEnd').hidden = $('#tourNext').hidden = !!list;
  bt.style.display = list && $('#tourPrev').hidden ? 'none' : '';
  if (!list) return;
  c.querySelectorAll('button').forEach((b, k) => {
    b.hidden = !list[k];
    if (!list[k]) return;
    b.dataset.go = list[k][0];
    b.textContent = list[k][1];
  });
}
$('#tourChoice').addEventListener('click', e => {
  const g = e.target.closest('button') && e.target.closest('button').dataset.go;
  if (!g) return;
  lsSet('stm-welcomed', '1');
  if (g === 'tour') tourGo(0);
  else if (g === 'quiz') {
    tourEnd();
    quizStart();
  } else if (g === 'exp') {
    tourEnd();
    document.querySelectorAll('.exppanel').forEach(p => (p.hidden = true));
    $('#expList').hidden = false;
    openCard('exp');
  } else {
    tourEnd();
    if (state.view !== 'sued') goView('sued');
  }
});
// Datum und Uhrzeit der Station in der Kopfzeile (auf dem Smartphone ist die Zeitleiste während des Rundgangs ausgeblendet)
export function tourWhen() {
  const w = $('#tourWhen');
  if (!w) return;
  w.textContent =
    tour.i !== null && tour.i >= 0
      ? ' · ' +
        ckFmtDay(state.d, state.m) +
        ' · ' +
        fmtT(state.minutes) +
        ' ' +
        tzN(berlinOffsetMin(localToUtc(state.y, state.m, state.d, state.minutes)))
      : '';
}
// „mehr“ nur zeigen, wenn der Text gekürzt ist
function tourFit() {
  const c = $('#tour'),
    t = $('#tourText'),
    b = $('#tourMore');
  if (!c || c.hidden) return;
  c.classList.remove('open');
  b.textContent = tr('mehr', 'more');
  requestAnimationFrame(() => {
    b.hidden = !(t.scrollHeight > t.clientHeight + 2);
  });
}
$('#tourMore').addEventListener('click', () => {
  const c = $('#tour'),
    o = c.classList.toggle('open');
  $('#tourMore').textContent = o ? tr('weniger', 'less') : tr('mehr', 'more');
});
addEventListener('resize', () => {
  if (tour.i !== null) tourFit();
});
export function tourGo(i) {
  tour.i = i;
  showTour();
  if (i >= 0) tourApply(TOUR[i]);
  $('#tourNext').focus({ preventScroll: true });
}
export function tourEnd() {
  if (state.playing && tour.i !== null && tour.i >= 0) setPlaying(false);
  if (tour.i !== null && tour.i >= 0) {
    state.speed = 30;
    $('#speed').value = '30';
  }
  tour.i = null;
  $('#tour').hidden = true;
  document.body.classList.remove('touring');
  lsSet('stm-welcomed', '1');
  if (!quiz || quiz.i === null) setTimeout(introExplore, 400);
}
$('#tourNext').addEventListener('click', () => {
  if (tour.i === TOUR.length - 1) tourEnd();
  else {
    lsSet('stm-welcomed', '1');
    tourGo(tour.i + 1);
  }
});
$('#tourPrev').addEventListener('click', () => {
  if (tour.i > 0) tourGo(tour.i - 1);
});
$('#tourEnd').addEventListener('click', tourEnd);
$('#tourBtn').addEventListener('click', () => {
  if (quiz.i !== null) quizEnd();
  tourGo(0);
});
$('#homeBtn').addEventListener('click', () => {
  if (tour.i !== null) tourEnd();
  if (quiz.i !== null) quizEnd();
  if (state.playing) setPlaying(false);
  yearStop();
  state.speed = 30;
  $('#speed').value = '30';
  openCard(null);
  const n = berlinNow(),
    sp = sunPos(localToUtc(n.y, n.m, n.d, n.minutes));
  state.minutes = sp.el > 3 ? n.minutes : 12 * 60 + 30;
  setDate(n.y, n.m, n.d);
  goView('sued');
  if (document.body.classList.contains('mobile')) tourGo(-1); // Handy: zurück zur Startseite
});
{
  // Handy: Stationen seitlich wischen
  const card = $('#tour');
  let x0 = null,
    y0 = 0;
  card.addEventListener('pointerdown', e => {
    x0 = e.clientX;
    y0 = e.clientY;
  });
  card.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0,
      dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy) || tour.i === null || tour.i < 0) return;
    if (dx < 0 && !$('#tourNext').hidden) $('#tourNext').click();
    else if (dx > 0 && !$('#tourPrev').hidden) $('#tourPrev').click();
  });
}
// Zeitleiste: Tagesdiagramm auf kleinen Bildschirmen auf- und zuklappen
function setTbOpen(o) {
  document.body.classList.toggle('tbopen', o);
  const b = $('#tbFold');
  b.setAttribute('aria-expanded', String(o));
  b.setAttribute(
    'aria-label',
    o
      ? tr('Weitere Zeiteinstellungen ausblenden', 'Hide more time settings')
      : tr('Weitere Zeiteinstellungen: Tempo, besondere Tage, Jetzt', 'More time settings: speed, special days, now'),
  );
  lsSet('stm-tbopen', o ? '1' : '0');
}
$('#tbFold').addEventListener('click', () => setTbOpen(!document.body.classList.contains('tbopen')));
if (lsGet('stm-tbopen') === '1') document.body.classList.add('tbopen');
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && tour.i !== null && !menuOpen()) tourEnd();
});
