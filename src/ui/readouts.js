// Anzeigen: Tagesdaten (Sonne, Mond), Tagesdiagramm, Kompass, Werte der Karten Sonne und Mond.
import '../scene/labels.js';   // Aufbau-Reihenfolge: nach scene/labels
import { berlinOffsetMin, dstInfo, localToUtc, moonPhaseTime, moonPos, moonRiseSet, rad, sunDay } from '../astro/index.js';
import { $, clamp01 } from '../core/util.js';
import { dc, fmtDeg, fmtT, LANG, moonPhaseName, pad2, tr, tzN } from '../core/i18n.js';
import { cur, state } from '../state.js';
import { windows } from '../model/geometry.js';
import { drawYearChart, moonAge } from '../model/sundial.js';
import { buildSunPath } from '../light/sky.js';
import { litCount } from '../light/windows.js';
import { eclL, eclObsc, eclS, moonCur, moonStr, useMoon } from '../light/sun.js';
import { drawPanoGrid } from '../scene/camera.js';
import { setMinutes, updateEclText } from './controls.js';
import { tour, tourWhen } from './tour.js';
import { expTick } from './experiments.js';
import { updateShare } from './share.js';

/* ---------------- UI ---------------- */

const DIRS_DE=['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'], DIRS_EN=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export const dirName=az=>(LANG==='en'?DIRS_EN:DIRS_DE)[Math.round(az/22.5)%16];
export let day={curve:[],rise:null,set:null,maxEl:0,maxT:0,mcurve:[],mrise:null,mset:null,nm0:null,nm1:null,nextFull:null,nextNew:null};
export function computeDay(){
  const {c,rise,set,maxEl,maxT}=sunDay(state.y,state.m,state.d);
  const t0=localToUtc(state.y,state.m,state.d,0), t1=localToUtc(state.y,state.m,state.d,1440), mc=[];
  for(let mi=0;mi<=1440;mi+=10) mc.push(moonPos(localToUtc(state.y,state.m,state.d,mi)));
  const mrs=moonRiseSet(t0,t1), nm1=moonPhaseTime(t1,0,-1), nm0=nm1?moonPhaseTime(nm1-3600000,0,-1):null;
  day={curve:c,rise,set,maxEl,maxT,mcurve:mc,mrise:mrs.rise!==null?(mrs.rise-t0)/60000:null,mset:mrs.set!==null?(mrs.set-t0)/60000:null,
       nm0,nm1,nextFull:moonPhaseTime(t0,180,1),nextNew:moonPhaseTime(t0,0,1)};
  drawChart(); drawCompassStatic(); buildSunPath(); drawYearChart(); if(state.pano) drawPanoGrid();
}
const svgNS='http://www.w3.org/2000/svg';
export const chart=$('#chart');
export let CHW=600; const CHH=48;
const CX=t=>4+t/1440*(CHW-8), CY=el=>3+(66-el)/(66+18)*(CHH-14);
export function drawChart(){
  CHW=Math.max(200,Math.round(chart.clientWidth||600)); chart.setAttribute('viewBox','0 0 '+CHW+' '+CHH);
  let s='';
  for(let hh=0;hh<=24;hh+=3){ const x=CX(hh*60); s+='<line class="grid" x1="'+x+'" y1="2" x2="'+x+'" y2="'+(CHH-12)+'"/>'+(hh%6===0?'<text x="'+Math.min(CHW-12,Math.max(2,x-4))+'" y="'+(CHH-2)+'">'+hh+'</text>':''); }
  s+='<line class="hz" x1="'+CX(0)+'" y1="'+CY(0)+'" x2="'+CX(1440)+'" y2="'+CY(0)+'"/>';
  const pts=day.curve.map((p,i)=>CX(i*5).toFixed(1)+','+CY(Math.max(-18,p.el)).toFixed(1));
  const area=day.curve.map((p,i)=>CX(i*5).toFixed(1)+','+CY(Math.max(0,p.el)).toFixed(1));
  s+='<polygon class="area" points="'+CX(0)+','+CY(0)+' '+area.join(' ')+' '+CX(1440)+','+CY(0)+'"/>';
  s+='<polyline class="curve" points="'+pts.join(' ')+'"/>';
  if(state.moon&&day.mcurve.length) s+='<polyline class="mcurve" points="'+day.mcurve.map((p,i)=>CX(i*10).toFixed(1)+','+CY(Math.max(-18,p.el)).toFixed(1)).join(' ')+'"/>';
  s+='<line class="now" id="cNow" x1="0" y1="1" x2="0" y2="'+(CHH-12)+'"/><circle class="mdot" id="cMoon" r="2.8"/><circle class="dot" id="cDot" r="3.4"/>';
  chart.innerHTML=s;
}
function chartTime(e){ const r=chart.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width*CHW; setMinutes(clamp01((x-4)/(CHW-8))*1439); }
chart.addEventListener('pointerdown',e=>{ chart.setPointerCapture(e.pointerId); chartTime(e); });
chart.addEventListener('pointermove',e=>{ if(e.buttons) chartTime(e); });
const compass=$('#compass');
export function drawCompassStatic(){
  let s='<circle class="ring" r="44"/><circle class="ring2" r="29.3"/><circle class="ring2" r="14.7"/>';
  s+='<text y="-47.5">N</text><text x="47.5">'+tr('O','E')+'</text><text y="47.5">S</text><text x="-47.5">W</text>';
  s+='<g transform="rotate('+(state.axis-90)+')"><path class="church" d="M-27,-2.6 h7.6 v-3.4 h-7.6 z M-27,2.6 h7.6 v3.4 h-7.6 z M-20,-8 H12 A8,8 0 0 1 12,8 H-20 Z M14,-3 h4 l2,3 l-2,3 h-4 z"/></g>';
  const pts=[]; day.curve.forEach(p=>{ if(p.el>=0){ const r=44*(90-p.el)/90; pts.push((r*Math.sin(p.az*rad)).toFixed(1)+','+(-r*Math.cos(p.az*rad)).toFixed(1)); } });
  if(pts.length>1) s+='<polyline class="path" points="'+pts.join(' ')+'"/>';
  if(state.moon){ const mp=[]; day.mcurve.forEach(p=>{ if(p.el>=0){ const r=44*(90-p.el)/90; mp.push((r*Math.sin(p.az*rad)).toFixed(1)+','+(-r*Math.cos(p.az*rad)).toFixed(1)); } });
    if(mp.length>1) s+='<polyline class="mpath" points="'+mp.join(' ')+'"/>'; }
  s+='<line class="ray" id="kRay" x1="0" y1="0" x2="0" y2="0"/><circle class="moon" id="kMoon" r="3.4"/><circle class="sun" id="kSun" r="4"/>';
  compass.innerHTML=s;
}
export function updateReadouts(){
  const di=dstInfo(state.y,state.m,state.d,state.minutes), tzName=tzN(di.off);
  $('#timeOut').textContent=fmtT(di.loc); $('#tzName').textContent=tzName;   // angezeigt wird die tatsächliche Ortszeit des berechneten Zeitpunkts
  $('#time').value=Math.round(state.minutes);
  $('#rEl').textContent=fmtDeg(cur.el);
  $('#rAz').textContent=fmtDeg(cur.az)+' '+dirName(cur.az);
  $('#rRise').textContent=day.rise!==null?fmtT(day.rise):'–';
  $('#rSet').textContent=day.set!==null?fmtT(day.set):'–';
  $('#rMax').textContent=fmtDeg(day.maxEl); $('#rMax').title=tr('um ','at ')+fmtT(day.maxT);
  $('#rLitLbl').textContent=useMoon?tr('Fenster im Mondlicht','Windows in moonlight'):tr('Fenster besonnt','Windows in sun');
  $('#rLit').textContent=(cur.el>0||useMoon)?(litCount+' / '+windows.length):tr('keine','none');
  updateMoonReadouts();
  try{ if(tour.i!==null) tourWhen(); }catch(e){}
  if(!$('#card-share').hidden) updateShare();
  expTick();
  { const m=moonCur, sp=cur.el>-0.3?tr('Sonne ','Sun ')+fmtDeg(cur.el)+' '+dirName(cur.az):tr('Sonne unter dem Horizont','Sun below the horizon');
    $('#sumLine').textContent=sp+(state.moon&&m?tr(' · Mond ',' · Moon ')+fmtDeg(m.el)+(m.el>0?' '+dirName(m.az):'')+', '+Math.round(m.k*100)+' %':'')+' · '+(useMoon?tr('im Mondlicht ','in moonlight '):tr('besonnt ','sunlit '))+((cur.el>0||useMoon)?litCount:0)+' / '+windows.length+tr(' Fenster',' windows'); }
  const nx=CX(state.minutes), cn=$('#cNow'), cd=$('#cDot');
  if(cn){ cn.setAttribute('x1',nx); cn.setAttribute('x2',nx); cd.setAttribute('cx',nx); cd.setAttribute('cy',CY(Math.max(-18,cur.el))); }
  const ks=$('#kSun'), kr=$('#kRay');
  if(ks){ const r=cur.el>=0?44*(90-cur.el)/90:44, x=r*Math.sin(cur.az*rad), y=-r*Math.cos(cur.az*rad);
    ks.setAttribute('cx',x.toFixed(1)); ks.setAttribute('cy',y.toFixed(1)); ks.style.opacity=cur.el>=0?1:0.3; kr.setAttribute('x2',x.toFixed(1)); kr.setAttribute('y2',y.toFixed(1)); kr.style.opacity=cur.el>=0?0.8:0; }
  const nb=$('#night'); nb.hidden=cur.el>-0.3;
  if(!nb.hidden){ const m=moonCur, pre=cur.el>-6?tr('Dämmerung','Twilight'):tr('Nacht','Night');
    nb.textContent=!state.moon?tr('Die Sonne steht unter dem Horizont','The sun is below the horizon'):m.el<=0?pre+tr(' · der Mond steht unter dem Horizont',' · the moon is below the horizon')
      :useMoon&&moonStr>0.03?pre+tr(' · Mondlicht, ',' · moonlight, ')+moonPhaseName(m.elong)+', '+Math.round(m.k*100)+tr(' % beleuchtet',' % lit'):pre+' · '+moonPhaseName(m.elong)+tr(', kaum Mondlicht',', hardly any moonlight'); }
  const et=eclBanner(); if(et){ nb.hidden=false; nb.textContent=et; }
  const dsi=dstInfo(state.y,state.m,state.d,state.minutes);
  if(dsi.gap){ nb.hidden=false; nb.textContent=tr('Zeitumstellung: Die Uhr springt von 2 auf 3 Uhr – 2:00 bis 2:59 gibt es heute nicht','Clocks go forward from 2 to 3 am – 2:00 to 2:59 does not exist today'); }
  else if(dsi.fold){ nb.hidden=false; nb.textContent=tr('Zeitumstellung: 2–3 Uhr gibt es heute zweimal – gezeigt wird der zweite Durchlauf (MEZ)','Clocks go back: 2–3 am occurs twice today – showing the second pass (CET)'); }
}
function eclBanner(){
  if(eclObsc>0&&cur.el>-0.5) return (eclS.mag>=1?tr('Totale Sonnenfinsternis','Total solar eclipse'):tr('Partielle Sonnenfinsternis','Partial solar eclipse'))+' · '+Math.round(eclObsc*100)+tr(' % der Sonnenscheibe bedeckt',' % of the sun covered');
  if(state.moon&&eclL&&eclL.pmag>0&&moonCur&&moonCur.el>-0.5) return eclL.umag>=1?tr('Totale Mondfinsternis · der Mond steht im Kernschatten der Erde','Total lunar eclipse · the moon is in the earth’s umbra')
    :eclL.umag>0?tr('Partielle Mondfinsternis · ','Partial lunar eclipse · ')+Math.round(eclL.uCover*100)+tr(' % im Kernschatten',' % in the umbra'):tr('Halbschatten-Mondfinsternis · kaum zu sehen','Penumbral lunar eclipse · hardly visible');
  return ''; }
