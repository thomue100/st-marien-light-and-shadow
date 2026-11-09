// Ladeanzeige: Fortschrittsbalken während des Aufbaus, Abschluss.
import '../three-global.js'; // zuerst: three.js bereitstellen
import { PHONE } from '../data.js'; // Daten (Umgebung, Uhr, Glasmalereien) schon jetzt anfordern

// Ladeanzeige: der Aufbau läuft in Schritten, zwischen denen der Browser die Anzeige aktualisieren kann
export const ldEl = document.getElementById('loader'),
  ldText = document.getElementById('ldText'),
  ldBar = document.getElementById('ldBar');
export const ldT0 = performance.now();
// Handy ohne Link: die Startseite schon während des Aufbaus zeigen – man kann lesen, während das Modell entsteht;
// die Knöpfe werden erst danach freigegeben (ldDone), die Ladeanzeige steht darüber im Bildbereich
const early = PHONE.matches && !location.hash ? document.getElementById('mstart') : null;
if (early) {
  document.body.classList.add('mearly');
  early.hidden = false;
  for (const b of early.querySelectorAll('button')) b.disabled = true;
}
export async function step(text, pct) {
  if (ldText) ldText.textContent = text;
  if (ldBar) ldBar.style.width = pct + '%';
  await new Promise(r => setTimeout(r, 20));
}
export function ldDone() {
  if (early) {
    document.body.classList.remove('mearly');
    for (const b of early.querySelectorAll('button')) b.disabled = false;
  }
  if (ldEl) {
    ldEl.classList.add('done');
    setTimeout(() => {
      ldEl.hidden = true;
    }, 600);
  }
}
