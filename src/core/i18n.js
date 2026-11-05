// Sprache (Deutsch/Englisch): aktuelle Sprache, Übersetzen, Zahlen- und Zeitformat.
import { HASHQ, lsGet } from './util.js';   // Aufbau-Reihenfolge: nach core/util
import { ldText } from './loader.js';

export let LANG=((HASHQ.get('l')||lsGet('stm-lang')||((navigator.language||'de').toLowerCase().startsWith('de')?'de':'en'))==='en')?'en':'de';
export const tr=(de,en)=>LANG==='en'?en:de;
export const dc=s=>LANG==='en'?String(s):String(s).replace('.',',');   // Dezimalzeichen
export const tzN=off=>off===120?tr('MESZ','CEST'):tr('MEZ','CET');
export function applyStaticLang(){
  document.documentElement.lang=LANG;
  document.querySelectorAll('[data-en]').forEach(el=>{ if(el.dataset.de===undefined) el.dataset.de=el.textContent; el.textContent=LANG==='en'?el.dataset.en:el.dataset.de; });
  document.querySelectorAll('[data-en-aria]').forEach(el=>{ if(el.dataset.deAria===undefined) el.dataset.deAria=el.getAttribute('aria-label')||''; el.setAttribute('aria-label',LANG==='en'?el.dataset.enAria:el.dataset.deAria); });
  document.querySelectorAll('[data-en-title]').forEach(el=>{ if(el.dataset.deTitle===undefined) el.dataset.deTitle=el.getAttribute('title')||''; el.setAttribute('title',LANG==='en'?el.dataset.enTitle:el.dataset.deTitle); });
  const lb=document.getElementById('langBtn'); if(lb){ lb.textContent=LANG==='en'?'DE':'EN'; lb.setAttribute('lang',LANG==='en'?'de':'en'); }
  document.title=tr('St. Marien – Licht und Schatten',"St. Mary's – Light and Shadow");
}
applyStaticLang();
if(ldText) ldText.textContent=tr('3D-Bibliothek wird geladen','Loading 3D library');
export function moonPhaseName(e){ const N=LANG==='en'?['new moon','waxing crescent','first quarter','waxing gibbous','full moon','waning gibbous','last quarter','waning crescent']:['Neumond','zunehmende Sichel','Erstes Viertel','zunehmender Mond','Vollmond','abnehmender Mond','Letztes Viertel','abnehmende Sichel'];
  return N[e<8||e>=352?0:e<82?1:e<98?2:e<172?3:e<188?4:e<262?5:e<278?6:7]; }

export const pad2=n=>String(n).padStart(2,'0');
export const fmtT=m=>{ m=((Math.round(m)%1440)+1440)%1440; return pad2(Math.floor(m/60))+':'+pad2(m%60); };
export const fmtDeg=v=>dc(v.toFixed(1))+'°';
export function setLang(l){ LANG=l; }   // Sprache wechseln (andere Module dürfen LANG nicht direkt zuweisen)
