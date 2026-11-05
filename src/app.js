// St. Marien – Licht und Schatten: Bedienoberfläche und Start (die Aufteilung der Oberfläche in Module folgt).
//
// Das Modell ist auf Module verteilt (src/core, src/model, src/scene, src/light). Sie bauen sich in derselben Reihenfolge auf
// wie früher die eine große Datei: Jedes Modul importiert als Erstes seinen Vorgänger, app.js als Erstes das letzte Modul
// (scene/labels.js). Module dürfen sich gegenseitig importieren; eine Variable eines anderen Moduls neu zuweisen geht aber nicht –
// dafür gibt es Setter wie setLang() oder requestRender(). Reihenfolge: core/loader → core/util → core/i18n → core/prefs → model/measures → state → scene/renderer → scene/textures → scene/shaders → scene/materials → model/geometry → model/church → model/clock → model/environment → model/sundial → light/sky → light/windows → light/sun → scene/camera → scene/labels → app.
import { placeLabels, relabel, updateLabelsVisibility } from './scene/labels.js';   // Aufbau-Reihenfolge: nach scene/labels
import { berlinNow, berlinOffsetMin, dstInfo, eclipseScan, localToUtc, lunarEclipseAt, moonPhaseTime, moonPos, moonRiseSet, moonTransitNear, nrm360, rad, sunDay, sunEcl, sunPos, trueNoon } from './astro/index.js';
import { V3 } from './three-global.js';
import { ldBar, ldDone, ldT0, step } from './core/loader.js';
import { $, clamp01, lsGet, lsSet, smooth } from './core/util.js';
import { applyStaticLang, dc, fmtDeg, fmtT, LANG, moonPhaseName, pad2, setLang, tr, tzN } from './core/i18n.js';
import { EXPERT, setExpert } from './core/prefs.js';
import { AXIS_MEASURED, TW } from './model/measures.js';
import { cur, LD, state, sunVec } from './state.js';
import { camera, coarse, cutPlane, renderer, requestRender, scene, stage, takeDirty } from './scene/renderer.js';
import { TINT } from './scene/shaders.js';
import { occluders, windows } from './model/geometry.js';
import { T_GTIP, T_HELM } from './model/church.js';
import { CK, CK_DE, CK_EN, CK_IAU, CK_N, CK_W, ckLeap, CKR, clk, clockUpdate } from './model/clock.js';
import { applyEnv, ENV, envBlocked, envG, envH, envHeightAt, envSample } from './model/environment.js';
import { dayOfYear, drawYearChart, moonAge, sd, sdDrawPlate, sdOrient } from './model/sundial.js';
import { buildSunPath, pathGroup, placeMoon, placeMoonAt, sky, skyMat, stars } from './light/sky.js';
import { litCount, rc } from './light/windows.js';
import { eclL, eclObsc, eclS, moonCur, moonStr, updateSun, useMoon } from './light/sun.js';
import { applyMode, busyHide, busyShow, busyState, busyText, clampWalk, controls, cubeCam, drawPanoGrid, goView, hintFor, joy, joyMove, keyMove, keys, PANO, panoCam, panoMarks, panoScene, panoUniforms, stepTween, tween, VIEWS } from './scene/camera.js';

/* ---------------- UI ---------------- */
const DIRS_DE=['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'], DIRS_EN=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const dirName=az=>(LANG==='en'?DIRS_EN:DIRS_DE)[Math.round(az/22.5)%16];
export let day={curve:[],rise:null,set:null,maxEl:0,maxT:0,mcurve:[],mrise:null,mset:null,nm0:null,nm1:null,nextFull:null,nextNew:null};
function computeDay(){
  const {c,rise,set,maxEl,maxT}=sunDay(state.y,state.m,state.d);
  const t0=localToUtc(state.y,state.m,state.d,0), t1=localToUtc(state.y,state.m,state.d,1440), mc=[];
  for(let mi=0;mi<=1440;mi+=10) mc.push(moonPos(localToUtc(state.y,state.m,state.d,mi)));
  const mrs=moonRiseSet(t0,t1), nm1=moonPhaseTime(t1,0,-1), nm0=nm1?moonPhaseTime(nm1-3600000,0,-1):null;
  day={curve:c,rise,set,maxEl,maxT,mcurve:mc,mrise:mrs.rise!==null?(mrs.rise-t0)/60000:null,mset:mrs.set!==null?(mrs.set-t0)/60000:null,
       nm0,nm1,nextFull:moonPhaseTime(t0,180,1),nextNew:moonPhaseTime(t0,0,1)};
  drawChart(); drawCompassStatic(); buildSunPath(); drawYearChart(); if(state.pano) drawPanoGrid();
}
const svgNS='http://www.w3.org/2000/svg';
const chart=$('#chart');
let CHW=600; const CHH=48;
const CX=t=>4+t/1440*(CHW-8), CY=el=>3+(66-el)/(66+18)*(CHH-14);
function drawChart(){
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
function drawCompassStatic(){
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
const WD=['So','Mo','Di','Mi','Do','Fr','Sa'], WD_EN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON_EN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
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
function gotoInstant(ms,minutes){ const off=berlinOffsetMin(ms), l=new Date(ms+off*60000); state.minutes=minutes!==undefined?minutes:l.getUTCHours()*60+l.getUTCMinutes(); setDate(l.getUTCFullYear(),l.getUTCMonth(),l.getUTCDate()); }
// Vollmond am Nachmittag: die Nacht danach zählt noch
function goFullMoon(){ const nf=moonPhaseTime(localToUtc(state.y,state.m,state.d,state.minutes)-12*3600000,180,1); if(nf!==null) gotoInstant(moonTransitNear(nf)); }
// Finsternisse: nächste von Lübeck aus sichtbare ab dem eingestellten Tag (Mondfinsternisse mit Kernschatten)
const eclCache={key:null,s:null,l:null};
function nextEclipses(){ const t=Date.UTC(state.y,state.m,state.d), key=state.y+'-'+state.m+'-'+state.d; if(eclCache.key===key) return eclCache;
  eclCache.key=key; eclCache.s=eclipseScan(t,6,'s').find(e=>e.cover>=0.005)||null;   // streifende Finsternisse unter 0,5 % Bedeckung nicht nennen eclCache.l=eclipseScan(t,60,'l').find(e=>e.visible&&e.type!=='penumbral'&&e.max>=t)||null;
  for(const k of ['s','l']) if(eclCache[k]&&eclCache[k].max>DATE_MAX+864e5) eclCache[k]=null;   // nur innerhalb des wählbaren Zeitraums
  return eclCache; }
function eclWhen(ms){ const off=berlinOffsetMin(ms), l=new Date(ms+off*60000), hm=pad2(l.getUTCHours())+':'+pad2(l.getUTCMinutes());
  return LANG==='en'?WD_EN[l.getUTCDay()]+' '+l.getUTCDate()+' '+MON_EN[l.getUTCMonth()]+' '+l.getUTCFullYear()+', '+hm+' '+tzN(off):WD[l.getUTCDay()]+' '+l.getUTCDate()+'.'+(l.getUTCMonth()+1)+'.'+l.getUTCFullYear()+', '+hm+' '+tzN(off); }
function eclText(e){ if(!e) return '–';
  if(e.kind==='s') return tr('Sonnenfinsternis ','Solar eclipse ')+eclWhen(e.max)+' · '+Math.round(e.cover*100)+tr(' % bedeckt',' % covered')+(e.endEl!==null&&e.endEl<-0.6?tr(', Sonnenuntergang vor dem Ende',', sun sets before the end'):e.startEl<-0.6?tr(', beginnt vor Sonnenaufgang',', begins before sunrise'):'');
  return (e.type==='total'?tr('Totale Mondfinsternis ','Total lunar eclipse '):tr('Partielle Mondfinsternis ','Partial lunar eclipse '))+eclWhen(e.max)+(e.type==='partial'?' · '+Math.round(lunarEclipseAt(e.max).uCover*100)+tr(' % im Kernschatten',' % in the umbra'):'')+(e.el<0?tr(', Mond beim Maximum unter dem Horizont',', moon below the horizon at maximum'):''); }
function updateEclText(){ if($('#card-moon').hidden) return; const n=nextEclipses(); $('#mEcl').textContent=eclText(n.s)+' · '+eclText(n.l); }
function goEclipse(e){ if(!e) return; if(e.kind==='l'&&!state.moon){ state.moon=true; $('#moonTog').checked=true; }
  if(state.playing) setPlaying(false);
  gotoInstant(e.max);
  const p=e.kind==='s'?sunPos(e.max):moonPos(e.max), dir=sunVec(Math.max(p.el,0.8),p.az,new V3()), hz=new V3(dir.x,0,dir.z).normalize();
  VIEWS.finsternis={pos:[11.9,135,0],dir:[dir.x,dir.y,dir.z],mode:'inside',cut:60,exp:e.kind==='s'?1.0:1.25,fov:e.kind==='s'?10:7};   // Blick von oberhalb der Turmspitzen zur Sonne bzw. zum Mond
  goView('finsternis'); }
$('#goSolEcl').addEventListener('click',()=>goEclipse(nextEclipses().s));
$('#goLunEcl').addEventListener('click',()=>goEclipse(nextEclipses().l));
document.querySelector('.rbtn[data-card="moon"]').addEventListener('click',()=>setTimeout(updateEclText,0));
function goNewMoon(){ const nn=moonPhaseTime(localToUtc(state.y,state.m,state.d,state.minutes)+3600000,0,1); if(nn!==null) gotoInstant(nn,22*60); }
function setMinutes(m){ state.minutes=m; updateSun(); if(state.pano) panoMarks(); if(yr.on){ yr.mez=yrMez(); yrBuild(); } }
// Wählbarer Zeitraum = Jahre der Kalenderscheibe der Astronomischen Uhr
const DATE_MIN=Date.UTC(1911,0,1), DATE_MAX=Date.UTC(2080,11,31);
function clampYMD(y,m,d){ let t=Date.UTC(+y||2026,+m||0,+d||1); if(+y>=0&&+y<100) t=DATE_MIN; if(!isFinite(t)) t=Date.UTC(2026,0,1); t=Math.min(DATE_MAX,Math.max(DATE_MIN,t)); const q=new Date(t); return [q.getUTCFullYear(),q.getUTCMonth(),q.getUTCDate()]; }
function setDate(y,m,d){ [y,m,d]=clampYMD(y,m,d); state.y=y; state.m=m; state.d=d; { const v=y+'-'+pad2(m+1)+'-'+pad2(d), el=$('#date'); if(el.value!==v) el.value=v; } computeDay(); updateSun(true); }
export function setCut(v){ state.cut=v; $('#cut').value=v; cutPlane.constant=v>=60?500:v; $('#cutOut').textContent=v>=60?tr('aus','off'):dc(v.toFixed(1))+' m'; requestRender(); }
export function setExp(v){ state.exp=v; $('#exp').value=v; renderer.toneMappingExposure=v*(1+0.15*(1-smooth(-7,-1.5,cur.el))*(state.moon?1:0)); $('#expOut').textContent=dc(v.toFixed(2)); requestRender(); }
function setAmb(v){ state.amb=v; $('#amb').value=v; TINT.uAmbIn.value=v; $('#ambOut').textContent=Math.round(v*100)+' %'; requestRender(); }
function setAxis(v){ state.axis=v; $('#axis').value=v; $('#axisOut').textContent=fmtDeg(v); drawCompassStatic(); buildSunPath(); sdOrient(); updateSun(true); }

// Während des Tippens (Jahr Ziffer für Ziffer: 0002, 0020, 0202, 2026) nichts zurücksetzen; erst ein gültiges Datum im Bereich übernehmen, beim Verlassen begrenzen
function dateApply(final){ const el=$('#date'), p=el.value.split('-').map(Number), ok=p.length===3&&p.every(Number.isFinite)&&p[0]>0;
  if(!ok){ if(final) el.value=state.y+'-'+pad2(state.m+1)+'-'+pad2(state.d); return; }
  const t=Date.UTC(p[0],p[1]-1,p[2]); if(!final&&(p[0]<1000||t<DATE_MIN||t>DATE_MAX)) return;   // Date.UTC macht aus 0019 das Jahr 1919
  if(final&&p[0]===state.y&&p[1]-1===state.m&&p[2]===state.d) return;
  const yOld=state.y; setDate(p[0],p[1]-1,p[2]); if(yr.on){ if(state.y!==yOld) yrBuild(); else yrMark(); } }
$('#date').addEventListener('change',()=>dateApply(false));
$('#date').addEventListener('blur',()=>dateApply(true));
$('#date').addEventListener('keydown',e=>{ if(e.key==='Enter') dateApply(true); });
$('#time').addEventListener('input',e=>setMinutes(+e.target.value));
function stepDay(k){ const t=new Date(Date.UTC(state.y,state.m,state.d)+k*864e5); setDate(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()); if(yr.on) yrMark(); }
$('#dayPrev').addEventListener('click',()=>stepDay(-1)); $('#dayNext').addEventListener('click',()=>stepDay(1));
$('#nowBtn').addEventListener('click',()=>{ const n=berlinNow(); state.minutes=n.minutes; setDate(n.y,n.m,n.d); });
const presetsEl=$('#presets');
function buildPresets(){ presetsEl.innerHTML='';
  [['Frühlingsanfang','Spring equinox',2,20],['Sommeranfang','Summer solstice',5,21],['Mariä Himmelfahrt','Assumption Day',7,15],['Herbstanfang','Autumn equinox',8,22],['Winteranfang','Winter solstice',11,21]].forEach(([t,te,m,d])=>{
    const b=document.createElement('button'); b.setAttribute('role','menuitem'); b.textContent=LANG==='en'?te+', '+d+' '+MON_EN[m]:t+' '+d+'.'+(m+1)+'.'; b.addEventListener('click',()=>setDate(state.y,m,d)); presetsEl.appendChild(b); });
  for(const k of ['s','l']){ const b=document.createElement('button'); b.setAttribute('role','menuitem'); b.dataset.ecl=k; b.textContent=k==='s'?tr('Nächste Sonnenfinsternis','Next solar eclipse'):tr('Nächste Mondfinsternis','Next lunar eclipse');
    b.addEventListener('click',()=>goEclipse(nextEclipses()[k])); presetsEl.appendChild(b); } }
$('#presetBtn').addEventListener('click',()=>{ const n=nextEclipses(); presetsEl.querySelectorAll('button[data-ecl]').forEach(b=>{ const e=n[b.dataset.ecl]; if(!e) return; const l=new Date(e.max+berlinOffsetMin(e.max)*60000);
  b.textContent=(b.dataset.ecl==='s'?tr('Sonnenfinsternis ','Solar eclipse '):tr('Mondfinsternis ','Lunar eclipse '))+(LANG==='en'?l.getUTCDate()+' '+MON_EN[l.getUTCMonth()]+' '+l.getUTCFullYear():l.getUTCDate()+'.'+(l.getUTCMonth()+1)+'.'+l.getUTCFullYear()); }); });
buildPresets();
function setPlaying(p){ state.playing=p; $('#playTxt').textContent=p?tr('Anhalten','Pause'):yr.on?tr('Jahreslauf','Play year'):tr('Tagesverlauf','Play day');
  $('#playIcon').innerHTML=p?'<path d="M2 1h3v10H2zM7 1h3v10H7z"/>':'<path d="M2 1l9 5-9 5z"/>'; if(!p) updateSun(true); }
$('#play').addEventListener('click',()=>setPlaying(!state.playing));
$('#speed').addEventListener('change',e=>{ const v=e.target.value; if(v[0]==='y'){ state.speed=0; yearStart(+v.slice(1)); } else { state.speed=+v; yearStop(); } });
/* ---------------- Jahr im Zeitraffer: die Kirche als Sonnenuhr ----------------
   Die Uhrzeit bleibt in MEZ fest (im Sommer zeigt die Uhr daher eine Stunde mehr), das Datum läuft.
   Spur: Schattenpunkt der Südturmspitze auf dem Boden für jeden Tag des Jahres zu dieser Uhrzeit (bei fester mittlerer Zeit eine Acht, das Analemma). */
export const yr={on:false,rate:0,mez:0,acc:0,year:0,group:null,marker:null,ray:null};
const YR_TIP=new V3(TW.xc,T_GTIP[1]+T_HELM[1],(TW.s[0]+TW.s[1])/2);
function yrGround(x,z){ const g=envG?envSample(envG,ENV.gn,ENV.gstep,x,z):-1e9; return g>-1e8?g:0; }
function yrPoint(utc,out){ const sp=sunPos(utc); if(sp.el<1) return null; const d=sunVec(sp.el,sp.az,new V3());
  let p=null, gy=0; for(let k=0;k<3;k++){ const t=(YR_TIP.y-gy)/d.y; p=YR_TIP.clone().addScaledVector(d,-t); gy=yrGround(p.x,p.z); } p.y=gy+0.6; return out?out.copy(p):p; }
const yrSeason=doy=>{ const C=[[0x2f6fc0,0],[0x3f9a4c,91],[0xe09a1a,182],[0xc0461f,274],[0x2f6fc0,365]]; for(let i=0;i<C.length-1;i++) if(doy<=C[i+1][1]){ const a=new THREE.Color(C[i][0]), b=new THREE.Color(C[i+1][0]); return a.lerp(b,(doy-C[i][1])/(C[i+1][1]-C[i][1])); } return new THREE.Color(C[0][0]); };
function yrBuild(){
  if(yr.group){ scene.remove(yr.group); yr.group.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); }
  const g=new THREE.Group(); g.renderOrder=30; const pos=[], col=[], y=state.y, n=(y%4===0&&y%100!==0)||y%400===0?366:365;
  for(let k=0;k<n;k++){ const utc=Date.UTC(y,0,1+k)+(yr.mez-60)*60000, p=yrPoint(utc); if(!p) continue; const c=yrSeason(k); pos.push(p.x,p.y,p.z); col.push(c.r,c.g,c.b); }
  const pg=new THREE.BufferGeometry(); pg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); pg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  const dots=new THREE.Points(pg,new THREE.PointsMaterial({size:coarse?6:8,sizeAttenuation:false,vertexColors:true,depthTest:false,transparent:true,opacity:0.95,fog:false})); dots.renderOrder=30; g.add(dots);
  const ln=new THREE.Line(pg,new THREE.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:0.8,fog:false})); ln.renderOrder=29; g.add(ln);
  yr.marker=new THREE.Mesh(new THREE.SphereGeometry(3.2,16,12),new THREE.MeshBasicMaterial({color:0xfff2b0,depthTest:false,fog:false})); yr.marker.renderOrder=31; g.add(yr.marker);
  const rg=new THREE.BufferGeometry(); rg.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,0],3));
  yr.ray=new THREE.Line(rg,new THREE.LineBasicMaterial({color:0xffe08a,depthTest:false,transparent:true,opacity:0.9,fog:false})); yr.ray.renderOrder=31; g.add(yr.ray);
  yr.group=g; yr.year=y; scene.add(g); yrMark(); }
