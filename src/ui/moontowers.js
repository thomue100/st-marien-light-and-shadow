// Experiment „Mond zwischen den Türmen“: Assistent für Fotografen (Standort, Terminsuche).
import './tour.js';   // Aufbau-Reihenfolge: nach ui/tour
import { berlinOffsetMin, localToUtc, moonPos, rad, sunPos } from '../astro/index.js';
import { V3 } from '../three-global.js';
import { $ } from '../core/util.js';
import { dc, fmtDeg, LANG, moonPhaseName, pad2, tr, tzN } from '../core/i18n.js';
import { TW } from '../model/measures.js';
import { state, sunVec } from '../state.js';
import { camera, renderer, requestRender, scene } from '../scene/renderer.js';
import { occluders } from '../model/geometry.js';
import { T_GTIP, T_HELM } from '../model/church.js';
import { ENV, envG, envH, envHeightAt, envSample } from '../model/environment.js';
import { rc } from '../light/windows.js';
import { busyHide, busyShow, busyText, goView, tween, VIEWS } from '../scene/camera.js';
import { MON_EN, WD, WD_EN } from './readouts.js';
import { DATE_MAX, DATE_MIN, gotoInstant, setPlaying } from './controls.js';
import { openCard } from './panels.js';
import { expOpen } from './experiments.js';
import { fmtDateL } from './quiz.js';

/* ---------------- Experimente: Mond zwischen den Türmen (Assistent für Fotografen) ---------------- */

// Standort auf der Verlängerung der Kirchenachse (z = 0), westlich oder östlich der Türme. Der Mond steht »zwischen den Türmen«,
// wenn seine Richtung die Ebene der Turmachsen (x = TW.xc) zwischen den beiden Turmmitten und unterhalb der Helmspitzen trifft
// und der Blick dorthin nicht von Dach, Turm oder (im Umkreis von 200 m) von Häusern verdeckt ist.
export const MZT={side:'w',dist:700,res:null,busy:false,zN:(TW.n[0]+TW.n[1])/2,zS:(TW.s[0]+TW.s[1])/2,top:Math.min(T_GTIP[0]+T_HELM[0],T_GTIP[1]+T_HELM[1])};
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
export function mtSync(){ const on=mtActive()||state.view==='mtTop'; mtGroup.visible=on&&state.view!=='mtCam'; if(!on) return;
  const W=renderer.domElement.clientWidth||800, v=VIEWS.mtTop, mpp=v&&state.view==='mtTop'?2*v.pos[1]*Math.tan(27.5*rad)*camera.aspect/W:MZT.dist*0.002;   // Meter je Bildpunkt in der Draufsicht
  const O=mtObs(), sc=Math.max(4,mpp*11); MZT.pin.position.set(O.x,O.y+0.5,0); MZT.pin.scale.setScalar(sc); MZT.pole.position.set(O.x,O.y-1.7,0); MZT.pole.scale.set(sc/4,Math.max(1,MZT.dist/400),sc/4);
  MZT.axis.scale.z=Math.max(1.5,mpp*3); requestRender(); }
export function mtGeo(){ const d=MZT.dist, O=mtObs(), w=2*Math.atan(MZT.half/d)/rad, top=Math.atan((MZT.top-O.y)/d)/rad;
  $('#mtDistOut').textContent=dc(String(d))+' m';
  $('#mtGeo').textContent=tr('Von dort erscheinen die Turmspitzen '+fmtDeg(top)+' hoch; die Turmmitten liegen '+fmtDeg(w)+' auseinander, der Mond ist 0,5° groß. ','From there the spires appear '+fmtDeg(top)+' high; the tower centres are '+fmtDeg(w)+' apart, the moon is 0.5° across. ')
    +(MZT.side==='w'?tr('Von Westen sieht man den Mond hinter den Türmen meist aufgehen.','From the west you mostly see the moon rising behind the towers.'):tr('Von Osten sieht man ihn über Chor und Dach hinweg untergehen.','From the east you see it setting beyond the choir and roof.')); }
function mtSetSide(sd){ const ch=MZT.side!==sd; MZT.side=sd; if(ch&&state.view==='mtTop') setTimeout(()=>mtTopView(),0); document.querySelectorAll('#mtSide [data-side]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.side===sd))); mtClear(); }
function mtSetDist(d){ MZT.dist=Math.round(Math.min(2000,Math.max(150,d))/10)*10; $('#mtDist').value=MZT.dist; mtClear(); }
function mtClear(){ MZT.res=null; $('#mtRes').innerHTML=''; $('#mtSum').textContent=''; mtGeo(); mtSync(); }
export function mtTopView(instant){   // ganze Achse der gewählten Seite (bis 2 km) samt Kirche im freien Bildteil (neben bzw. über der offenen Karte)
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
export function mtRender(){ const ul=$('#mtRes'); ul.innerHTML=''; const R=MZT.res; if(!R) return;
  $('#mtSum').textContent=R.list.length?tr(R.list.length+' Termine in den sechs Monaten ab '+fmtDateL(R.from)+', zum Ansehen antippen:',R.list.length+' dates in the six months from '+fmtDateL(R.from)+', tap to view:')
    :tr('In diesen sechs Monaten steht der Mond von hier aus nicht sichtbar zwischen den Türmen. Probieren Sie eine andere Entfernung.','From here the moon does not stand visibly between the towers in these six months. Try another distance.');
  R.list.forEach(e=>{ const li=document.createElement('li'), b=document.createElement('button'), off=berlinOffsetMin(e.best), l=new Date(e.best+off*60000), la=new Date(e.a+off*60000), lb=new Date(e.b+off*60000);
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
