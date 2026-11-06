// Rechnet mit den Astronomie-Modulen des Lichtmodells (src/astro) alle Prüffälle und schreibt model.json (Zeiten in ms UTC).
// Geprüft wird also genau der Code, der auch im Browser läuft.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import * as A from '../../src/astro/index.js';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const Y0=+(process.env.Y0||2026), Y1=+(process.env.Y1||2030), out={years:[Y0,Y1],lat:A.LAT,lon:A.LON,pos:[],sun:[],moon:[],phase:[],noon:[],ecl:[],dst:[]};
// 1 Örter: alle 5 Tage zu wechselnden Stunden
for(let t=Date.UTC(Y0,0,1,3),k=0;t<Date.UTC(Y1+1,0,1);t+=5*864e5+3.7*3600e3,k++){ const s=A.sunPos(t), m=A.moonPos(t); out.pos.push([t,s.el,s.az,m.el,m.elTrue,m.az]); }
// 2 Sonnen- und 3 Mondauf-/untergang: jeden 3. Tag (Minuten ab Mitternacht Ortszeit)
for(let t=Date.UTC(Y0,0,1);t<Date.UTC(Y1+1,0,1);t+=3*864e5){ const d=new Date(t), y=d.getUTCFullYear(), mo=d.getUTCMonth(), da=d.getUTCDate(), t0=A.localToUtc(y,mo,da,0), t1=A.localToUtc(y,mo,da,1440);
  const sd=A.sunDay(y,mo,da); out.sun.push([t0,sd.rise===null?null:A.localToUtc(y,mo,da,sd.rise),sd.set===null?null:A.localToUtc(y,mo,da,sd.set)]);   // Minuten sind Ortszeit
  const mr=A.moonRiseSet(t0,t1); out.moon.push([t0,t1,mr.rise,mr.set]);
  out.noon.push([t0,A.localToUtc(y,mo,da,A.trueNoon(y,mo,da))]); }
// 4 Mondphasen
for(const [tg,nm] of [[0,'new'],[90,'first'],[180,'full'],[270,'last']]){ let t=Date.UTC(Y0,0,1); for(;;){ const x=A.moonPhaseTime(t,tg,1); if(x===null||x>=Date.UTC(Y1+1,0,1)) break; out.phase.push([nm,x]); t=x+5*864e5; } }
// 5 Finsternisse (in Lübeck sichtbare Sonnenfinsternisse, alle Mondfinsternisse mit Sichtbarkeit)
for(const e of A.eclipseScan(Date.UTC(Y0,0,1),400,'sl')){ if(e.max>=Date.UTC(Y1+1,0,1)) break; out.ecl.push(e.kind==='s'?{kind:'s',max:e.max,start:e.start,end:e.end,mag:e.mag,cover:e.cover}:{kind:'l',type:e.type,max:e.max,mag:e.mag,pmag:e.pmag,visible:e.visible}); }
// 6 Zeitumstellung: jede Viertelstunde an den Umstellungstagen und einem normalen Tag, 1990–2040
for(let y=1981;y<=2040;y++){ const r=A.dstRange(y), dd=t=>[new Date(t).getUTCMonth(),new Date(t).getUTCDate()]; const days=[dd(r[0]),dd(r[1]),[6,15],[0,15]];
  for(const [mo,da] of days) for(let mi=0;mi<1440;mi+=15){ const u=A.localToUtc(y,mo,da,mi); out.dst.push([y,mo,da,mi,u,A.berlinOffsetMin(u)]); } }
fs.writeFileSync(path.join(__dirname,'model.json'),JSON.stringify(out)); console.log('model.json:',Object.entries(out).filter(([k,v])=>Array.isArray(v)&&k!=='years').map(([k,v])=>k+' '+v.length).join(', '));