function yrMark(){ if(!yr.group) return; const p=yrPoint(localToUtc(state.y,state.m,state.d,state.minutes));
  yr.marker.visible=yr.ray.visible=!!p; if(p){ yr.marker.position.copy(p); const a=yr.ray.geometry.attributes.position; a.setXYZ(0,YR_TIP.x,YR_TIP.y,YR_TIP.z); a.setXYZ(1,p.x,p.y,p.z); a.needsUpdate=true; } requestRender(); }
function yrMez(){ return state.minutes-(berlinOffsetMin(localToUtc(state.y,state.m,state.d,state.minutes))-60); }
function yearStart(rate){ const first=!yr.on; yr.on=true; yr.rate=rate; yr.acc=0; yr.mez=yrMez(); yrBuild(); $('#yearNote').hidden=false; setPlaying(state.playing);
  if(first&&!['sonnenuhr','himmel'].includes(state.view)) goView('jahr'); }
function yearStop(){ if(!yr.on) return; yr.on=false; if(yr.group){ scene.remove(yr.group); yr.group=null; } $('#yearNote').hidden=true; setPlaying(state.playing); requestRender(); }
function yearTick(dt){ yr.acc+=yr.rate*dt; if(yr.acc<1) return; const nd=Math.floor(yr.acc); yr.acc-=nd;
  const t=new Date(Date.UTC(state.y,state.m,state.d+nd)), y=t.getUTCFullYear(), m=t.getUTCMonth(), d=t.getUTCDate();
  const off=berlinOffsetMin(Date.UTC(y,m,d,12)); state.minutes=Math.max(0,Math.min(1439,yr.mez+(off-60)));
  setDate(y,m,d); if(y!==yr.year) yrBuild(); else yrMark(); }
document.querySelectorAll('#views button').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));
$('#cut').addEventListener('input',e=>setCut(+e.target.value));
$('#exp').addEventListener('input',e=>setExp(+e.target.value));
$('#amb').addEventListener('input',e=>setAmb(+e.target.value));
$('#axis').addEventListener('input',e=>setAxis(+e.target.value));
$('#labelsTog').addEventListener('change',e=>{ state.labels=e.target.checked; updateLabelsVisibility(); requestRender(); });
$('#beamsTog').addEventListener('change',e=>{ state.beams=e.target.checked; updateSun(true); });
$('#envTog').addEventListener('change',e=>{ state.env=e.target.checked; applyEnv(); updateSun(true); });
$('#treeTog').addEventListener('change',e=>{ state.trees=e.target.checked; applyEnv(); updateSun(true); });
$('#lodTog').addEventListener('change',e=>{ state.lodChurch=e.target.checked; applyEnv(); });
$('#sdGo').addEventListener('click',()=>goView('sonnenuhr'));
$('#sdMoonGo').addEventListener('click',()=>{ if(!state.moon){ state.moon=true; $('#moonTog').checked=true; } goFullMoon(); goView('sonnenuhr'); });
$('#goFull').addEventListener('click',goFullMoon);
$('#skyGo').addEventListener('click',()=>goView('himmel'));
$('#goNew').addEventListener('click',goNewMoon);
$('#moonTog').addEventListener('change',e=>{ state.moon=e.target.checked; drawChart(); drawCompassStatic(); buildSunPath(); setExp(state.exp); updateSun(true); });
$('#sunPathTog').addEventListener('change',e=>{ state.sunPath=e.target.checked; buildSunPath(); drawPanoGrid(); });
$('#moonPathTog').addEventListener('change',e=>{ state.moonPath=e.target.checked; buildSunPath(); drawPanoGrid(); });
$('#sdWedge').addEventListener('input',e=>{ state.sdWedge=+e.target.value; sdOrient(); updateSun(true); });
$('#axisReset').addEventListener('click',()=>setAxis(AXIS_MEASURED));
$('#tintTog').addEventListener('change',e=>{ state.tint=e.target.checked; TINT.uTintOn.value=e.target.checked?1:0; requestRender(); });
// Karten der Symbolleiste: immer nur eine offen
function openCard(k){ document.querySelectorAll('.card').forEach(c=>{ c.hidden=c.id!=='card-'+k; c.classList.remove('min'); }); const gp=document.getElementById('glPop'); if(gp) gp.hidden=true;
  document.querySelectorAll('.rbtn').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.card===k))); if(typeof mtSync==='function') mtSync(); }
document.querySelectorAll('.rbtn').forEach(b=>b.addEventListener('click',()=>openCard(b.getAttribute('aria-expanded')==='true'?null:b.dataset.card)));
document.querySelectorAll('.card .cx').forEach(b=>b.addEventListener('click',()=>openCard(null)));
// Aufklappmenüs (Ansicht, besondere Tage): schließen bei Klick daneben und mit Esc
function menu(btn,m){ const set=o=>{ m.hidden=!o; btn.setAttribute('aria-expanded',String(o)); };
  btn.addEventListener('click',e=>{ e.stopPropagation(); set(m.hidden); }); m.addEventListener('click',e=>{ if(e.target.closest('button')) set(false); });
  document.addEventListener('pointerdown',e=>{ if(!m.hidden&&!m.contains(e.target)&&!btn.contains(e.target)) set(false); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!m.hidden){ set(false); btn.focus(); } }); }
menu($('#viewBtn'),$('#views')); menu($('#presetBtn'),$('#presets'));
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!e.defaultPrevented&&document.querySelector('.card:not([hidden])')&&$('#views').hidden&&$('#presets').hidden) openCard(null); });
// Bedienhinweis nach dem ersten Ziehen oder nach 9 s ausblenden
{ const hide=()=>$('#hint').classList.add('gone'); renderer.domElement.addEventListener('pointerdown',hide,{once:true}); setTimeout(hide,9000); }
// Nach dem Rundgang bzw. beim ersten freien Erkunden: Bedienhinweis zeigen und die Symbole der Leiste kurz beschriften (einmal je Gerät)
let hintTimer=null;
function showHint(ms){ const h=$('#hint'); h.textContent=hintFor(); h.classList.remove('gone'); clearTimeout(hintTimer); hintTimer=setTimeout(()=>h.classList.add('gone'),ms||8000);
  renderer.domElement.addEventListener('pointerdown',()=>h.classList.add('gone'),{once:true}); }
function introExplore(){ showHint(9000); if(lsGet('stm-raillbl')==='1') return; lsSet('stm-raillbl','1');
  const r=document.querySelector('.rail'); r.classList.add('lbls'); setTimeout(()=>r.classList.remove('lbls'),7000); }
// Glossar: Begriffe mit gepunkteter Unterstreichung antippen
const GL={alt:['Höhe','Altitude','Winkel über dem Horizont: 0° liegt am Horizont, 90° genau über Ihnen. Je höher die Sonne, desto kürzer die Schatten.','Angle above the horizon: 0° is on the horizon, 90° straight overhead. The higher the sun, the shorter the shadows.'],
  az:['Azimut','Azimuth','Himmelsrichtung, im Uhrzeigersinn von Norden gezählt: 90° ist Osten, 180° Süden, 270° Westen.','Compass direction, counted clockwise from north: 90° is east, 180° south, 270° west.'],
  age:['Mondalter','Moon age','Tage seit dem letzten Neumond. Nach gut 7 Tagen ist Halbmond, nach etwa 15 Tagen Vollmond, nach 29,5 Tagen wieder Neumond.','Days since the last new moon. After about 7 days it is half moon, after about 15 days full moon, after 29.5 days new moon again.'],
  woz:['Wahre Ortszeit','Apparent solar time','Zeit nach dem Sonnenstand am eigenen Ort: 12 Uhr ist, wenn die Sonne genau im Süden steht. Diese Zeit zeigt die Sonnenuhr.','Time by the sun at your own place: 12 o’clock is when the sun stands due south. This is the time a sundial shows.'],
  tz:['MEZ und MESZ','CET and CEST','Mitteleuropäische Zeit, die gesetzliche Uhrzeit. Sie richtet sich nach dem Sonnenstand auf 15° Ost (Görlitz). Im Sommer gilt die Sommerzeit MESZ, eine Stunde später.','Central European Time, the legal clock time. It follows the sun at 15° east (Görlitz). In summer, daylight saving time (CEST) is one hour ahead.'],
  dl:['Tagesbuchstabe','Day letter','Im Kirchenkalender tragen die Tage des Jahres reihum die Buchstaben A bis G, beginnend mit A am 1. Januar. Die Kalenderscheibe der Uhr zeigt ihn für jeden Tag.','In the church calendar the days of the year carry the letters A to G in turn, starting with A on 1 January. The clock’s calendar disk shows it for every day.'],
  sl:['Sonntagsbuchstabe','Sunday letter','Der Tagesbuchstabe, der in einem Jahr auf die Sonntage fällt. Mit ihm findet man zu jedem Datum den Wochentag; Schaltjahre haben zwei.','The day letter that falls on the Sundays of a year. With it you can find the weekday of any date; leap years have two.'],
  gz:['Goldene Zahl','Golden number','Stellung des Jahres im 19-jährigen Mondzyklus (1 bis 19). Nach 19 Jahren fallen die Mondphasen wieder auf dieselben Kalendertage; daraus berechnet man den Ostertermin.','Position of the year in the 19-year lunar cycle (1 to 19). After 19 years the moon phases fall on the same calendar days again; Easter is computed from it.']};
document.addEventListener('click',e=>{ const t=e.target.closest('[data-gl]'), p=$('#glPop');
  if(!t){ if(!p.hidden&&!p.contains(e.target)) p.hidden=true; return; }
  const g=GL[t.dataset.gl]; if(!g) return; if(!p.hidden&&p.dataset.k===t.dataset.gl){ p.hidden=true; return; }
  p.dataset.k=t.dataset.gl; p.innerHTML='<b>'+(LANG==='en'?g[1]:g[0])+'</b>'+(LANG==='en'?g[3]:g[2]); p.hidden=false;
  const r=t.getBoundingClientRect(), w=p.offsetWidth, h=p.offsetHeight; let x=Math.min(innerWidth-w-12,Math.max(12,r.left)), y=r.bottom+6; if(y+h>innerHeight-8) y=r.top-h-6;
  p.style.left=x+'px'; p.style.top=Math.max(8,y)+'px'; });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') $('#glPop').hidden=true; });