export const WD=['So','Mo','Di','Mi','Do','Fr','Sa'], WD_EN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON_EN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtWhen(ms){ if(ms===null) return '–'; const off=berlinOffsetMin(ms), l=new Date(ms+off*60000), hm=pad2(l.getUTCHours())+':'+pad2(l.getUTCMinutes());
  return LANG==='en'?WD_EN[l.getUTCDay()]+' '+l.getUTCDate()+' '+MON_EN[l.getUTCMonth()]+', '+hm+' '+tzN(off):WD[l.getUTCDay()]+' '+l.getUTCDate()+'.'+(l.getUTCMonth()+1)+'., '+hm+(off===120?' MESZ':''); }
function moonIconSvg(k,waxing){ const R=40, rx=Math.abs(1-2*k)*R, big=k>0.5;
  const d=waxing?'M0,-40 A40 40 0 0 1 0,40 A'+rx.toFixed(2)+' 40 0 0 '+(big?1:0)+' 0,-40 Z':'M0,-40 A40 40 0 0 0 0,40 A'+rx.toFixed(2)+' 40 0 0 '+(big?0:1)+' 0,-40 Z';
  return '<circle class="mdisk" r="40"/><path class="mlit" d="'+d+'"/>'; }
function updateMoonReadouts(){
  const m=moonCur; if(!m) return; const utc=localToUtc(state.y,state.m,state.d,state.minutes), age=moonAge(utc);
  $('#mEl').textContent=fmtDeg(m.el); $('#mAz').textContent=fmtDeg(m.az)+' '+dirName(m.az);
  $('#mRise').textContent=day.mrise!==null?fmtT(day.mrise):'–'; $('#mSet').textContent=day.mset!==null?fmtT(day.mset):'–';
  $('#mIll').textContent=Math.round(m.k*100)+' %'; $('#mAge').textContent=age!==null?dc(age.toFixed(1))+tr(' Tage',' days'):'–';
  $('#mPhase').textContent=moonPhaseName(m.elong);
  $('#moonIcon').innerHTML=moonIconSvg(m.k,m.waxing);
  $('#mNext').textContent=tr('Nächster Vollmond ','Next full moon ')+fmtWhen(day.nextFull)+tr(' · nächster Neumond ',' · next new moon ')+fmtWhen(day.nextNew);
  updateEclText();
  const km=$('#kMoon'); if(km){ const r=m.el>=0?44*(90-m.el)/90:44; km.setAttribute('cx',(r*Math.sin(m.az*rad)).toFixed(1)); km.setAttribute('cy',(-r*Math.cos(m.az*rad)).toFixed(1)); km.style.opacity=state.moon?(m.el>=0?1:0.3):0; }
  const cm=$('#cMoon'); if(cm){ cm.setAttribute('cx',CX(state.minutes)); cm.setAttribute('cy',CY(Math.max(-18,m.el))); cm.style.opacity=state.moon?1:0; }
}
