// Finsternisse, von Lübeck aus gesehen.
// Sonnenfinsternis: topozentrische Örter von Sonne und Mond, Bedeckung als Flächenanteil der Sonnenscheibe.
// Mondfinsternis: geozentrischer Abstand des Mondes vom Gegenpunkt der Sonne, Kern- und Halbschatten nach Danjon.
import { AU_KM, EARTH_R, OBS_RC, OBS_RS, eclToEqu, horiz, lstDeg, nrm360, rad } from './common.js';
import { moonEcl, moonPhaseTime, moonPos } from './moon.js';
import { sunPrecise } from './sun.js';

export const _eV=(ra,dec)=>{ const a=ra*rad, d=dec*rad; return [Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)]; };
export const _eDot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
// topozentrischer Ort aus geozentrischem Ort (Rektaszension, Deklination, Abstand km): Vektor minus Beobachterort
export function topoVec(ra,dec,dist,ms){ const th=lstDeg(ms)*rad, g=_eV(ra,dec).map(c=>c*dist), o=[EARTH_R*OBS_RC*Math.cos(th),EARTH_R*OBS_RC*Math.sin(th),EARTH_R*OBS_RS];
  const v=[g[0]-o[0],g[1]-o[1],g[2]-o[2]], d=Math.hypot(v[0],v[1],v[2]), u=v.map(c=>c/d);
  const raT=nrm360(Math.atan2(u[1],u[0])/rad), decT=Math.asin(u[2])/rad; return {u,d,ra:raT,dec:decT,H:nrm360(lstDeg(ms)-raT+180)-180}; }
// Flächenanteil eines Kreises (Radius r1), den ein Kreis (Radius r2) im Mittelpunktsabstand d bedeckt
export function circleCover(r1,r2,d){ if(d>=r1+r2) return 0; if(d<=Math.abs(r2-r1)) return r2>=r1?1:(r2*r2)/(r1*r1);
  const a=r1*r1*Math.acos((d*d+r1*r1-r2*r2)/(2*d*r1))+r2*r2*Math.acos((d*d+r2*r2-r1*r1)/(2*d*r2))-0.5*Math.sqrt((-d+r1+r2)*(d+r1-r2)*(d-r1+r2)*(d+r1+r2));
  return a/(Math.PI*r1*r1); }
export function solarEclipseAt(ms){
  const m=moonEcl(ms), s=sunPrecise(ms);
  if(Math.abs(nrm360(m.lam-s.lam+180)-180)>4) return null;
  const qm=eclToEqu(m.lam,m.beta,m.T), qs=eclToEqu(s.lam,0,s.T);
  const tm=topoVec(qm.ra,qm.dec,m.dist,ms), ts=topoVec(qs.ra,qs.dec,s.R,ms);
  const sep=Math.acos(Math.min(1,_eDot(tm.u,ts.u)))/rad, hm=horiz(tm.H,tm.dec), hs=horiz(ts.H,ts.dec);
  const rm=Math.asin(1737.4/tm.d)/rad, rs=959.63/3600/(s.R/AU_KM);
  const cover=circleCover(rs,rm,sep), mag=Math.max(0,(rs+rm-sep)/(2*rs));
  return {sep,rs,rm,cover,mag,sunEl:hs.el,sunAz:hs.az,moonEl:hm.el,moonAz:hm.az}; }
export function lunarEclipseAt(ms){
  const m=moonEcl(ms), s=sunPrecise(ms);
  if(Math.abs(nrm360(m.lam-s.lam)-180)>4) return null;
  const sep=Math.acos(Math.max(-1,Math.min(1,Math.cos(m.beta*rad)*Math.cos((m.lam-s.lam-180)*rad))))/rad;
  const pm=Math.asin(EARTH_R/m.dist)/rad, ps=8.794/3600/(s.R/AU_KM), ss=959.63/3600/(s.R/AU_KM), sm=Math.asin(1737.4/m.dist)/rad;
  const ru=1.01*pm+ps-ss, rp=1.01*pm+ps+ss;
  const umag=(ru+sm-sep)/(2*sm), pmag=(rp+sm-sep)/(2*sm);
  return {sep,sm,ru,rp,umag,pmag,uCover:circleCover(sm,ru,sep),pCover:circleCover(sm,rp,sep)}; }
// Suche: Finsternisse, die von Lübeck aus zu sehen sind (Sonne bzw. Mond über dem Horizont), ab ms vorwärts
export function eclipseScan(ms,count,kinds){ kinds=kinds||'sl'; const out=[]; let t=ms-2*86400000;
  for(let n=0;n<3000&&out.length<count;n++){
    const tn=moonPhaseTime(t,0,1), tf=moonPhaseTime(t,180,1); if(tn===null&&tf===null) break;
    const cands=[]; if(tn!==null) cands.push([tn,'s']); if(tf!==null) cands.push([tf,'l']); cands.sort((a,b)=>a[0]-b[0]);
    const [tc,k]=cands[0]; t=tc+86400000;
    if(!kinds.includes(k)) continue;
    const e=k==='s'?solarEclipseInfo(tc):lunarEclipseInfo(tc); if(e&&e.max>=ms-4*3600000) out.push(e); }
  return out; }