document.querySelectorAll('[data-gl]').forEach(el=>{ el.tabIndex=0; el.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); el.click(); } }); });
// Karten auf dem Smartphone über die Überschrift ein- und ausklappen, damit die Szene sichtbar wird
document.querySelectorAll('.card .chead h2').forEach(h=>h.addEventListener('click',()=>{ if(matchMedia('(max-width: 760px)').matches) h.closest('.card').classList.toggle('min'); }));
/* ---------------- Einfache und erweiterte Ansicht ---------------- */
document.querySelectorAll('.more').forEach(b=>b.addEventListener('click',()=>setExpert(!EXPERT)));
/* ---------------- Sprache umschalten ---------------- */

function refreshLang(){
  applyStaticLang(); buildPresets(); relabel(); drawChart(); drawCompassStatic(); drawYearChart(); sdOrient();
  $('#playTxt').textContent=state.playing?tr('Anhalten','Pause'):tr('Tagesverlauf','Play day');
  { const vb=document.querySelector('#views button[data-view="'+state.view+'"]'); $('#viewTxt').textContent=state.pano?tr('Himmel: Sonnen- und Mondbahn','Sky: paths of sun and moon'):vb?vb.textContent:tr('eigene','custom'); }
  $('#hint').textContent=hintFor(); setCut(state.cut); setExp(state.exp); setAmb(state.amb); $('#axisOut').textContent=fmtDeg(state.axis); $('#sdWedgeOut').textContent=fmtDeg(state.sdWedge); if(state.pano) drawPanoGrid();
  if(tour.i!==null) showTour(); if(quiz.i!==null) qzRender(); mtGeo(); mtRender(); if(LK.list.length){ LK.list=[]; lkFill(); } updateShare(); updateSun(true); }
$('#langBtn').addEventListener('click',()=>{ setLang(LANG==='en'?'de':'en'); lsSet('stm-lang',LANG); refreshLang(); });
/* ---------------- Karte: Astronomische Uhr ---------------- */

const CK_MON=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const CK_MON_EN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const CK_ECL=[['totale Mondfinsternis','total lunar eclipse'],['partielle Mondfinsternis','partial lunar eclipse'],['totale Sonnenfinsternis','total solar eclipse'],['partielle Sonnenfinsternis','partial solar eclipse']];
function ckEaster(y){ const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=(h+l-7*m+114)%31+1; return [da,mo-1]; }
function ckFmtDay(d,m){ return LANG==='en'?d+' '+CK_MON_EN[m]:d+'. '+CK_MON[m]; }
function ckSign(name){ return LANG==='en'?CK_EN[name]:CK_DE[name]; }
function ckClockSign(st){   // Sternbild unter dem Sonnenzeiger, nach Behrens' Scheibe (Breiten wie am Himmel)
  const rel=(st.aSun-st.aZod)/rad; let o=nrm360(-90+CK_W[0]/2-rel);
  for(let k=0;k<CK_W.length;k++){ if(o<CK_W[k]) return CK_N[k]; o-=CK_W[k]; } return CK_N[0]; }
function ckSkySign(utc){ const yrs=(utc-Date.UTC(2000,0,1,12))/(365.25*864e5), lam=nrm360(sunEcl(utc).lam-0.013970*yrs);
  let n=CK_IAU[CK_IAU.length-1][0]; for(const [k,s] of CK_IAU) if(lam>=s) n=k; return n; }
const ckWrap=d=>{ const M=CKR.MC; return ((d+M/2)%M+M)%M-M/2; };   // Unterschied im Mondalter über den Neumond hinweg (−½ … +½ Monat)
const ckHM=h=>{ h=((h%24)+24)%24; let H=Math.floor(h), M=Math.round((h-H)*60); if(M===60){ H=(H+1)%24; M=0; } return pad2(H)+':'+pad2(M); };
function ckDiff(min){ const a=Math.abs(Math.round(min)), h=Math.floor(a/60), m=a%60; return h?h+' h'+(m?' '+m+' min':''):m+' min'; }
const ckEcl={key:null};
export function updateClockCard(){
  const st=clk.st; if(!st||$('#card-clock').hidden) return;
  const y=st.y, idx=st.doy-1+((!ckLeap(y)&&st.mo>=2)?1:0), dd=CK&&CK.day?CK.day[idx]:null, ci=CK&&CK.cal?CK.cal[y-CK.y0]:null;
  $('#ckDate').textContent=ckFmtDay(st.d,st.mo)+' '+y;
  $('#ckLetter').textContent=dd?dd[0]:'–';
  $('#ckSaint').textContent=dd?dd[1].charAt(0)+dd[1].slice(1).toLowerCase().replace(/([ .\-])(\S)/g,(m,a,b)=>a+b.toUpperCase()):'–';
  $('#ckSun').textContent=ci?ci[0].replace(',',' / '):'–';
  $('#ckGold').textContent=String(ci?ci[1]:y%19+1);
  const ea=ckEaster(y); $('#ckEaster').textContent=ckFmtDay(ea[0],ea[1]);
  const ecl=CK&&CK.ecl?CK.ecl[String(y)]:null, lo=CK&&CK.ecl?Math.min(...Object.keys(CK.ecl).map(Number)):0, hi=CK&&CK.ecl?Math.max(...Object.keys(CK.ecl).map(Number)):0;
  const ek=y+LANG; if(ckEcl.key!==ek){ ckEcl.key=ek; const el=$('#ckEcl');   // Einträge der Kalenderscheibe; ein Klick zeigt die berechnete Finsternis im Modell
    if(ecl&&ecl.length){ el.innerHTML=''; ecl.forEach(e=>{ const b=document.createElement('button'); b.className='elnk'; b.title=tr('Im Modell zeigen','Show in the model');
        b.textContent=(LANG==='en'?e[0]+' '+CK_MON_EN[e[1]-1].slice(0,3)+' '+e[2]:e[0]+'.'+e[1]+'. '+e[2]+' Uhr')+' · '+CK_ECL[e[3]][LANG==='en'?1:0];
        b.addEventListener('click',()=>{ const t=Date.UTC(y,e[1]-1,e[0],12), c=eclipseScan(t-3*86400000,3,'sl').filter(x=>Math.abs(x.max-t)<2.5*86400000).sort((a,b)=>Math.abs(a.max-t)-Math.abs(b.max-t))[0]; if(c) goEclipse(c); });
        el.appendChild(b); }); }
    else el.textContent=y>=lo&&y<=hi?tr('keine in '+y,'none in '+y):tr('nur für '+lo+'–'+hi+' eingetragen','only listed for '+lo+'–'+hi); }
  // Uhr gegen Himmel
  const sp=sunPos(st.utc), woz=12+sp.H/15, m=moonCur, ageSky=moonAge(st.utc), sC=ckClockSign(st), sS=ckSkySign(st.utc);
  const rows=[
    [tr('Sonne: Zeit','Sun: time'),ckHM(st.hrs)+' '+tzN(st.off),ckHM(woz)+tr(' WOZ',' AST')],
    [tr('Sonne im Sternbild','Sun in constellation'),ckSign(sC),ckSign(sS)],
    [tr('Mondalter','Moon age'),dc(st.age.toFixed(1))+tr(' Tage',' d'),ageSky!==null?dc(ageSky.toFixed(1))+tr(' Tage',' d'):'–'],
    [tr('Mondphase','Moon phase'),moonPhaseName(st.age/CKR.MC*360),m?moonPhaseName(m.elong):'–']];
  $('#ckCmp').innerHTML=rows.map(r=>'<tr><th scope="row">'+r[0]+'</th><td>'+r[1]+'</td><td'+(r[1]!==r[2]&&r[0]!==rows[0][0]&&r[0]!==rows[2][0]?' class="dif"':'')+'>'+r[2]+'</td></tr>').join('');
  const dt=(st.hrs-woz)*60, dm=ageSky!==null?ckWrap(st.age-ageSky)*24*60:null;
  { const r=$('#ckRange'), y0=CK?CK.y0:1911, y1=CK&&CK.cal?CK.y0+CK.cal.length-1:2080, out=!ci;
    r.hidden=!out; if(out) r.textContent=tr('Die Kalenderscheibe der Uhr ist für '+y0+'–'+y1+' beschriftet. Für '+y+' stehen dort keine Sonntagsbuchstaben und keine Finsternisse; die Zeiger laufen weiter wie gebaut.','The clock’s calendar disk is inscribed for '+y0+'–'+y1+'. For '+y+' it shows no Sunday letters and no eclipses; the hands keep running as built.'); }
  $('#ckNote').textContent=tr('Die Uhr zeigt die gesetzliche Zeit; die wahre Ortszeit (WOZ) der Sonne liegt ','The clock shows civil time; apparent solar time (AST) is ')+ckDiff(dt)+(dt>=0?tr(' dahinter.',' behind.'):tr(' davor.',' ahead.'))
    +(dm!==null?tr(' Der Mond der Uhr ',' The clock’s moon is ')+(Math.abs(dm)<30?tr('stimmt fast genau','almost exact'):ckDiff(dm)+(dm>0?tr(' voraus',' ahead'):tr(' zurück',' behind')))+tr('; Behrens rechnet mit 6940 : 6705 statt mit dem wechselnden wahren Mondlauf.','; Behrens uses a fixed 6940 : 6705 ratio, the real moon’s motion varies.'):'');
  ckDrawDisc($('#ckMini'),clk.mini); if(!$('#ckZoom').hidden) ckDrawDisc($('#ckBig'),clk.mini);
  $('#ckZoomBtn').setAttribute('aria-label',clk.mini==='cal'?tr('Kalenderscheibe vergrößern','Enlarge the calendar disk'):tr('Zifferblatt vergrößern','Enlarge the dial'));
}
// Vorschaubild: Zifferblatt oder Kalenderscheibe, je nach gewählter Ansicht; Antippen vergrößert
clk.mini='dial';
function ckDrawDisc(cv,mode){ if(!cv) return; const g=cv.getContext('2d'), W=cv.width; g.clearRect(0,0,W,W);
  if(mode==='cal'&&clk.img.kalender&&clk.st){ g.save(); g.translate(W/2,W/2); g.beginPath(); g.arc(0,0,W/2,0,2*Math.PI); g.clip(); g.rotate(clk.st.aCal); g.drawImage(clk.img.kalender,-W/2,-W/2,W,W); g.restore();
    g.beginPath(); g.moveTo(0,W/2-W*0.032); g.lineTo(W*0.075,W/2); g.lineTo(0,W/2+W*0.032); g.closePath(); g.fillStyle='#e0b040'; g.fill(); g.lineWidth=Math.max(1,W/256); g.strokeStyle='#5a3d0c'; g.stroke(); }   // fester Zeiger links weist auf den Tag
  else if(clk.canvas) g.drawImage(clk.canvas,0,0,W,W); }
function ckMiniSet(m){ clk.mini=m; ckDrawDisc($('#ckMini'),m); if(!$('#ckZoom').hidden) ckZoomOpen(); }
function ckZoomOpen(){ const z=$('#ckZoom'); z.hidden=false; ckDrawDisc($('#ckBig'),clk.mini);
  $('#ckZoomTxt').textContent=clk.mini==='cal'?tr('Kalenderscheibe am ','Calendar disk on ')+$('#ckDate').textContent+tr(' – der Zeiger links weist auf den Tag.',' – the pointer on the left marks the day.'):tr('Zifferblatt am ','Dial on ')+$('#ckDate').textContent;
  $('#ckZoomX').focus({preventScroll:true}); }
function ckZoomClose(){ const z=$('#ckZoom'); if(z.hidden) return; z.hidden=true; $('#ckZoomBtn').focus({preventScroll:true}); }
$('#ckZoomBtn').addEventListener('click',ckZoomOpen);
$('#ckZoom').addEventListener('click',ckZoomClose);
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#ckZoom').hidden){ e.stopImmediatePropagation(); ckZoomClose(); } },true);
$('#ckGo').addEventListener('click',()=>goView('uhr'));
$('#ckDial').addEventListener('click',()=>{ ckMiniSet('dial'); goView('uhrblatt'); });
$('#ckCal').addEventListener('click',()=>{ ckMiniSet('cal'); goView('uhrkalender'); });
document.querySelector('.rbtn[data-card="clock"]').addEventListener('click',()=>setTimeout(()=>{ clockUpdate(null,true); updateClockCard(); },0));
/* ---------------- Geführter Rundgang ---------------- */

