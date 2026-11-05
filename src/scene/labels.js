// Beschriftungen im Modell.
import './camera.js';   // Aufbau-Reihenfolge: nach scene/camera
import { V3 } from '../three-global.js';
import { $ } from '../core/util.js';
import { tr } from '../core/i18n.js';
import { TW } from '../model/measures.js';
import { state } from '../state.js';
import { camera } from './renderer.js';
import { insideJS } from './shaders.js';
import { CLK } from '../model/clock.js';
import { SD, sdX, sdZ } from '../model/sundial.js';

/* ---------------- Beschriftungen ---------------- */

const LABELS=[['Nordturm',[TW.xc,90,-14.2],0,'North tower'],['Südturm',[TW.xc,90,14.4],0,'South tower'],['Mittelschiff',[-8,51,0],0,'Nave'],['Dachreiter',[11.9,81,0],1,'Ridge turret'],['Sonnenuhr',[sdX,SD.y+0.9,sdZ],0,'Sundial'],['Westfenster',[-51.4,24,0],0,'West window'],['Briefkapelle',[-29.6,21,27.4],0,'Briefkapelle'],
  ['Totentanzkapelle',[8.3,31,-26.5],0,'Dance of Death Chapel'],['Südvorhalle',[8.9,31,30.2],0,'South porch'],['Marientidenkapelle',[47,33.5,0],0,'Marientiden Chapel'],['Kapellenkranz',[37.5,28,-12],0,'Chapel ring'],['Gedenkkapelle',[TW.x0-0.5,19,14.4],0,'Memorial Chapel'],['Astronomische Uhr',[CLK.x-0.3,13.2,CLK.z],2,'Astronomical clock']];
const labelLayer=$('#labels');
const labelEls=LABELS.map(([t,p,nc,te])=>{ const el=document.createElement('div'); el.className='lbl'; el.textContent=tr(t,te); labelLayer.appendChild(el); return {el,p:new V3(...p),nc:nc|0,de:t,en:te}; });
export function relabel(){ for(const l of labelEls){ l.el.textContent=tr(l.de,l.en); l.w=0; } }
export function updateLabelsVisibility(){ labelLayer.hidden=!(state.labels&&state.mode==='orbit'); }
const pv=new V3();
export function placeLabels(){
  if(labelLayer.hidden) return;
  if(insideJS(camera.position.x,camera.position.y,camera.position.z)){ for(const l of labelEls) l.el.style.display='none'; return; }   // im Innenraum keine Außenbeschriftungen
  const w=labelLayer.clientWidth, h=labelLayer.clientHeight, capY=state.cut<60?state.cut+1:1e9, boxes=[];
  for(const l of labelEls){ pv.copy(l.p); pv.y=Math.min(pv.y,capY); pv.project(camera);
    if((l.nc===1&&state.cut<60)||(l.nc===2&&state.cut>=60)||pv.z>1||pv.z<-1||Math.abs(pv.x)>1.1||Math.abs(pv.y)>1.1){ l.el.style.display='none'; continue; }
    const x=(pv.x+1)/2*w, y=(1-pv.y)/2*h-8;
    if(!l.w){ l.el.style.display=''; l.w=l.el.offsetWidth||80; l.h=l.el.offsetHeight||18; }
    const b=[x-l.w/2-3,y-l.h-2,x+l.w/2+3,y+2];
    if(boxes.some(o=>b[0]<o[2]&&b[2]>o[0]&&b[1]<o[3]&&b[3]>o[1])){ l.el.style.display='none'; continue; }
    boxes.push(b); l.el.style.display=''; l.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-50%,-100%)'; }
}