export function edgeSearch(f,a,b){ for(let i=0;i<40;i++){ const mid=(a+b)/2; if(f(mid)===f(a)) a=mid; else b=mid; } return (a+b)/2; }
export function solarEclipseInfo(tn){
  const m0=moonEcl(tn); if(Math.abs(m0.beta)>1.65) return null;
  const step=60000, A=tn-4*3600000, B=tn+4*3600000; let best=null, t1=null, t2=null, prevOn=false, prevT=A;
  for(let t=A;t<=B;t+=step){ const e=solarEclipseAt(t); const on=!!(e&&e.cover>0);
    if(on&&!prevOn&&t>A) t1=edgeSearch(x=>{ const q=solarEclipseAt(x); return !!(q&&q.cover>0); },prevT,t);
    if(!on&&prevOn) t2=edgeSearch(x=>{ const q=solarEclipseAt(x); return !!(q&&q.cover>0); },prevT,t);
    if(on&&e.sunEl>-0.6&&(!best||e.cover>best.cover)) best={t,cover:e.cover,mag:e.mag,el:e.sunEl};
    prevOn=on; prevT=t; }
  if(!best||t1===null) return null;
  // Maximum fein bestimmen
  let a=best.t-step, b=best.t+step; for(let i=0;i<40;i++){ const c1=a+(b-a)/3, c2=b-(b-a)/3, e1=solarEclipseAt(c1), e2=solarEclipseAt(c2);
    const v1=e1&&e1.sunEl>-0.6?e1.cover:-1, v2=e2&&e2.sunEl>-0.6?e2.cover:-1; if(v1<v2) a=c1; else b=c2; }
  const tm=(a+b)/2, em=solarEclipseAt(tm);
  return {kind:'s', type:em.mag>=1?'total':'partial', start:t1, max:tm, end:t2, mag:em.mag, cover:em.cover, el:em.sunEl,
    startEl:solarEclipseAt(t1).sunEl, endEl:t2?solarEclipseAt(t2).sunEl:null}; }
export function lunarEclipseInfo(tf){
  const m0=moonEcl(tf); if(Math.abs(m0.beta)>1.65) return null;
  const step=60000, A=tf-5*3600000, B=tf+5*3600000; let best=null; const ev={};
  const on=(x,key)=>{ const q=lunarEclipseAt(x); return !!(q&&q[key]>0); };
  let prev={p:false,u:false,t:false}, prevT=A;
  for(let t=A;t<=B;t+=step){ const e=lunarEclipseAt(t); const cur={p:!!(e&&e.pmag>0),u:!!(e&&e.umag>0),t:!!(e&&e.umag>=1)};
    for(const [k,key,s1,s2] of [['p','pmag','P1','P4'],['u','umag','U1','U4'],['t','umag','U2','U3']]){
      const tst=k==='t'?(x=>{ const q=lunarEclipseAt(x); return !!(q&&q.umag>=1); }):(x=>on(x,key));
      if(cur[k]&&!prev[k]&&t>A) ev[s1]=edgeSearch(tst,prevT,t); if(!cur[k]&&prev[k]) ev[s2]=edgeSearch(tst,prevT,t); }
    if(e&&(!best||e.pmag>best.pmag)) best={t,pmag:e.pmag,umag:e.umag};
    prev=cur; prevT=t; }
  if(!best||best.pmag<=0) return null;
  let a=best.t-step, b=best.t+step; for(let i=0;i<40;i++){ const c1=a+(b-a)/3, c2=b-(b-a)/3; if(lunarEclipseAt(c1).pmag<lunarEclipseAt(c2).pmag) a=c1; else b=c2; }
  const tm=(a+b)/2, em=lunarEclipseAt(tm), type=em.umag>=1?'total':em.umag>0?'partial':'penumbral';
  // sichtbar, wenn der Mond während der Finsternis (Halbschatten bzw. Kernschatten) irgendwann über dem Horizont steht
  const t0=type==='penumbral'?ev.P1:ev.U1, t3=type==='penumbral'?ev.P4:ev.U4; let vis=false, visMax=null;
  for(let t=t0||tm;t<=(t3||tm);t+=120000){ const mp=moonPos(t); if(mp.el>0){ vis=true; break; } }
  return {kind:'l', type, start:ev.P1, ustart:ev.U1, tstart:ev.U2, max:tm, tend:ev.U3, uend:ev.U4, end:ev.P4, mag:em.umag, pmag:em.pmag, el:moonPos(tm).el, visible:vis}; }