// Stationen: Datum (Monat 0-basiert, Jahr = aktuelles), Uhrzeit in Minuten, Ansicht. Station „moon“ sucht die nächste Vollmondnacht.
const TOUR=[
 {m:4,d:10,t:15*60,v:'aussen',
  de:['St. Marien zu Lübeck','Willkommen! Das Modell zeigt die Marienkirche und wie Sonne und Mond sie zu jeder Stunde des Jahres beleuchten. Ziehen Sie mit der Maus, um die Kirche zu drehen, mit dem Mausrad zoomen Sie. Unten stellen Sie Datum und Uhrzeit ein.'],
  en:["St. Mary's, Lübeck","Welcome! The model shows St. Mary's Church and how sun and moon light it at any hour of the year. Drag with the mouse to turn the church, use the wheel to zoom. Set date and time in the bar at the bottom."]},
 {m:4,d:10,t:10*60+30,v:'sonnenuhr',play:10,
  de:['Die Sonnenuhr','Am Südpfeiler vor der Briefkapelle hängt die Sonnenuhr. Die Zeit läuft jetzt: Sehen Sie, wie der Schatten des Stabes über die Stunden wandert. Sie zeigt die wahre Ortszeit; im Sommer geht unsere Uhr ihr gut eine Stunde voraus.'],
  en:['The sundial','The sundial hangs on the south buttress in front of the Briefkapelle. Time is running now: watch the shadow of the rod move across the hours. It shows apparent solar time; in summer our clocks are more than an hour ahead of it.']},
 {m:5,d:21,t:14*60,v:'totentanz',
  de:['Die Totentanzfenster','Die Fenster von Alfred Mahlau in der Totentanzkapelle liegen auf der Nordseite. Direktes Sonnenlicht fällt hier kaum hinein; die Farben leuchten im gleichmäßigen Himmelslicht. Sie erinnern an den Lübecker Totentanz, der 1942 in der Kirche verbrannte.'],
  en:['The Dance of Death windows','Alfred Mahlau’s windows in the Dance of Death Chapel face north. Hardly any direct sunlight reaches them; their colours glow in the even light of the sky. They recall the Lübeck Dance of Death painting that burned in the church in 1942.']},
 {m:5,d:21,t:11*60+40,v:'uhr',play:10,card:'clock',
  de:['Die Astronomische Uhr','An der Ostwand derselben Kapelle steht die Astronomische Uhr von Paul Behrens, 13,45 Meter hoch. Die Zeit läuft: Der goldene Sonnenzeiger umrundet das 24-Stunden-Zifferblatt einmal am Tag, der Mondzeiger etwas langsamer. Darunter dreht sich die Kalenderscheibe einmal im Jahr.'],
  en:['The astronomical clock',"On the east wall of the same chapel stands Paul Behrens' astronomical clock, 13.45 metres tall. Time is running: the golden sun hand circles the 24-hour dial once a day, the moon hand a little slower. Below, the calendar disk turns once a year."]},
 {m:4,d:10,t:17*60,v:'dachreiter',
  de:['Auf dem Dachreiter','Ein Blick, wie man ihn sonst nur bei den atemberaubenden Turm- und Gewölbeführungen genießen kann: aus der Laterne des Dachreiters, gut 50 Meter hoch, über das Kupferdach zu den Türmen. Ziehen Sie zum Umsehen; mit W/A/S/D oder den Pfeiltasten gehen Sie in der Laterne umher.'],
  en:["On the ridge turret","A view you can otherwise only enjoy on the breathtaking tower and vault tours: from the lantern of the ridge turret, over 50 metres up, across the copper roof to the towers. Drag to look around; W/A/S/D or the arrow keys walk you around the lantern."]},
 {m:5,d:21,t:13*60,v:'himmel',
  de:['Der Weg von Sonne und Mond','Am längsten Tag des Jahres steigt die Sonne in Lübeck fast 60 Grad hoch und zieht einen weiten Bogen von Nordost nach Nordwest. Gestrichelt sehen Sie den Lauf des Mondes vom Aufgang bis zum Untergang, der Ring zeigt, wo er gerade steht. Die Zahlen sind die Uhrzeiten. Schalten Sie einen Tag weiter: Der Mond geht dann rund 50 Minuten später auf.'],
  en:['The paths of sun and moon','On the longest day the sun climbs almost 60 degrees above Lübeck and sweeps a wide arc from north-east to north-west. The dashed line is the moon’s course from rise to set; the ring shows where it is now. The numbers are clock times. Step one day ahead: the moon then rises about 50 minutes later.']},
 {moon:true,v:'aussen',
  de:['Vollmondnacht','Das ist die nächste Vollmondnacht. Auch das Mondlicht fällt durch die Fenster, und sogar die Sonnenuhr wirft dann einen Schatten. Sie zeigt allerdings die »Mondzeit«, die das Modell in wahre Zeit umrechnet.'],
  en:['Full-moon night','This is the next full-moon night. Moonlight falls through the windows too, and even the sundial casts a shadow. It then shows “lunar time”, which the model converts to true time.']},
 {v:'sued',now:true,choice:true,
  de:['Wie geht es weiter?','Das Modell zeigt wieder den heutigen Tag. Testen Sie Ihr Wissen in einem Quiz mit fünf Aufgaben, die Sie im Modell lösen, probieren Sie Experimente zu Sonne, Sonnenuhr, Licht und Mond aus – oder erkunden Sie selbst: Rechts finden Sie alle Bereiche (die Experimente unter dem Kolben), oben weitere Ansichten.'],
  en:["What next?","The model is back at today. Test yourself in a quiz with five tasks you solve in the model, try experiments on sun, sundial, light and moon – or explore on your own: on the right you find all panels (the experiments under the flask), at the top more views."]}];
const tour={i:null};
function tourApply(s){
  if(state.playing) setPlaying(false);
  if(yr.on){ yearStop(); $('#speed').value='30'; state.speed=30; }
  openCard(null);
  if(s.moon){ const nf=moonPhaseTime(Date.now()-12*3600000,180,1); if(nf!==null){ const t=moonTransitNear(nf), off=berlinOffsetMin(t), l=new Date(t+off*60000);
      state.minutes=l.getUTCHours()*60+l.getUTCMinutes(); setDate(l.getUTCFullYear(),l.getUTCMonth(),l.getUTCDate()); } }
  else if(s.now){ const n=berlinNow(); const sp=sunPos(localToUtc(n.y,n.m,n.d,n.minutes)); state.minutes=sp.el>3?n.minutes:12*60+30; setDate(n.y,n.m,n.d); }
  else { state.minutes=s.t; setDate(berlinNow().y,s.m,s.d); }
  goView(s.v);
  if(s.card&&matchMedia('(min-width: 900px)').matches) setTimeout(()=>{ if(tour.i!==null&&TOUR[tour.i]===s){ openCard(s.card); clockUpdate(null,true); } },1300);
  if(s.play){ state.speed=s.play; $('#speed').value=String(s.play); setTimeout(()=>{ if(tour.i!==null&&TOUR[tour.i]===s) setPlaying(true); },1300); }
}
function showTour(){
  const el=$('#tour'), i=tour.i; el.hidden=false; document.body.classList.add('touring');
  if(i<0){ $('#tourStep').textContent=tr('Rundgang','Guided tour'); $('#tourTitle').textContent=tr('Willkommen in St. Marien',"Welcome to St. Mary's");
    $('#tourText').textContent=tr('Möchten Sie einen kurzen Rundgang in acht Stationen machen? Er dauert etwa zwei Minuten.','Would you like a short tour in eight stops? It takes about two minutes.');
    $('#tourEnd').textContent=tr('Selbst erkunden','Explore on my own'); $('#tourPrev').hidden=true; $('#tourNext').textContent=tr('Rundgang starten','Start the tour');
    tourChoice([['tour',tr('Rundgang starten','Start the tour')],['quiz',tr('Quiz: 5 Aufgaben','Quiz: 5 tasks')],['free',tr('Selbst erkunden','Explore on my own')]]); return; }
  const s=TOUR[i], txt=LANG==='en'?s.en:s.de;
  $('#tourStep').textContent=tr('Station ','Stop ')+(i+1)+tr(' von ',' of ')+TOUR.length;
  $('#tourTitle').textContent=txt[0]; $('#tourText').textContent=txt[1];
  $('#tourEnd').textContent=tr('Beenden','End'); $('#tourPrev').hidden=i===0; $('#tourPrev').textContent=tr('Zurück','Back');
  $('#tourNext').textContent=i===TOUR.length-1?tr('Fertig','Done'):tr('Weiter','Next');
  tourChoice(s.choice?[['quiz',tr('Quiz starten','Start the quiz')],['exp',tr('Experimente','Experiments')],['free',tr('Selbst entdecken','Explore on my own')],['tour',tr('Rundgang wiederholen','Repeat the tour')]]:null);
  tourWhen(); tourFit();
}
// Wahl statt Weiter: am Anfang (Willkommen) und an der letzten Station
function tourChoice(list){ const c=$('#tourChoice'), bt=$('#tour .tbtns'); c.hidden=!list; $('#tourEnd').hidden=$('#tourNext').hidden=!!list; bt.style.display=list&&$('#tourPrev').hidden?'none':'';
  if(!list) return; c.querySelectorAll('button').forEach((b,k)=>{ b.hidden=!list[k]; if(!list[k]) return; b.dataset.go=list[k][0]; b.textContent=list[k][1]; }); }
$('#tourChoice').addEventListener('click',e=>{ const g=e.target.closest('button')&&e.target.closest('button').dataset.go; if(!g) return; lsSet('stm-welcomed','1');
  if(g==='tour') tourGo(0); else if(g==='quiz'){ tourEnd(); quizStart(); } else if(g==='exp'){ tourEnd(); document.querySelectorAll('.exppanel').forEach(p=>p.hidden=true); $('#expList').hidden=false; openCard('exp'); } else { tourEnd(); if(state.view!=='sued') goView('sued'); } });
// Datum und Uhrzeit der Station in der Kopfzeile (auf dem Smartphone ist die Zeitleiste während des Rundgangs ausgeblendet)
function tourWhen(){ const w=$('#tourWhen'); if(!w) return;
  w.textContent=tour.i!==null&&tour.i>=0?' · '+ckFmtDay(state.d,state.m)+' · '+fmtT(state.minutes)+' '+tzN(berlinOffsetMin(localToUtc(state.y,state.m,state.d,state.minutes))):''; }
// „mehr“ nur zeigen, wenn der Text gekürzt ist
function tourFit(){ const c=$('#tour'), t=$('#tourText'), b=$('#tourMore'); if(!c||c.hidden) return;
  c.classList.remove('open'); b.textContent=tr('mehr','more');
  requestAnimationFrame(()=>{ b.hidden=!(t.scrollHeight>t.clientHeight+2); }); }
$('#tourMore').addEventListener('click',()=>{ const c=$('#tour'), o=c.classList.toggle('open'); $('#tourMore').textContent=o?tr('weniger','less'):tr('mehr','more'); });
addEventListener('resize',()=>{ if(tour.i!==null) tourFit(); });
function tourGo(i){ tour.i=i; showTour(); if(i>=0) tourApply(TOUR[i]); $('#tourNext').focus({preventScroll:true}); }
function tourEnd(){ if(state.playing&&tour.i!==null&&tour.i>=0) setPlaying(false); if(tour.i!==null&&tour.i>=0){ state.speed=30; $('#speed').value='30'; } tour.i=null; $('#tour').hidden=true; document.body.classList.remove('touring'); lsSet('stm-welcomed','1'); if(!quiz||quiz.i===null) setTimeout(introExplore,400); }
$('#tourNext').addEventListener('click',()=>{ if(tour.i===TOUR.length-1) tourEnd(); else { lsSet('stm-welcomed','1'); tourGo(tour.i+1); } });
$('#tourPrev').addEventListener('click',()=>{ if(tour.i>0) tourGo(tour.i-1); });
$('#tourEnd').addEventListener('click',tourEnd);
$('#tourBtn').addEventListener('click',()=>{ if(quiz.i!==null) quizEnd(); tourGo(0); });
$('#homeBtn').addEventListener('click',()=>{ if(tour.i!==null) tourEnd(); if(quiz.i!==null) quizEnd(); if(state.playing) setPlaying(false); yearStop(); state.speed=30; $('#speed').value='30'; openCard(null);
  const n=berlinNow(), sp=sunPos(localToUtc(n.y,n.m,n.d,n.minutes)); state.minutes=sp.el>3?n.minutes:12*60+30; setDate(n.y,n.m,n.d); goView('sued'); });
// Zeitleiste: Tagesdiagramm auf kleinen Bildschirmen auf- und zuklappen
function setTbOpen(o){ document.body.classList.toggle('tbopen',o); const b=$('#tbFold'); b.setAttribute('aria-expanded',String(o));
  b.setAttribute('aria-label',o?tr('Tagesdiagramm ausblenden','Hide day chart'):tr('Tagesdiagramm zeigen','Show day chart')); lsSet('stm-tbopen',o?'1':'0'); }
$('#tbFold').addEventListener('click',()=>setTbOpen(!document.body.classList.contains('tbopen')));
if(lsGet('stm-tbopen')==='1') document.body.classList.add('tbopen');
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&tour.i!==null&&$('#views').hidden&&$('#presets').hidden) tourEnd(); });
/* ---------------- Experimente: Mond zwischen den Türmen (Assistent für Fotografen) ---------------- */

// Standort auf der Verlängerung der Kirchenachse (z = 0), westlich oder östlich der Türme. Der Mond steht »zwischen den Türmen«,
// wenn seine Richtung die Ebene der Turmachsen (x = TW.xc) zwischen den beiden Turmmitten und unterhalb der Helmspitzen trifft
// und der Blick dorthin nicht von Dach, Turm oder (im Umkreis von 200 m) von Häusern verdeckt ist.
const MZT={side:'w',dist:700,res:null,busy:false,zN:(TW.n[0]+TW.n[1])/2,zS:(TW.s[0]+TW.s[1])/2,top:Math.min(T_GTIP[0]+T_HELM[0],T_GTIP[1]+T_HELM[1])};
MZT.zc=(MZT.zN+MZT.zS)/2; MZT.half=(MZT.zS-MZT.zN)/2;
function mtObs(){ const x=TW.xc+(MZT.side==='w'?-MZT.dist:MZT.dist), g=envG?envSample(envG,ENV.gn,ENV.gstep,x,0):-1e9;
  return new V3(x,(g>-1e8?g:(ENV?ENV.base:0))+1.7,0); }
// Markierung: rote Achse in beide Richtungen und Standort-Stecknadel, nur solange der Assistent offen ist
const mtGroup=new THREE.Group(); mtGroup.visible=false; scene.add(mtGroup);
{ const m=new THREE.MeshBasicMaterial({color:0xd0402a,depthTest:false,transparent:true,opacity:0.85,fog:false});
  const g=new THREE.PlaneGeometry(4300,1); g.rotateX(-Math.PI/2); MZT.axis=new THREE.Mesh(g,m); MZT.axis.position.set(TW.xc,0.4,0); MZT.axis.renderOrder=20; mtGroup.add(MZT.axis);
  const pm=new THREE.MeshBasicMaterial({color:0xffd23c,depthTest:false,transparent:true,fog:false});
  MZT.pin=new THREE.Mesh(new THREE.RingGeometry(0.7,1,40).rotateX(-Math.PI/2),pm); MZT.pin.renderOrder=21; mtGroup.add(MZT.pin);
  MZT.pole=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,30,8).translate(0,15,0),new THREE.MeshBasicMaterial({color:0xffd23c,fog:false})); mtGroup.add(MZT.pole); }
function mtActive(){ return !$('#card-exp').hidden&&!$('#exp-mt').hidden; }
function mtSync(){ const on=mtActive()||state.view==='mtTop'; mtGroup.visible=on&&state.view!=='mtCam'; if(!on) return;
  const W=renderer.domElement.clientWidth||800, v=VIEWS.mtTop, mpp=v&&state.view==='mtTop'?2*v.pos[1]*Math.tan(27.5*rad)*camera.aspect/W:MZT.dist*0.002;   // Meter je Bildpunkt in der Draufsicht
  const O=mtObs(), sc=Math.max(4,mpp*11); MZT.pin.position.set(O.x,O.y+0.5,0); MZT.pin.scale.setScalar(sc); MZT.pole.position.set(O.x,O.y-1.7,0); MZT.pole.scale.set(sc/4,Math.max(1,MZT.dist/400),sc/4);
  MZT.axis.scale.z=Math.max(1.5,mpp*3); requestRender(); }
