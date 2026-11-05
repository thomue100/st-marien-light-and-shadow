// Ladeanzeige: Fortschrittsbalken während des Aufbaus, Abschluss.
import '../three-global.js';   // zuerst: three.js bereitstellen
import '../data.js';           // Daten (Umgebung, Uhr, Glasmalereien) schon jetzt anfordern

// Ladeanzeige: der Aufbau läuft in Schritten, zwischen denen der Browser die Anzeige aktualisieren kann
export const ldEl=document.getElementById('loader'), ldText=document.getElementById('ldText'), ldBar=document.getElementById('ldBar');
export const ldT0=performance.now();
export async function step(text,pct){ if(ldText) ldText.textContent=text; if(ldBar) ldBar.style.width=pct+'%'; await new Promise(r=>setTimeout(r,20)); }
export function ldDone(){ if(ldEl){ ldEl.classList.add('done'); setTimeout(()=>{ ldEl.hidden=true; },600); } }