function mtGeo(){ const d=MZT.dist, O=mtObs(), w=2*Math.atan(MZT.half/d)/rad, top=Math.atan((MZT.top-O.y)/d)/rad;
  $('#mtDistOut').textContent=dc(String(d))+' m';
  $('#mtGeo').textContent=tr('Von dort erscheinen die Turmspitzen '+fmtDeg(top)+' hoch; die Turmmitten liegen '+fmtDeg(w)+' auseinander, der Mond ist 0,5° groß. ','From there the spires appear '+fmtDeg(top)+' high; the tower centres are '+fmtDeg(w)+' apart, the moon is 0.5° across. ')
    +(MZT.side==='w'?tr('Von Westen sieht man den Mond hinter den Türmen meist aufgehen.','From the west you mostly see the moon rising behind the towers.'):tr('Von Osten sieht man ihn über Chor und Dach hinweg untergehen.','From the east you see it setting beyond the choir and roof.')); }
function mtSetSide(sd){ const ch=MZT.side!==sd; MZT.side=sd; if(ch&&state.view==='mtTop') setTimeout(()=>mtTopView(),0); document.querySelectorAll('#mtSide [data-side]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.side===sd))); mtClear(); }
function mtSetDist(d){ MZT.dist=Math.round(Math.min(2000,Math.max(150,d))/10)*10; $('#mtDist').value=MZT.dist; mtClear(); }
function mtClear(){ MZT.res=null; $('#mtRes').innerHTML=''; $('#mtSum').textContent=''; mtGeo(); mtSync(); }
function mtTopView(instant){   // ganze Achse der gewählten Seite (bis 2 km) samt Kirche im freien Bildteil (neben bzw. über der offenen Karte)
  const sg=MZT.side==='w'?-1:1, x0=Math.min(TW.xc-sg*170,TW.xc+sg*2060), x1=Math.max(TW.xc-sg*170,TW.xc+sg*2060), span=x1-x0;
  const cv=renderer.domElement.getBoundingClientRect(), W=cv.width||1, H=cv.height||1, card=$('#card-exp'); let fx0=0.02, fx1=0.98, fy0=0.12, fy1=0.88;
  if(!card.hidden){ const r=card.getBoundingClientRect(); if(r.top>H*0.3) fy1=Math.max(0.3,(r.top-cv.top)/H-0.03); else fx1=Math.max(0.35,(r.left-cv.left)/W-0.03); }
  const a=W/H, tanH=Math.tan(27.5*rad)*a, totW=span/(fx1-fx0), h=totW/(2*tanH), totH=totW/a;
  const cx=(x0+x1)/2-((fx0+fx1)/2-0.5)*totW, cz=(0.5-(fy0+fy1)/2)*totH;
  VIEWS.mtTop={pos:[cx,h,cz+h*0.02],tgt:[cx,0,cz],mode:'orbit',cut:60,exp:0.85,fov:55}; goView('mtTop',instant); mtSync(); }
// Ist der Mond in Richtung D vom Standort O aus zwischen den Türmen zu sehen? Gibt den seitlichen Versatz zur Mitte (m in der Turmebene) zurück, sonst null
const _mtD=new V3(), _mtP=new V3();
function mtTest(O,el,az,slack){ sunVec(el,az,_mtD); if(O.x<TW.xc?_mtD.x<=1e-6:_mtD.x>=-1e-6) return null;
  const t=(TW.xc-O.x)/_mtD.x; _mtP.copy(O).addScaledVector(_mtD,t); const dz=_mtP.z-MZT.zc;
  if(Math.abs(dz)>MZT.half+slack||_mtP.y>MZT.top+slack||_mtP.y<20-slack) return null;
  return {dz,y:_mtP.y,t}; }
function mtVisible(O,t){ rc.set(O,_mtD); const far=rc.far; rc.far=t+25; const hit=rc.intersectObjects(occluders,false).length>0; rc.far=far; if(hit) return false;
  if(!envH) return true; const st=1/Math.max(Math.hypot(_mtD.x,_mtD.z),1e-3);   // Häuser im Umkreis von 200 m (ohne die Kirche selbst)
  for(let u=2;u<t;u+=st){ const x=O.x+_mtD.x*u, z=O.z+_mtD.z*u, y=O.y+_mtD.y*u; if(Math.abs(x)>199||Math.abs(z)>199) continue; if(x>-58&&x<64&&Math.abs(z)<36) continue;
    if(envHeightAt(x,z)>y) return false; }
  return true; }
async function mtSearch(){ if(MZT.busy) return; MZT.busy=true; document.querySelectorAll('#exp-mt button,#exp-mt input').forEach(x=>x.disabled=true); busyShow(tr('Termine werden gesucht …','Searching dates …'));
  await new Promise(r=>setTimeout(r,30));
  const O=mtObs(), t0=Math.max(localToUtc(state.y,state.m,state.d,0),DATE_MIN), t1=Math.min(t0+183*86400000,DATE_MAX+864e5), st=4*60000, fine=15000, out=[];
  const slack=14+MZT.dist*0.025;
  let tick=performance.now();
  for(let t=t0;t<t1;t+=st){
    if(performance.now()-tick>150){ busyText(tr('Termine werden gesucht … ','Searching dates … ')+Math.round((t-t0)/(t1-t0)*100)+' %'); await new Promise(r=>setTimeout(r,0)); tick=performance.now(); }
    const m=moonPos(t); if(m.el<-1) continue; if(!mtTest(O,m.el,m.az,slack)) continue;
    let ev=null;   // fein: 15 s im Umkreis
    for(let u=t-st;u<=t+st;u+=fine){ const q=moonPos(u), r=mtTest(O,q.el,q.az,0); const ok=r&&q.el>0&&mtVisible(O,r.t);
      if(ok){ if(!ev) ev={a:u,b:u,best:u,bd:Math.abs(r.dz),bel:q.el,baz:q.az,by:r.y}; else { ev.b=u; if(Math.abs(r.dz)<ev.bd){ ev.bd=Math.abs(r.dz); ev.best=u; ev.bel=q.el; ev.baz=q.az; ev.by=r.y; } } }
      else if(ev) break; }
    if(ev){ const last=out[out.length-1]; if(last&&ev.a-last.b<=st+fine){ if(ev.bd<last.bd) Object.assign(last,{best:ev.best,bd:ev.bd,bel:ev.bel,baz:ev.baz,by:ev.by}); last.b=Math.max(last.b,ev.b); }
      else out.push(ev); t=Math.max(t,ev.b); } }
  out.forEach(e=>{ const mp=moonPos(e.best); e.k=mp.k; e.elong=mp.elong; e.sun=sunPos(e.best).el; e.rising=moonPos(e.best+600000).el>e.bel; });
  MZT.res={list:out,O:O.toArray(),side:MZT.side,dist:MZT.dist,from:t0}; busyHide(); MZT.busy=false; document.querySelectorAll('#exp-mt button,#exp-mt input').forEach(x=>x.disabled=false); mtRender(); }
function mtSunTxt(el){ return el>-0.83?tr('Tag','daylight'):el>-6?tr('bürgerliche Dämmerung','civil twilight'):el>-12?tr('nautische Dämmerung (blaue Stunde)','nautical twilight (blue hour)'):tr('Nacht','night'); }
function mtRender(){ const ul=$('#mtRes'); ul.innerHTML=''; const R=MZT.res; if(!R) return;
  $('#mtSum').textContent=R.list.length?tr(R.list.length+' Termine in den sechs Monaten ab '+fmtDateL(R.from)+', zum Ansehen antippen:',R.list.length+' dates in the six months from '+fmtDateL(R.from)+', tap to view:')
    :tr('In diesen sechs Monaten steht der Mond von hier aus nicht sichtbar zwischen den Türmen. Probieren Sie eine andere Entfernung.','From here the moon does not stand visibly between the towers in these six months. Try another distance.');
  R.list.forEach((e,i)=>{ const li=document.createElement('li'), b=document.createElement('button'), off=berlinOffsetMin(e.best), l=new Date(e.best+off*60000), la=new Date(e.a+off*60000), lb=new Date(e.b+off*60000);
    const day=LANG==='en'?WD_EN[l.getUTCDay()]+' '+l.getUTCDate()+' '+MON_EN[l.getUTCMonth()]+' '+l.getUTCFullYear():WD[l.getUTCDay()]+' '+l.getUTCDate()+'.'+(l.getUTCMonth()+1)+'.'+l.getUTCFullYear();
    const hm=d=>pad2(d.getUTCHours())+':'+pad2(d.getUTCMinutes());
    b.innerHTML='<b>'+day+', '+hm(l)+' '+tzN(off)+'</b><br><span class="mtq">'+tr('im Spalt ','in the gap ')+hm(la)+'–'+hm(lb)+' · '+(e.rising?tr('aufgehend','rising'):tr('sinkend','setting'))+' · '+tr('Höhe ','altitude ')+fmtDeg(e.bel)+'<br>'
      +moonPhaseName(e.elong)+', '+Math.round(e.k*100)+tr(' % beleuchtet',' % lit')+' · '+mtSunTxt(e.sun)+'</span>';
    b.addEventListener('click',()=>mtShow(e)); li.appendChild(b); ul.appendChild(li); }); }
function mtShow(e){ if(state.playing) setPlaying(false); if(!state.moon){ state.moon=true; $('#moonTog').checked=true; }
  gotoInstant(e.best); const O=new V3(...MZT.res.O), D=sunVec(e.bel,e.baz,new V3()), f=2*Math.atan(Math.max(70,MZT.half*2.2)/MZT.res.dist)/rad*1.3;
  VIEWS.mtCam={pos:O.toArray(),dir:D.toArray(),mode:'inside',cut:60,exp:1.0,fov:Math.min(40,Math.max(2.5,f))};
  goView('mtCam'); if(!matchMedia('(min-width: 900px)').matches) openCard(null); }
document.querySelectorAll('#expList .explink').forEach(b=>b.addEventListener('click',()=>{ $('#expList').hidden=true; $('#exp-'+b.dataset.exp).hidden=false; expOpen(b.dataset.exp); }));
document.querySelectorAll('.exppanel .expback').forEach(b=>b.addEventListener('click',()=>{ b.closest('.exppanel').hidden=true; $('#expList').hidden=false; mtSync(); if(state.view==='mtTop'||state.view==='mtCam'||state.view==='lkIn') goView('sued'); }));
document.querySelectorAll('#mtSide [data-side]').forEach(b=>b.addEventListener('click',()=>mtSetSide(b.dataset.side)));
$('#mtTopBtn').addEventListener('click',()=>mtTopView());
$('#mtDist').addEventListener('input',e=>mtSetDist(+e.target.value));
$('#mtFind').addEventListener('click',mtSearch);
// Draufsicht: Fingertipp auf oder neben die rote Linie setzt den Standort (Seite und Entfernung)
{ let pd=null; renderer.domElement.addEventListener('pointerdown',e=>{ pd={x:e.clientX,y:e.clientY,t:performance.now()}; });
  addEventListener('pointerup',e=>{ const p=pd; pd=null; if(!p||state.view!=='mtTop'||tween) return; if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>6||performance.now()-p.t>700) return;
    const r=renderer.domElement.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) return;
    rc.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
    const hit=new V3(); if(!rc.ray.intersectPlane(new THREE.Plane(new V3(0,1,0),0),hit)) return;
    const dx=hit.x-TW.xc; if(Math.abs(dx)<100) return; MZT.side=dx<0?'w':'e'; mtSetSide(MZT.side); mtSetDist(Math.abs(dx)); }); }
/* ---------------- Experimente 1–4: Kirche als Sonnenuhr, Sonnenuhr und Armbanduhr, Lichtkalender, Uhr und Himmel ---------------- */
var expReady=false;   // erst nach dem Aufbau aktualisieren (updateReadouts läuft schon vorher)
const expPanel=k=>!$('#card-exp').hidden&&!$('#exp-'+k).hidden;
function expOpen(k){ if(state.playing) setPlaying(false); if(yr.on){ yearStop(); state.speed=30; $('#speed').value='30'; }
  if(k==='mt'){ mtGeo(); mtSync(); mtTopView(); }
  else if(k==='ks') ksSet(5);
  else if(k==='su'){ suGo('today'); }
  else if(k==='lk'){ lkFill(); lkRun(); }
  else if(k==='au'){ auGo(0); }
  expTick(); }
function expTick(){ if(!expReady) return; try{
  if(expPanel('ks')){ const sh=cur.el>0.5?Math.round(TOWER_H/Math.tan(cur.el*rad)):null;
    $('#ksEl').textContent=cur.el>-0.3?fmtDeg(cur.el)+' '+dirName(cur.az):tr('unter dem Horizont','below the horizon');
    $('#ksSh').textContent=sh===null?'–':sh>3000?tr('über 3 km','over 3 km'):dc(String(sh))+' m';
    $('#ksMax').textContent=fmtDeg(day.maxEl)+tr(' um ',' at ')+fmtT(day.maxT);
    $('#ksLen').textContent=day.rise!==null&&day.set!==null?Math.floor((day.set-day.rise)/60)+' h '+pad2(Math.round((day.set-day.rise)%60))+' min':'–';
    document.querySelectorAll('#ksSeg [data-m]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.m===state.m&&state.d===21))); }
  if(expPanel('su')) suText();
  if(expPanel('au')) auTable();
  if(expPanel('lk')){ if(LK.cur&&LK.cur.y!==state.y&&!LK.busy) lkRun(); else lkDraw(); }
}catch(e){ console.warn(e); } }
const TOWER_H=124.95;
// 1 Kirche als Sonnenuhr
function ksSet(m){ const keep=state.view==='luft'; state.minutes=state.minutes>=8*60&&state.minutes<=16*60&&keep?state.minutes:13*60; setDate(state.y,m,21); if(!keep) goView('luft'); expTick(); }
document.querySelectorAll('#ksSeg [data-m]').forEach(b=>b.addEventListener('click',()=>{ if(state.playing) setPlaying(false); ksSet(+b.dataset.m); }));
$('#ksPlay').addEventListener('click',()=>{ if(state.playing){ setPlaying(false); return; } if(day.rise!==null) setMinutes(Math.max(0,Math.floor(day.rise)-20)); state.speed=60; $('#speed').value='60'; setPlaying(true); });
// 2 Sonnenuhr und Armbanduhr (wahrer Mittag: trueNoon in src/astro/sun.js)
let suYear=null;
function suScan(y){ if(suYear&&suYear.y===y) return suYear; const r={y,min:null,win:null,sum:null};
  for(let t=Date.UTC(y,0,1);t<Date.UTC(y+1,0,1);t+=864e5){ const dd=new Date(t), m=dd.getUTCMonth(), d=dd.getUTCDate(), n=trueNoon(y,m,d), off=berlinOffsetMin(localToUtc(y,m,d,n)), diff=n-720, e={m,d,n,diff};
    if(!r.min||Math.abs(diff)<Math.abs(r.min.diff)) r.min=e;
    if(off===60&&(!r.win||diff>r.win.diff)) r.win=e;
    if(off===120&&(!r.sum||diff>r.sum.diff)) r.sum=e; }
  return suYear=r; }
function suGo(k){ if(state.playing) setPlaying(false); let y=state.y, m=state.m, d=state.d;
  if(k==='today'){ const n=berlinNow(); y=n.y; m=n.m; d=n.d; } else { const r=suScan(state.y)[k]; m=r.m; d=r.d; }
  state.minutes=Math.round(trueNoon(y,m,d)); setDate(y,m,d); if(state.view!=='sonnenuhr') goView('sonnenuhr'); expTick(); }
document.querySelectorAll('#suBtns [data-k]').forEach(b=>b.addEventListener('click',()=>suGo(b.dataset.k)));
let suLastDay=null;
function suText(){ const key=state.y+'-'+state.m+'-'+state.d;   // Datum geändert: wieder auf den wahren Mittag stellen
  if(suLastDay!==null&&suLastDay!==key&&!state.playing){ suLastDay=key; state.minutes=Math.round(trueNoon(state.y,state.m,state.d)); updateSun(true); return; }
  suLastDay=key; const n=trueNoon(state.y,state.m,state.d), off=berlinOffsetMin(localToUtc(state.y,state.m,state.d,n)), diff=Math.round(n-720);
  const day=ckFmtDay(state.d,state.m)+' '+state.y, lit=sd.lit?'':tr(' Im Modell liegt die Sonnenuhr dann im Schatten eines Nachbarhauses; das Modell rechnet den Stabschatten trotzdem.',' In the model the sundial then lies in the shadow of a neighbouring house; the model still computes the rod’s shadow.');
  $('#suNow').textContent=tr('Am '+day+' zeigt die Sonnenuhr 12 Uhr, wenn die Armbanduhr '+fmtT(n)+' '+tzN(off)+' zeigt – ','On '+day+' the sundial shows 12 o’clock when the watch shows '+fmtT(n)+' '+tzN(off)+' – ')
    +(Math.abs(diff)<0.5?tr('fast genau gleich.','almost exactly the same.'):tr('die Sonnenuhr geht '+Math.abs(diff)+(Math.abs(diff)===1?' Minute ':' Minuten ')+(diff>0?'nach':'vor')+'.','the sundial is '+Math.abs(diff)+(Math.abs(diff)===1?' minute ':' minutes ')+(diff>0?'behind':'ahead')+'.'))+lit; }
// 3 Lichtkalender eines Fensters
const LK={busy:false,cache:{},sel:0,list:[]};
function lkFill(){ if(LK.list.length) return; const pick=(f,score)=>{ let b=null,bs=-1e9; windows.forEach((w,i)=>{ if(f(w)){ const sc=score(w); if(sc>bs){ bs=sc; b=i; } } }); return b; };
  const cand=[['Westfenster (Auferstehungsfenster)','West window (Resurrection window)',pick(w=>w.type===0,w=>w.apex)],
    ['Briefkapelle, Südseite','Briefkapelle, south side',pick(w=>w.type===2,w=>-Math.abs(w.center.x+28.65)-Math.abs(w.center.y-7.5))],
    ['Hochfenster Südseite des Mittelschiffs','South clerestory window of the nave',pick(w=>w.type<0&&w.outN.z>0.9,w=>w.center.y*10-Math.abs(w.center.x))],
    ['Marientidenkapelle, Ostfenster','Marientiden Chapel, east window',pick(w=>w.type===5&&w.center.x>40,w=>w.outN.x)],
    ['Totentanzfenster (Nordseite)','Dance of Death window (north side)',pick(w=>w.type===1,w=>w.apex)]];
  LK.list=cand.filter(c=>c[2]!==null); const sl=$('#lkWin'); sl.innerHTML=''; LK.list.forEach((c,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=LANG==='en'?c[1]:c[0]; sl.appendChild(o); }); sl.value=String(LK.sel); }
$('#lkWin').addEventListener('change',e=>{ LK.sel=+e.target.value; lkRun(); });
const LK_COLS=72, LK_T0=4*60, LK_ROWS=24, _lkL=new V3(), _lkSave=new V3();
async function lkRun(){ if(LK.busy) return; const c=LK.list[LK.sel]; if(!c) return; const w=windows[c[2]], key=c[2]+'-'+state.y+'-'+(state.env?1:0)+(state.trees?1:0);
  if(!LK.cache[key]){ LK.busy=true; busyShow(tr('Lichtkalender wird berechnet …','Computing the light calendar …')); await new Promise(r=>setTimeout(r,30));
    const g=new Float32Array(LK_ROWS*LK_COLS); _lkSave.copy(LD); let tick=performance.now();
    for(let r=0;r<LK_ROWS;r++){ const m=r>>1, d=r&1?15:1;
      for(let k=0;k<LK_COLS;k++){ const mi=LK_T0+k*15, sp=sunPos(localToUtc(state.y,m,d,mi)); if(sp.el<=0){ g[r*LK_COLS+k]=-1; continue; }
        sunVec(sp.el,sp.az,_lkL); if(_lkL.dot(w.outN)<=0.01){ g[r*LK_COLS+k]=0; continue; }
        LD.copy(_lkL); let ok=0; for(const o of w.occ){ rc.set(o,_lkL); if(!envBlocked(o)&&rc.intersectObjects(occluders,false).length===0) ok++; } g[r*LK_COLS+k]=ok/w.occ.length; }
      if(performance.now()-tick>150){ LD.copy(_lkSave); busyText(tr('Lichtkalender wird berechnet … ','Computing the light calendar … ')+Math.round((r+1)/LK_ROWS*100)+' %'); await new Promise(res=>setTimeout(res,0)); tick=performance.now(); } }
    LD.copy(_lkSave); LK.cache[key]=g; busyHide(); LK.busy=false; }
  LK.cur={g:LK.cache[key],w,y:state.y}; lkDraw(); lkSum(); }
function lkSum(){ const g=LK.cur.g; let days=0, any=new Set(), first=null, last=null, hrs=0;
  for(let r=0;r<LK_ROWS;r++){ let lit=false; for(let k=0;k<LK_COLS;k++){ const v=g[r*LK_COLS+k]; if(v>0.3){ lit=true; hrs+=0.25; } } if(lit) any.add(r); }
  $('#lkSum').textContent=any.size?tr('Direktes Sonnenlicht an '+any.size+' von 24 Stichtagen, zusammen etwa '+Math.round(hrs)+' Stunden.','Direct sunlight on '+any.size+' of 24 sample days, about '+Math.round(hrs)+' hours in all.')
    :tr('An keinem der 24 Stichtage fällt direktes Sonnenlicht durch dieses Fenster.','On none of the 24 sample days does direct sunlight fall through this window.'); }
function lkDraw(){ const cv=$('#lkCv'); if(!cv||!LK.cur) return; const g=cv.getContext('2d'), W=cv.width, H=cv.height, L=34, B=18, cw=(W-L-4)/LK_COLS, ch=(H-B-4)/LK_ROWS, dk=matchMedia('(prefers-color-scheme: dark)').matches;
  g.clearRect(0,0,W,H); g.font='11px "IBM Plex Mono", monospace'; g.fillStyle=dk?'#cfc6bb':'#5e5852';
  for(let r=0;r<LK_ROWS;r++) for(let k=0;k<LK_COLS;k++){ const v=LK.cur.g[r*LK_COLS+k];
    g.fillStyle=v<0?(dk?'#1d2230':'#3a4152'):v<=0?(dk?'#4a4640':'#d9d4cb'):'rgba(232,170,40,'+(0.35+0.65*v)+')'; g.fillRect(L+k*cw,2+r*ch,Math.ceil(cw),Math.ceil(ch)); }
  g.fillStyle=dk?'#cfc6bb':'#5e5852'; g.textAlign='right'; g.textBaseline='middle';
  const MON=LANG==='en'?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']:['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  for(let m=0;m<12;m++) g.fillText(MON[m],L-4,2+(2*m+1)*ch);
  g.textAlign='center'; g.textBaseline='top'; for(let h=6;h<=21;h+=3){ const x=L+(h*60-LK_T0)/15*cw; g.fillText(String(h),x,H-B+3); g.fillRect(x-0.5,H-B-2,1,3); }
  const rr=state.m*2+(state.d>=8?1:0)+(state.d>=23?1:0), row=Math.min(23,state.m*2+(state.d>=15?1:0)), x=L+(state.minutes-LK_T0)/15*cw;   // aktueller Zeitpunkt
  if(x>=L&&x<=W-4){ g.strokeStyle=dk?'#fff':'#9b3a26'; g.lineWidth=2; g.strokeRect(x-cw,2+row*ch,2*cw,ch); } }
$('#lkCv').addEventListener('click',e=>{ if(!LK.cur) return; const cv=$('#lkCv'), b=cv.getBoundingClientRect(), x=(e.clientX-b.left)*cv.width/b.width, y=(e.clientY-b.top)*cv.height/b.height;
  const L=34, B=18, cw=(cv.width-L-4)/LK_COLS, ch=(cv.height-B-4)/LK_ROWS, k=Math.floor((x-L)/cw), r=Math.floor((y-2)/ch); if(k<0||k>=LK_COLS||r<0||r>=LK_ROWS) return;
  if(state.playing) setPlaying(false); state.minutes=LK_T0+k*15+7; setDate(state.y,r>>1,r&1?15:1); lkView(); });
function lkView(){ const w=LK.cur.w, back=Math.min(16,Math.max(7,w.hw*5)), P=w.center.clone().addScaledVector(w.inward,back); P.y=Math.max(1.7,Math.min(P.y,w.bottom+1.7));
  const D=w.center.clone().sub(P).normalize(); VIEWS.lkIn={pos:P.toArray(),dir:D.toArray(),mode:'inside',cut:60,exp:1.6,fov:70}; goView('lkIn'); }
// 4 Astronomische Uhr und Himmel (nur Vergleich, die Uhr selbst bleibt unverändert)
function auGo(dd){ if(state.playing) setPlaying(false); if(dd===0){ const n=berlinNow(); state.minutes=n.minutes; setDate(n.y,n.m,n.d); }
  else { const t=new Date(Date.UTC(state.y,state.m,state.d)+dd*864e5); setDate(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()); }
  if(state.view!=='uhrblatt') goView('uhrblatt'); clockUpdate(null,true); expTick(); }
document.querySelectorAll('#auBtns [data-d]').forEach(b=>b.addEventListener('click',()=>auGo(+b.dataset.d)));
function auTable(){ const st=clk.st; if(!st) return; const sp=sunPos(st.utc), woz=12+sp.H/15, m=moonCur, ageSky=moonAge(st.utc);
  const rows=[[tr('Sonne: Zeit','Sun: time'),ckHM(st.hrs)+' '+tzN(st.off),ckHM(woz)+tr(' WOZ',' AST')],
    [tr('Sonne im Sternbild','Sun in constellation'),ckSign(ckClockSign(st)),ckSign(ckSkySign(st.utc))],
    [tr('Mondalter','Moon age'),dc(st.age.toFixed(1))+tr(' Tage',' d'),ageSky!==null?dc(ageSky.toFixed(1))+tr(' Tage',' d'):'–'],
    [tr('Mondphase','Moon phase'),moonPhaseName(st.age/CKR.MC*360),m?moonPhaseName(m.elong):'–']];
  $('#auCmp').innerHTML=rows.map(r=>'<tr><th scope="row">'+r[0]+'</th><td>'+r[1]+'</td><td>'+r[2]+'</td></tr>').join('');
  const dm=ageSky!==null?ckWrap(st.age-ageSky)*24:null;
  $('#auNote').textContent=dm===null?'':Math.abs(dm)<0.5?tr('Der Mond der Uhr stimmt heute fast genau mit dem Himmel überein.','Today the clock’s moon almost exactly matches the sky.')
    :tr('Der Mond der Uhr ist dem Himmel '+dc(Math.abs(dm).toFixed(1))+' Stunden '+(dm>0?'voraus':'hinterher')+'.','The clock’s moon is '+Math.abs(dm).toFixed(1)+' hours '+(dm>0?'ahead of':'behind')+' the sky.'); }
/* ---------------- Quiz: fünf Aufgaben, die man im Modell löst ---------------- */
// Arten: set = Zustand einstellen, das Modell prüft laufend; mc = ablesen und wählen; pick = Fenster antippen
const fmtDateL=ms=>{ const l=new Date(ms+berlinOffsetMin(ms)*60000); return LANG==='en'?l.getUTCDate()+' '+CK_MON_EN[l.getUTCMonth()]+' '+l.getUTCFullYear():l.getUTCDate()+'. '+CK_MON[l.getUTCMonth()]+' '+l.getUTCFullYear(); };
const QZ=[
 {kind:'set',view:'aussen',min:13*60,
  q:()=>[tr('Die Kirche als Sonnenuhr','The church as a sundial'),tr('Stellen Sie unten das Datum so ein, dass der Schatten der Türme um 13 Uhr am kürzesten ist.','Use the date below to find the day on which the towers’ shadow at 1 pm is shortest.')],
  hint:()=>{ goView('aussen'); return tr('Die Sonne steht mittags am höchsten, wenn der Sommer beginnt. Unter »Besondere Tage« finden Sie den Sommeranfang.','The midday sun is highest at the start of summer. »Special days« lists the summer solstice.'); },
  check:()=>!state.playing&&Math.abs(dayOfYear()-171)<=10,
  solve:()=>setDate(state.y,5,21),
  ok:()=>tr('Richtig: um den 21. Juni steht die Sonne mittags gut 59° hoch, der 125 m hohe Turm wirft dann nur rund 73 m Schatten. Am 21. Dezember sind es bei knapp 13° Sonnenhöhe über 550 m. So zeigt die ganze Kirche mit ihrem Schatten Tageszeit und Jahreszeit an.','Correct: around 21 June the midday sun stands about 59° high and the 125 m tower casts only about 73 m of shadow. On 21 December, at barely 13°, it is more than 550 m. With its shadow the whole church shows the time of day and the season.')},
 {kind:'mc',view:'sonnenuhr',
  q:()=>[tr('Die Sonnenuhr','The sundial'),tr('Fliegen Sie zur Sonnenuhr am Südturm. Welche Jahreszahl steht auf der Platte?','Fly to the sundial on the south tower. Which year is written on the plate?')],
  opts:()=>[['1561',0],['1968',1],['2002',0]],
  hint:()=>{ goView('sonnenuhr'); return tr('Schauen Sie in die obere rechte Ecke der Platte.','Look at the upper right corner of the plate.'); },
  ok:()=>tr('Richtig: rechts oben steht 1968, links »REN« – wahrscheinlich für »renoviert«. Die Zahl nennt also eine Erneuerung, nicht das Alter der Sonnenuhr.','Correct: 1968 is at the top right, »REN« at the top left – probably for »renovated«. So the year marks a renewal, not the age of the sundial.'),
  no:()=>tr('Nicht ganz. Schauen Sie noch einmal genau auf die Platte, oben rechts.','Not quite. Have another close look at the plate, top right.')},
 {kind:'set',view:'sonnenuhr',min:11*60,m:4,d:10,card:'sd',
  q:()=>[tr('Wahre Zeit und Uhrzeit','True time and clock time'),tr('Es ist der 10. Mai. Stellen Sie die Uhrzeit so ein, dass der Schatten auf der Sonnenuhr genau 12 Uhr zeigt.','It is 10 May. Set the time so that the shadow on the sundial shows exactly 12 o’clock.')],
  hint:()=>{ goView('sonnenuhr'); if(matchMedia('(min-width: 900px)').matches) openCard('sd'); return tr('Ziehen Sie den Zeitregler langsam; die Karte »Sonnenuhr« zeigt die Ablesung in Minuten.','Move the time slider slowly; the »Sundial« card shows the reading to the minute.'); },
  check:()=>!state.playing&&sd.show!==null&&sd.lit&&Math.abs(sd.show-12)<=5/60,
  solve:()=>{ let m=state.minutes; for(let k=0;k<3;k++){ const p=sunPos(localToUtc(state.y,state.m,state.d,m)), w=((12+p.H/15)%24+24)%24; m+=(12-w)*60; } setMinutes(Math.round(m)); $('#time').value=String(Math.round(m)); },
  ok:()=>{ const off=berlinOffsetMin(localToUtc(state.y,state.m,state.d,state.minutes)), when=fmtT(state.minutes);
    return tr('Richtig: die Sonnenuhr zeigt 12 Uhr, Ihre Armbanduhr aber schon '+when+' Uhr. Die Sonnenuhr richtet sich nach der Sonne: 12 Uhr ist, wenn die Sonne genau im Süden steht. Unsere Uhren richten sich dagegen nach dem Sonnenstand in Görlitz an der polnischen Grenze. Lübeck liegt weiter westlich, deshalb steht die Sonne hier erst etwa eine Viertelstunde später im Süden'+(off===120?' – und im Sommer kommt noch eine Stunde Sommerzeit dazu.':'.'),
              'Correct: the sundial shows 12 o’clock, but your watch already says '+when+'. The sundial follows the sun: 12 o’clock is when the sun stands due south. Our clocks, however, follow the position of the sun at Görlitz on the Polish border. Lübeck lies further west, so the sun reaches due south here about a quarter of an hour later'+(off===120?' – and in summer there is an extra hour of daylight saving time.':'.')); }},
 {kind:'mc',view:'uhr',ecl:true,today:true,
  q:()=>[tr('Finsternisse','Eclipses'),tr('Von heute an gerechnet: Wann ist die nächste Sonnenfinsternis, die man in Lübeck sehen kann?','Counting from today: when is the next solar eclipse that can be seen from Lübeck?')],
  opts:()=>{ const e=quiz.ecl; return [[fmtDateL(e.s.max),1],[fmtDateL(e.l.max),0],[fmtDateL(e.s2.max),0]]; },
  hint:()=>{ qzToday(); openCard('moon'); setTimeout(updateEclText,0); return tr('Die Karte »Mond« nennt die nächsten Finsternisse; unter »Besondere Tage« springen Sie direkt hin.','The »Moon« card lists the next eclipses; »Special days« takes you straight there.'); },
  ok:()=>{ const e=quiz.ecl.s, l=fmtDateL(quiz.ecl.l.max), s2=fmtDateL(quiz.ecl.s2.max); return tr('Richtig: ','Correct: ')+eclWhen(e.max)+tr(', die Sonne ist dann zu '+Math.round(e.cover*100)+' % bedeckt. Am '+l+' ist eine Mondfinsternis, am '+s2+' die übernächste Sonnenfinsternis. Die Kalenderscheibe der Astronomischen Uhr verzeichnet für jedes Jahr die Finsternisse.',', when '+Math.round(e.cover*100)+' % of the sun will be covered. '+l+' is a lunar eclipse, '+s2+' the solar eclipse after that. The calendar disc of the astronomical clock lists the eclipses of every year.'); },
  no:()=>tr('Nicht ganz – vielleicht eine Mondfinsternis oder eine spätere? Die Karte »Mond« hilft.','Not quite – perhaps a lunar eclipse or a later one? The »Moon« card helps.')},
 {kind:'pick',view:'schiff',
  q:()=>[tr('Ein Fenster mit Totenkopf','A window with a skull'),tr('Eines der Fenster zeigt einen Totenkopf. Suchen Sie es und tippen Sie darauf.','One of the windows shows a skull. Find it and tap it.')],
  hint:()=>{ goView('totenkopf'); return tr('Suchen Sie in der Totentanzkapelle, über einer Tür.','Look in the Dance of Death chapel, above a door.'); },
  test:w=>w.type===4,
  solve:()=>goView('totenkopf'),
  near:w=>w.type===1||w.type===6?tr('Das sind die großen Totentanzfenster von Alfred Mahlau – ganz nah dran. Gesucht ist ein kleineres Fenster.','These are Alfred Mahlau’s large Dance of Death windows – very close. You are looking for a smaller one.'):tr('Dieses Fenster ist es nicht.','Not this window.'),
  ok:()=>tr('Richtig: das Oberlicht über dem Nordportal der Totentanzkapelle hat Markus Lüpertz 2002 gestaltet. Es liegt auf der Nordseite – direkte Sonne erreicht es nur an Sommerabenden in sehr flachem Winkel, sonst leuchtet es im Himmelslicht.','Correct: Markus Lüpertz designed the light above the north portal of the Dance of Death chapel in 2002. It faces north – direct sun reaches it only at a very flat angle on summer evenings; otherwise it glows in skylight.')}];
const quiz={i:null,score:0,done:[],t0:0,state:'ask',fb:null,order:null,timer:null};
function quizStart(){ if(tour.i!==null) tourEnd(); if(state.playing) setPlaying(false); if(yr.on){ yearStop(); state.speed=30; $('#speed').value='30'; } openCard(null);
  const n=berlinNow(), t=Date.UTC(n.y,n.m,n.d), s=eclipseScan(t,1,'s')[0], s2=s?eclipseScan(s.max+864e5,1,'s')[0]:null,
    l=eclipseScan(t,60,'l').find(e=>e.visible&&e.type!=='penumbral'&&e.max>=t);
  quiz.ecl=s&&s2&&l?{s,s2,l}:null;
  quiz.list=QZ.filter(q=>!q.ecl||quiz.ecl); quiz.score=0; quiz.done=[]; document.body.classList.add('quizzing'); qzGo(0); }
// Finsternis-Aufgabe: Modell auf heute stellen, damit Karte »Mond« und »Besondere Tage« dieselbe Finsternis nennen wie die Antworten
function qzToday(){ if(state.playing) setPlaying(false); const n=berlinNow(); state.minutes=n.minutes; setDate(n.y,n.m,n.d); qzDay(); }
// Quiz bei Tageslicht: steht die Sonne zur eingestellten Zeit tiefer als 8°, auf den wahren Mittag stellen (sonst ist das Modell dunkel)
function qzDay(){ const s=sunPos(localToUtc(state.y,state.m,state.d,state.minutes)); if(s.el>=8) return; const m=Math.round(trueNoon(state.y,state.m,state.d)); setMinutes(m); $('#time').value=String(m); }
function qzSetup(q){ const n=berlinNow(); if(state.playing) setPlaying(false); if(q.today) qzToday(); if(q.min!==undefined){ state.minutes=q.min; setDate(n.y,q.m!==undefined?q.m:n.m,q.d!==undefined?q.d:n.d); } else qzDay(); if(q.view&&state.view!==q.view) goView(q.view); openCard(null); }
function qzGo(i){ quiz.i=i; quiz.state='ask'; quiz.fb=null; quiz.picked=null; quiz.t0=performance.now(); quiz.order=null; $('#qzHint').classList.remove('hot');
  if(i<quiz.list.length) qzSetup(quiz.list[i]); qzRender(); const f=i<quiz.list.length?$('#qzHint'):$('#qzNext'); f.focus({preventScroll:true}); }
function qzRender(){ const el=$('#quiz'), i=quiz.i, N=quiz.list.length; el.hidden=false;
  const opts=$('#qzOpts'), fb=$('#qzFb'); opts.innerHTML=''; $('#qzEnd').textContent=tr('Beenden','End');
  if(i>=N){ const k=quiz.score, t=k===N?tr('Sonnenuhr-Meister','Sundial master'):k>=N-2?tr('Sonnenuhr-Kenner','Sundial expert'):tr('Entdecker','Explorer');
    $('#qzStep').textContent=tr('Quiz · Ergebnis','Quiz · Result'); $('#qzTitle').textContent=t+': '+k+tr(' von ',' of ')+N;
    $('#qzText').textContent=k===N?tr('Alle Aufgaben gelöst – Sie kennen Sonnenuhr, Uhr und Licht von St. Marien.','All tasks solved – you know the sundial, the clock and the light of St. Mary’s.'):tr('Gut gemacht! Übersprungene Aufgaben können Sie jederzeit wiederholen oder im Modell selbst nachspüren.','Well done! You can repeat skipped tasks at any time or explore them yourself in the model.');
    fb.hidden=true; $('#qzHint').hidden=$('#qzSkip').hidden=true; $('#qzEnd').hidden=true;
    [['free',tr('Selbst entdecken','Explore on my own'),'btn'],['again',tr('Quiz wiederholen','Repeat the quiz'),'chip'],['tour',tr('Rundgang','Guided tour'),'chip']].forEach(([g,l,c])=>{ const b=document.createElement('button'); b.className=c; b.textContent=l; b.dataset.go=g; opts.appendChild(b); });
    $('#qzNext').hidden=true; return; }
  const q=quiz.list[i], [ti,tx]=q.q();
  $('#qzStep').textContent=tr('Quiz · Aufgabe ','Quiz · Task ')+(i+1)+tr(' von ',' of ')+N+' · '+quiz.score+tr(' gelöst',' solved');
  $('#qzTitle').textContent=ti; $('#qzText').textContent=tx;
  const solved=quiz.state==='ok', shown=quiz.state!=='ask';
  $('#qzHint').hidden=$('#qzSkip').hidden=shown; $('#qzEnd').hidden=false; $('#qzHint').textContent=tr('Tipp','Hint'); $('#qzSkip').textContent=tr('Überspringen','Skip');
  $('#qzNext').hidden=!shown; $('#qzNext').textContent=i===N-1?tr('Ergebnis','Result'):tr('Weiter','Next');
  if(q.kind==='mc'){ const o=q.opts();   // Reihenfolge einmal pro Aufgabe mischen, beim Sprachwechsel beibehalten
    if(!quiz.order){ quiz.order=o.map((_,k)=>k); for(let a=o.length-1;a>0;a--){ const b=Math.floor(Math.random()*(a+1)); [quiz.order[a],quiz.order[b]]=[quiz.order[b],quiz.order[a]]; } }
    quiz.order.forEach(k=>{ const op=o[k], b=document.createElement('button'); b.className='chip'; b.textContent=op[0]; b.dataset.go='opt'; b.dataset.k=k; b.dataset.ok=op[1]?'1':'0';
      if(shown&&op[1]) b.classList.add('ok'); if(quiz.picked===k) b.classList.add('no'); b.disabled=shown; opts.appendChild(b); }); }
  if(quiz.fb){ fb.hidden=false; fb.textContent=quiz.fb[1](); fb.classList.toggle('no',quiz.fb[0]==='no'); } else fb.hidden=true; }
function qzSolve(ok){ const q=quiz.list[quiz.i]; quiz.state=ok?'ok':'skip'; if(ok){ quiz.score++; quiz.done.push(quiz.i); } else if(q.solve) q.solve();
  quiz.fb=ok?['ok',q.ok]:['skip',()=>tr('Lösung: ','Answer: ')+q.ok().replace(/^(Richtig|Correct): /,'')]; qzRender(); $('#qzNext').focus({preventScroll:true}); }
function quizEnd(){ if(quiz.i===null) return; quiz.i=null; $('#quiz').hidden=true; document.body.classList.remove('quizzing'); }
$('#qzOpts').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const g=b.dataset.go;
  if(g==='opt'){ if(quiz.state!=='ask') return; if(b.dataset.ok==='1') qzSolve(true); else { quiz.picked=+b.dataset.k; quiz.fb=['no',quiz.list[quiz.i].no]; qzRender(); } return; }
  if(g==='free'){ quizEnd(); if(state.view!=='sued') goView('sued'); } else if(g==='again') quizStart(); else if(g==='tour'){ quizEnd(); tourGo(0); } });
$('#qzHint').addEventListener('click',()=>{ const q=quiz.list[quiz.i]; const h=q.hint(); quiz.fb=['hint',()=>h]; $('#qzHint').classList.remove('hot'); qzRender(); });
$('#qzSkip').addEventListener('click',()=>{ quiz.picked=null; qzSolve(false); });
$('#qzNext').addEventListener('click',()=>{ quiz.picked=null; qzGo(quiz.i+1); });
$('#qzEnd').addEventListener('click',quizEnd);
$('#quizBtn').addEventListener('click',quizStart);
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&quiz.i!==null&&$('#views').hidden&&$('#presets').hidden&&!document.querySelector('.card:not([hidden])')) quizEnd(); });
// Einstell-Aufgaben laufend prüfen; nach 60 s auf den Tipp hinweisen
setInterval(()=>{ if(quiz.i===null||quiz.i>=quiz.list.length||quiz.state!=='ask') return; const q=quiz.list[quiz.i];
  if(q.kind==='set'&&q.check()) qzSolve(true);
  else if(performance.now()-quiz.t0>60000) $('#qzHint').classList.add('hot'); },400);
// Fenster antippen: kurzer Tipp ohne Ziehen, Strahl gegen Fensterglas und Mauerwerk
{ let pd=null; const panes=new Map(); windows.forEach(w=>{ panes.set(w.paneIn,w); if(w.paneOut) panes.set(w.paneOut,w); });
  renderer.domElement.addEventListener('pointerdown',e=>{ pd={x:e.clientX,y:e.clientY,t:performance.now()}; });
  // Toleranz: Finger zittern und tippen länger als eine Maus klickt; Strahl in der Mitte und im Kreis um den Tippunkt, ein Fenster knapp hinter Laibung oder Rahmen zählt
  const objs=()=>[...panes.keys(),...occluders];
  function paneAt(x,y,r){ const nd=new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1); rc.setFromCamera(nd,camera);
    const hits=rc.intersectObjects(objs(),false).filter(h=>cutPlane.distanceToPoint(h.point)>=0); if(!hits.length) return null;
    const h0=hits[0]; for(const h of hits){ if(h.distance-h0.distance>0.8) break; const w=panes.get(h.object); if(w) return w; } return null; }
  addEventListener('pointerup',e=>{ const p=pd; pd=null; if(!p||quiz.i===null||quiz.i>=quiz.list.length||quiz.state!=='ask'||state.pano) return; const q=quiz.list[quiz.i]; if(q.kind!=='pick') return;
    const touch=e.pointerType==='touch'||e.pointerType==='pen';
    if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>(touch?24:12)||performance.now()-p.t>1500) return;
    const r=renderer.domElement.getBoundingClientRect(), far=rc.far; rc.far=600;
    let w=paneAt(e.clientX,e.clientY,r);
    if(!w){ const rad=touch?20:10, found=new Map(); for(let k=0;k<8;k++){ const a=k*Math.PI/4, x=paneAt(e.clientX+rad*Math.cos(a),e.clientY+rad*Math.sin(a),r); if(x) found.set(x,(found.get(x)||0)+1); }
      for(const [x,n] of found) if(!w||n>found.get(w)||q.test(x)) w=x; }
    rc.far=far;
    if(!w){ quiz.fb=['no',()=>tr('Tippen Sie direkt auf ein Fenster. Die Glasbilder sind von innen zu sehen.','Tap directly on a window. The stained glass is visible from inside.')]; qzRender(); return; }
    if(q.test(w)) qzSolve(true); else { quiz.fb=['no',()=>q.near(w)]; qzRender(); } }); }
/* ---------------- Teilen und Bild speichern ---------------- */

export function stateCode(){ const p=new URLSearchParams();
  p.set('d',state.y+'-'+pad2(state.m+1)+'-'+pad2(state.d)); p.set('t',String(Math.round(state.minutes)));
  if(state.view) p.set('v',state.view);
  if(state.pano) p.set('p',[PANO.az,PANO.elB,PANO.kx,PANO.ky].map(v=>v.toFixed(2)).join(','));
  else { p.set('c',camera.position.toArray().concat(controls.target.toArray()).map(v=>v.toFixed(2)).join(',')); p.set('m',state.mode); }
  if(LANG==='en') p.set('l','en');
  return p.toString(); }
const embedded=(()=>{ try{ return window.top!==window; }catch(e){ return true; } })();
function shareLink(){ return location.href.split('#')[0]+'#'+stateCode(); }
function updateShare(){ if($('#card-share').hidden) return; $('#shareUrl').value=shareLink();
  $('#shareMsg').textContent=(embedded||location.protocol==='file:')?tr('Hinweis: In dieser Vorschau oder Offline-Datei verweist der Link auf diese Kopie. Auf der Webseite der Kirche öffnet er die Ansicht direkt.','Note: in this preview or offline file the link points to this copy. On the church website it opens the view directly.'):''; }
function applyCode(str){
  const q=new URLSearchParams(String(str||'').replace(/^[^#]*#/,'').replace(/^#/,'')); if(!q.get('d')) return false;
  if(q.get('l')&&q.get('l')!==LANG){ setLang(q.get('l')==='en'?'en':'de'); refreshLang(); }
  const [y,mo,d]=q.get('d').split('-').map(Number); if(!Number.isFinite(y)||!Number.isFinite(mo)||!Number.isFinite(d)||mo<1||mo>12||d<1||d>31) return false;
  if(tour.i!==null) tourEnd();
  { const t=q.get('t')===null||q.get('t')===''?NaN:+q.get('t'); state.minutes=Number.isFinite(t)?Math.max(0,Math.min(1439,t)):720; } setDate(y,mo-1,Math.min(d,new Date(Date.UTC(y,mo,0)).getUTCDate()));
  const v=q.get('v'); if(v&&VIEWS[v]) goView(v,true);
  if(v==='himmel'&&q.get('p')){ const a=q.get('p').split(',').map(Number); if(a.length===4&&a.every(Number.isFinite)){ Object.assign(PANO,{az:a[0],elB:a[1],kx:a[2],ky:a[3]}); panoUniforms(); } }
  else if(q.get('c')){ const c=q.get('c').split(',').map(Number); if(c.length===6&&c.every(isFinite)){ if(state.pano){ state.pano=false; controls.enabled=true; drawPanoGrid(); }
      camera.position.set(c[0],c[1],c[2]); controls.target.set(c[3],c[4],c[5]); camera.lookAt(controls.target);
      const vw=v&&VIEWS[v]; applyMode(q.get('m')==='inside'?'inside':'orbit',vw?vw.minD:undefined,vw?vw.walk:undefined); controls.update(); } }
  requestRender(); return true; }
window.addEventListener('hashchange',()=>applyCode(location.hash));
async function copyText(t){ try{ await navigator.clipboard.writeText(t); return true; }catch(e){ const i=$('#shareUrl'); i.focus(); i.select(); try{ return document.execCommand('copy'); }catch(e2){ return false; } } }
$('#copyBtn').addEventListener('click',async()=>{ const ok=await copyText($('#shareUrl').value); $('#shareMsg').textContent=ok?tr('Link kopiert.','Link copied.'):tr('Bitte den markierten Link selbst kopieren.','Please copy the selected link yourself.'); });
// Teilen-Menü des Systems nur auf der Webseite: Für file:-Links bricht Chrome die Seite ab (RESULT_CODE_KILLED_BAD_MESSAGE)
if(navigator.share&&/^https?:$/.test(location.protocol)){ $('#nativeShare').hidden=false; $('#nativeShare').addEventListener('click',()=>{ try{ navigator.share({title:document.title,url:shareLink()}).catch(()=>{}); }catch(e){} }); }
window.addEventListener('hashchange',()=>applyCode(location.hash));   // geteilten Link in die Adresszeile einfügen: Ansicht wechselt ohne Neuladen
document.querySelector('.rbtn[data-card="share"]').addEventListener('click',()=>setTimeout(updateShare,0));
let dlNS=null; try{ if(window.claude&&window.claude.use) window.claude.use('downloads').then(n=>{ dlNS=n; }).catch(()=>{}); }catch(e){}
const PANO_CSS='line{stroke:rgba(255,255,255,.55);stroke-width:1} line.el{stroke-dasharray:3 6;stroke:rgba(255,255,255,.35)} line.hz{stroke:rgba(255,255,255,.7)} text{fill:#fff;font-family:monospace;font-size:12px;paint-order:stroke;stroke:rgba(0,0,0,.55);stroke-width:3px} .azt{text-anchor:middle} .sp{fill:none;stroke:#ffd27a;stroke-width:2} .mp{fill:none;stroke:#dfe6f2;stroke-width:1.6;stroke-dasharray:6 5} .spd{fill:#ffd27a} .mpd{fill:#dfe6f2} .spt,.mpt{text-anchor:middle;font-size:11px} .spt{fill:#ffe9b8}';
async function saveImage(){
  const msg=$('#shareMsg'); msg.textContent=tr('Bild wird erstellt …','Creating image …');
  renderFrame(); const src=renderer.domElement, W=src.width, H=src.height, pr=renderer.getPixelRatio(), bar=Math.round(40*pr);
  const c=document.createElement('canvas'); c.width=W; c.height=H+bar; const g=c.getContext('2d'); g.drawImage(src,0,0);   // direkt nach dem Zeichnen kopieren
  if(state.pano){ try{ const svg=$('#panoGrid').cloneNode(true); svg.setAttribute('xmlns','http://www.w3.org/2000/svg'); svg.setAttribute('width',W); svg.setAttribute('height',H);
      const st=document.createElementNS('http://www.w3.org/2000/svg','style'); st.textContent=PANO_CSS; svg.insertBefore(st,svg.firstChild);
      const img=new Image(); img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg)); await img.decode(); g.drawImage(img,0,0,W,H); }catch(e){} }
  const di=dstInfo(state.y,state.m,state.d,state.minutes), tzName=tzN(di.off);
  const dateTxt=LANG==='en'?state.d+' '+MON_EN[state.m]+' '+state.y:pad2(state.d)+'.'+pad2(state.m+1)+'.'+state.y;
  g.fillStyle='#f5f6f3'; g.fillRect(0,H,W,bar); g.fillStyle='#1e1a17'; g.font='700 '+Math.round(17*pr)+'px Georgia, serif'; g.textBaseline='middle';
  g.fillText(tr('St. Marien zu Lübeck – Licht und Schatten',"St. Mary's, Lübeck – Light and Shadow"),Math.round(14*pr),H+bar/2);
  g.font=Math.round(14*pr)+'px "IBM Plex Mono", monospace'; g.textAlign='right'; g.fillStyle='#5e5852';
  g.fillText(dateTxt+' · '+fmtT(di.loc)+' '+tzName+' · '+$('#viewTxt').textContent,W-Math.round(14*pr),H+bar/2);
  const blob=await new Promise(r=>c.toBlob(r,'image/png')); if(!blob){ msg.textContent=tr('Das Bild konnte nicht erstellt werden.','The image could not be created.'); return; }
  const name='St-Marien_'+state.y+'-'+pad2(state.m+1)+'-'+pad2(state.d)+'_'+fmtT(state.minutes).replace(':','')+'.png';
  if(dlNS){ try{ await dlNS.save({filename:name,data:blob}); msg.textContent=tr('Bild gespeichert.','Image saved.'); }
    catch(e){ msg.textContent=e&&e.code==='declined'?tr('Speichern abgebrochen.','Saving cancelled.'):tr('Speichern ist hier nicht möglich.','Saving is not possible here.'); } return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  msg.textContent=tr('Bild gespeichert.','Image saved.'); }
$('#saveImg').addEventListener('click',()=>{ saveImage().catch(()=>{ $('#shareMsg').textContent=tr('Das Bild konnte nicht erstellt werden.','The image could not be created.'); }); });
/* ---------------- Größe & Render-Schleife ---------------- */

function resize(){ const w=stage.clientWidth||innerWidth, h=stage.clientHeight||innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); requestRender(); }
new ResizeObserver(resize).observe(stage);
new ResizeObserver(()=>{ if(state.pano){ panoUniforms(); requestRender(); } }).observe(stage);
new ResizeObserver(()=>{ const tb=document.querySelector('.timebar'); document.documentElement.style.setProperty('--tbh',Math.ceil(tb.offsetHeight)+'px'); }).observe(document.querySelector('.timebar'));   // Karten und Hinweise sitzen über der Zeitleiste
new ResizeObserver(()=>{ if(Math.abs((chart.clientWidth||0)-CHW)>2){ drawChart(); updateReadouts(); } }).observe(chart);
let last=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  if(MZT.busy||LK.busy){ last=now; return; }   // während der Terminsuche nicht zeichnen
  const dt=Math.min(0.06,(now-last)/1000); last=now;
  if(state.playing&&yr.on) yearTick(dt);
  else if(state.playing){ const fast=(cur.el<-4&&!(useMoon&&moonStr>0.05))?6:1; let m=state.minutes+state.speed*dt*fast; if(m>=1440) m-=1440; state.minutes=m; updateSun(); if(state.pano) panoMarks(); }
  if(tween) stepTween(now);
  if(clk.pending&&now-clk.lastDraw>=70) clockUpdate(null);
  if(keys.size) keyMove(dt);
  if(joy.id!==null) joyMove(dt);
  if(!tween&&controls.update()){ requestRender(); if(state.walk) clampWalk(); if(state.mode==='orbit'&&camera.position.y<1.5){ camera.position.y=1.5; camera.lookAt(controls.target); } }
  if(takeDirty()) renderFrame();
}
function renderFrame(){ sky.position.copy(camera.position); stars.position.copy(camera.position); pathGroup.position.copy(camera.position);
    if(state.pano){ placeMoonAt(); pathGroup.visible=false; cubeCam.position.copy(camera.position); renderer.shadowMap.autoUpdate=false; renderer.shadowMap.needsUpdate=true;   // Schatten nur einmal je Bild
      cubeCam.update(renderer,scene); renderer.shadowMap.autoUpdate=true; renderer.render(panoScene,panoCam); pathGroup.visible=true;
      if(busyState.hideOnPano){ busyState.hideOnPano=false; requestAnimationFrame(busyHide); } }
    else { const ev=state.view==='finsternis'; pathGroup.visible=!ev; skyMat.uniforms.uGlow.value=(1-eclObsc)*(ev?0.3:1); placeMoon(); renderer.render(scene,camera); placeLabels(); }
}

await step(tr('Sonnenstand und Verschattung werden berechnet','Computing sun position and shading'),84);
/* ---------------- Start ---------------- */
const n0=berlinNow();
state.y=n0.y; state.m=n0.m; state.d=n0.d;
$('#date').value=n0.y+'-'+pad2(n0.m+1)+'-'+pad2(n0.d);
{ const s=sunPos(localToUtc(n0.y,n0.m,n0.d,n0.minutes)); state.minutes=s.el>3?n0.minutes:12*60+30; }
$('#speed').value='30';
setAmb(0.3); setExp(1.0);
state.axis=AXIS_MEASURED; $('#axis').value=AXIS_MEASURED; $('#axisOut').textContent=fmtDeg(AXIS_MEASURED); applyEnv();
setCut(60);
sdOrient(); sdDrawPlate(); if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>sdDrawPlate());
resize();
computeDay();
updateSun(true);
goView('sued',true);
const fromLink=applyCode(location.hash);
await step(tr('Darstellung wird vorbereitet','Preparing the display'),94);
expReady=true; stars.position.copy(camera.position); pathGroup.position.copy(camera.position); placeMoon(); renderer.compile(scene,camera); renderer.render(scene,camera); placeLabels();   // Shader übersetzen und Texturen hochladen, solange die Anzeige steht
requestAnimationFrame(loop);
requestAnimationFrame(()=>{ if(ldBar) ldBar.style.width='100%'; ldDone(); if(!fromLink&&lsGet('stm-welcomed')!=='1'){ tour.i=-1; showTour(); } console.log('[St. Marien] Aufbau in',Math.round(performance.now()-ldT0),'ms'); });
