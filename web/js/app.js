(async function(){
'use strict';
const getJSON=(u,f)=>fetch(u).then(r=>{ if(!r.ok) throw new Error(u+': '+r.status); return r.json(); }).catch(e=>{ console.warn('[St. Marien] Daten fehlen',e); return f; });
const DATA={glass:getJSON('data/glas.json',{}),clock:getJSON('data/uhr.json',null),env:getJSON('data/umgebung.json',null)};   // Webfassung: Daten als eigene Dateien
// Ladeanzeige: der Aufbau läuft in Schritten, zwischen denen der Browser die Anzeige aktualisieren kann
const ldEl=document.getElementById('loader'), ldText=document.getElementById('ldText'), ldBar=document.getElementById('ldBar');
const ldT0=performance.now();
async function step(text,pct){ if(ldText) ldText.textContent=text; if(ldBar) ldBar.style.width=pct+'%'; await new Promise(r=>setTimeout(r,20)); }
function ldDone(){ if(ldEl){ ldEl.classList.add('done'); setTimeout(()=>{ ldEl.hidden=true; },600); } }
/* ---------------- Sprache und Ansichtstiefe ---------------- */
const lsGet=k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, lsSet=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
const HASHQ=new URLSearchParams((location.hash||'').replace(/^#/,''));
let LANG=((HASHQ.get('l')||lsGet('stm-lang')||((navigator.language||'de').toLowerCase().startsWith('de')?'de':'en'))==='en')?'en':'de';
const tr=(de,en)=>LANG==='en'?en:de;
const dc=s=>LANG==='en'?String(s):String(s).replace('.',',');   // Dezimalzeichen
const tzN=off=>off===120?tr('MESZ','CEST'):tr('MEZ','CET');
function applyStaticLang(){
  document.documentElement.lang=LANG;
  document.querySelectorAll('[data-en]').forEach(el=>{ if(el.dataset.de===undefined) el.dataset.de=el.textContent; el.textContent=LANG==='en'?el.dataset.en:el.dataset.de; });
  document.querySelectorAll('[data-en-aria]').forEach(el=>{ if(el.dataset.deAria===undefined) el.dataset.deAria=el.getAttribute('aria-label')||''; el.setAttribute('aria-label',LANG==='en'?el.dataset.enAria:el.dataset.deAria); });
  document.querySelectorAll('[data-en-title]').forEach(el=>{ if(el.dataset.deTitle===undefined) el.dataset.deTitle=el.getAttribute('title')||''; el.setAttribute('title',LANG==='en'?el.dataset.enTitle:el.dataset.deTitle); });
  const lb=document.getElementById('langBtn'); if(lb){ lb.textContent=LANG==='en'?'DE':'EN'; lb.setAttribute('lang',LANG==='en'?'de':'en'); }
  document.title=tr('St. Marien – Licht und Schatten',"St. Mary's – Light and Shadow");
}
applyStaticLang();
if(ldText) ldText.textContent=tr('3D-Bibliothek wird geladen','Loading 3D library');
let EXPERT=lsGet('stm-expert')==='1'||HASHQ.get('x')==='1';
document.body.classList.toggle('expert',EXPERT);
if(!window.THREE || !THREE.OrbitControls){
  ldDone(); document.getElementById('stage').innerHTML='<div class="err">'+tr('Die 3D-Bibliothek konnte nicht geladen werden. Bitte Seite neu laden.','The 3D library could not be loaded. Please reload the page.')+'</div>';
  return;
}
await step(tr('Texturen und Glasmalereien','Textures and stained glass'),12);
const $=s=>document.querySelector(s);
const V3=THREE.Vector3;
const rad=Math.PI/180, SQ3=Math.sqrt(3);
const LAT=53.8677, LON=10.6850;
// Maße der Kirche, abgeglichen mit dem amtlichen LoD2-Gebäudemodell (LVermGeo SH, 2025) und dem Oberflächenmodell bDOM20 (2023).
// Modellkoordinaten: x entlang der Kirchenachse (Ost = +x), z quer (Süd = +z), y Höhe über Fußboden (13,0 m NHN).
const X0=-36.8, XC=28.8, XT=1.6, XW=-50.3;           // Turm-Ostflucht, Beginn Chorpolygon, Beginn Chorjoche, Westwand (Mitte)
const PX=[X0,-30.15,-24.19,-17.76,-11.32,-4.87,XT,8.64,15.0,22.07,XC];   // Pfeilerachsen aus den Strebepfeilern in LoD2
const NB=PX.length-1;
const ZN=7.15, ZNF=7.85;                              // Mittelschiff: Wandmitte, Außenflucht
const ZAN=17.45, ZAS=21.2, ZCS=17.5, ZKN=20.5;        // Seitenschiffwände (Mitte): Nord, Süd Langhaus, Süd Chor; niedrige Nordkapellen
// Chorschluss nach den Grundrissen (Dehio; Plan von 1906, Maßstab 1:… über die Maßleiste, Pfeilerachsen auf ±0,4 m mit LoD2 übereinstimmend):
// Binnenchor aus drei Seiten des Achtecks, Polygonpfeiler bei x = XC + 4,4 und z = ±3,05 (Wandmitte).
const CHA=4.4, CHE=3.05, CHOIR=[[XC,-ZN],[XC+CHA,-CHE],[XC+CHA,CHE],[XC,ZN]];
// Umgang mit Kapellenkranz (Wandmitte, Nordhälfte; Süd gespiegelt): je Seite eine dreiseitig vortretende Kapelle,
// westlich davon eine schräge Wand, im Osten die Marientidenkapelle. Außenkanten passen zu den LoD2-Wänden.
const AMB_N=[[XC,-17.45],[32.2,-12.7],[37.2,-13.4],[40.2,-10.0],[38.4,-5.0]];
const AMB=AMB_N.concat(AMB_N.slice().reverse().map(p=>[p[0],-p[1]])); AMB[AMB.length-1]=[XC,17.5];
const APSE_WB=25.0, APSE_WS=31.4, APSE_GAL=19.6;   // Chorschluss: Fensterbank, Kämpfer der Fenster, Laufgang (nach Innenfotos)
const ZSI=17.3;   // südliche Seitenschiffwand (Grundriss): dahinter Briefkapelle und vier Kapellen zwischen den Strebepfeilern
// Polygon um d nach außen versetzen (Außennormale (dz,-dx) bei Lauf von Nord nach Süd); n0/n1: Normalen vor dem ersten bzw. nach dem letzten Punkt
function offPoly(pts,d,n0,n1,closed){ const N=pts.length, nr=[];
  for(let i=0;i<N-(closed?0:1);i++){ const a=pts[i], b=pts[(i+1)%N], dx=b[0]-a[0], dz=b[1]-a[1], l=Math.hypot(dx,dz); nr.push([dz/l,-dx/l]); }
  return pts.map((p,i)=>{ const na=closed?nr[(i-1+N)%N]:(i===0?n0:nr[i-1]), nb=closed?nr[i]:(i===N-1?n1:nr[i]); const s=d/(1+na[0]*nb[0]+na[1]*nb[1]); return [p[0]+(na[0]+nb[0])*s,p[1]+(na[1]+nb[1])*s]; }); }
const choirOff=d=>offPoly(CHOIR,d,[0,-1],[0,1],false);
const HN=40.9, HR=49.6, HJ=29.4, HAN=22.7, HAS=20.9, HCS=22.7, COS18=Math.cos(18*Math.PI/180);
const TW={x0:-50.9,x1:X0,n:[-20.8,-7.2],s:[7.3,21.0],xc:-43.85};   // Turmbreiten nach bDOM20 (Schaft 13,6–13,7 m)
const ARC_SP=14.0;   // Kämpferhöhe der Mittelschiffarkaden
const GK={x0:TW.x0+0.45,x1:TW.x1-0.45,z0:TW.s[0]+0.45,z1:TW.s[1]-0.45,h:23.0,ceil:22.0};   // Gedenkkapelle im Südturm (hohe Turmhalle)
const MT=[[38.4,-5.0],[43.6,-5.3],[47.4,-5.4],[50.5,-2.6],[50.5,1.4],[47.7,5.2],[43.6,5.1],[38.4,4.95]];   // Marientidenkapelle (Wandmitte): westliches Vorjoch ab dem Umgang (Grundriss), Ostteil nach LoD2
const AXIS_MEASURED=98.5;
const F=v=>(+v).toFixed(4);
const CHAPELS=[
  {name:'Briefkapelle',s:1,x0:X0,x1:-22.46,zi:ZSI,zo:26.85,h:14.1,roof:'lean',ridge:21.9,ceil:12.4},
  {name:'Totentanzkapelle',s:-1,x0:XT,x1:15.0,zi:ZAN,zo:25.95,h:22.0,roof:'gableZ',ridge:28.6,ceil:19.0},
  {name:'Nördliche Chorkapellen',s:-1,x0:15.0,x1:XC,zi:ZAN,zo:26.05,h:24.0,roof:'gableX',hin:24.0,zr:22.6,ridge:28.9,ceil:17.0,noWest:true},
  {name:'Südvorhalle',s:1,x0:XT,x1:16.2,zi:ZCS,zo:29.7,rzo:28.5,h:21.3,roof:'gableX',hin:23.4,zr:23.0,ridge:29.7,ceil:16.5},   // ein durchgehendes Dach mit der Bürgermeisterkapelle (Luftbilder)
  {name:'Bürgermeisterkapelle',s:1,x0:16.2,x1:XC,zi:ZCS,zo:28.5,h:21.3,roof:'gableX',hin:23.4,zr:23.0,ridge:29.7,ceil:16.5}
];
// Innenräume (Rechtecke x0,x1,z0,z1,yMax) für Putzfarbe innen und gedämpftes Streulicht
const ROOMS=[[XW,X0+0.1,-ZNF-0.3,ZNF+0.3,38.6],[X0,XC,-ZN,ZN,38.6],[X0,XC,-ZAN,0,20.6],[X0,XT,0,ZAS,20.6],[XT,XC,0,ZCS,20.6],[X0,XT,-ZKN,-ZAN,7.7]]
  .concat(CHAPELS.map(c=>c.s>0?[c.x0,c.x1,c.zi,c.zo,c.ceil+0.1]:[c.x0,c.x1,-c.zo,-c.zi,c.ceil+0.1])).concat([[GK.x0,GK.x1,GK.z0,GK.z1,GK.ceil+0.1]]);   // bis zur Wandmitte, damit die Innenseiten erfasst werden
const CH_EDGES=CHOIR.slice(0,3).map((a,i)=>{ const b=CHOIR[i+1], dx=b[0]-a[0], dz=b[1]-a[1], l=Math.hypot(dx,dz); return [dz/l,-dx/l,a[0],a[1]]; });
function inAmb(x,z){ let c=false; for(let i=0,j=AMB.length-1;i<AMB.length;j=i++){ const a=AMB[i], b=AMB[j]; if(a[1]===b[1]) continue; if((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])/(b[1]-a[1])*(z-a[1])+a[0]) c=!c; } return c; }
const MT_EDGES=MT.map((a,i)=>{ const b=MT[(i+1)%MT.length], dx=b[0]-a[0], dz=b[1]-a[1], l=Math.hypot(dx,dz); return [-dz/l,dx/l,a[0],a[1]]; });
const MASK_GLSL=(function(){
  let s='float insideMask(vec3 p){\n';
  for(const r of ROOMS) s+='  if(p.x>'+F(r[0])+' && p.x<'+F(r[1])+' && p.z>'+F(r[2])+' && p.z<'+F(r[3])+' && p.y<'+F(r[4])+') return 1.0;\n';
  s+='  if(p.x>='+F(XC)+'){\n    if(p.y<38.6'+CH_EDGES.map(e=>' && dot(vec2('+F(e[0])+','+F(e[1])+'),p.xz-vec2('+F(e[2])+','+F(e[3])+'))<0.0').join('')+') return 1.0;\n';
  s+='    if(p.y<20.6){ bool c=false;\n'; for(let i=0,j=AMB.length-1;i<AMB.length;j=i++){ const a=AMB[i], b=AMB[j]; if(a[1]===b[1]) continue;
    s+='      if(('+F(a[1])+'>p.z)!=('+F(b[1])+'>p.z) && p.x<'+F((b[0]-a[0])/(b[1]-a[1]))+'*(p.z-('+F(a[1])+'))+('+F(a[0])+')'+') c=!c;\n'; }
  s+='      if(c) return 1.0; }\n  }\n';
  s+='  if(p.y<18.3'+MT_EDGES.map(e=>' && dot(vec2('+F(e[0])+','+F(e[1])+'),p.xz-vec2('+F(e[2])+','+F(e[3])+'))>-0.05').join('')+') return 1.0;\n';
  return s+'  return 0.0;\n}\n';
})();

/* ---------------- Zeit & Sonne ---------------- */
function lastSundayUtc(y,m){ const d=new Date(Date.UTC(y,m+1,0)); d.setUTCDate(d.getUTCDate()-d.getUTCDay()); return Date.UTC(y,m,d.getUTCDate(),1); }
// Sommerzeit in Deutschland (MESZ), Umstellung jeweils 01:00 UTC: seit 1996 letzter Sonntag im März bis letzter Sonntag im Oktober,
// 1981–1995 bis zum letzten Sonntag im September, 1980 vom 6. April bis 28. September, davor (ab 1950) keine Sommerzeit
function dstRange(y){ if(y<1980) return null; if(y===1980) return [Date.UTC(1980,3,6,1),Date.UTC(1980,8,28,1)];
  return [lastSundayUtc(y,2),lastSundayUtc(y,y<1996?8:9)]; }
function berlinOffsetMin(u){ const r=dstRange(new Date(u).getUTCFullYear()); return r&&u>=r[0]&&u<r[1]?120:60; }
function localToUtc(y,m,d,min){ const base=Date.UTC(y,m,d)+min*60000; let u=base-3600000; if(berlinOffsetMin(u)===120){ const u2=base-7200000; if(berlinOffsetMin(u2)===120) u=u2; else u=dstRange(new Date(u).getUTCFullYear())[0]; } return u; }   // 02:00–02:59 am Umstellungstag im März gibt es nicht: alle diese Minuten zeigen den Umstellungsmoment (03:00 MESZ), so läuft die Zeit nie rückwärts
// Zeitumstellung: Tag der Umstellung erkennen; 02:00–02:59 gibt es im März nicht und im Oktober zweimal (das Modell zeigt dann den zweiten Durchlauf, MEZ)
function dstInfo(y,m,d,min){ const u=localToUtc(y,m,d,min), off=berlinOffsetMin(u), loc=(u-Date.UTC(y,m,d))/60000+off;   // tatsächliche Ortszeit in Minuten ab Mitternacht
  const dr=dstRange(y), day0=t=>{ const q=new Date(t); return Date.UTC(q.getUTCFullYear(),q.getUTCMonth(),q.getUTCDate()); }, spring=!!dr&&Date.UTC(y,m,d)===day0(dr[0]), fall=!!dr&&Date.UTC(y,m,d)===day0(dr[1]);
  return {utc:u,off,loc,gap:spring&&min>=120&&min<180,fold:fall&&min>=120&&min<180}; }
function berlinNow(){ const u=Date.now(); const l=new Date(u+berlinOffsetMin(u)*60000); return {y:l.getUTCFullYear(),m:l.getUTCMonth(),d:l.getUTCDate(),minutes:l.getUTCHours()*60+l.getUTCMinutes()}; }
function sunPos(ms){
  const n=ms/86400000+2440587.5-2451545.0;
  const g=(357.529+0.98560028*n)*rad;
  const q=280.459+0.98564736*n;
  const lam=(q+1.915*Math.sin(g)+0.020*Math.sin(2*g))*rad;
  const eps=(23.439-0.00000036*n)*rad;
  const ra=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam));
  const dec=Math.asin(Math.sin(eps)*Math.sin(lam));
  const gmst=((18.697374558+24.06570982441908*n)%24+24)%24;
  const H=(gmst*15+LON)*rad-ra, phi=LAT*rad;
  const el=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H));
  const az=Math.atan2(-Math.cos(dec)*Math.sin(H),Math.sin(dec)*Math.cos(phi)-Math.cos(dec)*Math.cos(H)*Math.sin(phi));
  let e=el/rad; if(e>-1.5){ e+=1.02/Math.tan((e+10.3/(e+5.11))*rad)/60; }
  return {el:e,az:((az/rad)%360+360)%360,H:((H/rad)%360+540)%360-180};
}
const state={y:2026,m:9,d:26,minutes:720,playing:false,speed:30,axis:98.5,env:true,trees:true,lodChurch:false,sdWedge:8.5,cut:60,beams:true,tint:true,amb:0.3,exp:1.0,labels:true,moon:true,sunPath:true,moonPath:true,mode:'orbit'};
const cur={el:0,az:0};
const L=new V3(0,1,0);
const LD=new V3(0,1,0);   // Richtung der aktiven Lichtquelle: Sonne, nachts der Mond
let moonCur=null, moonStr=0, lightStr=0, useMoon=false;
const lightUp=()=>useMoon?moonCur.el>0:cur.el>0;
function sunVec(el,az,out){
  const ce=Math.cos(el*rad), E=ce*Math.sin(az*rad), N=ce*Math.cos(az*rad), U=Math.sin(el*rad), b=state.axis*rad;
  return out.set(E*Math.sin(b)+N*Math.cos(b),U,E*Math.cos(b)-N*Math.sin(b));
}
const clamp01=x=>Math.min(1,Math.max(0,x));
const smooth=(a,b,x)=>{const t=clamp01((x-a)/(b-a)); return t*t*(3-2*t);};

/* ---------------- Mond: Bahn, Phase, Auf- und Untergang ---------------- */
// Verkürzte Mondtheorie nach Meeus, Astronomical Algorithms, Kap. 47 (die größten Glieder; Fehler etwa 0,01°),
// topozentrisch (Parallaxe bis ~1°) für Lübeck, Lichtbrechung wie bei der Sonne. Phase nach Kap. 48.
const MOON_L=[[0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],
  [0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],
  [2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],[0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],
  [0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],
  [2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
  [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],
  [2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],[0,2,0,0,-2069,0],
  [2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],[2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],
  [3,0,-1,0,-892,3258],[2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],[0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354]];
const MOON_B=[[0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],
  [2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],
  [2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],
  [0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],[0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107]];
const AU_KM=149597870.7, EARTH_R=6378.14;
function nrm360(x){ return ((x%360)+360)%360; }
// geozentrisch, ekliptikal: λ, β (Grad), Abstand (km)
function moonEcl(ms){
  const T=(ms/86400000+2440587.5-2451545.0+69/86400)/36525;   // TT ≈ UT + 69 s
  const Lp=218.3164477+481267.88123421*T, D=297.8501921+445267.1114034*T, M=357.5291092+35999.0502909*T,
        Mp=134.9633964+477198.8675055*T, F=93.2720950+483202.0175233*T, E=1-0.002516*T;
  const A1=119.75+131.849*T, A2=53.09+479264.290*T, A3=313.45+481266.484*T;
  let sl=0, sr=0, sb=0;
  for(const [d,m,mp,f,cl,cr] of MOON_L){ const a=(d*D+m*M+mp*Mp+f*F)*rad, e=m===0?1:(Math.abs(m)===1?E:E*E); sl+=cl*e*Math.sin(a); sr+=cr*e*Math.cos(a); }
  for(const [d,m,mp,f,cb] of MOON_B){ const a=(d*D+m*M+mp*Mp+f*F)*rad, e=m===0?1:(Math.abs(m)===1?E:E*E); sb+=cb*e*Math.sin(a); }
  sl+=3958*Math.sin(A1*rad)+1962*Math.sin((Lp-F)*rad)+318*Math.sin(A2*rad);
  sb+=-2235*Math.sin(Lp*rad)+382*Math.sin(A3*rad)+175*Math.sin((A1-F)*rad)+175*Math.sin((A1+F)*rad)+127*Math.sin((Lp-Mp)*rad)-115*Math.sin((Lp+Mp)*rad);
  return {lam:nrm360(Lp+sl/1e6), beta:sb/1e6, dist:385000.56+sr/1000, T};
}
// Sonne geozentrisch (wie sunPos): λ, Rektaszension, Abstand in km
function sunEcl(ms){
  const n=ms/86400000+2440587.5-2451545.0, g=(357.529+0.98560028*n)*rad, q=280.459+0.98564736*n;
  const lam=nrm360(q+1.915*Math.sin(g)+0.020*Math.sin(2*g)), R=(1.00014-0.01671*Math.cos(g)-0.00014*Math.cos(2*g))*AU_KM;
  const eps=(23.439-0.00000036*n)*rad, ra=Math.atan2(Math.cos(eps)*Math.sin(lam*rad),Math.cos(lam*rad))/rad;
  return {lam,R,ra:nrm360(ra)};
}
function eclToEqu(lam,beta,T){ const eps=(23.4392911-0.0130042*T)*rad, l=lam*rad, b=beta*rad;
  const ra=Math.atan2(Math.sin(l)*Math.cos(eps)-Math.tan(b)*Math.sin(eps),Math.cos(l));
  const dec=Math.asin(Math.sin(b)*Math.cos(eps)+Math.cos(b)*Math.sin(eps)*Math.sin(l));
  return {ra:nrm360(ra/rad), dec:dec/rad}; }
function lstDeg(ms){ const n=ms/86400000+2440587.5-2451545.0; return nrm360((18.697374558+24.06570982441908*n)*15+LON); }
function horiz(Hdeg,dec){ const H=Hdeg*rad, d=dec*rad, phi=LAT*rad;
  const el=Math.asin(Math.sin(phi)*Math.sin(d)+Math.cos(phi)*Math.cos(d)*Math.cos(H));
  const az=Math.atan2(-Math.cos(d)*Math.sin(H),Math.sin(d)*Math.cos(phi)-Math.cos(d)*Math.cos(H)*Math.sin(phi));
  return {el:el/rad, az:nrm360(az/rad)}; }
function refract(e){ return e>-1.5? e+1.02/Math.tan((e+10.3/(e+5.11))*rad)/60 : e; }
const OBS_U=Math.atan(0.99664719*Math.tan(LAT*rad)), OBS_RS=0.99664719*Math.sin(OBS_U)+20/6378140*Math.sin(LAT*rad), OBS_RC=Math.cos(OBS_U)+20/6378140*Math.cos(LAT*rad);
function moonPos(ms){
  const m=moonEcl(ms), q=eclToEqu(m.lam,m.beta,m.T), H=nrm360(lstDeg(ms)-q.ra+180)-180;
  const sp=EARTH_R/m.dist, d=q.dec*rad, Hr=H*rad;   // topozentrische Korrektur (Meeus Kap. 40)
  const dA=Math.atan2(-OBS_RC*sp*Math.sin(Hr),Math.cos(d)-OBS_RC*sp*Math.cos(Hr));
  const dec2=Math.atan2((Math.sin(d)-OBS_RS*sp)*Math.cos(dA),Math.cos(d)-OBS_RC*sp*Math.cos(Hr))/rad;
  const H2=H-dA/rad, hz=horiz(H2,dec2);
  const s=sunEcl(ms), elong=nrm360(m.lam-s.lam);
  const psi=Math.acos(Math.cos(m.beta*rad)*Math.cos((m.lam-s.lam)*rad)), i=Math.atan2(s.R*Math.sin(psi),m.dist-s.R*Math.cos(psi));
  return {el:refract(hz.el), elTrue:hz.el, az:hz.az, H:nrm360(H2+180)-180, ra:q.ra, dec:dec2, dist:m.dist, lam:m.lam, beta:m.beta,
          elong, k:(1+Math.cos(i))/2, waxing:elong<180, raSun:s.ra, semi:Math.asin(1737.4/m.dist)/rad}; }
function moonElong(ms){ return nrm360(moonEcl(ms).lam-sunEcl(ms).lam); }
// nächster (dir=+1) bzw. letzter (dir=−1) Zeitpunkt, an dem die Elongation den Zielwert (0 Neumond, 180 Vollmond) erreicht
function moonPhaseTime(ms,target,dir){
  const f=t=>{ const e=nrm360(moonElong(t)-target); return e>180?e-360:e; };   // −180…180, steigt mit der Zeit
  const step=6*3600000*dir; let a=ms, fa=f(a);
  for(let i=0;i<140;i++){ const b=a+step, fb=f(b);
    const cross=dir>0?(fa<0&&fb>=0&&fb-fa<90):(fa>=0&&fb<0&&fa-fb<90);
    if(cross){ let lo=dir>0?a:b, hi=dir>0?b:a; for(let k=0;k<30;k++){ const mid=(lo+hi)/2; if(f(mid)<0) lo=mid; else hi=mid; } return (lo+hi)/2; }
    a=b; fa=fb; }
  return null; }
/* ---------------- Finsternisse ---------------- */
// Sonne genauer nach Meeus Kap. 25 (wahre Länge + Aberration, ohne Nutation wie beim Mond), Zeit TT ≈ UT + ΔT.
// Sonnenfinsternis: topozentrische Örter von Sonne und Mond, Bedeckung als Flächenanteil der Sonnenscheibe.
// Mondfinsternis: geozentrischer Abstand des Mondes vom Gegenpunkt der Sonne, Kern- und Halbschatten nach Danjon.
function deltaT(ms){ const q=new Date(ms), y=q.getUTCFullYear()+(q.getUTCMonth()+0.5)/12;   // Espenak & Meeus (NASA), Polynome 1900–2150
  if(y<1920){ const t=y-1900; return -2.79+1.494119*t-0.0598939*t*t+0.0061966*t*t*t-0.000197*t*t*t*t; }
  if(y<1941){ const t=y-1920; return 21.20+0.84493*t-0.076100*t*t+0.0020936*t*t*t; }
  if(y<1961){ const t=y-1950; return 29.07+0.407*t-t*t/233+t*t*t/2547; }
  if(y<1986){ const t=y-1975; return 45.45+1.067*t-t*t/260-t*t*t/718; }
  if(y<2005){ const t=y-2000; return 63.86+0.3345*t-0.060374*t*t+0.0017275*t*t*t+0.000651814*t**4+0.00002373599*t**5; }
  if(y<2050){ const t=y-2000; return 62.92+0.32217*t+0.005589*t*t; }
  const u=(y-1820)/100; return -20+32*u*u-0.5628*(2150-y); }
function sunPrecise(ms){
  const T=(ms/86400000+2440587.5-2451545.0+deltaT(ms)/86400)/36525;
  const L0=280.46646+36000.76983*T+0.0003032*T*T, M=(357.52911+35999.05029*T-0.0001537*T*T)*rad, e=0.016708634-0.000042037*T;
  const C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(M)+(0.019993-0.000101*T)*Math.sin(2*M)+0.000289*Math.sin(3*M);
  const nu=M+C*rad, R=1.000001018*(1-e*e)/(1+e*Math.cos(nu));
  return {lam:nrm360(L0+C-0.00569), R:R*AU_KM, T}; }
const _eV=(ra,dec)=>{ const a=ra*rad, d=dec*rad; return [Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)]; };
const _eDot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
// topozentrischer Ort aus geozentrischem Ort (Rektaszension, Deklination, Abstand km): Vektor minus Beobachterort
function topoVec(ra,dec,dist,ms){ const th=lstDeg(ms)*rad, g=_eV(ra,dec).map(c=>c*dist), o=[EARTH_R*OBS_RC*Math.cos(th),EARTH_R*OBS_RC*Math.sin(th),EARTH_R*OBS_RS];
  const v=[g[0]-o[0],g[1]-o[1],g[2]-o[2]], d=Math.hypot(v[0],v[1],v[2]), u=v.map(c=>c/d);
  const raT=nrm360(Math.atan2(u[1],u[0])/rad), decT=Math.asin(u[2])/rad; return {u,d,ra:raT,dec:decT,H:nrm360(lstDeg(ms)-raT+180)-180}; }
// Flächenanteil eines Kreises (Radius r1), den ein Kreis (Radius r2) im Mittelpunktsabstand d bedeckt
function circleCover(r1,r2,d){ if(d>=r1+r2) return 0; if(d<=Math.abs(r2-r1)) return r2>=r1?1:(r2*r2)/(r1*r1);
  const a=r1*r1*Math.acos((d*d+r1*r1-r2*r2)/(2*d*r1))+r2*r2*Math.acos((d*d+r2*r2-r1*r1)/(2*d*r2))-0.5*Math.sqrt((-d+r1+r2)*(d+r1-r2)*(d-r1+r2)*(d+r1+r2));
  return a/(Math.PI*r1*r1); }
function solarEclipseAt(ms){
  const m=moonEcl(ms), s=sunPrecise(ms);
  if(Math.abs(nrm360(m.lam-s.lam+180)-180)>4) return null;
  const qm=eclToEqu(m.lam,m.beta,m.T), qs=eclToEqu(s.lam,0,s.T);
  const tm=topoVec(qm.ra,qm.dec,m.dist,ms), ts=topoVec(qs.ra,qs.dec,s.R,ms);
  const sep=Math.acos(Math.min(1,_eDot(tm.u,ts.u)))/rad, hm=horiz(tm.H,tm.dec), hs=horiz(ts.H,ts.dec);
  const rm=Math.asin(1737.4/tm.d)/rad, rs=959.63/3600/(s.R/AU_KM);
  const cover=circleCover(rs,rm,sep), mag=Math.max(0,(rs+rm-sep)/(2*rs));
  return {sep,rs,rm,cover,mag,sunEl:hs.el,sunAz:hs.az,moonEl:hm.el,moonAz:hm.az}; }
function lunarEclipseAt(ms){
  const m=moonEcl(ms), s=sunPrecise(ms);
  if(Math.abs(nrm360(m.lam-s.lam)-180)>4) return null;
  const sep=Math.acos(Math.max(-1,Math.min(1,Math.cos(m.beta*rad)*Math.cos((m.lam-s.lam-180)*rad))))/rad;
  const pm=Math.asin(EARTH_R/m.dist)/rad, ps=8.794/3600/(s.R/AU_KM), ss=959.63/3600/(s.R/AU_KM), sm=Math.asin(1737.4/m.dist)/rad;
  const ru=1.01*pm+ps-ss, rp=1.01*pm+ps+ss;
  const umag=(ru+sm-sep)/(2*sm), pmag=(rp+sm-sep)/(2*sm);
  return {sep,sm,ru,rp,umag,pmag,uCover:circleCover(sm,ru,sep),pCover:circleCover(sm,rp,sep)}; }
// Suche: Finsternisse, die von Lübeck aus zu sehen sind (Sonne bzw. Mond über dem Horizont), ab ms vorwärts
function eclipseScan(ms,count,kinds){ kinds=kinds||'sl'; const out=[]; let t=ms-2*86400000;
  for(let n=0;n<3000&&out.length<count;n++){
    const tn=moonPhaseTime(t,0,1), tf=moonPhaseTime(t,180,1); if(tn===null&&tf===null) break;
    const cands=[]; if(tn!==null) cands.push([tn,'s']); if(tf!==null) cands.push([tf,'l']); cands.sort((a,b)=>a[0]-b[0]);
    const [tc,k]=cands[0]; t=tc+86400000;
    if(!kinds.includes(k)) continue;
    const e=k==='s'?solarEclipseInfo(tc):lunarEclipseInfo(tc); if(e&&e.max>=ms-4*3600000) out.push(e); }
  return out; }
function edgeSearch(f,a,b){ for(let i=0;i<40;i++){ const mid=(a+b)/2; if(f(mid)===f(a)) a=mid; else b=mid; } return (a+b)/2; }
function solarEclipseInfo(tn){
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
function lunarEclipseInfo(tf){
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
function moonPhaseName(e){ const N=LANG==='en'?['new moon','waxing crescent','first quarter','waxing gibbous','full moon','waning gibbous','last quarter','waning crescent']:['Neumond','zunehmende Sichel','Erstes Viertel','zunehmender Mond','Vollmond','abnehmender Mond','Letztes Viertel','abnehmende Sichel'];
  return N[e<8||e>=352?0:e<82?1:e<98?2:e<172?3:e<188?4:e<262?5:e<278?6:7]; }
// Auf- und Untergang (Oberrand am mathematischen Horizont, mit Lichtbrechung) zwischen t0 und t1, Abtastung 5 min
function moonRiseSet(t0,t1){ let rise=null,set=null,prev=null; const st=300000;
  const f=t=>{ const m=moonPos(t); return m.el+m.semi; };
  for(let t=t0;t<=t1;t+=st){ const v=f(t);
    if(prev!==null){ if(prev<0&&v>=0&&rise===null){ let a=t-st,b=t; for(let k=0;k<12;k++){ const c=(a+b)/2; if(f(c)<0) a=c; else b=c; } rise=(a+b)/2; }
      if(prev>=0&&v<0&&set===null){ let a=t-st,b=t; for(let k=0;k<12;k++){ const c=(a+b)/2; if(f(c)>=0) a=c; else b=c; } set=(a+b)/2; } }
    prev=v; }
  return {rise,set}; }


/* ---------------- Renderer ---------------- */
const stage=$('#stage');
const coarse=matchMedia('(pointer:coarse)').matches;
const lowEnd=coarse&&((navigator.deviceMemory||8)<=4||(navigator.hardwareConcurrency||8)<=4);   // ältere Handys: weniger Pixel, kleinere Schatten- und Umgebungstexturen
let renderer;
try{ renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); }
catch(e){ ldDone(); stage.innerHTML='<div class="err">'+tr('WebGL ist in diesem Browser nicht verfügbar.','WebGL is not available in this browser.')+'</div>'; return; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowEnd?1.5:2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
// Handy im Hintergrund o. Ä.: Browser entzieht den Grafikspeicher. Statt schwarzer Fläche Hinweis und Neuladen mit der aktuellen Ansicht
renderer.domElement.addEventListener('webglcontextlost',e=>{ e.preventDefault(); if(document.getElementById('glLost')) return;
  const d=document.createElement('div'); d.id='glLost'; d.className='err';
  d.innerHTML='<div><p>'+tr('Der Browser hat die 3D-Darstellung unterbrochen (z. B. weil die Seite im Hintergrund war).','The browser interrupted the 3D view (for example because the page was in the background).')+'</p><button class="btn" id="glReload">'+tr('Neu laden','Reload')+'</button></div>';
  document.getElementById('stage').appendChild(d);
  document.getElementById('glReload').addEventListener('click',()=>{ try{ history.replaceState(null,'','#'+stateCode()); }catch(x){} location.reload(); }); });
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1;
renderer.localClippingEnabled=true;
stage.appendChild(renderer.domElement);
renderer.domElement.tabIndex=0;
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xb6cfe6,350,1700);
const camera=new THREE.PerspectiveCamera(55,1,0.2,5000);
const cutPlane=new THREE.Plane(new V3(0,-1,0),200);
const maxAniso=renderer.capabilities.getMaxAnisotropy();

/* ---------------- Texturen ---------------- */
function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function canvasTex(w,h,draw,rep,srgb){
  const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; if(rep) t.repeat.set(rep[0],rep[1]);
  if(srgb!==false) t.encoding=THREE.sRGBEncoding; t.anisotropy=maxAniso; return t;
}
// Backsteinfarben nach Fotos (2026): gedecktes Rotbraun, G/R ≈ 0,6, dazu sintergebrannte dunkle und einzelne hellere Steine
function brickCol(r,dark){ const t=r(); if(t<(dark===undefined?0.1:dark)) return [60+r()*18,43+r()*10,39+r()*8]; if(t>0.86) return [158+r()*20,98+r()*14,76+r()*12]; return [130+r()*26,77+r()*16,61+r()*12]; }
const brickTex=canvasTex(512,256,(g,w,h)=>{
  const r=rng(11); g.fillStyle='#968a80'; g.fillRect(0,0,w,h);
  const bw=64, bh=h/12;
  for(let row=0;row<12;row++){ const off=(row%2)*bw/2;
    for(let i=-1;i<9;i++){ const x=i*bw+off, y=row*bh, k=r(); let c;
      c=brickCol(r);
      g.fillStyle='rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')'; g.fillRect(x+2,y+2,bw-3,bh-3); } }
},[1/2.4,1/1.2]);
const slabTex=canvasTex(512,512,(g,w,h)=>{   // roter Ziegelboden (nach Innenfotos), 30 × 15 cm
  const r=rng(5); g.fillStyle='#b8a594'; g.fillRect(0,0,w,h); const bw=64, bh=32;
  for(let row=0;row<h/bh;row++){ const off=(row%2)*bw/2; for(let i=-1;i<=w/bw;i++){ const t=r(); const c=t<0.08?[120,62,48]:[150+r()*28,70+r()*18,52+r()*14];
    g.fillStyle='rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')'; g.fillRect(i*bw+off+2,row*bh+2,bw-4,bh-4); } }
  for(let i=0;i<4000;i++){ g.fillStyle='rgba('+(r()<.5?'0,0,0':'255,255,255')+','+(r()*0.05)+')'; g.fillRect(r()*w,r()*h,2,2); }
},[1/2.4,1/2.4]);
const groundTex=canvasTex(256,256,(g,w,h)=>{
  const r=rng(9); g.fillStyle='#5d5a55'; g.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=16) for(let x=0;x<w;x+=16){ const t=118+r()*40; g.fillStyle='rgb('+t+','+(t-3)+','+(t-8)+')'; g.beginPath(); g.ellipse(x+8+r()*2,y+8+r()*2,7,6.5,0,0,Math.PI*2); g.fill(); }
},[3333,3333]);
const copperTex=canvasTex(256,256,(g,w,h)=>{   // Kupfer mit hellem Grünspan (Luftbilder)
  const r=rng(21); g.fillStyle='#7dbdb0'; g.fillRect(0,0,w,h);   // Grünspan türkisgrau (Luftbilder, Foto vom Petriturm)
  for(let i=0;i<900;i++){ const t=r(); g.fillStyle=t<.5?'rgba(92,146,138,.32)':'rgba(170,216,206,.30)'; g.fillRect(r()*w,r()*h,6+r()*20,4+r()*14); }
  for(let i=0;i<30;i++){ g.fillStyle='rgba(50,80,70,.16)'; g.fillRect(r()*w,0,2+r()*3,h); }
  g.fillStyle='rgba(50,90,78,.45)'; for(let x=0;x<w;x+=32) g.fillRect(x,0,2,h); for(let y=0;y<h;y+=64) g.fillRect(0,y,w,1);
},[1/4.8,1/4.8]);
const diamondTex=canvasTex(128,128,(g,w,h)=>{   // helle Rechteckverglasung in Blei (nach Fotos des Obergadens)
  const r=rng(4); for(let j=0;j<2;j++) for(let i=0;i<3;i++){ const t=222+r()*18; g.fillStyle='rgb('+(t-4|0)+','+(t+2|0)+','+(t|0)+')'; g.fillRect(i*w/3,j*h/2,w/3,h/2); }
  for(let i=0;i<300;i++){ g.fillStyle='rgba(255,250,235,'+(r()*0.35)+')'; g.fillRect(r()*w,r()*h,3,3); }
  g.strokeStyle='#3a3d40'; g.lineWidth=3; for(let i=0;i<=3;i++){ g.beginPath(); g.moveTo(i*w/3,0); g.lineTo(i*w/3,h); g.stroke(); } for(let j=0;j<=2;j++){ g.beginPath(); g.moveTo(0,j*h/2); g.lineTo(w,j*h/2); g.stroke(); }
},null);

/* Glasmalerei-Atlas: 8 Spalten = 8 Fenstertypen. Typen 1, 2, 4, 5, 6 = eigene Fotos der Fenster (2026, entzerrt); 0 Westfenster = neutrale Platzhalter-Verglasung (Bildrechte), 3 = gemalt.
   Gezeichnet wird in 256 × 1024 Einheiten pro Spalte, gespeichert mit doppelter Auflösung (512 × 2048 Pixel). */
const NT=8, ATL=1024, COL=256, AS=2;
const GLASS=await DATA.glass;
const HASPHOTO=k=>Object.prototype.hasOwnProperty.call(GLASS,String(k));   // Spalten mit Foto werden nicht erst gemalt
const atlasCanvas=document.createElement('canvas'); atlasCanvas.width=COL*NT*AS; atlasCanvas.height=ATL*AS;
(function paintAtlas(){
  const g=atlasCanvas.getContext('2d'); g.scale(AS,AS);
  const pick=(arr,r)=>arr[(r()*arr.length)|0];
  function cells(ox,seed,colorAt){ const r=rng(seed); let y=0;
    while(y<ATL){ const rh=16+r()*22; let x=0;
      while(x<COL){ const w=Math.min(14+r()*30,COL-x); const u=(x+w/2)/COL, v=1-(y+rh/2)/ATL;
        g.fillStyle=colorAt(u,v,r); g.fillRect(ox+x,y,w,rh); g.strokeStyle='rgba(22,20,20,.92)'; g.lineWidth=2.2; g.strokeRect(ox+x+1,y+1,w-2,rh-2); x+=w; }
      y+=rh; } }
  const clip=ox=>{ g.save(); g.beginPath(); g.rect(ox,0,COL,ATL); g.clip(); };
  // 0 Westfenster: bewusst neutrale, nicht nachempfundene Verglasung (Bildrechte des Kunstwerks); helle getönte Rechteckscheiben
  { const ox=0; const tints=['#f2ece0','#e9e4d8','#efe7d2','#e3e8ea','#ece2cf','#f4f0e6','#dfe4e2','#eadfca'];
    cells(ox,101,(u,v,rr)=>tints[(rr()*tints.length)|0]); }
  // 1 Totentanz: Craquelé-Grund, Reigen aus Tod und Lebenden in drei Bahnen
  if(HASPHOTO(1)) { g.fillStyle='#8c8f96'; g.fillRect(1*COL,0,COL,ATL); } else
  { const ox=COL, r=rng(202); g.fillStyle='#eceee9'; g.fillRect(ox,0,COL,ATL); clip(ox);
    const S=26, pts=[]; for(let y=-S;y<=ATL+S;y+=S){ const row=[]; for(let x=-S;x<=COL+S;x+=S) row.push([ox+x+(r()-0.5)*S*0.8,y+(r()-0.5)*S*0.8]); pts.push(row); }
    g.strokeStyle='rgba(70,72,76,.75)'; g.lineWidth=1.6;
    for(let j=0;j<pts.length;j++) for(let i=0;i<pts[j].length;i++){ const p=pts[j][i]; if(i+1<pts[j].length){ const q=pts[j][i+1]; g.beginPath(); g.moveTo(p[0],p[1]); g.lineTo(q[0],q[1]); g.stroke(); } if(j+1<pts.length){ const q=pts[j+1][i]; g.beginPath(); g.moveTo(p[0],p[1]); g.lineTo(q[0],q[1]); g.stroke(); } }
    const robes=['#2f4fa8','#e0c020','#b0281e','#5a3a8a','#6b4a2a','#2f7a5a','#c86a20','#7a2a6a'];
    for(let row=0;row<6;row++) for(let lane=0;lane<3;lane++){ const cx=ox+COL*(lane+0.5)/3, cy=ATL*(0.17+row*0.128), s=0.62, col=pick(robes,r);
      if((row+lane)%2===0){ g.globalAlpha=0.85; g.fillStyle=col; g.beginPath(); g.moveTo(cx-10*s,cy-40*s); g.quadraticCurveTo(cx+42*s,cy+10*s,cx+22*s,cy+72*s); g.lineTo(cx-30*s,cy+72*s); g.quadraticCurveTo(cx-42*s,cy+10*s,cx-10*s,cy-40*s); g.fill(); g.globalAlpha=1;
        g.strokeStyle='#2b2b2e'; g.lineWidth=5*s; g.beginPath(); g.moveTo(cx,cy-40*s); g.lineTo(cx,cy+30*s); g.lineTo(cx-14*s,cy+70*s); g.moveTo(cx,cy+30*s); g.lineTo(cx+16*s,cy+70*s); g.moveTo(cx,cy-25*s); g.lineTo(cx-28*s,cy-50*s); g.moveTo(cx,cy-25*s); g.lineTo(cx+30*s,cy-5*s); g.stroke();
        g.fillStyle='#e8e6dc'; g.lineWidth=2; g.beginPath(); g.arc(cx,cy-54*s,12*s,0,7); g.fill(); g.stroke(); }
      else { g.fillStyle=col; g.strokeStyle='#222'; g.lineWidth=2; g.beginPath(); g.moveTo(cx-14*s,cy-38*s); g.lineTo(cx+14*s,cy-38*s); g.lineTo(cx+30*s,cy+72*s); g.lineTo(cx-30*s,cy+72*s); g.closePath(); g.fill(); g.stroke();
        g.fillStyle='#f0d9c0'; g.beginPath(); g.arc(cx,cy-52*s,12*s,0,7); g.fill(); g.stroke();
        g.fillStyle=pick(['#c8a030','#8a2a20','#333333','#2a4a8a'],r); g.fillRect(cx-14*s,cy-70*s,28*s,10*s); } }
    g.fillStyle='#b8261c'; g.fillRect(ox,ATL*0.94,COL,ATL*0.06); g.fillStyle='#1d3a9a'; for(let x=0;x<COL;x+=40) g.fillRect(ox+x,ATL*0.94,14,ATL*0.06);
    g.fillStyle='#e07a20'; g.fillRect(ox,0,COL*0.33,ATL*0.06); g.fillStyle='#2e56b8'; g.fillRect(ox+COL*0.67,0,COL*0.33,ATL*0.06); g.restore(); }
  // 2 Briefkapelle: weißes Glas mit roten und schwarzen Zickzackbändern (Ersatz, falls das Foto fehlt)
  if(HASPHOTO(2)) { g.fillStyle='#8c8f96'; g.fillRect(2*COL,0,COL,ATL); } else
  { const whites=['#f2f1ec','#e1e3df','#f7f6f1','#d6d9d6','#ebeae4'];
    cells(2*COL,303,(u,v,r)=> r()<0.04?'#3e5d93':pick(whites,r));
    const zr=rng(9); clip(2*COL);
    for(let k=0;k<6;k++){ let x=2*COL+20+zr()*216, y=-20; const pts=[[x,y]];
      while(y<ATL+20){ x+=(zr()<.5?-1:1)*(24+zr()*46); x=Math.min(3*COL-8,Math.max(2*COL+8,x)); y+=36+zr()*70; pts.push([x,y]); }
      g.lineJoin='miter'; g.strokeStyle='#141414'; g.lineWidth=11; g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke();
      g.strokeStyle=k%3===2?'#262626':'#b3222b'; g.lineWidth=6; g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke(); }
    g.restore(); }
  // 3 (nicht mehr verwendet) Wappen von Lübeck, Hamburg, Bremen, Textband
  { const ox=3*COL; g.fillStyle='#e4e8e7'; g.fillRect(ox,0,COL,ATL);
    clip(ox); g.strokeStyle='#3a3d42'; g.lineWidth=2.2; g.beginPath();
    for(let k=-ATL;k<ATL+COL;k+=34){ g.moveTo(ox+k,0); g.lineTo(ox+k+ATL,ATL); g.moveTo(ox+k,ATL); g.lineTo(ox+k+ATL,0); } g.stroke(); g.restore();
    const shield=(cy,fill)=>{ const cx=ox+128, w=150, h=190; g.beginPath(); g.moveTo(cx-w/2,cy-h/2); g.lineTo(cx+w/2,cy-h/2); g.lineTo(cx+w/2,cy); g.quadraticCurveTo(cx+w/2,cy+h*0.42,cx,cy+h/2); g.quadraticCurveTo(cx-w/2,cy+h*0.42,cx-w/2,cy); g.closePath(); g.fillStyle=fill; g.fill(); g.strokeStyle='#151515'; g.lineWidth=6; g.stroke(); return [cx,cy]; };
    { const cy=ATL*(1-0.76), cx=ox+128; g.fillStyle='#202020'; g.beginPath(); g.ellipse(cx-62,cy-30,52,26,-0.5,0,Math.PI*2); g.ellipse(cx+62,cy-30,52,26,0.5,0,Math.PI*2); g.fill();
      g.beginPath(); g.arc(cx-26,cy-108,14,0,Math.PI*2); g.arc(cx+26,cy-108,14,0,Math.PI*2); g.fill();
      g.save(); shield(cy,'#f2f0ea'); g.clip(); g.fillStyle='#b5202a'; g.fillRect(cx-80,cy,160,120); g.restore(); shield(cy,'rgba(0,0,0,0)'); }
    { const [cx,cy]=shield(ATL*(1-0.5),'#b5202a'); g.fillStyle='#f2f0ea'; g.fillRect(cx-46,cy-6,92,52); g.fillRect(cx-14,cy-52,28,50); g.fillRect(cx-50,cy-34,20,32); g.fillRect(cx+30,cy-34,20,32); g.fillStyle='#b5202a'; g.fillRect(cx-10,cy+16,20,30); }
    { const [cx,cy]=shield(ATL*(1-0.26),'#b5202a'); g.save(); g.translate(cx,cy); g.rotate(-0.75); g.fillStyle='#f2f0ea'; g.fillRect(-6,-70,12,120); g.beginPath(); g.arc(0,-78,20,0,Math.PI*2); g.fill(); g.fillRect(0,32,28,10); g.fillRect(0,46,22,9); g.fillStyle='#b5202a'; g.beginPath(); g.arc(0,-78,9,0,Math.PI*2); g.fill(); g.restore(); }
    g.fillStyle='#d7b257'; g.fillRect(ox+18,ATL*(1-0.09),COL-36,46); g.fillStyle='#3a2a10'; const tr=rng(55); for(let x=ox+26;x<ox+COL-30;x+=9){ g.fillRect(x,ATL*(1-0.09)+14+tr()*4,5,12+tr()*6); } }
  // 4 Tympanon über dem Nordportal: große Farbflächen, Flammen, kräftige Bleilinien
  if(HASPHOTO(4)) { g.fillStyle='#8c8f96'; g.fillRect(4*COL,0,COL,ATL); } else
  { const ox=4*COL, r=rng(404);
    cells(ox,404,(u,v,rr)=>{ if(v<0.12) return pick(['#dfe3e6','#c9ced2','#eef0f0'],rr);
      if(u<0.32&&v<0.6) return pick(['#1b2fd0','#2440e0','#1426a0'],rr);
      if(u<0.56&&v<0.42) return pick(['#9c1414','#c22020','#7a0f0f'],rr);
      if(u>0.62&&v<0.45) return pick(['#3fae2a','#2f8a20','#cfd6d0','#b9c0bc'],rr);
      if(v>0.62) return pick(['#e9ecee','#d6dadd','#c4c9cc'],rr);
      return pick(['#f1f2ef','#d9dcda','#b8bdb9','#8e9590'],rr); });
    clip(ox);
    for(const [fu,fv] of [[0.2,0.76],[0.36,0.84],[0.52,0.8],[0.7,0.78],[0.84,0.7]]){ const cx=ox+fu*COL, cy=ATL*(1-fv); g.fillStyle='#e8501c'; g.beginPath(); g.moveTo(cx,cy-70); g.quadraticCurveTo(cx+30,cy-10,cx+12,cy+30); g.quadraticCurveTo(cx,cy+10,cx-12,cy+30); g.quadraticCurveTo(cx-30,cy-10,cx,cy-70); g.fill(); g.fillStyle='#f6c040'; g.beginPath(); g.ellipse(cx,cy+8,9,20,0,0,7); g.fill(); }
    g.strokeStyle='#151515'; g.lineWidth=6; for(let k=0;k<14;k++){ let x=ox+r()*COL, y=r()*ATL; g.beginPath(); g.moveTo(x,y); for(let s=0;s<4;s++){ x+=(r()-0.5)*90; y+=(r()-0.5)*160; g.lineTo(x,y); } g.stroke(); }
    g.fillStyle='#b01818'; for(let y=20;y<ATL;y+=60){ g.beginPath(); g.arc(ox+10,y,6,0,7); g.fill(); g.beginPath(); g.arc(ox+COL-10,y,6,0,7); g.fill(); } g.restore(); }
  // 5 Wappenfenster der Marientidenkapelle (Foto; gemalter Ersatz: Schriftzeilen auf hellem Glas, Wappenreihen)
  if(HASPHOTO(5)) { g.fillStyle='#8c8f96'; g.fillRect(5*COL,0,COL,ATL); } else
  { const ox=5*COL, r=rng(505); g.fillStyle='#e8eae4'; g.fillRect(ox,0,COL,ATL); clip(ox);
    g.fillStyle='#2a2622';
    for(let y=ATL*0.08;y<ATL;y+=13){ for(let x=ox+6;x<ox+COL-6;){ const w=2+r()*5; if(r()<0.12){ x+=8; continue; } g.fillRect(x,y,w,7+r()*3); x+=w+1.5; } }
    g.strokeStyle='rgba(40,40,40,.85)'; g.lineWidth=3; for(let y=0;y<ATL;y+=ATL/16){ g.beginPath(); g.moveTo(ox,y); g.lineTo(ox+COL,y); g.stroke(); }
    const tinct=[['#f2f0ea','#1a1a1a'],['#c01e24','#f2f0ea'],['#e8c020','#1a1a1a'],['#1d3e8f','#e8c020'],['#f2f0ea','#c01e24'],['#2f7a3a','#f2f0ea']];
    const shp=(cx,cy,w,h)=>{ g.beginPath(); g.moveTo(cx-w/2,cy-h/2); g.lineTo(cx+w/2,cy-h/2); g.lineTo(cx+w/2,cy); g.quadraticCurveTo(cx+w/2,cy+h*0.42,cx,cy+h/2); g.quadraticCurveTo(cx-w/2,cy+h*0.42,cx-w/2,cy); g.closePath(); };
    const shield=(cx,cy,w,h,t)=>{ g.save(); shp(cx,cy,w,h); g.fillStyle=t[0]; g.fill(); g.clip(); g.fillStyle=t[1]; const k=(r()*4)|0;
      if(k===0) g.fillRect(cx-w/2,cy,w,h); else if(k===1) g.fillRect(cx-w/8,cy-h/2,w/4,h); else if(k===2){ g.beginPath(); g.ellipse(cx,cy,w*0.28,h*0.3,0,0,7); g.fill(); } else { g.fillRect(cx-w/2,cy-h/2,w/2,h/2); g.fillRect(cx,cy,w/2,h/2); }
      g.restore(); g.strokeStyle='#151515'; g.lineWidth=2.5; shp(cx,cy,w,h); g.stroke(); };
    for(const fy of [0.27,0.45,0.62,0.8]) for(const fx of [1/6,1/2,5/6]){ const cx=ox+COL*fx, cy=ATL*fy; g.fillStyle='#f4f1e6'; g.fillRect(cx-36,cy-46,72,92); shield(cx,cy+4,56,70,pick(tinct,r)); }
    for(let k=0;k<40;k++) shield(ox+10+r()*(COL-20),r()*ATL,12,15,pick(tinct,r));
    g.fillStyle='#1a1a1a'; for(const fx of [1/6,1/2,5/6]){ const cx=ox+COL*fx, cy=ATL*0.05; g.fillRect(cx-3,cy-18,6,36); g.fillRect(cx-14,cy-6,28,6); }
    g.restore(); }
  g.fillStyle='#e6e8e4'; g.fillRect(6*COL,0,COL,ATL);
  // 7 Gedenkkapelle: helle Bleiverglasung, wird durch das Foto des Wappenfensters ersetzt
  cells(7*COL,707,(u,v,r)=>r()<0.05?pick(['#c9b27a','#9fb3c8'],r):pick(['#e9ece6','#dfe5df','#f2f2ec','#d5ddd8'],r));
})();
function texFromCanvas(c,mip){ const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; if(!mip){ t.generateMipmaps=false; t.minFilter=THREE.LinearFilter; } else t.anisotropy=maxAniso; return t; }
const atlasMip=texFromCanvas(atlasCanvas,true);
const atlasLin=new THREE.CanvasTexture(atlasCanvas); atlasLin.generateMipmaps=false; atlasLin.minFilter=THREE.LinearFilter;
// mittlere Farbe je Spalte: über eine kleine verkleinerte Kopie gelesen (das Auslesen des großen Atlas dauerte mehrere Sekunden)
const ccCanvas=document.createElement('canvas'); ccCanvas.width=NT*8; ccCanvas.height=32;
function colColor(k){ const cg=ccCanvas.getContext('2d'); cg.clearRect(k*8,0,8,32); cg.drawImage(atlasCanvas,k*COL*AS,0,COL*AS,ATL*AS,k*8,0,8,32);
  const d=cg.getImageData(k*8,0,8,32).data; let r=0,g=0,b=0,n=0;
  for(let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; } const c=new THREE.Color(r/n/255,g/n/255,b/n/255); const m=Math.max(c.r,c.g,c.b,1e-3); return c.multiplyScalar(1/m); }
// gemalte Spalten: feste Mittelwerte (spart das langsame Auslesen des großen Atlas); Fotospalten: aus dem Foto selbst
const typeColor=[[1,.97,.92],[1,.98,.95],[1,.93,.92],[1,.92,.92],[.8,.8,1],[1,1,.96],[1,.98,.95],[1,1,1]].map(c=>new THREE.Color(c[0],c[1],c[2]));
function imgColor(img){ const cg=ccCanvas.getContext('2d'); cg.clearRect(0,0,8,32); cg.drawImage(img,0,0,8,32); const d=cg.getImageData(0,0,8,32).data; let r=0,g=0,b=0,n=0;
  for(let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; } const c=new THREE.Color(r/n/255,g/n/255,b/n/255); const m=Math.max(c.r,c.g,c.b,1e-3); return c.multiplyScalar(1/m); }
// Fotos der Fenster laden und in ihre Spalten legen (bis dahin stehen die gemalten Fassungen)
async function loadGlassPhotos(){   // Fotos dekodieren und in ihre Spalten legen, bevor der Atlas zur Grafikkarte geht
  const g=atlasCanvas.getContext('2d');
  await Promise.all(Object.keys(GLASS).map(async key=>{ const k=+key, img=new Image(); img.src=GLASS[key];
    try{ await img.decode(); }catch(e){ return; }
    g.setTransform(1,0,0,1,0,0); g.drawImage(img,k*COL*AS,0,COL*AS,ATL*AS); typeColor[k]=imgColor(img); }));
  atlasMip.needsUpdate=true; atlasLin.needsUpdate=true;
}
await loadGlassPhotos();
// Gewölbekappen: heller Putz mit Ziegelzeichnung und Rankenmalerei (nach Innenfotos)
const vaultTex=canvasTex(512,512,(g,w,h)=>{
  const r=rng(77); g.fillStyle='#ece6da'; g.fillRect(0,0,w,h);
  g.strokeStyle='rgba(150,118,96,.10)'; g.lineWidth=1; for(let y=0;y<h;y+=12){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); for(let x=(y/12%2)*16;x<w;x+=32){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+12); g.stroke(); } }
  for(let k=0;k<7;k++){ const x0=r()*w, y0=r()*h, len=60+r()*80, a=r()*Math.PI*2;
    g.strokeStyle='#7a3a2a'; g.lineWidth=2.2; g.beginPath(); g.moveTo(x0,y0); const pts=[];
    for(let s=1;s<=6;s++){ const t=s/6, x=x0+Math.cos(a)*len*t+Math.sin(t*6)*10, y=y0+Math.sin(a)*len*t+Math.cos(t*6)*10; g.lineTo(x,y); pts.push([x,y]); } g.stroke();
    for(const [x,y] of pts){ g.fillStyle='#5e7a5a'; g.beginPath(); g.ellipse(x+6,y-4,7,3.2,a+0.8,0,7); g.fill(); g.beginPath(); g.ellipse(x-6,y+4,7,3.2,a-0.8,0,7); g.fill(); }
    const [fx,fy]=pts[pts.length-1]; g.fillStyle='#a8402c'; for(let q=0;q<5;q++){ const b=q/5*Math.PI*2; g.beginPath(); g.arc(fx+Math.cos(b)*6,fy+Math.sin(b)*6,4,0,7); g.fill(); } g.fillStyle='#d8b050'; g.beginPath(); g.arc(fx,fy,3.5,0,7); g.fill(); }
  for(let i=0;i<3000;i++){ g.fillStyle='rgba(120,100,80,'+(r()*0.05)+')'; g.fillRect(r()*w,r()*h,2,2); }
},[1,1]);

/* ---------------- Shader-Erweiterung: Innenraum-Maske & farbiges Licht ---------------- */
const MAXW=16;
const TINT={
  uSunL:{value:new V3(0,1,0)},
  uWinO:{value:Array.from({length:MAXW},()=>new V3())},
  uWinU:{value:Array.from({length:MAXW},()=>new V3(1,0,0))},
  uWinN:{value:Array.from({length:MAXW},()=>new V3(0,0,1))},
  uWinP:{value:Array.from({length:MAXW},()=>new THREE.Vector4(1,0,1,2))},
  uWinT:{value:new Array(MAXW).fill(0)},
  uWinCount:{value:0},
  uAtlas:{value:atlasLin},
  uAmbIn:{value:0.22},
  uPlaster:{value:new THREE.Color(0.86,0.83,0.76)},
  uPX:{value:PX.slice()},
  uTintOn:{value:1}
};
const GL_HEAD=`
varying vec3 vWP;
uniform vec3 uSunL;
uniform vec3 uWinO[${MAXW}];
uniform vec3 uWinU[${MAXW}];
uniform vec3 uWinN[${MAXW}];
uniform vec4 uWinP[${MAXW}];
uniform float uWinT[${MAXW}];
uniform int uWinCount;
uniform sampler2D uAtlas;
uniform float uAmbIn;
uniform vec3 uPlaster;
uniform float uTintOn;
uniform float uPX[${NB+1}];
float polyD(vec2 q, float step, float lo, float hi){
  float a=degrees(atan(q.y,q.x+1e-5));
  float mid=clamp(lo+step*floor((a-lo)/step+0.5),lo,hi);
  return length(q)*cos(radians(a-mid));
}
${MASK_GLSL}vec3 winTint(vec3 P){
  if(uTintOn<0.5) return vec3(1.0);
  for(int i=0;i<${MAXW};i++){
    if(i>=uWinCount) break;
    vec3 N=uWinN[i];
    float dn=dot(uSunL,N);
    if(abs(dn)<1e-4) continue;
    float t=dot(uWinO[i]-P,N)/dn;
    if(t<=0.0) continue;
    vec3 Q=P+uSunL*t-uWinO[i];
    float u=dot(Q,uWinU[i]);
    float v=Q.y;
    vec4 g=uWinP[i];
    if(abs(u)>g.x || v<g.y || v>g.w) continue;
    if(v>g.z){
      float w=g.x; float dv=v-g.z;
      if((u-w)*(u-w)+dv*dv>4.0*w*w || (u+w)*(u+w)+dv*dv>4.0*w*w) continue;
    }
    vec2 auv=vec2((uWinT[i]+0.02+0.96*(u+g.x)/(2.0*g.x))*${F(1/NT)},(v-g.y)/(g.w-g.y));
    vec3 c=texture2D(uAtlas,auv).rgb;
    return pow(c,vec3(2.2))*1.7;
  }
  return vec3(1.0);
}
`;
function jsPolyD(qx,qz,step,lo,hi){ const a=Math.atan2(qz,qx+1e-5)/rad; const mid=Math.min(hi,Math.max(lo,lo+step*Math.floor((a-lo)/step+0.5))); return Math.hypot(qx,qz)*Math.cos((a-mid)*rad); }
function insideJS(x,y,z){
  for(const r of ROOMS) if(x>r[0]&&x<r[1]&&z>r[2]&&z<r[3]&&y<r[4]) return true;
  if(x>=XC){ if(y<38.6&&CH_EDGES.every(e=>e[0]*(x-e[2])+e[1]*(z-e[3])<0)) return true; if(y<20.6&&inAmb(x,z)) return true; }
  if(y<18.3&&MT_EDGES.every(e=>e[0]*(x-e[2])+e[1]*(z-e[3])>-0.05)) return true;
  return false;
}
const LFB=(function(){ const c=THREE.ShaderChunk.lights_fragment_begin; const i=c.indexOf('NUM_DIR_LIGHTS > 0'); if(i<0) return null; const j=c.indexOf('RE_Direct( directLight',i); if(j<0) return null; return c.slice(0,j)+'directLight.color *= winTint( vWP );\n\t\t'+c.slice(j); })();
function enhance(mat,o){
  o=o||{}; const key='stm'+(o.mask?1:0)+(o.pillar?1:0);
  mat.customProgramCacheKey=()=>key;
  mat.onBeforeCompile=function(sh){
    Object.assign(sh.uniforms,TINT);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n\tvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    let f=sh.fragmentShader;
    f=f.replace('#include <common>','#include <common>\n'+(o.mask?'#define USE_MASK\n':'')+(o.pillar?'#define PILLAR\n':'')+GL_HEAD);
    f=f.replace('#include <map_fragment>',`#include <map_fragment>
#ifdef USE_MASK
	{
		float mk=insideMask(vWP);
		vec3 base=uPlaster*(0.92+0.3*dot(diffuseColor.rgb,vec3(0.333)));
#ifdef PILLAR
		if(vWP.x>uPX[0]-0.3 && vWP.x<uPX[${NB}]-0.05){   // Bemalung nach Innenfotos: rote Bogenränder, Rankenbänder an den Pfeilern
			float xm=0.0, hw=1.0, dp=100.0;
			for(int i=0;i<${NB};i++){ if(vWP.x>=uPX[i] && vWP.x<uPX[i+1]){ xm=0.5*(uPX[i]+uPX[i+1]); hw=0.5*(uPX[i+1]-uPX[i])-1.0; } }
			for(int i=0;i<=${NB};i++) dp=min(dp,abs(vWP.x-uPX[i]));
			float u=vWP.x-xm, y=vWP.y, sp=${F(ARC_SP)}, d;
			if(y<sp) d=abs(abs(u)-hw); else { vec2 c=vec2(u<=0.0?hw:-hw,sp); d=abs(length(vec2(u,y)-c)-2.0*hw); }
			vec3 red=vec3(0.68,0.34,0.24), green=vec3(0.42,0.55,0.46);
			if(d<0.38 && y>0.8 && y<${F(ARC_SP+5.0)}) base=mix(base, d<0.08?vec3(0.48,0.22,0.15):red, 0.8);
			if(dp>0.4 && dp<0.85 && y>0.8 && y<29.5){ float k=fract(y/0.8); vec3 orn=k<0.5?red:green; float q=length(vec2((dp-0.62)/0.17,(fract(y/0.4)-0.5)/0.3)); if(q<1.0) base=mix(base,orn,0.75); if(abs(dp-0.42)<0.03||abs(dp-0.83)<0.03) base=mix(base,red,0.8); }
		}
#endif
		diffuseColor.rgb=mix(diffuseColor.rgb,base,mk);
	}
#endif`);
    if(LFB) f=f.replace('#include <lights_fragment_begin>',LFB);
    f=f.replace('#include <aomap_fragment>',`{ float am=mix(1.0,uAmbIn,insideMask(vWP)); reflectedLight.indirectDiffuse*=am; reflectedLight.indirectSpecular*=am; }
#include <aomap_fragment>`);
    sh.fragmentShader=f;
  };
  mat.clippingPlanes=[cutPlane];
  return mat;
}

/* ---------------- Materialien ---------------- */
const lin=h=>new THREE.Color(h).convertSRGBToLinear();   // Farbwert als sRGB angeben (wie im Foto gemessen); three r128 nimmt Hex-Farben sonst linear
const wallMat=enhance(new THREE.MeshStandardMaterial({map:brickTex,roughness:0.93,metalness:0,side:THREE.DoubleSide}),{mask:true});
const arcadeMat=enhance(new THREE.MeshStandardMaterial({map:brickTex,roughness:0.93,metalness:0,side:THREE.DoubleSide}),{mask:true,pillar:true});
const floorMat=enhance(new THREE.MeshStandardMaterial({map:slabTex,roughness:0.7}),{});
const doorMat=new THREE.MeshStandardMaterial({color:lin(0x26302b),roughness:0.75,side:THREE.DoubleSide}); doorMat.clippingPlanes=[cutPlane];   // ohne Innenraum-Shader: sonst hellt das Streulicht das Türblatt auf
const woodMat=enhance(new THREE.MeshStandardMaterial({color:0x8a5c36,roughness:0.65}),{});
const towerMatW=enhance(new THREE.MeshStandardMaterial({map:brickTex,roughness:0.93,side:THREE.DoubleSide}),{mask:true});
const revealMat=new THREE.MeshStandardMaterial({map:brickTex,color:0x9c948c,roughness:0.95,side:THREE.DoubleSide}); revealMat.clippingPlanes=[cutPlane];   // Laibung: derselbe Backstein, nur etwas dunkler (Fotos: keine hellen Bögen)
const stoneLedgeMat=new THREE.MeshStandardMaterial({color:lin(0xa8a39b),roughness:0.85}); stoneLedgeMat.clippingPlanes=[cutPlane];   // helle Gesimse und Sohlbänke
const mullionMat=enhance(new THREE.MeshStandardMaterial({map:brickTex,color:0xd8d0c8,roughness:0.92}),{mask:true});   // Pfosten außen Backstein, innen verputzt (Fotos)
const graniteMat=enhance(new THREE.MeshStandardMaterial({color:0x7a756f,roughness:0.5}),{});
const altarMat=enhance(new THREE.MeshStandardMaterial({color:0x6e5a3e,roughness:0.6}),{});
const roofMat=new THREE.MeshStandardMaterial({map:copperTex,roughness:0.7,metalness:0.1,side:THREE.DoubleSide}); roofMat.clippingPlanes=[cutPlane];
const goldMat=new THREE.MeshStandardMaterial({color:0xd8a948,roughness:0.32,metalness:0.4,emissive:0x2a1a04}); goldMat.clippingPlanes=[cutPlane];
const darkMat=new THREE.MeshStandardMaterial({color:0x1b1715,roughness:0.9,side:THREE.DoubleSide}); darkMat.clippingPlanes=[cutPlane];
const darkRoofMat=new THREE.MeshStandardMaterial({color:0x3b3d42,roughness:0.75,metalness:0.1}); darkRoofMat.clippingPlanes=[cutPlane];
const groundMat=new THREE.MeshStandardMaterial({map:groundTex,roughness:0.95,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:4});
const outerFront=new THREE.MeshStandardMaterial({color:0x2a3a42,map:diamondTex,roughness:0.25,metalness:0.55,side:THREE.FrontSide}); outerFront.clippingPlanes=[cutPlane];
const outerBack=outerFront.clone(); outerBack.side=THREE.BackSide; outerBack.clippingPlanes=[cutPlane];
diamondTex.repeat.set(1,1);

/* ---------------- Geometrie-Helfer ---------------- */
const building=new THREE.Group(); scene.add(building);
const occluders=[];
function addMesh(geo,mat,cast,recv){ const m=new THREE.Mesh(geo,mat); m.castShadow=cast!==false; m.receiveShadow=recv!==false; building.add(m); if(m.castShadow) occluders.push(m); return m; }
function scaleUV(g,sx,sy){ const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*sx,uv.getY(i)*sy); return g; }
function boxGeo(w,h,d){ const g=new THREE.BoxGeometry(w,h,d); const uv=g.attributes.uv, dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++) for(let k=0;k<4;k++){ const i=f*4+k; uv.setXY(i,uv.getX(i)*dims[f][0],uv.getY(i)*dims[f][1]); } return g; }
function box(x0,x1,y0,y1,z0,z1,mat){ const g=boxGeo(Math.abs(x1-x0),Math.abs(y1-y0),Math.abs(z1-z0)); g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); return addMesh(g,mat||wallMat); }
function polyGeo(faces){
  const pos=[],uv=[], ab=new V3(), ac=new V3(), n=new V3(), e2=new V3(), tmp=new V3();
  for(const f of faces){ const a=f[0]; ab.subVectors(f[1],a); ac.subVectors(f[2],a); n.crossVectors(ab,ac).normalize(); const e1=ab.clone().normalize(); e2.crossVectors(n,e1);
    const push=v=>{ pos.push(v.x,v.y,v.z); tmp.subVectors(v,a); uv.push(tmp.dot(e1),tmp.dot(e2)); };
    push(f[0]);push(f[1]);push(f[2]); if(f.length===4){ push(f[0]);push(f[2]);push(f[3]); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.computeVertexNormals(); return g;
}
function mergeGeos(gs){ let pc=0,ic=0; for(const g of gs){ pc+=g.attributes.position.count; ic+=g.index.count; }
  const pos=new Float32Array(pc*3), nor=new Float32Array(pc*3), uv=new Float32Array(pc*2), idx=new Uint32Array(ic); let po=0,io=0;
  for(const g of gs){ pos.set(g.attributes.position.array,po*3); nor.set(g.attributes.normal.array,po*3); uv.set(g.attributes.uv.array,po*2);
    const gi=g.index.array; for(let i=0;i<gi.length;i++) idx[io+i]=gi[i]+po; po+=g.attributes.position.count; io+=gi.length; }
  const m=new THREE.BufferGeometry(); m.setAttribute('position',new THREE.BufferAttribute(pos,3)); m.setAttribute('normal',new THREE.BufferAttribute(nor,3)); m.setAttribute('uv',new THREE.BufferAttribute(uv,2)); m.setIndex(new THREE.BufferAttribute(idx,1)); return m; }
const P=(x,y,z)=>new V3(x,y,z);
function ringPt(R,aDeg,cx,cz,k){ return [ (cx===undefined?XC:cx)+R*Math.cos(aDeg*rad)*(k||1), (cz||0)+R*Math.sin(aDeg*rad) ]; }

/* Spitzbogen (gleichseitig): Punkte von links unten über den Scheitel nach rechts unten */
function lancet(c,hw,bottom,spring,n){ n=n||10; const pts=[[c-hw,bottom],[c-hw,spring]], r=2*hw;
  for(let i=1;i<=n;i++){ const a=Math.PI-(Math.PI/3)*i/n; pts.push([c+hw+r*Math.cos(a),spring+r*Math.sin(a)]); }
  for(let i=1;i<=n;i++){ const a=Math.PI/3-(Math.PI/3)*i/n; pts.push([c-hw+r*Math.cos(a),spring+r*Math.sin(a)]); }
  pts.push([c+hw,bottom]); return pts; }
function wallGeo(Lw,H,t,openings,ext,top){
  const s=new THREE.Shape(); s.moveTo(-ext,0);
  openings.filter(o=>o.kind==='door').sort((a,b)=>a.u-b.u).forEach(d=>{ lancet(d.u,d.hw,0,d.spring,10).forEach(p=>s.lineTo(p[0],p[1])); });
  s.lineTo(Lw+ext,0);
  if(top) top.forEach(p=>s.lineTo(p[0],p[1])); else { s.lineTo(Lw+ext,H); s.lineTo(-ext,H); }
  openings.filter(o=>o.kind==='win'&&!o.inDoor).forEach(w=>{ const pts=lancet(w.u,w.hw,w.bottom,w.spring,10); const path=new THREE.Path(); path.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) path.lineTo(pts[i][0],pts[i][1]); s.holes.push(path); });
  return new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false,curveSegments:1});
}
const windows=[];
function wall(p0,p1,o){
  const dx=p1[0]-p0[0], dz=p1[1]-p0[1], Lw=Math.hypot(dx,dz);
  const X=new V3(dx/Lw,0,dz/Lw), Y=new V3(0,1,0), Z=new V3().crossVectors(X,Y);
  const t=o.t, y0=o.y0||0, ext=o.ext!==undefined?o.ext:t/2, ops=o.openings||[];
  const g=wallGeo(Lw,o.h,t,ops,ext,o.top);
  const m=new THREE.Matrix4().makeBasis(X,Y,Z); m.setPosition(new V3(p0[0],y0,p0[1]).addScaledVector(Z,-t/2)); g.applyMatrix4(m);
  addMesh(g,o.mat||wallMat);
  ops.forEach(w=>{ if(w.kind==='win') registerWindow(p0,X,Z,y0,w,t); });
  if(o.doorLeaf) ops.filter(d=>d.kind==='door').forEach(d=>{ const tw=ops.find(w=>w.inDoor&&Math.abs(w.u-d.u)<0.01), sh=new THREE.Shape();   // mit Oberlicht: Türblatt nur bis unter das Glas
    const pts=tw?[[d.u-d.hw,0],[d.u-d.hw,tw.bottom],[d.u+d.hw,tw.bottom],[d.u+d.hw,0]]:lancet(d.u,d.hw,0,d.spring,10); sh.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) sh.lineTo(pts[i][0],pts[i][1]);
    const dg=new THREE.ShapeGeometry(sh); dg.translate(0,0,t*0.55); dg.applyMatrix4(m); addMesh(dg,doorMat); });   // geschlossene Außentür
}
const W=(u,hw,bottom,spring,glass,inDoor)=>({kind:'win',u,hw,bottom,spring,glass:glass===undefined?-1:glass,inDoor:!!inDoor});   // inDoor: Oberlicht im Türbogen, kein eigenes Wandloch
const D=(u,hw,spring)=>({kind:'door',u,hw,spring});

await step(tr('Fenster werden angelegt','Placing the windows'),22);
/* ---------------- Fenster: Glas, Lichtbahn, Datensatz ---------------- */
const beamVS=`attribute float aA; varying float vA;
#include <clipping_planes_pars_vertex>
void main(){ vA=aA; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mvPosition;
#include <clipping_planes_vertex>
}`;
const beamFS=`uniform vec3 uColor; uniform float uI; varying float vA;
#include <clipping_planes_pars_fragment>
void main(){
#include <clipping_planes_fragment>
 float a=pow(vA,1.5); gl_FragColor=vec4(uColor*a*uI,1.0); }`;
const mullionGeos=[];
const archY=(u,hw,sp)=>sp+Math.sqrt(Math.max(0,4*hw*hw-Math.pow(u<=0?u-hw:u+hw,2)));
function registerWindow(p0,X,Z,y0,o,t){
  const apex=o.spring+SQ3*o.hw, mid=(o.bottom+apex)/2, Y=new V3(0,1,0);
  const O=new V3(p0[0]+X.x*o.u,y0,p0[1]+X.z*o.u);
  const test=O.clone().addScaledVector(Z,t/2+0.8); test.y+=mid;
  const inward=insideJS(test.x,test.y,test.z)?Z.clone():Z.clone().negate();
  const outN=inward.clone().negate(), type=o.glass;
  const fs=new V3().crossVectors(outN,Y).dot(X)<0?-1:1;   // Glasbild von innen seitenrichtig: links/rechts wie vom Kirchenraum aus gesehen
  const w={O,X:X.clone(),Z:Z.clone(),inward,outN,hw:o.hw,bottom:o.bottom,spring:o.spring,apex,type,t,lit:0};
  const pts=lancet(0,o.hw,o.bottom,o.spring,12);
  const shape=new THREE.Shape(); shape.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) shape.lineTo(pts[i][0],pts[i][1]);
  const basis=new THREE.Matrix4().makeBasis(X,Y,Z);
  function pane(off,mat){ const g=new THREE.ShapeGeometry(shape); const uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++){ const u=uv.getX(i), v=uv.getY(i);
      if(type>=0) uv.setXY(i,(type+0.02+0.96*(fs*u+o.hw)/(2*o.hw))/NT,(v-o.bottom)/(apex-o.bottom)); else uv.setXY(i,u*1.25,v*1.25); }
    const m=basis.clone(); m.setPosition(O.clone().addScaledVector(inward,off)); g.applyMatrix4(m);
    const mesh=new THREE.Mesh(g,mat); mesh.castShadow=false; mesh.receiveShadow=false; building.add(mesh); return mesh; }
  const inMat=new THREE.MeshBasicMaterial({map:type>=0?atlasMip:diamondTex,side:inward.dot(Z)>0?THREE.FrontSide:THREE.BackSide});
  inMat.clippingPlanes=[cutPlane];
  w.paneIn=pane(0.04,inMat);
  w.paneOut=pane(-0.04,outN.dot(Z)>0?outerFront:outerBack);
  // Lichtbahn
  const N=pts.length; w.ptsIn=pts.map(p=>O.clone().addScaledVector(X,p[0]).addScaledVector(Y,p[1]).addScaledVector(inward,t/2+0.03));
  const pos=new Float32Array(N*6), al=new Float32Array(N*2), idx=[];
  for(let i=0;i<N;i++){ al[i]=1; al[N+i]=0; const j=(i+1)%N; idx.push(i,j,N+i, j,N+j,N+i); }
  const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.BufferAttribute(pos,3)); bg.setAttribute('aA',new THREE.BufferAttribute(al,1)); bg.setIndex(idx);
  const bm=new THREE.ShaderMaterial({vertexShader:beamVS,fragmentShader:beamFS,uniforms:{uColor:{value:(type>=0?typeColor[type].clone():new THREE.Color(1,0.93,0.8))},uI:{value:0}},
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,clipping:true});
  bm.clippingPlanes=[cutPlane];
  w.beam=new THREE.Mesh(bg,bm); w.beam.frustumCulled=false; w.beam.visible=false; w.beam.renderOrder=5; scene.add(w.beam);
  w.center=O.clone().addScaledVector(Y,mid).addScaledVector(inward,t/2);
  w.occ=[o.bottom+0.8,mid,apex-0.9].map(v=>O.clone().addScaledVector(Y,v).addScaledVector(outN,t/2+0.35));
  windows.push(w);
  { const nL=o.glass===4||o.inDoor?1:o.glass===1||o.glass===6?3:o.hw>=3?4:o.hw>=1.35?3:2, B=new THREE.Matrix4().makeBasis(X,Y,Z);   // Fensterpfosten
    for(let k=1;k<nL;k++){ const u=-o.hw+2*o.hw*k/nL, top=archY(u,o.hw,o.spring)-0.04; if(top-o.bottom<0.3) continue;
      const g=boxGeo(0.16,top-o.bottom,t*0.85); const m=B.clone(); m.setPosition(O.clone().addScaledVector(X,u).addScaledVector(Y,(o.bottom+top)/2)); g.applyMatrix4(m); mullionGeos.push(g); } }
  if(type>=0){ const k=TINT.uWinCount.value; if(k<MAXW){ TINT.uWinO.value[k].copy(O); TINT.uWinU.value[k].copy(X).multiplyScalar(fs); TINT.uWinN.value[k].copy(Z);
    TINT.uWinP.value[k].set(o.hw,o.bottom,o.spring,apex); TINT.uWinT.value[k]=type; TINT.uWinCount.value=k+1; } }
}

await step(tr('Kirche wird aufgebaut','Building the church'),32);
/* ---------------- Bau der Kirche (Maße abgeglichen mit LoD2 2025 und bDOM20 2023) ---------------- */
const groundMesh=(function(){ const gg=new THREE.PlaneGeometry(10000,10000); gg.rotateX(-Math.PI/2); const gm=new THREE.Mesh(gg,groundMat); gm.receiveShadow=true; scene.add(gm); return gm; })();
function floorPoly(pts){ const s=new THREE.Shape(); pts.forEach((p,i)=>i?s.lineTo(p[0],-p[1]):s.moveTo(p[0],-p[1])); const g=new THREE.ShapeGeometry(s); g.rotateX(-Math.PI/2); g.translate(0,0.04,0); addMesh(g,floorMat,false,true); }
const floorRect=(x0,x1,z0,z1)=>floorPoly([[x0,z0],[x1,z0],[x1,z1],[x0,z1]]);
floorRect(XW,X0,-ZNF,ZNF); floorRect(GK.x0,GK.x1,GK.z0,GK.z1); floorRect(X0,XC,-ZAN,0); floorRect(X0,CHAPELS[0].x1,0,ZSI); floorRect(CHAPELS[0].x1,XT,0,ZAS); floorRect(XT,XC,0,ZCS); floorRect(X0,XT,-ZKN,-ZAN);
for(const c of CHAPELS) floorRect(c.x0,c.x1,c.s>0?c.zi:-c.zo,c.s>0?c.zo:-c.zi);
floorPoly(AMB);
floorPoly(MT);
const bayMid=i=>(PX[i]+PX[i+1])/2, bayW=i=>PX[i+1]-PX[i];

// Arkadenwände Mittelschiff und Chor (Pfeiler + Obergaden), 10 Joche nach LoD2
for(const s of [-1,1]){
  const ops=[]; for(let i=0;i<NB;i++){ const u=bayMid(i)-X0, bw=bayW(i); ops.push(D(u,(bw-2)/2,ARC_SP)); ops.push(W(u,Math.min(1.9,(bw-2.6)/2),29.8,34.8)); }   // Obergaden bis ≈38 m (Fotos)
  wall([X0,s*ZN],[XC,s*ZN],{h:HN,t:1.4,ext:0.7,openings:ops,mat:arcadeMat});
}
// Obergaden innen (Fotos aus dem Mittelschiff): unter jedem Fenster eine Blende bis zum Ornamentfries bei 21,4 m,
// die Pfosten laufen herunter, unten je drei gemalte Heilige unter Baldachinen
{ const Y0=21.6, Y1=29.8, mk=(w,h,draw)=>{ const m=enhance(new THREE.MeshStandardMaterial({map:canvasTex(w,h,draw,[1,1]),roughness:0.9,side:THREE.DoubleSide}),{}); return m; };
  const nicheMat=mk(256,512,(g,w,h)=>{ const r=rng(31);
    g.fillStyle='#e6e0d4'; g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(160,110,92,.28)'; g.lineWidth=1; for(let y=8;y<h;y+=17){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); for(let x=((y/17)|0)%2*20;x<w;x+=40){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+17); g.stroke(); } }
    g.fillStyle='#8a4a38'; g.fillRect(0,0,7,h); g.fillRect(w-7,0,7,h); g.fillStyle='#2f3433'; g.fillRect(9,0,5,h); g.fillRect(w-14,0,5,h);
    const lane=(w-28)/3, robes=['#9a4632','#5d6f58','#a8743c','#7a3a2e','#55617a','#8c5a3a'];
    for(let k=0;k<3;k++){ const x0=14+k*lane, cx=x0+lane/2;
      if(k>0){ g.fillStyle='#2f3433'; g.fillRect(x0-3,0,6,h); }
      // Baldachin
      g.fillStyle='rgba(120,128,110,.85)'; g.fillRect(cx-lane*0.36,h*0.5,lane*0.72,h*0.08); g.fillStyle='rgba(176,120,70,.85)';
      for(const dx of [-0.26,0,0.26]){ g.fillRect(cx+dx*lane-5,h*0.4,10,h*0.1); g.beginPath(); g.moveTo(cx+dx*lane-7,h*0.4); g.lineTo(cx+dx*lane,h*0.36); g.lineTo(cx+dx*lane+7,h*0.4); g.fill(); }
      g.strokeStyle='rgba(90,60,40,.7)'; g.lineWidth=2; g.beginPath(); g.moveTo(cx-lane*0.34,h*0.6); g.quadraticCurveTo(cx,h*0.53,cx+lane*0.34,h*0.6); g.stroke();
      // Figur mit Nimbus
      const rb=robes[(k+((r()*6)|0))%robes.length];
      g.fillStyle='rgba(200,160,80,.85)'; g.beginPath(); g.arc(cx,h*0.655,lane*0.14,0,7); g.fill();
      g.fillStyle='#d8bfa4'; g.beginPath(); g.arc(cx,h*0.66,lane*0.085,0,7); g.fill();
      g.fillStyle=rb; g.beginPath(); g.moveTo(cx-lane*0.12,h*0.69); g.lineTo(cx+lane*0.12,h*0.69); g.lineTo(cx+lane*0.24,h*0.95); g.lineTo(cx-lane*0.24,h*0.95); g.closePath(); g.fill();
      g.strokeStyle='rgba(40,30,25,.5)'; g.lineWidth=1.5; g.beginPath(); g.moveTo(cx,h*0.7); g.lineTo(cx+lane*0.04,h*0.94); g.stroke();
      g.fillStyle='rgba(60,50,40,.55)'; g.fillRect(cx+lane*0.15,h*0.7,3,h*0.2); }
    g.fillStyle='rgba(140,90,70,.35)'; g.fillRect(0,h*0.965,w,h*0.035); });
  const friezeMat=mk(256,32,(g,w,h)=>{ g.fillStyle='#d9cfbf'; g.fillRect(0,0,w,h); g.fillStyle='#8e4630'; g.fillRect(0,0,w,4); g.fillRect(0,h-4,w,4);
    g.strokeStyle='#4f6a52'; g.lineWidth=3; for(let x=0;x<w;x+=32){ g.beginPath(); g.moveTo(x+4,6); g.lineTo(x+28,h-6); g.moveTo(x+28,6); g.lineTo(x+4,h-6); g.stroke(); }
    g.fillStyle='#a8402c'; for(let x=16;x<w;x+=32){ g.beginPath(); g.arc(x,h/2,4,0,7); g.fill(); } });
  const ng=[], fg=[];
  for(const s of [-1,1]){ const zf=s*(ZN-0.71);
    for(let i=0;i<NB;i++){ const u=bayMid(i), bw=bayW(i), hw=Math.min(1.9,(bw-2.6)/2)+0.2;
      const p=new THREE.PlaneGeometry(2*hw,Y1-Y0); if(s>0) p.rotateY(Math.PI); p.translate(u,(Y0+Y1)/2,zf); ng.push(p); }
    const L=XC-X0, f=new THREE.PlaneGeometry(L,0.42); scaleUV(f,L/1.6,1); if(s>0) f.rotateY(Math.PI); f.translate((X0+XC)/2,Y0-0.21,zf+0.005*(-s)); fg.push(f); }
  const m1=new THREE.Mesh(mergeGeos(ng),nicheMat), m2=new THREE.Mesh(mergeGeos(fg),friezeMat); m1.receiveShadow=m2.receiveShadow=true; building.add(m1); building.add(m2); }
// Binnenchor: drei Seiten des Achtecks (Grundriss), Arkaden zum Umgang, je ein hohes Obergadenfenster (Drohnenfoto von Osten)
for(let k=0;k<3;k++){ const a=CHOIR[k], b=CHOIR[k+1], Lw=Math.hypot(b[0]-a[0],b[1]-a[1]);
  wall(a,b,{h:HN,t:1.4,ext:0.35,mat:arcadeMat,openings:[D(Lw/2,Math.min(1.7,(Lw-1.6)/2),13.6),W(Lw/2,Math.min(1.5,(Lw-2.2)/2),APSE_WB,APSE_WS)]}); }
// Chorschluss innen (Fotos aus dem Mittelschiff): Laufgang mit Maßwerkbrüstung über den Arkaden, darüber Blendmaßwerk bis zu den Fenstern
{ const ci=choirOff(-0.72), mk=(draw)=>{ const m=new THREE.MeshStandardMaterial({map:canvasTex(256,128,draw,[1,1]),roughness:0.85,side:THREE.DoubleSide}); m.clippingPlanes=[cutPlane]; return m; };
  const balMat=mk((g,w,h)=>{ g.fillStyle='#d9d0c2'; g.fillRect(0,0,w,h); g.fillStyle='#4a3a32';
    for(let x=32;x<w;x+=64){ for(const [dx,dy] of [[0,-14],[14,0],[0,14],[-14,0]]){ g.beginPath(); g.arc(x+dx,64+dy,12,0,7); g.fill(); } }
    g.fillStyle='#b9ad9c'; g.fillRect(0,0,w,14); g.fillRect(0,h-12,w,12); for(let x=0;x<=w;x+=64) g.fillRect(x-3,0,6,h); });
  const blendMat=mk((g,w,h)=>{ g.fillStyle='#d6ccbc'; g.fillRect(0,0,w,h); g.strokeStyle='#8f5340'; g.lineWidth=6;
    for(let x=0;x<w;x+=42){ g.beginPath(); g.moveTo(x+6,h); g.lineTo(x+6,40); g.quadraticCurveTo(x+21,4,x+36,40); g.lineTo(x+36,h); g.stroke(); } });
  const bg=[], lg=[];
  for(let k=0;k<3;k++){ const a=ci[k], b=ci[k+1], L=Math.hypot(b[0]-a[0],b[1]-a[1]), cx=(a[0]+b[0])/2, cz=(a[1]+b[1])/2, ang=Math.atan2(-(b[1]-a[1]),b[0]-a[0]);
    const p1=new THREE.PlaneGeometry(L,1.2); scaleUV(p1,L/2.4,1); p1.rotateY(ang); p1.translate(cx,APSE_GAL+0.6,cz); bg.push(p1);
    const p2=new THREE.PlaneGeometry(L,APSE_WB-APSE_GAL-1.2); scaleUV(p2,L/1.8,1); p2.rotateY(ang); p2.translate(cx,(APSE_GAL+1.2+APSE_WB)/2,cz); lg.push(p2); }
  const m1=new THREE.Mesh(mergeGeos(bg),balMat), m2=new THREE.Mesh(mergeGeos(lg),blendMat); m1.receiveShadow=m2.receiveShadow=true; building.add(m1); building.add(m2); }

// Nördliches Seitenschiff: Langhaus mit niedriger Kapellenreihe davor, im Chor Öffnungen zu Totentanz- und Chorkapellen
{ const ops=[];
  for(let i=0;i<NB;i++){ const u=bayMid(i)-X0, bw=bayW(i);
    if(PX[i]<XT-0.1){ ops.push(D(u,Math.min(2.3,(bw-1.8)/2),3.6)); ops.push(W(u,1.8,11.0,16.6)); }
    else ops.push(D(u,(bw-1.8)/2,PX[i]<14?13.0:11.0)); }
  wall([X0,-ZAN],[XC,-ZAN],{h:HAN,t:1.2,ext:0.6,openings:ops}); }
// Südliches Seitenschiff, Langhaus. Nach dem Grundriss liegt die Seitenschiffwand bei z = 17,3; dahinter in den beiden
// westlichen Jochen die Briefkapelle, in den übrigen vier Jochen Kapellen zwischen den Strebepfeilern (Warendorp-, Stotebrügge-,
// Segeberg-, Divessen-Kapelle). Die Außenwand bei z = 21,2 (LoD2) trägt die Kapellenfenster.
{ const ops=[], bx=CHAPELS[0].x1;
  for(let i=0;i<6;i++){ const a=PX[i], b=PX[i+1];
    if(b<=bx+0.01) continue;
    else if(a<bx){ ops.push(W((bx+b)/2-bx,Math.min(1.9,(b-bx-1.6)/2),5,14.0)); }
    else ops.push(W((a+b)/2-bx,1.9,5,14.0)); }
  wall([bx,ZAS],[XT,ZAS],{h:HAS,t:1.2,ext:0.6,openings:ops});
  wall([X0,ZAS],[bx,ZAS],{y0:12.6,h:HAS-12.6,t:1.2,ext:0.6});   // über dem Dach der Briefkapelle
  const iops=[];
  for(let i=0;i<6;i++){ const a=PX[i], b=PX[i+1];
    if(b<=bx+0.01){ if(i===1) iops.push(D((a+b)/2-X0,1.3,3.6)); }   // Tür zur Briefkapelle
    else { const aa=Math.max(a,bx); iops.push(D((aa+b)/2-X0,Math.min(2.3,(b-aa-2.0)/2),11.2)); } }
  wall([X0,ZSI],[XT,ZSI],{h:HAS-0.5,t:1.2,ext:0.6,openings:iops});
  // Strebepfeiler zwischen den Kapellen (innen), Kapellengewölbe
  for(let i=3;i<6;i++) box(PX[i]-0.8,PX[i]+0.8,0,19.6,ZSI+0.6,ZAS-0.6);
}
// Südliches Chorseitenschiff: Öffnungen zu Südvorhalle und Bürgermeisterkapelle
{ const ops=[]; for(let i=6;i<NB;i++) ops.push(D(bayMid(i)-XT,(bayW(i)-1.8)/2,11.0));
  wall([XT,ZCS],[XC,ZCS],{h:HCS,t:1.2,ext:0.6,openings:ops}); }
// Übergang Chorseitenschiffe -> Umgang

// Niedrige Kapellenreihe an der Nordseite des Langhauses
{ const ops=[]; for(let i=0;i<6;i++) ops.push(W(bayMid(i)-X0,1.25,1.6,4.6));
  wall([X0,-ZKN],[XT,-ZKN],{h:8.1,t:1.0,ext:0.5,openings:ops});
  addMesh(polyGeo([[P(X0-0.3,9.3,-(ZAN+0.6)),P(XT,9.3,-(ZAN+0.6)),P(XT,8.1,-(ZKN+0.7)),P(X0-0.3,8.1,-(ZKN+0.7))]]),roofMat);
  box(X0+0.3,XT,7.6,7.85,-(ZKN-0.5),-(ZAN+0.6)); }
// Chorumgang mit Kapellenkranz
// (Grundriss 1906: je Seite eine schräge Wand und eine dreiseitige Kapelle, alle Wände mit hohen Fenstern; nach Osten offen zur Marientidenkapelle)
for(let k=0;k<AMB.length-1;k++){ if(k===4) continue; const a=AMB[k], b=AMB[k+1], Lw=Math.hypot(b[0]-a[0],b[1]-a[1]);
  wall(a,b,{h:HCS,t:1.2,ext:0.45,openings:[W(Lw/2,Math.min(1.5,(Lw-2.0)/2),4.5,16.6)]}); }
// Dächer des Kapellenkranzes (Drohnenfoto von Osten): Pultdach an der schrägen Wand, Kapelle mit radialem First und Walm,
// dazwischen Kehlen; First an der Chorwand unter den Obergadenfenstern
const MT_APEX=31.0, HRC=APSE_WB-0.4;   // Dächer des Kapellenkranzes enden unter den tiefer sitzenden Chorfenstern
const nrm2=(x,z)=>{ const l=Math.hypot(x,z); return [x/l,z/l]; };
const AMB_BN=(function(){ const [,P1,P2,P3]=AMB_N, e1=[P2[0]-P1[0],P2[1]-P1[1]], e2=[P3[0]-P2[0],P3[1]-P2[1]], n1=nrm2(e1[1],-e1[0]), n2=nrm2(e2[1],-e2[0]);
  return {1:nrm2(P1[0]-CHOIR[0][0],P1[1]-CHOIR[0][1]),2:nrm2(n1[0]+n2[0],n1[1]+n2[1]),3:nrm2(P3[0]-CHOIR[1][0],P3[1]-CHOIR[1][1])}; })();
function AMB_ROOF(s){ const m=-s, q=(p,y)=>P(p[0],y,m*p[1]);
  const ao=offPoly(AMB,0.7,[0,-1],[0,1],false).slice(0,5); ao[0]=[XC,-(ZAN+0.8)];
  const [,P1,P2,P3]=AMB_N, mid=[(P2[0]+P3[0])/2,(P2[1]+P3[1])/2], e=nrm2(P3[0]-P2[0],P3[1]-P2[1]), d=[-e[1],e[0]];   // d: nach innen
  const co=choirOff(0.7), A=co[0], B=co[1], bx=B[0]-A[0], bz=B[1]-A[1], den=d[0]*bz-d[1]*bx;
  const t=((A[0]-mid[0])*bz-(A[1]-mid[1])*bx)/den, Rin=[mid[0]+d[0]*t,mid[1]+d[1]*t], Rout=[mid[0]+d[0]*4.9,mid[1]+d[1]*4.9];
  const mo=offPoly(MT,0.7,null,null,true), Wn=[MT[0][0],mo[0][1]], e0=[co[1][0]-0.3,-0.1];
  const H=HCS, f=[];
  f.push([q(ao[0],H),q(ao[1],H),q(Rin,HRC)],[q(ao[0],H),q(Rin,HRC),q([XC,-ZNF],HJ)]);
  f.push([q(ao[1],H),q(ao[2],H),q(Rout,HRC)],[q(ao[1],H),q(Rout,HRC),q(Rin,HRC)],[q(ao[2],H),q(ao[3],H),q(Rout,HRC)]);
  f.push([q(ao[3],H),q(ao[4],H),q(Rin,HRC)],[q(ao[3],H),q(Rin,HRC),q(Rout,HRC)]);
  f.push([q(ao[4],H),q(Wn,21.9),q(Rin,HRC)],[q(Wn,21.9),P(e0[0],HRC,e0[1]),q(Rin,HRC)]);
  return f; }
// Westwand zwischen den Türmen: Portal, Westfenster, Giebel
wall([XW,-ZNF],[XW,ZNF],{h:HN,t:1.2,ext:0.9,mat:towerMatW,openings:[D(ZNF,2.2,5.5),W(ZNF,1.9,10.5,19.4,0)],top:[[2*ZNF+0.9,HN],[ZNF,HR],[-0.9,HN]]});   // Westfenster nach Foto: 3,8 × 12,2 m

// Kreuzrippengewölbe (nach Innenfotos): bemalte Kappen, rote Rippen, Schlusssteine; Seitenschiffe ebenso
const VSP_N=31.0, VCR_N=38.5, VSP_A=13.5, VCR_A=20.4;
const vf=t=>Math.sqrt(Math.max(0,1-t*t));
const vaultGeos=[], ribGeos=[], keyGeos=[];
function tube(pts,r){ ribGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),Math.max(8,pts.length*2),r,6,false)); }
function bayVault(xa,xb,za,zb,sp,cr,o){
  o=o||{}; const xm=(xa+xb)/2, zm=(za+zb)/2, hx=(xb-xa)/2, hz=(zb-za)/2, NX=24, NZ=24, rr=o.rib||0.16;
  const hy=(x,z)=>sp+(cr-sp)*Math.max(vf((z-zm)/hz),vf((x-xm)/hx));
  const pos=[], uv=[], idx=[];
  for(let j=0;j<=NZ;j++) for(let i=0;i<=NX;i++){ const x=xa+2*hx*i/NX, z=za+2*hz*j/NZ; pos.push(x,hy(x,z),z); uv.push(x/3,z/3); }
  for(let j=0;j<NZ;j++) for(let i=0;i<NX;i++){ const a=j*(NX+1)+i, b=a+1, c=a+NX+1, d=c+1;
    if((i-NX/2+0.5)*(j-NZ/2+0.5)>0){ idx.push(a,c,d,a,d,b); } else { idx.push(a,c,b,b,c,d); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  vaultGeos.push(g);
  const N=14, dy=-0.14;
  for(const [cx,cz] of [[xa,za],[xb,za],[xa,zb],[xb,zb]]){ const pts=[]; for(let k=0;k<=N;k++){ const t=k/N, x=cx+(xm-cx)*t, z=cz+(zm-cz)*t; pts.push(P(x,hy(x,z)+dy,z)); } tube(pts,rr); }
  if(!o.noWest){ const pts=[]; for(let k=0;k<=N*2;k++){ const z=za+(zb-za)*k/(N*2); pts.push(P(xa,hy(xa,z)+dy,z)); } tube(pts,rr*1.15); }
  if(o.east){ const pts=[]; for(let k=0;k<=N*2;k++){ const z=za+(zb-za)*k/(N*2); pts.push(P(xb,hy(xb,z)+dy,z)); } tube(pts,rr*1.15); }
  for(const zz of [za,zb]){ const pts=[]; for(let k=0;k<=N;k++){ const x=xa+(xb-xa)*k/N; pts.push(P(x,hy(x,zz)+dy,zz)); } tube(pts,rr*0.7); }
  const kg=new THREE.CylinderGeometry(rr*3.4,rr*3.4,0.14,20); kg.translate(xm,cr-0.12,zm); keyGeos.push(kg);
}
// Mittelschiff: Turmhalle + 10 Joche; Seitenschiffe je Joch
bayVault(XW+0.6,X0,-ZNF,ZNF,VSP_N,VCR_N,{rib:0.17});
for(let i=0;i<NB;i++) bayVault(PX[i],PX[i+1],-(ZN-0.7),ZN-0.7,VSP_N,VCR_N,{rib:0.17,east:i===NB-1});
for(let i=0;i<NB;i++){
  bayVault(PX[i],PX[i+1],-(ZAN-0.6),-(ZN+0.7),VSP_A,VCR_A,{rib:0.13,east:i===NB-1});
  bayVault(PX[i],PX[i+1],ZN+0.7,(i<6?ZSI:ZCS)-0.6,VSP_A,VCR_A,{rib:0.13,east:i===NB-1});
  if(i>=2&&i<6) bayVault(i===2?CHAPELS[0].x1+0.5:PX[i]+0.8,PX[i+1]-(i===5?0.5:0.8),ZSI+0.6,ZAS-0.6,13.2,18.6,{rib:0.11,east:true});   // Kapellen zwischen den Strebepfeilern
}
// Chorpolygon: Fächergewölbe mit Rippen zu den Polygonecken
{ const CI=choirOff(-0.7), NR=12, NS=8, pos=[], uv=[], idx=[]; let cols=0;
  const bnd=[]; for(let k=0;k<3;k++) for(let s=0;s<(k===2?NS+1:NS);s++){ const a=CI[k], b=CI[k+1], t=s/NS; bnd.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]); }
  cols=bnd.length;
  for(let j=0;j<=NR;j++){ const r=j/NR; for(const p of bnd){ const x=XC+(p[0]-XC)*r, z=p[1]*r, y=VSP_N+(VCR_N-VSP_N)*vf(r); pos.push(x,y,z); uv.push(x/3,z/3); } }
  for(let j=0;j<NR;j++) for(let i=0;i<cols-1;i++){ const a=j*cols+i, b=a+1, c=a+cols, d=c+1; idx.push(a,c,b,b,c,d); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); vaultGeos.push(g);
  for(const v of [CI[1],CI[2],[(CI[0][0]+CI[1][0])/2,(CI[0][1]+CI[1][1])/2],[(CI[2][0]+CI[3][0])/2,(CI[2][1]+CI[3][1])/2]]){ const pts=[]; for(let k=0;k<=14;k++){ const r=1-k/14; pts.push(P(XC+(v[0]-XC)*r,VSP_N+(VCR_N-VSP_N)*vf(r)-0.14,v[1]*r)); } tube(pts,0.17); }
}
const vaultMat=enhance(new THREE.MeshStandardMaterial({map:vaultTex,roughness:0.92,side:THREE.DoubleSide}),{});
const ribMat=enhance(new THREE.MeshStandardMaterial({color:0x9a4630,roughness:0.8}),{});
const keyMat=enhance(new THREE.MeshStandardMaterial({color:0xc79a3e,roughness:0.45,metalness:0.25}),{});
{ const vm=addMesh(mergeGeos(vaultGeos),vaultMat); occluders.splice(occluders.indexOf(vm),1); }   // nicht in die Strahlprüfung (nur innen sichtbar)
addMesh(mergeGeos(ribGeos),ribMat,false); addMesh(mergeGeos(keyGeos),keyMat,false);
// Umgang: flache Decke wie bisher
{ const ci=choirOff(0.7), out=AMB.concat([[XC,ZN+0.7]],ci.slice(1,3).reverse(),[[XC,-(ZN+0.7)]]);
  const s=new THREE.Shape(); out.forEach((p,i)=>i?s.lineTo(p[0],-p[1]):s.moveTo(p[0],-p[1])); const g=new THREE.ShapeGeometry(s); g.rotateX(-Math.PI/2); g.translate(0,20.5,0); addMesh(g,wallMat); }
// Dienste (rote Wandvorlagen an den Pfeilern), Zuganker und Hängeleuchten
{ const dg=[], ig=[];
  for(let i=1;i<NB;i++) for(const s of [-1,1]){ const g=boxGeo(0.36,VSP_N,0.32); g.translate(PX[i],VSP_N/2,s*(ZN-0.7-0.16)); dg.push(g);
    const lamp=new THREE.CylinderGeometry(0.12,0.15,0.45,12); lamp.translate(PX[i]+0.9,9.6,s*5.4); ig.push(lamp);
    const wire=new THREE.CylinderGeometry(0.012,0.012,30.6-9.9,4); wire.translate(PX[i]+0.9,(30.6+9.9)/2,s*5.4); ig.push(wire); }
  for(let i=1;i<=NB;i++){ const rod=new THREE.CylinderGeometry(0.045,0.045,2*(ZN-0.7),6); rod.rotateX(Math.PI/2); rod.translate(PX[i],30.6,0); ig.push(rod);
    const rod2=new THREE.CylinderGeometry(0.04,0.04,2*(ZN-0.7),6); rod2.rotateX(Math.PI/2); rod2.translate(PX[i]+0.9,30.6,0); if(i<NB) ig.push(rod2); }
  const dienstMat=enhance(new THREE.MeshStandardMaterial({color:0x8a3a24,roughness:0.85}),{});
  const ironMat=enhance(new THREE.MeshStandardMaterial({color:0x232224,roughness:0.6,metalness:0.4}),{});
  { const dm=addMesh(mergeGeos(dg),dienstMat); occluders.splice(occluders.indexOf(dm),1); } addMesh(mergeGeos(ig),ironMat,false); }

// Dächer: Mittelschiff mit Chorpolygon, Pultdächer der Seitenschiffe, Umgang
{ const f=[], RE=ZNF+0.2;
  for(const s of [-1,1]) f.push([P(XW-0.7,HN,s*RE),P(XC,HN,s*RE),P(XC,HR,0),P(XW-0.7,HR,0)]);
  { const co=choirOff(RE-ZN); co[0][0]=XC; co[3][0]=XC; for(let k=0;k<3;k++){ const a=co[k], b=co[k+1]; f.push([P(a[0],HN,a[1]),P(b[0],HN,b[1]),P(XC,HR,0)]); } }
  f.push([P(X0-0.7,HAN,-(ZAN+0.8)),P(XC,HAN,-(ZAN+0.8)),P(XC,HJ,-ZNF),P(X0-0.7,HJ,-ZNF)]);
  f.push([P(X0-0.7,HAS,ZAS+0.8),P(XT,HAS,ZAS+0.8),P(XT,HJ,ZNF),P(X0-0.7,HJ,ZNF)]);
  f.push([P(XT,HCS,ZCS+0.8),P(XC,HCS,ZCS+0.8),P(XC,HJ,ZNF),P(XT,HJ,ZNF)]);
  for(const s of [-1,1]){ const r=AMB_ROOF(s); r.forEach(t=>f.push(t)); }
  addMesh(polyGeo(f),roofMat); }

// Kapellen und Vorhallen nach LoD2: Lage, Außenflucht, Traufe, First
function chapel(c){
  const s=c.s, zi=c.zi, zo=c.zo, Lx=c.x1-c.x0, Lz=zo-zi;
  const rz=c.rzo||zo;   // rzo: Dachtraufe weiter innen als die Außenwand (Südervorhalle: gemeinsames Dach mit der Bürgermeisterkapelle, Fassade steht vor)
  const prof=c.roof==='lean'?[[zi,c.ridge],[rz+0.6,c.h]]:c.roof==='gableX'?[[zi,c.hin],[c.zr,c.ridge],[rz+0.6,c.h]]:null;
  const yAt=z=>{ if(!prof) return c.h; for(let i=0;i<prof.length-1;i++){ const a=prof[i], b=prof[i+1]; if(z<=b[0]) return a[1]+(z-a[0])/(b[0]-a[0])*(b[1]-a[1]); } return prof[prof.length-1][1]; };
  let top=null;
  if(c.roof==='gableZ'){ top=[[Lx+0.5,c.h]]; for(let g=c.gables.length-1;g>=0;g--){ const [a,b]=c.gables[g]; top.push([b-c.x0,c.h],[(a+b)/2-c.x0,c.ridge],[a-c.x0,c.h]); } top.push([-0.5,c.h]); }
  wall([c.x0,s*zo],[c.x1,s*zo],{h:c.h,t:1.0,ext:0.5,openings:c.outer||[],top,doorLeaf:true});
  const endTop=prof?[[Lz+0.5,yAt(zo+0.5)]].concat(prof.slice(1,-1).reverse().map(p=>[p[0]-zi,p[1]])).concat([[-0.6,yAt(zi)]]):null;
  if(!c.noWest) wall([c.x0,s*zi],[c.x0,s*zo],{h:c.h,t:1.0,ext:0.5,openings:c.west||[],top:endTop});
  wall([c.x1,s*zi],[c.x1,s*zo],{h:c.h,t:1.0,ext:0.5,openings:c.east||[],top:endTop});
  box(c.x0+0.4,c.x1-0.4,c.ceil,c.ceil+0.25,s*(zi+0.6),s*(zo-0.4));
  const f=[], g=[];
  if(prof){ for(let i=0;i<prof.length-1;i++){ const a=prof[i], b=prof[i+1];
      f.push([P(c.x0-0.6,a[1],s*a[0]),P(c.x1+0.6,a[1],s*a[0]),P(c.x1+0.6,b[1],s*b[0]),P(c.x0-0.6,b[1],s*b[0])]); }
    if(prof[0][1]>HAN) box(c.x0,c.x1,HAN-0.2,prof[0][1],s*(zi-0.6),s*(zi+0.6)); }
  else for(const [a,b] of c.gables){ const m=(a+b)/2;
    f.push([P(a-0.3,c.h,s*zi),P(a-0.3,c.h,s*(zo+0.6)),P(m,c.ridge,s*(zo+0.6)),P(m,c.ridge,s*zi)]);
    f.push([P(b+0.3,c.h,s*zi),P(b+0.3,c.h,s*(zo+0.6)),P(m,c.ridge,s*(zo+0.6)),P(m,c.ridge,s*zi)]);
    g.push([P(a,c.h,s*zi),P(m,c.ridge,s*zi),P(b,c.h,s*zi)]); }
  addMesh(polyGeo(f),roofMat); if(g.length) addMesh(polyGeo(g),wallMat);
  if(c.rzo) box(c.x0-0.5,c.x1+0.5,c.h-0.05,c.h+0.12,s*(c.rzo+0.4),s*(zo+0.62),roofMat);   // Abdeckung der vorstehenden Fassade
}
CHAPELS[0].outer=[D(2.92,1.0,3.0),W(2.92,1.0,2.99,3.0,2,true),W(1.62,0.72,6.2,10.4-SQ3*0.72,2),W(4.22,0.72,6.2,10.4-SQ3*0.72,2),W(8.15,0.74,3.6,11.4-SQ3*0.74,2),W(10.3,0.74,3.6,11.4-SQ3*0.74,2),W(12.45,0.74,3.6,11.4-SQ3*0.74,2)];   // Fotos 2026: westliches Joch mit Steinportal und zwei gekuppelten Fenstern darüber, östliches Joch mit drei hohen zweibahnigen Fenstern   // Fenster beiderseits des durchgehenden Strebepfeilers CHAPELS[0].east=[W(2.82,1.15,3.2,8.8,2)];
CHAPELS[1].gables=[[XT,PX[7]],[PX[7],15.0]]; CHAPELS[1].outer=[D(3.5,1.25,2.96),W(3.5,1.25,2.95,2.96,4,true),W(3.5,1.3,5.9,16.0-SQ3*1.3,6),W(10.3,1.3,5.9,16.0-SQ3*1.3,1)];   // Fotos innen (2026): Nordportal mit Oberlicht (Lüpertz) im westlichen Joch, darüber das linke Totentanzfenster; beide Fenster ab 5,9 m, Scheitel 16 m
CHAPELS[1].west=[W(5.8,1.25,9.0,13.5)]; CHAPELS[1].east=[D(4.25,2.5,10.5)];
CHAPELS[2].outer=[W(3.5,1.6,5,11.5),W(10.3,1.6,5,11.5)]; CHAPELS[2].east=[W(4.3,1.3,5,11.5)];
CHAPELS[3].west=[D(1.85,1.6,12.0)]; CHAPELS[3].outer=[D(3.5,1.25,3.4),W(3.5,1.25,3.39,3.4,-1,true),W(3.5,1.75,8.3,14.2-SQ3*1.75),W(10.9,1.45,9.4,14.0-SQ3*1.45)];   // Foto 2026: Südportal im westlichen Teil (Südervorhalle) mit großem Fenster darüber, östlich das Fenster der Tesdorpf-Kapelle
CHAPELS[4].west=[D(5.5,2.2,9.5)]; CHAPELS[4].outer=[W(3.2,1.4,4,11.0),W(9.4,1.4,4,11.0)]; CHAPELS[4].east=[W(5.5,1.2,4,11)];
CHAPELS.forEach(chapel);
// Fassadendetails nach Fotos (2026): Granitsockel, Gesimse, Bogenfriese, Steinportal der Briefkapelle, Vierpassfries und Portalbogen an der Südervorhalle
{ const outerZ=c=>c.s*(c.zo+0.5), P3=(c,u,y,o)=>new V3(c.x0+u,y,outerZ(c)+c.s*(o||0));
  const granite=new THREE.MeshStandardMaterial({color:lin(0x6d6e69),roughness:0.9}); granite.clippingPlanes=[cutPlane];
  const sg=[], lg=[];
  const along=(c,u0,u1,y0,y1,d,arr)=>{ const g=boxGeo(u1-u0,y1-y0,d); g.translate(c.x0+(u0+u1)/2,(y0+y1)/2,outerZ(c)+c.s*d/2); arr.push(g); };
  for(const c of CHAPELS){ const L=c.x1-c.x0, doors=(c.outer||[]).filter(o=>o.kind==='door').map(o=>[o.u-o.hw-0.15,o.u+o.hw+0.15]).sort((a,b)=>a[0]-b[0]);
    let u=-0.5; for(const [d0,d1] of doors.concat([[L+0.5,L+0.5]])){ if(d0>u+0.05) along(c,u,d0,0,0.9,0.14,sg); u=d1; } }
  const BK=CHAPELS[0], SV=CHAPELS[3];
  along(BK,7.4,14.4,3.35,3.55,0.18,lg);   // Sohlbankgesims unter den drei hohen Fenstern
  along(BK,-0.4,5.85,5.62,5.8,0.2,lg);    // Abschluss über dem Steinportal
  addMesh(mergeGeos(sg),granite,false); addMesh(mergeGeos(lg),stoneLedgeMat,false);
  // helles Steinportal der Briefkapelle: Quaderfläche mit Spitzbogenöffnung
  { const stone=new THREE.MeshStandardMaterial({color:lin(0xb3aca2),roughness:0.85,side:THREE.DoubleSide}); stone.clippingPlanes=[cutPlane];
    const u=2.92, sh=new THREE.Shape(); sh.moveTo(u-1.9,0); sh.lineTo(u-1.9,5.62); sh.lineTo(u+1.9,5.62); sh.lineTo(u+1.9,0);
    const hole=lancet(u,1.0,0,3.0,10); sh.lineTo(hole[hole.length-1][0],0); for(let i=hole.length-1;i>=0;i--) sh.lineTo(hole[i][0],hole[i][1]); sh.lineTo(u-1.9,0);
    const g=new THREE.ShapeGeometry(sh); g.translate(BK.x0,0,outerZ(BK)+0.04); const m=new THREE.Mesh(g,stone); m.receiveShadow=true; building.add(m);
    const ring=new THREE.Shape(), o=lancet(u,1.55,0,3.0,12), i2=lancet(u,1.08,0,3.0,12); ring.moveTo(o[0][0],o[0][1]); o.slice(1).forEach(q=>ring.lineTo(q[0],q[1])); for(let i=i2.length-1;i>=0;i--) ring.lineTo(i2[i][0],i2[i][1]);
    const rg=new THREE.ShapeGeometry(ring); rg.translate(BK.x0,0,outerZ(BK)+0.07); const rm=new THREE.Mesh(rg,new THREE.MeshStandardMaterial({color:lin(0x8f897f),roughness:0.85})); rm.material.clippingPlanes=[cutPlane]; building.add(rm); }
  // Bogenfries unter der Traufe (Briefkapelle, Südervorhalle): Rundbögen im Backstein mit Schatten
  const arcTex=canvasTex(128,64,(g,w,h)=>{ g.clearRect(0,0,w,h); g.strokeStyle='rgba(30,16,12,.75)'; g.lineWidth=7; g.beginPath(); g.moveTo(14,64); g.lineTo(14,30); g.arc(64,30,50,Math.PI,0); g.lineTo(114,64); g.stroke();
    g.fillStyle='rgba(30,16,12,.35)'; g.beginPath(); g.moveTo(18,64); g.lineTo(18,32); g.arc(64,32,46,Math.PI,0); g.lineTo(110,64); g.fill(); },[1,1]);
  const arcMat=new THREE.MeshStandardMaterial({map:arcTex,transparent:true,depthWrite:false,roughness:0.9}); arcMat.clippingPlanes=[cutPlane];
  const ag=[]; const arcRow=(c,u0,u1,y)=>{ const L=u1-u0, n=Math.max(1,Math.round(L/0.62)); const g=new THREE.PlaneGeometry(L,0.31); const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setX(i,uv.getX(i)*n);
    if(c.s<0) g.rotateY(Math.PI); g.translate(c.x0+(u0+u1)/2,y,outerZ(c)+c.s*0.03); ag.push(g); };
  arcRow(BK,-0.3,5.85,BK.h-0.9); arcRow(BK,7.45,14.3,BK.h-0.9); arcRow(SV,0.3,6.9,SV.h-0.9);
  // Südervorhalle: Vierpassfries über dem Portal, zwei Rundfenster-Blenden, tiefer Portalbogen
  const qTex=canvasTex(128,128,(g,w,h)=>{ g.clearRect(0,0,w,h); g.strokeStyle='rgba(30,16,12,.8)'; g.lineWidth=7; g.beginPath(); g.arc(64,64,52,0,7); g.stroke();
    g.lineWidth=5; g.beginPath(); for(const [dx,dy] of [[0,-20],[20,0],[0,20],[-20,0]]){ g.moveTo(64+dx+20,64+dy); g.arc(64+dx,64+dy,20,0,7); } g.stroke(); },[1,1]);
  const qMat=new THREE.MeshStandardMaterial({map:qTex,transparent:true,depthWrite:false,roughness:0.9}); qMat.clippingPlanes=[cutPlane];
  const qg=[]; { const g=new THREE.PlaneGeometry(6.0,0.6); const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setX(i,uv.getX(i)*10); g.translate(SV.x0+3.5,7.55,outerZ(SV)+0.03); qg.push(g);
    for(const du of [-2.45,2.45]){ const r=new THREE.PlaneGeometry(0.75,0.75); r.translate(SV.x0+3.5+du,6.55,outerZ(SV)+0.03); qg.push(r); } }
  for(const y of [7.15,7.95]){ const g=boxGeo(6.4,0.15,0.16); g.translate(SV.x0+3.5,y,outerZ(SV)+0.08); addMesh(g,stoneLedgeMat,false); }
  { const ring=new THREE.Shape(), o=lancet(3.5,2.05,0,3.4,12), i2=lancet(3.5,1.3,0,3.4,12); ring.moveTo(o[0][0],o[0][1]); o.slice(1).forEach(q=>ring.lineTo(q[0],q[1])); for(let i=i2.length-1;i>=0;i--) ring.lineTo(i2[i][0],i2[i][1]);
    const rg=new THREE.ShapeGeometry(ring); rg.translate(SV.x0,0,outerZ(SV)+0.05); const rm=new THREE.Mesh(rg,revealMat); building.add(rm); }
  building.add(new THREE.Mesh(mergeGeos(ag),arcMat)); building.add(new THREE.Mesh(mergeGeos(qg),qMat)); }
// Briefkapelle: zwei schlanke Granitsäulen in der Mittelachse (Grundriss 1906), Stern-/Palmengewölbe mit Rippen, die von den Säulen ausstrahlen
// Fotos 2026: Säulen und Wanddienste ockergelb gefasst, schlank bis hoch unter das Gewölbe; Rippen rot und blau
{ const c=CHAPELS[0], xa=c.x0+0.6, xb=c.x1-0.5, za=c.zi+0.6, zb=c.zo-0.5, zc=(za+zb)/2, cols=[-31.8,-27.9], HC=9.6, HW=11.4, HK=12.2, RC=2.6, RW=1.2;
  const ochre=enhance(new THREE.MeshStandardMaterial({color:lin(0xc69a3e),roughness:0.6,metalness:0.1}),{}), capM=enhance(new THREE.MeshStandardMaterial({color:lin(0xa8782a),roughness:0.5,metalness:0.3}),{});
  for(const x of cols){ const g=new THREE.CylinderGeometry(0.19,0.22,HC,14); g.translate(x,HC/2,zc); addMesh(g,ochre);
    const cap=new THREE.CylinderGeometry(0.42,0.2,0.5,8); cap.translate(x,HC+0.1,zc); addMesh(cap,capM); }
  { const sh=[], cp=[], HS=HW-1.3;   // Wanddienste an den Fensterpfeilern und in den Ecken
    const add=(x,z)=>{ const g=new THREE.CylinderGeometry(0.13,0.13,HS,10); g.translate(x,HS/2,z); sh.push(g); const k=new THREE.CylinderGeometry(0.28,0.13,0.4,8); k.translate(x,HS+0.15,z); cp.push(k); };
    for(const x of [xa+0.15,-33.88,-30.15,-27.57,-25.42,xb-0.15]){ add(x,za+0.12); add(x,zb-0.12); }
    for(const z of [zc]){ add(xa+0.12,z); add(xb-0.12,z); }
    addMesh(mergeGeos(sh),ochre); addMesh(mergeGeos(cp),capM,false); }
  const fr=t=>{ t=Math.min(1,Math.max(0,t)); return Math.sqrt(1-(1-t)*(1-t)); };
  const hy=(x,z)=>{ const dc=Math.min(...cols.map(cx=>Math.hypot(x-cx,z-zc))), dw=Math.min(x-xa,xb-x,z-za,zb-z); return Math.min(HC+0.35+(HK-HC-0.35)*fr(dc/RC),HW+(HK-HW)*fr(dw/RW)); };
  const NX=56, NZ=36, pos=[], uv=[], idx=[];
  for(let j=0;j<=NZ;j++) for(let i=0;i<=NX;i++){ const x=xa+(xb-xa)*i/NX, z=za+(zb-za)*j/NZ; pos.push(x,hy(x,z),z); uv.push(x/3,z/3); }
  for(let j=0;j<NZ;j++) for(let i=0;i<NX;i++){ const a=j*(NX+1)+i; idx.push(a,a+NX+1,a+1,a+1,a+NX+1,a+NX+2); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  const vm=addMesh(g,vaultMat); occluders.splice(occluders.indexOf(vm),1);
  const rg=[], rgB=[], xm=(cols[0]+cols[1])/2;
  for(const cx of cols) for(let k=0;k<16;k++){ const a=k*Math.PI/8, dx=Math.cos(a), dz=Math.sin(a), pts=[];
    for(let s=0.3;s<12;s+=0.3){ const x=cx+dx*s, z=zc+dz*s; if(x<xa+0.05||x>xb-0.05||z<za+0.05||z>zb-0.05) break; if((cx<xm)!==(x<xm)) break; pts.push(P(x,hy(x,z)-0.07,z)); }
    if(pts.length>2) (k%2?rgB:rg).push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),pts.length*2,0.07,5,false)); }
  addMesh(mergeGeos(rg),ribMat,false); addMesh(mergeGeos(rgB),enhance(new THREE.MeshStandardMaterial({color:lin(0x4a6a96),roughness:0.8}),{}),false); }   // Rippen abwechselnd rot und blau (Foto)
/* ---------------- Astronomische Uhr (Paul Behrens, 1955–1976) an der Ostwand der Totentanzkapelle ---------------- */
// Gehäuse: entzerrtes Frontalfoto (13,45 m hoch, Zifferblatt und Kalenderscheibe je 3 m Durchmesser).
// Zifferblatt und Kalenderscheibe werden live gezeichnet, Rechnung und Bilder nach der App „astro-uhr-app“ (ClockRenderer, AstroCalc, config).
const CK=await DATA.clock;
const CLK={x:13.6, back:14.5, z:-21.7, w:6.2, h0:0.8, h1:13.45, dialY:6.19, calY:2.31, R:1.5};
const clk={em:[], img:{}, ctx:null, tex:null, cal:null, st:null, lastUtc:null, lastDraw:0, pending:false};
async function ckImg(src){ const im=new Image(); im.src=src; try{ await im.decode(); return im; }catch(e){ return null; } }
if(CK&&CK.img){ const ks=Object.keys(CK.img), ims=await Promise.all(ks.map(k=>ckImg(CK.img[k]))); ks.forEach((k,i)=>{ if(ims[i]) clk.img[k]=ims[i]; }); }
function ckTex(img,srgb){ const t=new THREE.Texture(img); if(srgb!==false) t.encoding=THREE.sRGBEncoding; t.anisotropy=maxAniso; t.needsUpdate=true; return t; }
{ const I=clk.img, x0=CLK.x, zc=CLK.z, toWall=g=>{ g.rotateY(-Math.PI/2); return g; };
  // Holzkörper (wirft die Schatten), Sockel mit Gesims und zwei Füßen
  const wood=enhance(new THREE.MeshStandardMaterial({color:0x6e4529,roughness:0.6}),{});
  box(x0,CLK.back,CLK.h0,9.25,zc-2.55,zc+2.55,wood);
  box(x0+0.35,CLK.back,9.25,12.3,zc-0.95,zc+0.95,wood);
  box(x0-0.15,CLK.back,0.3,CLK.h0,zc-2.8,zc+2.8,wood);
  for(const s of [-1,1]) box(x0,CLK.back,0,0.3,zc+s*1.9,zc+s*2.45,wood);
  // Front: Foto mit Freistellmaske (Figurenaufsatz vor der Wand)
  const caseMat=enhance(new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.62,metalness:0,alphaTest:0.5,side:THREE.DoubleSide}),{});
  if(I.gehaeuse){ const t=ckTex(I.gehaeuse); caseMat.map=t; caseMat.emissiveMap=t; caseMat.emissive=new THREE.Color(0.16,0.15,0.14); clk.em.push([caseMat,0.155]); }
  if(I.maske){ caseMat.alphaMap=ckTex(I.maske,false); }
  const hh=CLK.h1-CLK.h0, cg=toWall(new THREE.PlaneGeometry(CLK.w,hh)); cg.translate(x0-0.02,CLK.h0+hh/2,zc); addMesh(cg,caseMat,false,true);
  // Zifferblatt: Canvas, bei jeder Zeitänderung neu gezeichnet
  const cv=document.createElement('canvas'); cv.width=cv.height=1024; clk.ctx=cv.getContext('2d'); clk.canvas=cv;
  clk.tex=new THREE.CanvasTexture(cv); clk.tex.encoding=THREE.sRGBEncoding; clk.tex.anisotropy=maxAniso;
  const dialMat=enhance(new THREE.MeshStandardMaterial({map:clk.tex,emissiveMap:clk.tex,emissive:new THREE.Color(0.2,0.2,0.2),roughness:0.4,metalness:0.1,alphaTest:0.5,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),{});
  clk.em.push([dialMat,0.2]);
  const dg=toWall(new THREE.CircleGeometry(CLK.R,128)); dg.translate(x0-0.05,CLK.dialY,zc); addMesh(dg,dialMat,false,true);
  // Kalenderscheibe: dreht sich einmal im Jahr, der feste Zeiger links weist auf den Tag
  const calMat=enhance(new THREE.MeshStandardMaterial({color:I.kalender?0xffffff:0x1e3a5f,roughness:0.55,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),{});
  if(I.kalender){ const t=ckTex(I.kalender); calMat.map=t; calMat.emissiveMap=t; calMat.emissive=new THREE.Color(0.16,0.16,0.16); clk.em.push([calMat,0.16]); }
  const cgrp=new THREE.Group(); cgrp.position.set(x0-0.05,CLK.calY,zc); cgrp.rotation.y=-Math.PI/2; building.add(cgrp);
  clk.cal=new THREE.Mesh(new THREE.CircleGeometry(CLK.R,160),calMat); clk.cal.receiveShadow=true; cgrp.add(clk.cal);
  const pc=document.createElement('canvas'); pc.width=512; pc.height=128; { const g=pc.getContext('2d'), gr=g.createLinearGradient(0,52,0,76);
    gr.addColorStop(0,'#fff1b8'); gr.addColorStop(0.5,'#d9a531'); gr.addColorStop(1,'#7d5a14');
    g.fillStyle=gr; g.fillRect(0,56,400,16); g.beginPath(); for(let k=0;k<16;k++){ const a=k*Math.PI/8, r=k%2?18:58; g.lineTo(424+Math.cos(a)*r,64+Math.sin(a)*r); } g.closePath(); g.fill();
    g.strokeStyle='rgba(80,55,10,.8)'; g.lineWidth=2; g.stroke(); }
  const pMat=enhance(new THREE.MeshStandardMaterial({map:ckTex(pc),alphaTest:0.4,roughness:0.35,metalness:0.5,emissive:new THREE.Color(0.12,0.09,0.02),side:THREE.DoubleSide}),{});
  const pg=toWall(new THREE.PlaneGeometry(0.8,0.2)); pg.translate(x0-0.08,CLK.calY,zc-1.217-(424/512-0.5)*0.8); addMesh(pg,pMat,false,false);
  // Gitter vor der Uhr (schwarzes Eisen)
  const iron=darkMat, rx=x0-1.6, za=zc-3.2, zb=zc+3.2;
  for(const y of [0.12,0.98]){ box(rx-0.025,rx+0.025,y-0.02,y+0.02,za,zb,iron); for(const z of [za,zb]) box(rx,x0-0.1,y-0.02,y+0.02,z-0.025,z+0.025,iron); }
  for(let k=0;k<=5;k++){ const z=za+(zb-za)*k/5; box(rx-0.025,rx+0.025,0,1.0,z-0.025,z+0.025,iron); }
}
// Rechnung der Uhr (Paul Behrens): Sonnenzeiger einmal in 24 h (gesetzliche Zeit), Mond 6705:6940, Sternscheibe 366¼:365¼
const CKR={MR:6705/6940, MC:19*365.25/235, REF:Date.UTC(2025,10,5,13,19)};
const CK_W=[36.7,27.9,20.1,35.7,44.1,23.0,6.7,18.6,33.4,27.9,24.2,37.2,24.7];
const CK_N=['stier','zwilling','krebs','loewe','jungfrau','waage','skorpion','schlangentraeger','schuetze','steinbock','wassermann','fische','widder'];
const CK_TW=[-1,-3,-4.3,-6.1,0,4,-12,-3,-2.5,2,0,-2.7,-1.5];
const CK_SC=[10,7,6,8,7.5,8,0.01,6,6,6,9,10,6], CK_RO=[-0.085,0.035,0.032,-0.085,0.035,-0.05,0,-0.07,0.03,-0.015,-0.05,-0.08,0.03];
const CK_ANG=CK_W.map((w,k)=>{ let s=0; for(let j=0;j<k;j++) s+=(j===0?CK_W[0]/2:CK_W[j]); return (-90-(k?s+w/2:0)+CK_TW[k])*rad; });
const CK_DE={stier:'Stier',zwilling:'Zwillinge',krebs:'Krebs',loewe:'Löwe',jungfrau:'Jungfrau',waage:'Waage',skorpion:'Skorpion',schlangentraeger:'Schlangenträger',schuetze:'Schütze',steinbock:'Steinbock',wassermann:'Wassermann',fische:'Fische',widder:'Widder'};
const CK_EN={stier:'Taurus',zwilling:'Gemini',krebs:'Cancer',loewe:'Leo',jungfrau:'Virgo',waage:'Libra',skorpion:'Scorpius',schlangentraeger:'Ophiuchus',schuetze:'Sagittarius',steinbock:'Capricornus',wassermann:'Aquarius',fische:'Pisces',widder:'Aries'};
// Grenzen der Sternbilder auf der Ekliptik (IAU, J2000), Beginn in Grad Länge
const CK_IAU=[['widder',29.09],['stier',53.47],['zwilling',90.43],['krebs',118.26],['loewe',138.18],['jungfrau',174.15],['waage',218.02],['skorpion',241.13],['schlangentraeger',247.70],['schuetze',266.28],['steinbock',299.68],['wassermann',327.87],['fische',351.57]];
// Kalenderscheibe: 366 Tageszeilen (der 29. Februar steht immer darauf). Ungedreht steht der 3. Juni (Zeile 154) am Zeiger.
// Die Zeilen des Fotos sind nicht ganz gleichmäßig verteilt; Korrektur in Tagen, an den Monatsersten abgelesen.
const CK_CAL=[[0,-3],[31,-2],[60,-1],[91,0],[121,0],[152,0],[182,0],[213,-1],[244,-2],[302,-3],[334,-3],[366,-3]];
function ckCalAngle(ix){ let k=0; while(k<CK_CAL.length-2&&ix>CK_CAL[k+1][0]) k++; const a=CK_CAL[k], b=CK_CAL[k+1], d=a[1]+(b[1]-a[1])*(ix-a[0])/(b[0]-a[0]); return (ix-154-d)*2*Math.PI/366; }
const ckLeap=y=>(y%4===0&&y%100!==0)||y%400===0;
function ckDoy(y,m,d){ return Math.round((Date.UTC(y,m,d)-Date.UTC(y,0,1))/864e5)+1; }
function ckState(utc){
  const off=berlinOffsetMin(utc), l=new Date(utc+off*60000), y=l.getUTCFullYear(), mo=l.getUTCMonth(), d=l.getUTCDate(), TP=2*Math.PI;
  const hrs=l.getUTCHours()+l.getUTCMinutes()/60+l.getUTCSeconds()/3600, aSun=hrs/24*TP-1.5*Math.PI;
  const days=(utc-CKR.REF)/864e5; let age=(CKR.MC/2+days)%CKR.MC; if(age<0) age+=CKR.MC;
  const md=(((Math.PI+days*TP*(CKR.MR-1))%TP)+TP)%TP;
  const N=ckLeap(y)?366:365, doy=ckDoy(y,mo,d);
  return {utc,off,y,mo,d,hrs,aSun,aMoon:aSun+md,md,age,aZod:(doy-ckDoy(y,5,2))/N*TP+aSun+Math.PI/2,aCal:ckCalAngle(doy-1+((N===365&&mo>=2)?1:0)),doy,N};
}
function ckDraw(st){
  const g=clk.ctx, S=1024, L=S/0.888, c=S/2, rL=L*0.37, rO=rL*1.12, rS=L*0.32, rM=(rL+rS)/2, I=clk.img, TP=2*Math.PI;
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,S,S); g.save(); g.translate(c,c);
  g.beginPath(); g.arc(0,0,rO,0,TP); g.arc(0,0,rL*1.005,0,TP,true); g.fillStyle='#6d87a5'; g.fill();
  g.strokeStyle='gold'; g.lineWidth=2; for(const r of [rO,rL*1.005]){ g.beginPath(); g.arc(0,0,r,0,TP); g.stroke(); }
  if(I.ziffer){ const s=rL*2.4; g.drawImage(I.ziffer,-s/2,-s/2,s,s); }
  g.save(); g.rotate(st.aZod);
  if(I.stern) g.drawImage(I.stern,-rL,-rL,2*rL,2*rL); else { g.beginPath(); g.arc(0,0,rL,0,TP); g.fillStyle='#1d3d78'; g.fill(); }
  const fs=L*0.02, rb=rS*0.8;
  CK_N.forEach((n,k)=>{ const im=I['z_'+n]; if(!im||CK_SC[k]<0.1) return; const rp=rb+rS*CK_RO[k], s=fs*CK_SC[k];
    g.save(); g.translate(Math.cos(CK_ANG[k])*rp,Math.sin(CK_ANG[k])*rp); g.rotate(-st.aZod); g.drawImage(im,-s/2,-s/2,s,s); g.restore(); });
  g.restore();
  // Zeiger kräftiger als in der App gezeichnet, damit sie im Raum aus einigen Metern Abstand erkennbar bleiben
  const ptr=(a,len,w)=>{ g.save(); g.rotate(a); const gr=g.createLinearGradient(0,-w,0,w); gr.addColorStop(0,'#fff0b0'); gr.addColorStop(0.5,'#d6a23a'); gr.addColorStop(1,'#7a5512');
    g.beginPath(); g.moveTo(-len*0.1,-w); g.lineTo(len,-w*0.35); g.lineTo(len,w*0.35); g.lineTo(-len*0.1,w); g.closePath(); g.fillStyle=gr; g.fill(); g.strokeStyle='rgba(60,40,8,.75)'; g.lineWidth=1.3; g.stroke(); g.restore(); };
  ptr(st.aSun,rL*0.96,L*0.009);
  { const s=L*0.1, r=rL*1.13-s/2; g.save(); g.rotate(st.aSun); if(I.sonne) g.drawImage(I.sonne,r-s/2,-s/2,s,s); else { g.beginPath(); g.arc(r,0,s/2,0,TP); g.fillStyle='gold'; g.fill(); } g.restore(); }
  { const r=L*0.022, ph=st.age/CKR.MC, wax=ph<0.5, x=Math.cos(st.aMoon)*rM, y=Math.sin(st.aMoon)*rM, hx=-r*0.35, hy=-r*0.35;
    const gold=g.createRadialGradient(hx,hy,r*0.05,0,0,r*1.05); gold.addColorStop(0,'#FFF3C4'); gold.addColorStop(0.35,'#FFD866'); gold.addColorStop(0.7,'#D4A017'); gold.addColorStop(1,'#8A6A14');
    const dark=g.createRadialGradient(hx*0.5,hy*0.5,r*0.05,0,0,r*1.05); dark.addColorStop(0,'#3A3D44'); dark.addColorStop(0.6,'#22242A'); dark.addColorStop(1,'#131418');
    const lf=wax?dark:gold, rf=wax?gold:dark, ef=wax?(ph<0.25?dark:gold):(ph<0.75?gold:dark);
    g.save(); g.translate(x,y); g.rotate(st.aMoon+Math.PI/2);
    g.beginPath(); g.arc(0,0,r,Math.PI/2,Math.PI*1.5); g.fillStyle=lf; g.fill();
    g.beginPath(); g.arc(0,0,r,Math.PI*1.5,Math.PI/2); g.fillStyle=rf; g.fill();
    g.beginPath(); g.ellipse(0,0,r*Math.abs(Math.cos(ph*TP)),r,0,0,TP); g.fillStyle=ef; g.fill();
    g.beginPath(); g.arc(0,0,r,0,TP); g.strokeStyle='rgba(255,216,102,0.55)'; g.lineWidth=1.5; g.stroke(); g.restore(); }
  ptr(st.aMoon,rM*0.95,L*0.0075);
  if(I.heiland){ const s=L*0.29; g.drawImage(I.heiland,-s/2,-s/2,s,s); }
  g.restore();
}
function clockUpdate(utc,force){
  if(!clk.ctx) return;
  if(utc===undefined||utc===null) utc=clk.lastReq; else clk.lastReq=utc;
  if(utc===undefined) return;
  const st=ckState(utc); clk.st=st; if(clk.cal) clk.cal.rotation.z=-st.aCal;
  { const k=0.22+0.78*smooth(-8,4,cur.el); for(const [m,b] of clk.em) m.emissive.setScalar(b*k); }   // Eigenhelligkeit (Strahler) tagsüber, nachts gedämpft
  const now=performance.now(), stale=force||clk.lastUtc===null||Math.abs(utc-clk.lastUtc)>=20000;
  if(!stale) clk.pending=false;
  else if(!force&&now-clk.lastDraw<70) clk.pending=true;
  else { ckDraw(st); clk.tex.needsUpdate=true; clk.lastDraw=now; clk.lastUtc=utc; clk.pending=false; dirty=true; }
  if(typeof updateClockCard==='function') updateClockCard();
}
// Marientidenkapelle (Vorjoch und Rechteckjoch mit polygonalem Schluss, Ostende bei x = 51,1)
// Wappenfenster nach Foto (Glasart 5); das westliche Vorjoch hat geschlossene, dicke Wände (Grundriss)
for(let k=0;k<MT.length-1;k++){ const a=MT[k], b=MT[k+1], Lw=Math.hypot(b[0]-a[0],b[1]-a[1]); wall(a,b,{h:21.9,t:k===0||k===6?1.6:1.0,ext:0.3,openings:(k===0||k===6)?[]:[W(Lw/2,Math.min(1.15,(Lw-1.4)/2),4.5,14.2,5)]}); }
{ const cxm=MT.reduce((s,p)=>s+p[0],0)/MT.length, czm=MT.reduce((s,p)=>s+p[1],0)/MT.length;
  const out=offPoly(MT,0.7,null,null,true), fc=[], fr=[], ap=P(46.3,MT_APEX,-0.1), e0=P(choirOff(0.7)[1][0]-0.3,HJ-0.3,-0.1), cc=P(cxm,18.2,czm);
  for(let k=0;k<MT.length;k++){ const a=MT[k], b=MT[(k+1)%MT.length]; fc.push([P(a[0],18.2,a[1]),P(b[0],18.2,b[1]),cc]); }
  const q=(p,y)=>P(p[0],y,p[1]);
  for(let k=2;k<5;k++) fr.push([q(out[k],21.9),q(out[k+1],21.9),ap]);   // Polygonschluss: Walm
  for(const [i0,i2] of [[0,2],[7,5]]){ const w=[MT[i0][0],out[i0][1]]; fr.push([q(w,21.9),q(out[i2],21.9),ap]); fr.push([q(w,21.9),ap,e0]); }   // Langseiten, First bis zur Chorwand
  addMesh(polyGeo(fc),wallMat); addMesh(polyGeo(fr),roofMat); }

// Doppelturmfassade nach Fotos der Westseite (vermessen) und Luftbildern:
// Turmschaft bis 60 m, vier Giebel je Turm bis 72,7 m (LoD2-Wandoberkante ≈ Giebelspitze, bDOM vorn 73,5 m),
// achtseitiger Rhombenhelm von den Ecken (60 m) und Giebelspitzen bis 124,75 / 124,95 m.
// Geschossgliederung nach Foto (Maßstab aus der Turmbreite): Friese 58,6 / 50,1 / 40,6 / 30,9 m,
// gekuppelte Spitzbogenfenster 52,2–57,0 / 43,2–48,3 / 34,5–39,3 m.
const T_EAVE=60, T_GTIP=[73.19,73.08], T_HELM=[46.56,46.47];   // Nordturm, Südturm: Giebelspitze, Helm bis Knauf (Vermessung, Unterlage „Maße Türme“)
// darüber Knauf 0,90 m, Helmstange 3,30 m, Hahn 1,00 m → Gesamthöhe Nordturm 124,95 m, Südturm 124,75 m (der Nordhahn kräht höher)
const T_FRIEZE=[58.6,50.1,40.6,30.9], T_LEVELS=[[52.2,57.0],[43.2,48.3],[34.5,39.3]];
function brickCanvas(g,w,h,r,bw,bh,dark){ g.fillStyle='#968a80'; g.fillRect(0,0,w,h);
  for(let row=0;row<h/bh;row++){ const off=(row%2)*bw/2; for(let i=-1;i<=w/bw;i++){ const c=brickCol(r,dark||0.08);
    g.fillStyle='rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')'; g.fillRect(i*bw+off+1,row*bh+1,bw-2,bh-2); } } }
// Turmwände: Backstein mit dunklem Rautenmuster aus glasierten Köpfen (Foto)
const diaperTex=canvasTex(512,512,(g,w,h)=>{ const r=rng(41); brickCanvas(g,w,h,r,22,10.7,0.03);
  g.strokeStyle='rgba(48,34,30,.85)'; g.lineWidth=5; g.lineCap='round';
  for(let y=48;y<h;y+=128) for(let x=(y/128%2)*64+32;x<w;x+=128){ g.beginPath(); g.moveTo(x-9,y-9); g.lineTo(x+9,y+9); g.moveTo(x+9,y-9); g.lineTo(x-9,y+9); g.stroke(); }
},[1/4.8,1/4.8]);
towerMatW.map=diaperTex; towerMatW.needsUpdate=true;   // Mittelbau ebenfalls mit Rautenmuster
const towerMat=enhance(new THREE.MeshStandardMaterial({map:diaperTex,roughness:0.92,side:THREE.DoubleSide}),{mask:true});
function gableCanvas(kind){ return (g,w,h)=>{ const r=rng(kind==='trio'?31:32); brickCanvas(g,w,h,r,40,13);
  const ring=(cx,cy,rr)=>{ g.fillStyle='rgba(118,50,34,.9)'; g.beginPath(); g.arc(cx,cy,rr,0,7); g.fill(); g.strokeStyle='#cfa98c'; g.lineWidth=6; g.stroke();
    g.strokeStyle='rgba(58,22,16,.9)'; g.lineWidth=3; for(let k=0;k<3;k++){ const a=k*2*Math.PI/3-Math.PI/2; g.beginPath(); g.arc(cx+Math.cos(a)*rr*0.36,cy+Math.sin(a)*rr*0.36,rr*0.4,0,7); g.stroke(); } };
  if(kind==='trio'){   // Süd-/Nordgiebel (Foto vom Petriturm): drei große Dreipässe und ein kleiner Kreis, im Backstein mit dunkel profiliertem Rand
    const cp=document.createElement('canvas'); cp.width=w; cp.height=h; cp.getContext('2d').drawImage(g.canvas,0,0);
    const tre=(cx,cy,R)=>{ const L=[]; for(let k=0;k<3;k++){ const a=-Math.PI/2+k*2*Math.PI/3; L.push([cx+Math.cos(a)*R*0.62,cy+Math.sin(a)*R*0.62]); } return L; };
    const shapes=[[tre(254,214,74),44],[tre(158,416,74),44],[tre(350,416,74),44],[[[255,336]],29]];
    for(const [cs,r] of shapes){ g.fillStyle='rgba(40,22,18,.85)'; g.beginPath(); for(const [x,y] of cs){ g.moveTo(x+r+7,y); g.arc(x,y,r+7,0,7); } g.fill();
      g.save(); g.beginPath(); for(const [x,y] of cs){ g.moveTo(x+r,y); g.arc(x,y,r,0,7); } g.clip(); g.drawImage(cp,0,0); g.restore();
      g.strokeStyle='rgba(196,140,110,.55)'; g.lineWidth=2; g.beginPath(); for(const [x,y] of cs){ g.moveTo(x+r-2,y); g.arc(x,y,r-2,0,7); } g.stroke(); } }
  else if(kind==='wheel'){   // Ostgiebel Nordturm (Foto vom Dach): Radfenster mit Speichen, darunter Zickzackfries
    const cx=256, cy=250, R=92; g.fillStyle='rgba(112,46,32,.92)'; g.beginPath(); g.arc(cx,cy,R,0,7); g.fill(); g.strokeStyle='#c99e84'; g.lineWidth=7; g.stroke();
    g.lineWidth=5; g.beginPath(); g.arc(cx,cy,R*0.3,0,7); g.stroke(); for(let k=0;k<12;k++){ const a=k*Math.PI/6; g.beginPath(); g.moveTo(cx+Math.cos(a)*R*0.3,cy+Math.sin(a)*R*0.3); g.lineTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R); g.stroke(); }
    g.strokeStyle='#c99e84'; g.lineWidth=5; g.beginPath(); for(let x=40;x<=472;x+=24){ g.lineTo(x,(x/24)%2<1?452:430); } g.stroke(); g.fillStyle='rgba(60,26,18,.85)'; g.fillRect(36,458,440,10); }
  else if(kind==='rose'){   // Nordgiebel Nordturm (Luftbild von Norden): große Rosette mit Achtpass
    const cx=256, cy=268, R=104; g.fillStyle='rgba(112,46,32,.92)'; g.beginPath(); g.arc(cx,cy,R,0,7); g.fill(); g.strokeStyle='#c99e84'; g.lineWidth=7; g.stroke();
    g.lineWidth=5; for(let k=0;k<8;k++){ const a=k*Math.PI/4; g.beginPath(); g.arc(cx+Math.cos(a)*R*0.52,cy+Math.sin(a)*R*0.52,R*0.36,0,7); g.stroke(); }
    g.beginPath(); g.arc(cx,cy,R*0.2,0,7); g.stroke(); }
  else if(kind==='diaper'){   // Ostgiebel Südturm (Drohnenfoto): Gitter aus schwarz glasierten Steinen, dazwischen Vierpässe aus hellem Backstein
    const st=40; g.fillStyle='rgba(28,24,24,.95)';
    for(let y=60;y<508;y+=st) g.fillRect(0,y-3,512,6); for(let x=16;x<512;x+=st) g.fillRect(x-3,50,6,460);
    for(let y=60+st/2;y<508;y+=st) for(let x=16+st/2;x<512;x+=st){ g.fillStyle='rgba(28,24,24,.95)'; g.beginPath(); g.moveTo(x,y-st/2); g.lineTo(x+st/2,y); g.lineTo(x,y+st/2); g.lineTo(x-st/2,y); g.closePath(); g.fill();
      g.fillStyle='#c4734f'; for(const [dx,dy] of [[0,-7],[7,0],[0,7],[-7,0]]){ g.beginPath(); g.arc(x+dx,y+dy,8.5,0,7); g.fill(); } } }
  else {   // Westgiebel (Foto von Westen): Kreis mit profiliertem dunklem Rand und Vierpass im Backstein, darunter eine kleine Lanzette
    { const cp=document.createElement('canvas'); cp.width=w; cp.height=h; cp.getContext('2d').drawImage(g.canvas,0,0);
      g.fillStyle='rgba(40,22,18,.85)'; g.beginPath(); g.arc(256,240,70,0,7); g.fill(); g.save(); g.beginPath(); g.arc(256,240,62,0,7); g.clip(); g.drawImage(cp,0,0); g.restore();
      g.strokeStyle='rgba(40,22,18,.8)'; g.lineWidth=5; g.beginPath(); for(const [dx,dy] of [[0,-24],[24,0],[0,24],[-24,0]]){ g.moveTo(256+dx+24,240+dy); g.arc(256+dx,240+dy,24,0,7); } g.stroke(); } g.fillStyle='rgba(70,30,22,.9)'; g.beginPath(); g.moveTo(222,512); g.lineTo(222,415); g.quadraticCurveTo(225,365,256,345); g.quadraticCurveTo(287,365,290,415); g.lineTo(290,512); g.fill();
    g.strokeStyle='#cfa98c'; g.lineWidth=5; g.stroke(); }
  g.strokeStyle='#c99e84'; g.lineWidth=9; g.beginPath(); g.moveTo(4,508); g.lineTo(256,6); g.lineTo(508,508); g.stroke(); }; }
const gableMatWE=new THREE.MeshStandardMaterial({map:canvasTex(512,512,gableCanvas('one'),null),roughness:0.9,side:THREE.DoubleSide}); gableMatWE.clippingPlanes=[cutPlane];
const gableMatNS=new THREE.MeshStandardMaterial({map:canvasTex(512,512,gableCanvas('trio'),null),roughness:0.9,side:THREE.DoubleSide}); gableMatNS.clippingPlanes=[cutPlane];
const gableMatWheel=new THREE.MeshStandardMaterial({map:canvasTex(512,512,gableCanvas('wheel'),null),roughness:0.9,side:THREE.DoubleSide}); gableMatWheel.clippingPlanes=[cutPlane];
const gableMatRose=new THREE.MeshStandardMaterial({map:canvasTex(512,512,gableCanvas('rose'),null),roughness:0.9,side:THREE.DoubleSide}); gableMatRose.clippingPlanes=[cutPlane];
const gableMatDiaper=new THREE.MeshStandardMaterial({map:canvasTex(512,512,gableCanvas('diaper'),null),roughness:0.9,side:THREE.DoubleSide}); gableMatDiaper.clippingPlanes=[cutPlane];
const discFriezeTex=canvasTex(128,128,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#efe9df'; g.beginPath(); g.arc(64,64,40,0,7); g.fill(); },[1,1]);   // unterstes Band: weiße Scheiben (Foto vom Petriturm)   // weiße Vierpässe unter den Giebeln (Drohnenfoto)
const discFriezeMat=new THREE.MeshStandardMaterial({map:discFriezeTex,roughness:0.85,alphaTest:0.5,transparent:false}); discFriezeMat.clippingPlanes=[cutPlane];
const friezeTex=canvasTex(128,128,(g,w,h)=>{   // weißes Fries: je Kachel ein Kreuz mit runden Armenden (Foto vom Petriturm)
  g.clearRect(0,0,w,h); g.fillStyle='#efe9df'; const c=64;
  g.fillRect(c-9,c-30,18,60); g.fillRect(c-30,c-9,60,18); for(const [dx,dy] of [[0,-30],[0,30],[-30,0],[30,0]]){ g.beginPath(); g.arc(c+dx,c+dy,15,0,7); g.fill(); }
},[1,1]);
const arcadeFriezeTex=canvasTex(256,64,(g,w,h)=>{   // weißer Bogenfries des Mittelbaus (Foto)
  g.fillStyle='#8e4630'; g.fillRect(0,0,w,h); g.fillStyle='#efe9df';
  for(let x=0;x<w;x+=64){ g.beginPath(); g.moveTo(x+6,58); g.lineTo(x+6,30); g.arc(x+32,30,26,Math.PI,0); g.lineTo(x+58,58); g.fill(); }
  g.fillStyle='#8e4630'; for(let x=0;x<w;x+=64){ g.beginPath(); g.moveTo(x+14,58); g.lineTo(x+14,34); g.arc(x+32,34,18,Math.PI,0); g.lineTo(x+50,58); g.fill(); }
},[1,1]);
const friezeMat=new THREE.MeshStandardMaterial({map:friezeTex,roughness:0.85,alphaTest:0.5,transparent:false}); friezeMat.clippingPlanes=[cutPlane];
const arcFriezeMat=new THREE.MeshStandardMaterial({map:arcadeFriezeTex,roughness:0.85}); arcFriezeMat.clippingPlanes=[cutPlane];
const whiteMat=new THREE.MeshStandardMaterial({color:0xefe9df,roughness:0.85,side:THREE.DoubleSide}); whiteMat.clippingPlanes=[cutPlane];
function triUV(a,b,c){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute([a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z],3)); g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0.5,1],2)); g.computeVertexNormals(); return g; }
// Fläche auf einer Wandseite: (cx,cz) Mitte der Wand, (nx,nz) Außennormale, u seitlich, Grundriss als Punktliste [u,y]
function facePoly(cx,cz,nx,nz,pts,off){ const s=new THREE.Shape(); s.moveTo(pts[0][0],pts[0][1]); pts.slice(1).forEach(p=>s.lineTo(p[0],p[1]));
  const g=new THREE.ShapeGeometry(s); const X=new V3(-nz,0,nx), Y=new V3(0,1,0), Z=new V3(nx,0,nz);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(X,Y,Z).setPosition(new V3(cx,0,cz).addScaledVector(Z,off||0.06))); return g; }
const lanc=(u,hw,bot,top)=>lancet(u,hw,bot,Math.max(bot+0.01,top-SQ3*hw),8);
// gekuppeltes Spitzbogenfenster: heller Rahmen, zwei dunkle Lanzetten, weißer Vierpass im Bogenfeld
function twinWindow(acc,cx,cz,nx,nz,u,bot,top,hw){ hw=hw||1.25;
  acc.reveal.push(facePoly(cx,cz,nx,nz,lanc(u,hw,bot,top),0.05));
  const lt=top-1.35; for(const d of [-0.42,0.42]) acc.dark.push(facePoly(cx,cz,nx,nz,lanc(u+d,0.3,bot+0.15,lt),0.08));
  const q=new THREE.CircleGeometry(0.34,14); const X=new V3(-nz,0,nx), Z=new V3(nx,0,nz);
  for(const [du,dv] of [[0,0.28],[0,-0.28],[-0.28,0],[0.28,0]]){ const c=q.clone(); c.applyMatrix4(new THREE.Matrix4().makeBasis(X,new V3(0,1,0),Z).setPosition(new V3(cx,0,cz).addScaledVector(X,u+du).addScaledVector(Z,0.09).setY(top-0.78+dv))); acc.white.push(c); } }
const facadeAcc={reveal:[],dark:[],white:[]};
for(const zz of [TW.n,TW.s]){
  const z0=zz[0], z1=zz[1], zc=(z0+z1)/2, south=zz===TW.s, T_GABLE=(south?T_GTIP[1]:T_GTIP[0])-T_EAVE, apexY=T_EAVE+T_GABLE+(south?T_HELM[1]:T_HELM[0]);
  const xa=TW.x0, xb=TW.x1, hx=(xb-xa)/2, hz=(z1-z0)/2, xc=(xa+xb)/2, zo=south?z1:z0, zi=south?z0:z1, so=south?1:-1;
  if(south){   // Gedenkkapelle im Erdgeschoss des Südturms
    box(xa,xb,GK.h,T_EAVE,z0,z1,towerMat);
    wall([GK.x0,GK.z1],[GK.x1,GK.z1],{h:GK.h,t:0.9,ext:0.45,mat:towerMat});   // Südseite unten geschlossen (Fotos)
    wall([GK.x0,GK.z0],[GK.x1,GK.z0],{h:GK.h,t:0.9,ext:0.45,mat:towerMat,openings:[D((GK.x1-GK.x0)/2,1.6,4.5)]});
    wall([GK.x0,GK.z0],[GK.x0,GK.z1],{h:GK.h,t:0.9,ext:0.45,mat:towerMat,openings:[W((GK.z1-GK.z0)/2,0.95,6.8,20.6-SQ3*0.95,5)]});   // das hohe Fenster vorn in der Westseite; die Südseite ist unten geschlossen
    wall([GK.x1,GK.z0],[GK.x1,GK.z1],{h:GK.h,t:0.9,ext:0.45,mat:towerMat,openings:[D((GK.z1-GK.z0)/2,2.0,6.0)]});
    box(GK.x0+0.45,GK.x1-0.45,GK.ceil,GK.h,GK.z0+0.45,GK.z1-0.45);
  } else box(xa,xb,0,T_EAVE,z0,z1,towerMat);
  // Ecken (60 m), Giebelspitzen (72,7 m), Helmspitze; Giebel West/Ost mit Rosette und Blende, Nord/Süd mit Dreipass
  const C=[P(xa,T_EAVE,z0),P(xb,T_EAVE,z0),P(xb,T_EAVE,z1),P(xa,T_EAVE,z1)];
  const G=[P(xc,T_EAVE+T_GABLE,z0),P(xb,T_EAVE+T_GABLE,zc),P(xc,T_EAVE+T_GABLE,z1),P(xa,T_EAVE+T_GABLE,zc)];
  const A=P(xc,apexY,zc);
  for(let k=0;k<4;k++) addMesh(triUV(C[k],C[(k+1)%4],G[k]),k===3?gableMatWE:k===1?(south?gableMatDiaper:gableMatWheel):(k===0&&!south)?gableMatRose:gableMatNS);   // Nordturm Nordgiebel: Rosette (Luftbild)   // Ost: Süd Rautenmuster, Nord Radfenster (Foto)
  const f=[]; for(let k=0;k<4;k++){ f.push([A,C[k],G[k]]); f.push([A,G[k],C[(k+1)%4]]); }
  addMesh(polyGeo(f),roofMat);
  // goldene Knäufe auf den Giebelspitzen, Helmstange, Kugel, Wetterhahn
  for(const gp of G){ const r=new THREE.CylinderGeometry(0.05,0.05,1.2,5); r.translate(gp.x,gp.y+0.6,gp.z); addMesh(r,darkMat,false);
    const b=new THREE.SphereGeometry(0.32,10,8); b.translate(gp.x,gp.y+1.3,gp.z); addMesh(b,goldMat,false); }
  { const k0=apexY, k1=k0+0.9, r1=k1+3.3;   // Knauf, Helmstange, Hahn
    const g=new THREE.CylinderGeometry(0.07,0.07,r1-k0,6); g.translate(xc,(k0+r1)/2,zc); addMesh(g,darkMat,false);
    const b=new THREE.SphereGeometry(0.47,12,8); b.translate(xc,k0+0.45,zc); addMesh(b,goldMat,false);
    const body=new THREE.SphereGeometry(0.4,10,8); body.scale(1.3,1,0.15); body.translate(xc,r1+0.35,zc); addMesh(body,goldMat,false);
    const tail=new THREE.ConeGeometry(0.35,0.75,6); tail.scale(1,1,0.15); tail.translate(xc-0.5,r1+0.6,zc); addMesh(tail,goldMat,false);
    const head=new THREE.SphereGeometry(0.17,8,6); head.scale(1,1,0.3); head.translate(xc+0.45,r1+0.8,zc); addMesh(head,goldMat,false); }
  // Friesbänder
  { const fg=[], dg=[], ledgeG=[]; for(const y of T_FRIEZE) for(const [cx,cz,len,rot,side] of [[xa-0.07,zc,2*hz,-Math.PI/2,'w'],[xb+0.07,zc,2*hz,Math.PI/2,'e'],[xc,zo+so*0.07,2*hx,south?0:Math.PI,'o'],[xc,zi-so*0.07,2*hx,south?Math.PI:0,'i']]){
      if((side==='e'&&y<HJ+1)||(side==='i'&&y<HN+1.5)) continue;
      const disc=(side==='o'||side==='e')&&y<35, nT=disc?7:side==='o'?6:9, bh=disc?1.0:0.95;   // Motive je Seite nach Fotos: außen 6 Kreuze, West/Ost/innen 9, unterstes Band 7 Scheiben
      const g=new THREE.PlaneGeometry(len-0.4,bh); const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setX(i,uv.getX(i)*nT);
      g.rotateY(rot); g.translate(cx,y,cz); (disc?dg:fg).push(g);
      const lg=boxGeo(len+0.3,0.16,0.22); lg.rotateY(rot); lg.translate(cx,y+0.62,cz); ledgeG.push(lg); }   // unterstes Band außen und östlich als Scheibenfries (Foto vom Petriturm)
    const m=new THREE.Mesh(mergeGeos(fg),friezeMat); m.receiveShadow=true; building.add(m);
    if(dg.length){ const m2=new THREE.Mesh(mergeGeos(dg),discFriezeMat); m2.receiveShadow=true; building.add(m2); }
    addMesh(mergeGeos(ledgeG),stoneLedgeMat,false); }   // hellgraues Gesims über jedem Fries (Foto)
  // gekuppelte Fenster: zwei je Seite und Geschoss (Achsen bei ±24 % der Breite); innen/Ost nur über dem Dach
  // Achsen bei ±16 % der Breite (Fotos West, Süd, Ost); Ostseite über den Seitenschiffdächern, Innenseite über der Mittelschifftraufe
  for(const [bot,top] of T_LEVELS.concat([[24.8,29.4]])){
    for(const d of [-0.16,0.16]){
      twinWindow(facadeAcc,xa,zc,-1,0,d*2*hz,bot,top);
      twinWindow(facadeAcc,xc,zo,0,so,d*2*hx,bot,top);
      if(bot>=HJ+2) twinWindow(facadeAcc,xb,zc,1,0,d*2*hz,bot,top);
      if(bot>=HN+2) twinWindow(facadeAcc,xc,zi,0,-so,d*2*hx,bot,top); } }
  // kleine Blende in jedem Giebel ist Teil der Giebeltextur; unten: kleines und hohes Spitzbogenfenster auf West- und Außenseite
  for(const [cx,cz,nx,nz,tall] of [[xa,zc,-1,0,true],[xc,zo,0,so,!south]]){
    if(tall){ facadeAcc.reveal.push(facePoly(cx,cz,nx,nz,lanc(0,1.25,6.5,21.0),0.05)); facadeAcc.dark.push(facePoly(cx,cz,nx,nz,lanc(0,0.95,6.8,20.6),0.08)); } }   // Südturm vorn: dahinter das verglaste Fenster der Gedenkkapelle (die dunkle Fläche wirft keinen Schatten)
}
// Mittelbau zwischen den Türmen (Foto): Giebel bis zum First, Rautenmuster, zwei Spitzbogennischen mit Fenstern und Kupferbrüstung,
// kleines Giebelfenster, weißer Bogenfries bei 32,4 m; unten Westportal mit Maßwerk-Tympanon und das Westfenster
{ const zL=TW.n[1], zR=TW.s[0], cx=TW.x0;
  facadeAcc.dark.push(facePoly(cx,0,-1,0,lanc(0,0.42,42.6,45.4),0.08));
  for(const u of [-3.3,3.3]){ facadeAcc.reveal.push(facePoly(cx,0,-1,0,lanc(u,1.45,35.4,42.4),0.05)); facadeAcc.dark.push(facePoly(cx,0,-1,0,lanc(u,0.5,35.6,38.8),0.08));
    const ledge=boxGeo(1.6,0.5,0.45); ledge.translate(cx-0.22,35.55,-u); addMesh(ledge,roofMat,false); }
  { const g=new THREE.PlaneGeometry(zR-zL,0.9); const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setX(i,uv.getX(i)*(zR-zL)/1.5); g.rotateY(-Math.PI/2); g.translate(cx-0.07,32.4,0); const m=new THREE.Mesh(g,arcFriezeMat); building.add(m); }
  for(const [u,y] of [[-4.2,44],[4.2,44],[-2.2,46.3],[2.2,46.3],[-6,41],[6,41],[-1.4,40.8],[1.4,40.8]]){   // weiße Kreuze im Giebel
    for(const [w,h] of [[0.7,0.18],[0.18,0.7]]){ const g=new THREE.PlaneGeometry(w,h); g.rotateY(-Math.PI/2); g.translate(cx-0.09,y,u); facadeAcc.white.push(g); } }
  // Tympanon über dem Westportal: helles Maßwerk mit Rosette
  { const stoneMat=new THREE.MeshStandardMaterial({color:0xb9b1a6,roughness:0.85,side:THREE.DoubleSide}); stoneMat.clippingPlanes=[cutPlane];
    { const tp=facePoly(cx,0,-1,0,lanc(0,2.2,5.5,9.3),0.02); const m=new THREE.Mesh(tp,stoneMat); m.receiveShadow=true; building.add(m);
      const tp2=facePoly(cx+1.2,0,-1,0,lanc(0,2.2,5.5,9.3),-0.02); building.add(new THREE.Mesh(tp2,stoneMat)); }
    const ring=new THREE.RingGeometry(0.9,1.15,24); ring.rotateY(-Math.PI/2); ring.translate(cx-0.09,7.3,0); facadeAcc.dark.push(ring);
    for(let k=0;k<3;k++){ const a=k*2*Math.PI/3-Math.PI/2, r2=new THREE.RingGeometry(0.32,0.42,16); r2.rotateY(-Math.PI/2); r2.translate(cx-0.1,7.3+Math.sin(a)*-0.4,Math.cos(a)*0.4); facadeAcc.dark.push(r2); }
  }
}
{ const mk=(arr,mat)=>{ const m=new THREE.Mesh(mergeGeos(arr),mat); m.receiveShadow=true; building.add(m); };
  mk(facadeAcc.reveal,revealMat); mk(facadeAcc.dark,darkMat); mk(facadeAcc.white,whiteMat); }
// Obergaden außen: tiefe Spitzbogenblenden um jedes Fenster (Fotos von Süden)
{ const gs=[], recessMat=new THREE.MeshStandardMaterial({map:brickTex,color:0x8a827a,roughness:0.95,side:THREE.DoubleSide}); recessMat.clippingPlanes=[cutPlane];   // Blende im selben Backstein, im Schatten etwas dunkler
  for(let i=0;i<NB;i++){ const bw=PX[i+1]-PX[i], hwO=bw/2-0.55, hwW=Math.min(1.9,(bw-2.6)/2), um=(PX[i]+PX[i+1])/2;
    const outer=lancet(0,hwO,29.0,40.2-SQ3*hwO,10), inner=lancet(0,hwW,29.8,34.8,10);
    const sh=new THREE.Shape(); sh.moveTo(outer[0][0],outer[0][1]); outer.slice(1).forEach(q=>sh.lineTo(q[0],q[1]));
    const hole=new THREE.Path(); hole.moveTo(inner[0][0],inner[0][1]); inner.slice(1).forEach(q=>hole.lineTo(q[0],q[1])); sh.holes.push(hole);
    for(const sgn of [-1,1]){ const g=new THREE.ShapeGeometry(sh); if(sgn<0) g.rotateY(Math.PI); g.translate(um,0,sgn*(ZN+0.74)); gs.push(g); } }
  const m=new THREE.Mesh(mergeGeos(gs),recessMat); m.receiveShadow=true; building.add(m); }
// Chorhaupt nach Drohnenfotos von Osten und Norden: Umgang mit Pultdach je Joch zwischen den Strebepfeilern,
// schlanke Fialen auf den Umgangspfeilern; Schmuckgiebel mit Blendnischen und Fialen an den Ostgiebeln der Chorkapellen
{ for(const s of [-1,1]) for(const k of [1,2,3]){ const v=AMB_N[k], C=[v[0]+AMB_BN[k][0]*2.6,-s*(v[1]+AMB_BN[k][1]*2.6)]; const g=new THREE.ConeGeometry(0.55,5.2,8); g.translate(C[0],HCS+1.4+2.6,C[1]); addMesh(g,roofMat);
    const b=boxGeo(1.1,1.6,1.1); b.translate(C[0],HCS+0.6,C[1]); addMesh(b,wallMat); }
  // Ostgiebel der Chorkapellen: abgestufte Blendnischen und drei Fialen
  const gd=[];
  for(const c of [CHAPELS[2],CHAPELS[4]]){ const s3=c.s, zi=c.zi, zo=c.zo, zr=c.zr, x=c.x1+0.52;
    const yAt=z=>z<=zr? c.hin+(z-zi)/(zr-zi)*(c.ridge-c.hin) : c.ridge+(z-zr)/(zo+0.6-zr)*(c.h-c.ridge);
    for(const f of [-0.75,-0.4,0,0.4,0.75]){ const z=zr+f*(f<0?zr-zi:zo-zr), ytop=yAt(z)-1.2, ybot=Math.min(c.h,c.hin)-2.5; if(ytop-ybot<1.5) continue;
      gd.push(facePoly(x,s3*z,1,0,lanc(0,0.42,ybot,ytop),0.02)); }
    pinnacle(c.x1,c.ridge,s3*zr); pinnacle(c.x1,c.h,s3*(zo+0.4)); pinnacle(c.x1,c.hin,s3*(zi+0.2)); }
  // Westgiebel der nördlichen Chorkapellen über dem Dach der Totentanzkapelle (Luftbild von Norden; war offen)
  { const c=CHAPELS[2], s3=c.s, zi=c.zi, zo=c.zo, zr=c.zr, x=c.x0, yb=c.h-2.2;
    const yAt=z=>z<=zr? c.hin+(z-zi)/(zr-zi)*(c.ridge-c.hin) : c.ridge+(z-zr)/(zo+0.6-zr)*(c.h-c.ridge);
    const q=(z,y)=>P(x,y,s3*z);
    addMesh(polyGeo([[q(zi-0.6,yb),q(zr,yb),q(zr,c.ridge),q(zi-0.6,yAt(zi-0.6))],[q(zr,yb),q(zo+0.5,yb),q(zo+0.5,yAt(zo+0.5)),q(zr,c.ridge)]]),wallMat);
    for(const f of [-0.75,-0.4,0,0.4,0.75]){ const z=zr+f*(f<0?zr-zi:zo-zr), ytop=yAt(z)-1.2, ybot=yb+0.6; if(ytop-ybot<1.5) continue;
      gd.push(facePoly(x-0.02,s3*z,-1,0,lanc(0,0.42,ybot,ytop),0.04)); }
    pinnacle(x,c.ridge,s3*zr); pinnacle(x,c.h,s3*(zo+0.4)); }
  if(gd.length) building.add(new THREE.Mesh(mergeGeos(gd),darkMat)); }
// Treppentürme der Westtürme (Grundriss 1906: achteckig, mittig vor der Nordseite des Nordturms und der Südseite des Südturms;
// Foto von Südwesten: bis knapp unter das unterste Friesband, Kupferhaube)
function stairTurret(x,z,R,h,cap,mat){ const g=new THREE.CylinderGeometry(R,R,h,8); g.rotateY(Math.PI/8); scaleUV(g,2*Math.PI*R,h); g.translate(x,h/2,z); addMesh(g,wallMat);
  const c=new THREE.ConeGeometry(R*1.12,cap,8); c.rotateY(Math.PI/8); c.translate(x,h+cap/2,z); addMesh(c,mat||roofMat); }
stairTurret(-43.4,TW.n[0]-0.6,1.6,27.4,3.2);
stairTurret(-43.6,TW.s[1]+0.6,1.6,27.4,3.2);
// Sockel aus Granit und helle Eckquader an den Westecken der Türme (Fotos der Westseite)
{ const sg=[], qg=[], H0=1.9;
  const plinth=(x0,x1,z0,z1)=>{ const g=boxGeo(Math.abs(x1-x0),H0,Math.abs(z1-z0)); g.translate((x0+x1)/2,H0/2,(z0+z1)/2); sg.push(g); };
  plinth(TW.x0-0.15,TW.x0+0.1,TW.n[0]-0.15,TW.s[1]+0.15); plinth(TW.x0-0.15,TW.x1,TW.n[0]-0.15,TW.n[0]+0.1); plinth(TW.x0-0.15,CHAPELS[0].x0-0.5,TW.s[1]-0.1,TW.s[1]+0.15);
  for(const [cx,sx] of [[TW.x0,1],[TW.x1,-1]]) for(const [cz,sz] of [[TW.n[0],-1],[TW.n[1],1],[TW.s[0],-1],[TW.s[1],1]]) for(let y=H0, i=0; y<T_EAVE-0.3; y+=0.62, i++){ const long=i%2===0;
    if(sx<0&&y<HN+0.5) continue;   // Ostecken erst über den Dächern sichtbar
    const a=boxGeo(0.14,0.58,long?1.1:0.55); a.translate(cx-sx*0.05,y+0.29,cz-sz*(long?0.55:0.275)); qg.push(a);
    const b=boxGeo(long?0.55:1.1,0.58,0.14); b.translate(cx+sx*(long?0.275:0.55),y+0.29,cz+sz*0.05); qg.push(b); }
  const qm=new THREE.MeshStandardMaterial({color:lin(0x9a958c),roughness:0.88}); qm.clippingPlanes=[cutPlane];
  addMesh(mergeGeos(sg),graniteMat); addMesh(mergeGeos(qg),qm,false); }
// Dachreiter (LoD2: x = 11,9)
// Dachreiter nach Fotos (Nordseite aus der Ferne, Nahaufnahmen von Süden): geschlossener Unterbau bis 2,4 m über den First mit Galerie,
// offene Laterne mit acht Pfosten und schlanken Eckfialen, goldene Krone (Bögen mit Muschelfächern, Fialenkranz),
// achtseitiger Helm mit Krabben, Kugel, Stange und Wetterhahn. Grün patiniertes Metall, dunkler als das Kupferdach.
{ const xc=11.9, yF=HR+2.4, R=1.6, hL=5.2, SPL=17.0, ys=yF+hL+0.8, A=k=>k*Math.PI/4+Math.PI/8;
  const dark=new THREE.MeshStandardMaterial({color:0x27322e,roughness:0.75,metalness:0.15,side:THREE.DoubleSide}); dark.clippingPlanes=[cutPlane];
  const dk=[], gd=[];
  { const yb=HR-2.6; const base=new THREE.CylinderGeometry(R+0.25,R+0.45,yF-yb,8); base.rotateY(Math.PI/8); base.translate(xc,(yb+yF)/2,0); dk.push(base);
    const led=new THREE.CylinderGeometry(R+0.5,R+0.5,0.22,8); led.rotateY(Math.PI/8); led.translate(xc,yF-0.11,0); dk.push(led); }   // Gesims unter der Galerie
  for(let k=0;k<8;k++){ const a=A(k), c=Math.cos(a), s=Math.sin(a);
    const p=boxGeo(0.18,hL,0.18); p.translate(xc+R*c,yF+hL/2,R*s); dk.push(p);   // Pfosten
    const f=new THREE.CylinderGeometry(0.05,0.07,hL+0.9,4); f.translate(xc+(R+0.42)*c,yF+(hL+0.9)/2-0.2,(R+0.42)*s); dk.push(f);   // Eckfiale
    const ft=new THREE.ConeGeometry(0.09,0.5,4); ft.translate(xc+(R+0.42)*c,yF+hL+0.95,(R+0.42)*s); gd.push(ft);
    const b=boxGeo(0.06,0.06,0.42); b.rotateY(-a); b.translate(xc+(R+0.21)*c,yF+hL*0.55,(R+0.21)*s); dk.push(b);   // Strebe zur Fiale
    const a1=A(k+1), p0=[xc+R*c,R*s], p1=[xc+R*Math.cos(a1),R*Math.sin(a1)], L=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]), ang=-Math.atan2(p1[1]-p0[1],p1[0]-p0[0]), mx=(p0[0]+p1[0])/2, mz=(p0[1]+p1[1])/2;
    for(const yy of [0.5,1.0]){ const r=boxGeo(L,0.05,0.05); r.rotateY(ang); r.translate(mx,yF+yy,mz); dk.push(r); }   // Galeriegeländer
    // Krone: goldener Bogen mit Muschelfächer je Seite, darüber Gesims und Fialenkranz
    const am=(a+a1)/2, out=Math.PI/2-am;
    const fan=new THREE.CircleGeometry(0.62,9,0,Math.PI); fan.rotateY(out); fan.translate(xc+R*0.93*Math.cos(am),yF+hL-0.72,R*0.93*Math.sin(am)); gd.push(fan);
    const arch=new THREE.TorusGeometry(0.66,0.05,4,12,Math.PI); arch.rotateY(out); arch.translate(xc+R*0.94*Math.cos(am),yF+hL-0.72,R*0.94*Math.sin(am)); gd.push(arch);
    const pc=new THREE.ConeGeometry(0.14,1.15,4); pc.translate(xc+(R+0.3)*c,yF+hL+0.8+0.55,(R+0.3)*s); gd.push(pc);
    const pm=new THREE.ConeGeometry(0.09,0.75,4); pm.translate(xc+(R+0.2)*Math.cos(am),yF+hL+0.8+0.35,(R+0.2)*Math.sin(am)); gd.push(pm); }
  const core=new THREE.CylinderGeometry(0.28,0.28,hL,8); core.translate(xc,yF+hL/2,0); dk.push(core);   // Mittelsäule (Glockenstuhl); ringsum ist Platz zum Umhergehen
  { const g1=new THREE.CylinderGeometry(R+0.36,R+0.32,0.4,8); g1.rotateY(Math.PI/8); g1.translate(xc,yF+hL+0.2,0); gd.push(g1);
    const g2=new THREE.CylinderGeometry(R+0.3,R+0.36,0.4,8); g2.rotateY(Math.PI/8); g2.translate(xc,yF+hL+0.6,0); dk.push(g2); }
  // Helm mit Krabben auf den Graten
  // Helm braun-bronzefarben, Krabben hell patiniert (Foto vom Petriturm 2010)
  const sp=new THREE.ConeGeometry(R+0.15,SPL,8,1,true); sp.rotateY(Math.PI/8); sp.translate(xc,ys+SPL/2,0);
  const helmMat=new THREE.MeshStandardMaterial({color:lin(0x7a6a5e),roughness:0.6,metalness:0.25,side:THREE.DoubleSide}); helmMat.clippingPlanes=[cutPlane]; addMesh(sp,helmMat);
  const cr=[]; for(let k=0;k<8;k++){ const a=A(k); for(let t=0.06;t<0.94;t+=0.75/SPL){ const r=(R+0.15)*(1-t)+0.06, c=boxGeo(0.13,0.13,0.13); c.translate(xc+r*Math.cos(a),ys+t*SPL,r*Math.sin(a)); cr.push(c); } }
  const crMat=new THREE.MeshStandardMaterial({color:lin(0x9fc2b2),roughness:0.7}); crMat.clippingPlanes=[cutPlane]; addMesh(mergeGeos(cr),crMat,false);
  addMesh(mergeGeos(dk),dark); addMesh(mergeGeos(gd),goldMat,false);
  const top=ys+SPL, b=new THREE.SphereGeometry(0.32,12,10); b.translate(xc,top+0.25,0); addMesh(b,goldMat,false);
  const rod=new THREE.CylinderGeometry(0.04,0.05,1.9,6); rod.translate(xc,top+1.2,0); addMesh(rod,goldMat,false);
  // Wetterhahn (Umriss)
  const hs=new THREE.Shape([[-0.42,0.02],[-0.3,0.18],[-0.12,0.22],[0.06,0.2],[0.16,0.36],[0.12,0.5],[0.2,0.62],[0.3,0.58],[0.36,0.48],[0.3,0.36],[0.26,0.2],[0.2,0.05],[0.06,-0.08],[0.04,-0.2],[0.12,-0.3],[-0.1,-0.3],[-0.04,-0.18],[-0.16,-0.08],[-0.36,-0.2],[-0.52,-0.05],[-0.6,0.22],[-0.5,0.3]].map(p=>new THREE.Vector2(p[0],p[1])));
  const hg=new THREE.ShapeGeometry(hs); hg.scale(1.15,1.15,1); hg.translate(xc,top+2.45,0); addMesh(hg,goldMat,false); }
// Gauben im Kupferdach des Mittelschiffs: eine Reihe je Seite im unteren Drittel, je Joch eine Gaube über dem Fenster (Foto von St. Petri, Fernfoto von Norden)
{ const dg=[], wg=[], RE=ZNF+0.2, slope=(HR-HN)/RE;
  for(const s of [-1,1]) for(const yb of [43.2]) for(let i=0;i<NB;i++){ const x=bayMid(i);
    const z=s*(RE-(yb-HN)/slope), d=boxGeo(1.0,1.0,1.1); d.translate(x,yb+0.5,z); dg.push(d);
    const roof=new THREE.ConeGeometry(0.78,0.5,4); roof.rotateY(Math.PI/4); roof.scale(1,1,1.3); roof.translate(x,yb+1.25,z); dg.push(roof);
    const w=new THREE.PlaneGeometry(0.55,0.6); if(s<0) w.rotateY(Math.PI); w.translate(x,yb+0.5,z+s*0.56); wg.push(w); }
  addMesh(mergeGeos(dg),roofMat,false); building.add(new THREE.Mesh(mergeGeos(wg),darkMat)); }

// Strebepfeiler, Strebebögen, Fialen (Lage aus LoD2)
function flyer(a,b){ const len=a.distanceTo(b); const m=addMesh(boxGeo(0.85,0.95,len),wallMat); m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b);
  const cap=new THREE.Mesh(boxGeo(1.25,0.14,len),roofMat); cap.position.set(0,0.54,0); cap.castShadow=true; m.add(cap); }   // Kupferabdeckung (Luftbild)
function pinnacle(x,y,z){ const g=new THREE.ConeGeometry(0.6,3.4,4); g.rotateY(Math.PI/4); g.translate(x,y+1.7,z); addMesh(g,roofMat); }
const SB_FACE=23.6;   // Außenflucht der südlichen Strebepfeiler im Langhaus (LoD2)
const SD_PIER=1, SD_FACE=29.8, SD_TOP=17.6;   // Sonnenuhr: erster Strebepfeiler östlich des Südturms, vor der Briefkapelle bis zum Boden geführt (LoD2: Außenflucht z = 29,8)
for(let i=1;i<NB;i++){ const x=PX[i];
  // Nord: Pfeiler zwischen den niedrigen Kapellen bzw. über den Chorkapellen
  if(x<XT-0.1) box(x-0.8,x+0.8,0,28.3,-(ZKN+0.5),-(ZAN+0.6)); else box(x-0.8,x+0.8,HAN-0.5,29.0,-21.4,-(ZAN+0.6));
  pinnacle(x,x<XT-0.1?28.3:29.0,-20.0);
  flyer(P(x,28.6,-19.6),P(x,36.2,-(ZNF-0.05)));
  // Süd
  const zs=x<XT-0.1?ZAS:ZCS;
  box(x-0.8,x+0.8,HAS-1.5,28.5,zs-0.7,zs+0.75); pinnacle(x,28.5,zs);
  if(x<XT-0.1&&x>CHAPELS[0].x1){ box(x-0.9,x+0.9,0,18.4,ZAS+0.6,SB_FACE); pinnacle(x,18.4,(ZAS+0.6+SB_FACE)/2); }
  if(i===SD_PIER){ box(x-0.8,x+0.8,0,SD_TOP,CHAPELS[0].zo+0.45,SD_FACE); box(x-0.8,x+0.8,12.6,SD_TOP,ZAS+0.6,CHAPELS[0].zo+0.5); box(x-0.9,x+0.9,SD_TOP,SD_TOP+0.12,CHAPELS[0].zo+0.3,SD_FACE+0.1,darkRoofMat); }   // flach abgedeckt, gut 1 m über der Sonnenuhr (Fotos 2026)
  flyer(P(x,28.5,zs),P(x,36.2,ZNF-0.05));
}
// Strebepfeiler des Kapellenkranzes in Richtung der Chorecken (Grundriss) mit Strebebögen zu den Polygonecken (Drohnenfoto)
{ const co=choirOff(0.75);
  for(const s of [-1,1]) for(const k of [1,2,3]){ const v=AMB_N[k], n=AMB_BN[k], L=k===2?1.8:3.2, c=[v[0]+n[0]*(0.6+L/2),-s*(v[1]+n[1]*(0.6+L/2))];
    const m=addMesh(boxGeo(1.5,HCS+1.4,L),wallMat); m.position.set(c[0],(HCS+1.4)/2,c[1]); m.lookAt(c[0]+n[0],(HCS+1.4)/2,c[1]-s*n[1]); }
  for(const s of [-1,1]){ const v1=AMB_N[1], n1=AMB_BN[1], v3=AMB_N[3], n3=AMB_BN[3];
    flyer(P(v1[0]+n1[0]*0.8,21.6,-s*(v1[1]+n1[1]*0.8)),P(XC+0.2,34.5,s*(ZNF+0.05)));
    flyer(P(v3[0]+n3[0]*0.8,21.6,-s*(v3[1]+n3[1]*0.8)),P(co[1][0],34.5,-s*co[1][1])); } }
// Treppentürme an den Anschlüssen des Umgangs (Grundriss; Drohnenfoto: dunkles Kegeldach)
// Nord: (28,5 / −18,8) über die Dächer geführt, dunkles Kegeldach (Luftbilder von Osten); Süd: (26,4 / 17,6) endet unter den Dächern
stairTurret(28.5,-18.8,1.35,27.0,5.0,darkRoofMat);
stairTurret(26.4,17.6,1.35,21.2,1.2,darkRoofMat);

// Ausstattung: Gestühl, Altar
{ const gs=[]; for(let x=X0+3;x<=XT-3;x+=1.15) for(const zz of [[-5.6,-0.9],[0.9,5.6]]){
    const seat=boxGeo(0.45,0.45,zz[1]-zz[0]); seat.translate(x,0.45,(zz[0]+zz[1])/2); gs.push(seat);
    const back=boxGeo(0.08,0.95,zz[1]-zz[0]); back.translate(x-0.25,0.5,(zz[0]+zz[1])/2); gs.push(back); }
  addMesh(mergeGeos(gs),woodMat); }
box(30.0,31.6,0,1.1,-1.6,1.6,altarMat);
box(30.6,31.0,1.1,2.4,-1.0,1.0,altarMat);   // Retabel, niedrig
box(31.4,31.6,6.0,12.4,-0.14,0.14,woodMat); box(31.4,31.6,10.2,10.5,-1.6,1.6,woodMat);   // Triumphkreuz, frei hängend (nach Innenfoto)
{ const g=new THREE.CylinderGeometry(0.012,0.012,30.6-12.4,4); g.translate(31.5,(30.6+12.4)/2,0); addMesh(g,darkMat,false); }

// Fensterpfosten aller Fenster als ein Netz (werfen Schatten, sind aber nicht Teil der Strahlprüfung)
{ const m=new THREE.Mesh(mergeGeos(mullionGeos),mullionMat); m.castShadow=true; m.receiveShadow=true; building.add(m); }
// Wappenscheiben (Stiftungen von 1953) in den hellen Fenstern der Chorkapellen: kleine farbige Felder im unteren Fensterdrittel (Fotos 2026).
// Die Motive sind vereinfacht und nicht einzelnen Fenstern zugeordnet.
{ const T=128, medTex=canvasTex(T*4,T*2,(g)=>{ g.clearRect(0,0,T*4,T*2);
    const shield=(x,y,fill)=>{ g.save(); g.translate(x,y); g.beginPath(); g.moveTo(18,14); g.lineTo(110,14); g.lineTo(110,62); g.quadraticCurveTo(108,104,64,120); g.quadraticCurveTo(20,104,18,62); g.closePath();
      g.save(); g.clip(); fill(g); g.restore(); g.lineWidth=5; g.strokeStyle='#2a2420'; g.stroke(); g.restore(); };
    const disc=(x,y,ring,fill)=>{ g.save(); g.translate(x+64,y+64); g.beginPath(); g.arc(0,0,58,0,7); g.fillStyle=ring; g.fill(); g.lineWidth=4; g.strokeStyle='#2a2420'; g.stroke();
      g.beginPath(); g.arc(0,0,40,0,7); g.save(); g.clip(); fill(g); g.restore(); g.stroke(); g.restore(); };
    const eagle=(g,c)=>{ g.fillStyle=c; g.beginPath(); g.ellipse(64,62,10,22,0,0,7); g.fill(); g.beginPath(); g.moveTo(60,50); g.lineTo(22,34); g.lineTo(30,58); g.lineTo(22,64); g.lineTo(56,70); g.fill();
      g.beginPath(); g.moveTo(68,50); g.lineTo(106,34); g.lineTo(98,58); g.lineTo(106,64); g.lineTo(72,70); g.fill(); g.beginPath(); g.arc(64,36,7,0,7); g.fill(); g.beginPath(); g.moveTo(54,84); g.lineTo(64,104); g.lineTo(74,84); g.fill(); };
    shield(0,0,g=>{ g.fillStyle='#f2efe6'; g.fillRect(0,0,T,64); g.fillStyle='#c0262d'; g.fillRect(0,64,T,64); });   // geteilt Silber über Rot
    shield(T,0,g=>{ g.fillStyle='#e7b631'; g.fillRect(0,0,T,T); eagle(g,'#1e1a18'); });
    shield(2*T,0,g=>{ g.fillStyle='#e9bf3a'; g.fillRect(0,0,T,T); g.fillStyle='#2546a8'; for(const y of [40,84]){ g.beginPath(); g.ellipse(64,y,30,13,0,0,7); g.fill(); g.fillRect(36,y-3,8,18); g.fillRect(80,y-3,8,18); } });
    disc(3*T,0,'#c0262d',g=>{ g.fillStyle='#f2efe6'; g.fillRect(-60,-60,120,120); g.fillStyle='#1e1a18'; g.fillRect(-6,-34,12,68); g.fillRect(-34,-6,68,12); });
    shield(0,T,g=>{ g.fillStyle='#2546a8'; g.fillRect(0,0,T,T); for(let k=0;k<6;k++){ g.fillStyle=k%2?'#f2efe6':'#c0262d'; g.fillRect(36,22+k*13,56,13); } });
    disc(T,T,'#d9a441',g=>{ g.fillStyle='#3d6fc4'; g.fillRect(-60,-60,120,120); g.fillStyle='#7a3b22'; g.beginPath(); g.moveTo(-26,8); g.lineTo(26,8); g.lineTo(18,22); g.lineTo(-18,22); g.fill();
      g.fillStyle='#f2efe6'; g.beginPath(); g.moveTo(-2,6); g.lineTo(-2,-30); g.lineTo(-22,4); g.fill(); g.fillStyle='#c0262d'; g.beginPath(); g.moveTo(2,6); g.lineTo(2,-26); g.lineTo(20,4); g.fill(); });
    disc(2*T,T,'#e0b13a',g=>{ g.fillStyle='#2b56b0'; g.fillRect(-60,-60,120,120); g.fillStyle='#f2efe6'; for(let k=0;k<5;k++){ const a=k*2*Math.PI/5-Math.PI/2; g.beginPath(); g.arc(Math.cos(a)*16,Math.sin(a)*16,13,0,7); g.fill(); }
      g.fillStyle='#c0262d'; g.beginPath(); g.arc(0,0,11,0,7); g.fill(); g.fillStyle='#1e1a18'; g.fillRect(-2,-8,4,16); g.fillRect(-6,-3,12,4); });
    shield(3*T,T,g=>{ for(let i=0;i<8;i++) for(let j=0;j<9;j++){ g.fillStyle=(i+j)%2?'#f2efe6':'#3d82d0'; g.beginPath(); const x=i*16+(j%2)*8, y=j*14; g.moveTo(x,y-8); g.lineTo(x+8,y); g.lineTo(x,y+8); g.lineTo(x-8,y); g.fill(); } });
  },null);
  medTex.encoding=THREE.sRGBEncoding;
  let k=0;
  for(const w of windows){ if(w.type>=0||w.bottom>10||w.apex>22) continue; const c=w.center; if(!(c.x>8.6&&(Math.abs(c.z)>15||c.x>XC))) continue;
    const id=(k*5+3)%8, sz=w.hw>=1.2?0.72:0.6, g=new THREE.PlaneGeometry(sz,sz), uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++) uv.setXY(i,((id%4)+uv.getX(i))/4,(uv.getY(i)-Math.floor(id/4))/2+0.5);   // Atlas 4×2, obere Reihe = v 0,5…1
    const XR=new V3(0,1,0).cross(w.inward).normalize();   // von innen gesehen nach rechts: Bild seitenrichtig
    const mat=new THREE.MeshBasicMaterial({map:medTex,alphaTest:0.5,side:THREE.DoubleSide}); mat.clippingPlanes=[cutPlane];
    const mesh=new THREE.Mesh(g,mat); mesh.matrixAutoUpdate=false;
    const pos=w.O.clone().addScaledVector(new V3(0,1,0),w.bottom+Math.min(1.5,0.2*(w.apex-w.bottom))).addScaledVector(w.inward,0.06).addScaledVector(XR,w.hw>=1.35?0:-w.hw/2);   // zweibahnig: in die linke Bahn, nicht auf den Pfosten
    mesh.matrix.copy(new THREE.Matrix4().makeBasis(XR,new V3(0,1,0),w.inward.clone()).setPosition(pos));
    mesh.castShadow=false; mesh.receiveShadow=false; building.add(mesh); w.med=mesh; k++; }
  console.log('[St. Marien] Wappenscheiben: '+k); }

await step(tr('Umgebung wird geladen (273 Gebäude, Gelände, Bäume)','Loading surroundings (273 buildings, terrain, trees)'),58);
/* ---------------- Umgebung: LoD2-Gebäude, Gelände und Bäume (LVermGeo SH) ---------------- */
// Gebäude: LoD2 (CityGML, 2025). Gelände und Bäume: aus dem Oberflächenmodell bDOM20 (2023) abgeleitet.
// Verschattung: Strahlverfolgung über ein 1-m-Höhenraster (Dächer aus bDOM20, Bäume abschaltbar).
const ENV=await DATA.env;
let envH=null, envCls=null, envG=null, envMax=-1e9;
const envGroup=new THREE.Group(), treeGroup=new THREE.Group(); scene.add(envGroup); scene.add(treeGroup);
let churchLines=null;
function b64(s){ const bin=atob(s), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; }
function u16grid(s,base){ const b=b64(s), n=b.length/2, out=new Float32Array(n); for(let k=0;k<n;k++) out[k]=base+(b[2*k]|(b[2*k+1]<<8))/100; return out; }
function i16arr(s){ const b=b64(s); return new Int16Array(b.buffer,b.byteOffset,b.length/2); }
if(ENV){
  const n=ENV.n, st=ENV.step, o=ENV.origin;
  envH=u16grid(ENV.occ,ENV.base); envCls=b64(ENV.cls); envG=u16grid(ENV.ground,ENV.base);
  for(let k=0;k<envH.length;k++) if(envH[k]>envMax) envMax=envH[k];
  const r=rng(31);
  // Gelände (2-m-Raster)
  { const gn=ENV.gn, gs=ENV.gstep, pos=new Float32Array(gn*gn*3), col=new Float32Array(gn*gn*3);
    for(let j=0;j<gn;j++) for(let i=0;i<gn;i++){ const k=j*gn+i; pos[3*k]=o+i*gs; pos[3*k+1]=envG[k]; pos[3*k+2]=o+j*gs;
      const t=0.92+r()*0.1; col[3*k]=0.235*t; col[3*k+1]=0.228*t; col[3*k+2]=0.215*t; }
    const idx=new Uint32Array((gn-1)*(gn-1)*6); let p=0;
    for(let j=0;j<gn-1;j++) for(let i=0;i<gn-1;i++){ const a=j*gn+i,b=a+1,c=a+gn,d=c+1; idx[p++]=a; idx[p++]=c; idx[p++]=b; idx[p++]=b; idx[p++]=c; idx[p++]=d; }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('color',new THREE.BufferAttribute(col,3)); g.setIndex(new THREE.BufferAttribute(idx,1)); g.computeVertexNormals();
    const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2});
    const mesh=new THREE.Mesh(g,m); mesh.receiveShadow=true; mesh.castShadow=true; envGroup.add(mesh); }
  // LoD2-Gebäude
  { const P=i16arr(ENV.bld.pos), K=b64(ENV.bld.kind), ib=b64(ENV.bld.idx);
    const idx=ENV.bld.i32?new Uint32Array(ib.buffer,ib.byteOffset,ib.length/4):new Uint16Array(ib.buffer,ib.byteOffset,ib.length/2);
    const nv=P.length/3, pos=new Float32Array(nv*3); for(let i=0;i<nv*3;i++) pos[i]=P[i]/100;
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setIndex(new THREE.BufferAttribute(idx,1)); g.computeVertexNormals();
    const nor=g.attributes.normal.array, col=new Float32Array(nv*3);
    for(let i=0;i<nv;i++){ const ny=nor[3*i+1], jit=0.94+((i*2654435761>>>0)%1000)/1000*0.1; let c;
      if(K[i]===1) c=ny>0.985?[0.20,0.20,0.21]:[0.35,0.125,0.08];   // Luftbild: Flachdach grau, Steildach Ziegel terrakotta (linear)
      else c=[0.29,0.26,0.225];                                    // Wand gedeckt warmgrau, damit die Kirche im Vordergrund bleibt
      col[3*i]=c[0]*jit; col[3*i+1]=c[1]*jit; col[3*i+2]=c[2]*jit; }
    g.setAttribute('color',new THREE.BufferAttribute(col,3));
    const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.88,metalness:0,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(g,m); mesh.castShadow=true; mesh.receiveShadow=true; envGroup.add(mesh); }
  // Bäume und sonstige Objekte (1-m-Zellen aus bDOM20 außerhalb der Gebäude)
  { const pos=[], idx=[]; let v=0; const H=(i,j)=>envH[j*n+i];
    for(let j=0;j<n-1;j++) for(let i=0;i<n-1;i++){ if(envCls[j*n+i]!==2) continue;
      const x=o+i*st, z=o+j*st;
      pos.push(x,H(i,j),z, x+st,H(i+1,j),z, x,H(i,j+1),z+st, x+st,H(i+1,j+1),z+st); idx.push(v,v+2,v+1,v+1,v+2,v+3); v+=4; }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
    const m=new THREE.MeshStandardMaterial({color:lin(0x56683f),roughness:0.95,side:THREE.DoubleSide});   // Laubgrün wie im Luftbild
    const mesh=new THREE.Mesh(g,m); mesh.castShadow=true; mesh.receiveShadow=true; treeGroup.add(mesh); }
  // LoD2-Umriss der Kirche zum Vergleich mit dem Modell
  { const S=i16arr(ENV.church), pos=new Float32Array(S.length); for(let i=0;i<S.length;i++) pos[i]=S[i]/100;
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    churchLines=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xffc93c,transparent:true,opacity:0.9,depthTest:false,fog:false}));
    churchLines.renderOrder=20; churchLines.visible=false; scene.add(churchLines); }
}
function envSample(arr,nn,stp,x,z){ const fi=(x-ENV.origin)/stp, fj=(z-ENV.origin)/stp; if(fi<0||fj<0||fi>nn-1||fj>nn-1) return -1e9;
  const i=Math.floor(fi), j=Math.floor(fj), i1=Math.min(i+1,nn-1), j1=Math.min(j+1,nn-1), tx=fi-i, tz=fj-j;
  return (arr[j*nn+i]*(1-tx)+arr[j*nn+i1]*tx)*(1-tz)+(arr[j1*nn+i]*(1-tx)+arr[j1*nn+i1]*tx)*tz; }
function envHeightAt(x,z){ const n=ENV.n, i=Math.round((x-ENV.origin)/ENV.step), j=Math.round((z-ENV.origin)/ENV.step);
  if(i<0||j<0||i>=n||j>=n) return -1e9; const k=j*n+i;
  if(envCls[k]===2&&!state.trees) return envSample(envG,ENV.gn,ENV.gstep,x,z);
  return envH[k]; }
function envBlocked(o){
  if(!state.env||!envH) return false;
  const hz=Math.hypot(LD.x,LD.z); if(LD.y<=0) return true;
  const dt=0.5/Math.max(hz,1e-3), lim=-ENV.origin;
  for(let t=dt;t<3000;t+=dt){ const y=o.y+LD.y*t; if(y>envMax) return false; const x=o.x+LD.x*t, z=o.z+LD.z*t;
    if(Math.abs(x)>lim||Math.abs(z)>lim) return false; if(envHeightAt(x,z)>y) return true; }
  return false;
}
function applyEnv(){ envGroup.visible=state.env; treeGroup.visible=state.env&&state.trees; if(churchLines) churchLines.visible=state.lodChurch;
  groundMesh.position.y=(state.env&&ENV)?ENV.base-0.3:0; dirty=true; }

await step(tr('Sonnenuhr wird aufgebaut','Building the sundial'),74);
/* ---------------- Sonnenuhr am südlichen Strebepfeiler ---------------- */
// Gemalte Stundenlinien: im entzerrten Foto vermessen (Strebenfuß senkrecht unter dem Stabansatz). Sie stimmen auf 0,6° (RMS)
// mit der Sollteilung einer senkrechten Uhr für 53,87° Breite an einer genau nach Süden zeigenden Wand überein: tan θ = cos φ · tan τ.
const SD_PAINT=(function(){ const a=[[6,-90]]; for(let h=7;h<=17;h++) a.push([h,Math.atan(Math.cos(LAT*rad)*Math.tan((h-12)*15*rad))/rad]); a.push([18,90]); return a; })();
const SD={pier:SD_PIER,y:16.0,size:0.9,foot:[0.53,0.215],strut:[0.53,0.90]};
const sdX=PX[SD.pier], sdZ=SD_FACE+0.1;
const sdGroup=new THREE.Group(); sdGroup.position.set(sdX,SD.y,sdZ); scene.add(sdGroup);
const sdCanvas=document.createElement('canvas'); sdCanvas.width=sdCanvas.height=512;
const sdTex=new THREE.CanvasTexture(sdCanvas); sdTex.encoding=THREE.sRGBEncoding; sdTex.anisotropy=maxAniso;
{ const pm=new THREE.MeshStandardMaterial({map:sdTex,roughness:0.85}); pm.clippingPlanes=[cutPlane];
  const plate=new THREE.Mesh(new THREE.PlaneGeometry(SD.size,SD.size),pm); plate.receiveShadow=true; sdGroup.add(plate);
  const fr=new THREE.Mesh(new THREE.BoxGeometry(SD.size+0.12,SD.size+0.12,0.1),darkMat); fr.position.z=-0.055; fr.castShadow=true; sdGroup.add(fr);
  // Kasten aus schwarzem Blech, ringsum bündig (Foto 2026): oben ein etwas tieferes Dachbrett, seitlich helle Halteleisten mit Schrauben
  const W=SD.size+0.12, rim=(w,h,d,x,y,z)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),darkMat); m.position.set(x,y,z); m.castShadow=true; sdGroup.add(m); };
  rim(W,0.04,0.17,0,SD.size/2+0.04,0.08); rim(W,0.04,0.09,0,-SD.size/2-0.04,0.04);
  rim(0.04,SD.size+0.04,0.09,-SD.size/2-0.04,0,0.04); rim(0.04,SD.size+0.04,0.09,SD.size/2+0.04,0,0.04);
  const metal=new THREE.MeshStandardMaterial({color:lin(0x9ea3a6),roughness:0.5,metalness:0.6}); metal.clippingPlanes=[cutPlane];
  for(const sx of [-1,1]){ const st=new THREE.Mesh(new THREE.BoxGeometry(0.075,W*0.92,0.015),metal); st.position.set(sx*(W/2+0.035),0,-0.09); sdGroup.add(st);
    for(let k=0;k<4;k++){ const b=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,0.02,8),darkMat); b.rotation.x=Math.PI/2; b.position.set(sx*(W/2+0.04),(k-1.5)*W*0.26,-0.075); sdGroup.add(b); } } }
const sdLocal=(px,py)=>new V3((px-0.5)*SD.size,(0.5-py)*SD.size,0);
const sdFootL=sdLocal(SD.foot[0],SD.foot[1]), sdStrutL=sdLocal(SD.strut[0],SD.strut[1]);
// Stab: vom Ansatz in der senkrechten Ebene quer zur Platte, 90° − φ gegen die Platte geneigt (richtig für eine Südwand).
// Strebe: steht senkrecht auf der Platte, Fuß mittig unten bei der 12.
const sdStrutLen=sdFootL.distanceTo(sdStrutL)*Math.tan((90-LAT)*rad);
const sdTipL=sdStrutL.clone().add(new V3(0,0,sdStrutLen));
const rodMat=new THREE.MeshStandardMaterial({color:0x2a2622,roughness:0.5,metalness:0.6}); rodMat.clippingPlanes=[cutPlane];
const sdRod=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,1,8),rodMat); sdRod.castShadow=true; sdGroup.add(sdRod);
const sdStrut=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,1,8),rodMat); sdGroup.add(sdStrut);
const shMat=new THREE.MeshBasicMaterial({color:0x151210,transparent:true,opacity:0.72,depthWrite:false}); shMat.clippingPlanes=[cutPlane];
const sdShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),shMat); sdShadow.visible=false; sdGroup.add(sdShadow);
function placeBar(mesh,a,b){ const len=a.distanceTo(b); mesh.scale.set(1,len,1); mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new V3(0,1,0),b.clone().sub(a).normalize()); }
placeBar(sdRod,sdFootL,sdTipL); placeBar(sdStrut,sdStrutL,sdTipL);
// Keil: Die Platte ist um eine senkrechte Achse aus der Wand gedreht, die westliche (linke) Kante steht vor.
// Detailfoto: Kastenkanten waagerecht, Ziegelschichten um ca. 4° steigend -> geschätzt 6–9°, genau nach Süden wären 8,5°.
let sdWedgeMesh=null;
function sdOrient(){
  const psi=state.sdWedge*rad, half=SD.size/2+0.06, wallZ=SD_FACE;
  sdGroup.rotation.y=psi; sdGroup.position.set(sdX,SD.y,wallZ+0.105*Math.cos(psi)+half*Math.sin(psi)); sdGroup.updateMatrixWorld();
  if(sdWedgeMesh){ scene.remove(sdWedgeMesh); sdWedgeMesh.geometry.dispose(); sdWedgeMesh=null; }
  if(psi>0.001){
    const w=(x,y)=>new V3(x,y,-0.105).applyMatrix4(sdGroup.matrixWorld), wp=v=>new V3(v.x,v.y,wallZ);
    const bl=w(-half,-half), tl=w(-half,half), br=w(half,-half), tr=w(half,half);
    const f=[[wp(bl),bl,tl,wp(tl)],[wp(tl),tl,tr,wp(tr)],[wp(bl),bl,br,wp(br)]];
    sdWedgeMesh=new THREE.Mesh(polyGeo(f),darkMat); sdWedgeMesh.castShadow=true; scene.add(sdWedgeMesh);
  }
  const o=$('#sdWedgeOut'); if(o) o.textContent=fmtDeg(state.sdWedge);
  const face=state.axis+90-state.sdWedge; const fo=$('#sdFace'); if(fo) fo.textContent=tr('Zifferblatt zeigt auf ','Dial faces ')+fmtDeg(((face%360)+360)%360)+(Math.abs(face-180)<0.3?tr(' (genau Süd)',' (due south)'):'');
}
const SD_FIELD={x0:0.16,x1:0.875,y0:0.205,y1:0.89};
function fieldHit(th){ const [fx,fy]=SD.foot, dx=Math.sin(th*rad), dy=Math.cos(th*rad); let t=1e9;
  if(dy>1e-6) t=Math.min(t,(SD_FIELD.y1-fy)/dy);
  if(dx>1e-6) t=Math.min(t,(SD_FIELD.x1-fx)/dx); else if(dx<-1e-6) t=Math.min(t,(SD_FIELD.x0-fx)/dx);
  return [fx+dx*t,fy+dy*t]; }
function sdDrawPlate(){
  const g=sdCanvas.getContext('2d'), S=512, r=rng(17);
  g.fillStyle='#3e4c68'; g.fillRect(0,0,S,S);   // schieferblau mit hellen Linien und goldener Sonne (Fotos 2026)
  for(let i=0;i<1400;i++){ g.fillStyle='rgba('+(r()<.5?'30,36,50':'150,165,190')+','+(r()*0.14)+')'; g.fillRect(r()*S,r()*S,2+r()*5,2+r()*4); }
  g.strokeStyle='#e8e5d8'; g.lineWidth=4; g.strokeRect(SD_FIELD.x0*S,SD_FIELD.y0*S,(SD_FIELD.x1-SD_FIELD.x0)*S,(SD_FIELD.y1-SD_FIELD.y0)*S);
  const [fx,fy]=SD.foot;
  g.save(); g.translate(fx*S,fy*S); g.strokeStyle='#efe2a6'; g.lineWidth=4;
  for(let k=0;k<24;k++){ const a=k/24*Math.PI*2; g.beginPath(); g.moveTo(Math.cos(a)*56,Math.sin(a)*56); g.lineTo(Math.cos(a+0.1)*(k%2?80:96),Math.sin(a+0.1)*(k%2?80:96)); g.stroke(); }
  g.fillStyle='#e3bd3c'; g.beginPath(); g.arc(0,0,56,0,Math.PI*2); g.fill(); g.strokeStyle='#7a5a14'; g.stroke();
  g.fillStyle='#7a5a14'; g.beginPath(); g.arc(-18,-10,5,0,7); g.arc(18,-10,5,0,7); g.fill(); g.beginPath(); g.arc(0,14,16,0.2,Math.PI-0.2); g.stroke(); g.restore();
  g.strokeStyle='#ecebe2'; g.lineWidth=5; g.fillStyle='#ecebe2'; g.textAlign='center'; g.textBaseline='middle';
  g.font='700 46px "Alegreya SC", Georgia, serif';
  for(const [h,th] of SD_PAINT){ const hit=fieldHit(th), s0=0.17;
    if(h!==6&&h!==18){ g.beginPath(); g.moveTo((fx+Math.sin(th*rad)*s0)*S,(fy+Math.cos(th*rad)*s0)*S); g.lineTo(hit[0]*S,hit[1]*S); g.stroke(); }
    let lx=hit[0], ly=hit[1];
    if(Math.abs(hit[1]-SD_FIELD.y1)<1e-3) ly+=0.055; else if(th<0) lx-=0.075; else lx+=0.075;
    if(h===6){ lx=0.085; ly=0.27; } if(h===18){ lx=0.93; ly=0.27; }
    g.fillText(String(h>12?h-12:h),lx*S,ly*S); }
  g.font='600 26px "Alegreya SC", Georgia, serif'; g.textAlign='left'; g.fillText('REN',0.05*S,0.1*S); g.textAlign='right'; g.fillText('1968',0.95*S,0.1*S);
  sdTex.needsUpdate=true; dirty=true;
}
function paintedReading(th){ for(let i=0;i<SD_PAINT.length-1;i++){ const a=SD_PAINT[i], b=SD_PAINT[i+1]; if(th>=a[1]&&th<=b[1]) return a[0]+(th-a[1])/(b[1]-a[1])*(b[0]-a[0]); } return null; }
const sd={lit:false,front:false,theta:null,show:null,woz:null,moonCorr:null};
function sdLocalSun(){ return LD.clone().applyQuaternion(sdGroup.quaternion.clone().invert()); }
function sdUpdate(){
  const n=new V3(0,0,1), Ls=sdLocalSun(); sd.front=Ls.dot(n)>0.005&&lightUp();
  sd.moonCorr=useMoon?nrm360(moonCur.ra-moonCur.raSun)/15:null;   // Mondzeit + (α Mond − α Sonne) = wahre Ortszeit
  const s=sunPos(localToUtc(state.y,state.m,state.d,state.minutes)); sd.woz=((12+s.H/15)%24+24)%24;
  if(sd.front){ const off=sdTipL.clone().sub(sdFootL).dot(n)/Ls.dot(n); const T=sdTipL.clone().addScaledVector(Ls,-off);
    const v=T.clone().sub(sdFootL); sd.theta=Math.atan2(v.x,-v.y)/rad; sd.show=paintedReading(sd.theta);
    const dir=v.clone().normalize(), half=SD.size/2-0.01; let tmax=v.length();
    for(const [c,dc] of [[sdFootL.x,dir.x],[sdFootL.y,dir.y]]){ if(dc>1e-6) tmax=Math.min(tmax,(half-c)/dc); else if(dc<-1e-6) tmax=Math.min(tmax,(-half-c)/dc); }
    placeShadow(sdFootL,sdFootL.clone().addScaledVector(dir,tmax));
    sdShadow.visible=sd.lit&&lightStr>0.05; shMat.opacity=useMoon?0.45:0.72;
  } else { sd.theta=null; sd.show=null; sdShadow.visible=false; }
  updateSdReadouts();
}
function placeShadow(a,b){ const len=Math.max(0.001,a.distanceTo(b)); sdShadow.scale.set(0.022,len,1); sdShadow.position.copy(a).add(b).multiplyScalar(0.5); sdShadow.position.z=0.003;
  sdShadow.rotation.set(0,0,Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2); }
function sdUpdateLit(){
  if(!(sdLocalSun().z>0.005&&lightUp())){ sd.lit=false; return; }
  const c=new V3(0,0.1,0.25).applyMatrix4(sdGroup.matrixWorld); rc.set(c,LD);
  sd.lit=!envBlocked(c)&&rc.intersectObjects(occluders,false).length===0;
}
const fmtHM=h=>{ if(h===null||h===undefined) return '–'; let m=Math.round(h*60); m=((m%1440)+1440)%1440; return pad2(Math.floor(m/60))+':'+pad2(m%60); };
function fmtDiff(min){ const s=min<0?'−':'+'; const a=Math.round(Math.abs(min)); return s+(a>=60?Math.floor(a/60)+' h '+pad2(a%60):a)+' min'; }
function fmtDur(hh){ const m=Math.round(hh*60); return (m>=60?Math.floor(m/60)+' h ':'')+pad2(m%60)+' min'; }
function moonAge(utc){ const ln=(day.nm1!==null&&day.nm1<=utc)?day.nm1:day.nm0; return ln?(utc-ln)/86400000:null; }
function updateSdReadouts(){
  const utc=localToUtc(state.y,state.m,state.d,state.minutes), clockH=state.minutes/60, tz=tzN(berlinOffsetMin(utc));
  $('#sdClock').textContent=fmtT(state.minutes)+' '+tz;
  const mm=useMoon;
  $('#sdShowLbl').textContent=mm?tr('Mondschatten zeigt','Moon shadow shows'):tr('Sonnenuhr zeigt','Sundial shows');
  $('#sdDiffLbl').textContent=mm?tr('Korrektur (Mondalter)','Correction (moon age)'):tr('gegenüber Uhrzeit','vs. clock time');
  $('#sdErrLbl').textContent=mm?tr('korrigiert','corrected'):tr('Ablesefehler','Reading error');
  $('#sdWoz').textContent=(cur.el>0||mm)?fmtHM(sd.woz):'–';
  const ok=sd.show!==null&&sd.lit;
  $('#sdShow').textContent=ok?fmtHM(sd.show):'–';
  if(mm){ $('#sdDiff').textContent=ok?'+'+fmtDur(sd.moonCorr):'–'; $('#sdErr').textContent=ok?fmtHM(sd.show+sd.moonCorr):'–'; }
  else { $('#sdDiff').textContent=ok?fmtDiff((sd.show-clockH)*60):'–'; $('#sdErr').textContent=ok?fmtDiff((sd.show-sd.woz)*60):'–'; }
  let st;
  if(mm){ const age=moonAge(utc);
    if(!sd.front) st=tr('Der Mond steht hinter der Wand, das Zifferblatt liegt im Dunkeln.','The moon is behind the wall; the dial is in the dark.');
    else if(!sd.lit) st=tr('Das Zifferblatt liegt im Mondschatten der Umgebung oder der Kirche.','The dial lies in the moon shadow of the surroundings or the church.');
    else { let e=((sd.show+sd.moonCorr-sd.woz)%24+24)%24; if(e>12) e-=24; const ag=age!==null?dc(age.toFixed(1)):'–';
      st=LANG==='en'
        ?'Moon shadow: the dial shows lunar time. The moon is '+ag+' days old and lags the sun by '+fmtDur(sd.moonCorr)+(age!==null?' (rule of thumb 48 min per day: '+fmtDur(age*0.8)+')':'')+(Math.abs(e*60)<1?'. The corrected reading matches apparent solar time.':'. The corrected reading is off by '+fmtDiff(e*60)+' from apparent solar time.')
        :'Mondschatten: Die Uhr zeigt die Mondzeit. Der Mond ist '+ag+' Tage alt und steht '+fmtDur(sd.moonCorr)+' hinter der Sonne zurück'
        +(age!==null?' (Faustregel 48 min pro Tag: '+fmtDur(age*0.8)+')':'')+(Math.abs(e*60)<1?'. Die korrigierte Ablesung stimmt mit der wahren Ortszeit überein.':'. Die korrigierte Ablesung weicht '+fmtDiff(e*60).replace('+','um +').replace('−','um −')+' von der wahren Ortszeit ab.'); } }
  else if(cur.el<=0) st=tr('Die Sonne ist untergegangen.','The sun has set.')+(state.moon&&moonCur&&moonCur.el>0?(moonCur.k<0.25?tr(' Der Mond gibt zu wenig Licht für einen Schatten.',' The moon gives too little light for a shadow.'):tr(' Der Mond gibt noch kein Licht für einen Schatten.',' The moon does not yet give enough light for a shadow.')):'');
  else if(!sd.front) st=tr('Die Sonne steht hinter der Wand, das Zifferblatt liegt im Schatten.','The sun is behind the wall; the dial is in shade.');
  else if(!sd.lit) st=tr('Das Zifferblatt liegt im Schatten der Umgebung oder der Kirche.','The dial lies in the shadow of the surroundings or the church.');
  else st=tr('Das Zifferblatt ist besonnt.','The dial is in sunshine.');
  $('#sdState').textContent=st;
  const m=$('#yNow'); if(m){ const nx=YX(dayOfYear()); m.setAttribute('x1',nx); m.setAttribute('x2',nx); }
}
const YX=d=>10+d/365*278;
function dayOfYear(){ return (Date.UTC(state.y,state.m,state.d)-Date.UTC(state.y,0,1))/86400000; }
function drawYearChart(){
  const el=$('#sdChart'); const lo=-6, hi=36, yv=m=>8+(hi-m)/(hi-lo)*68;
  const pts=[]; let mn=1e9,mx=-1e9;
  for(let d=0;d<366;d+=2){ const s=sunPos(Date.UTC(state.y,0,1)+d*86400000+11*3600000); const noon=-s.H/15*60; pts.push(YX(d).toFixed(1)+','+yv(noon).toFixed(1)); mn=Math.min(mn,noon); mx=Math.max(mx,noon); }
  let h='';
  for(const [m,t] of [[0,'12:00'],[17.3,'12:17'],[30,'12:30']]) h+='<line class="grid" x1="10" x2="288" y1="'+yv(m)+'" y2="'+yv(m)+'"/><text x="292" y="'+(yv(m)+3)+'">'+t+'</text>';
  const mon=['J','F','M','A','M','J','J','A','S','O','N','D'];
  for(let k=0;k<12;k++){ const d=(Date.UTC(state.y,k,15)-Date.UTC(state.y,0,1))/86400000; h+='<text x="'+YX(d)+'" y="90" text-anchor="middle">'+mon[k]+'</text>'; }
  h+='<polyline class="curve" points="'+pts.join(' ')+'"/><line class="now" id="yNow" x1="0" x2="0" y1="6" y2="78"/>';
  el.innerHTML=h;
  $('#sdRange').textContent=tr('Bei richtiger Ausrichtung steht der Schatten im Jahr '+state.y+' zwischen '+fmtHM(12+mn/60)+' und '+fmtHM(12+mx/60)+' MEZ auf der 12, in der Sommerzeit eine Stunde später.','With correct alignment the shadow falls on the 12 between '+fmtHM(12+mn/60)+' and '+fmtHM(12+mx/60)+' CET in '+state.y+', an hour later in summer time.');
}

/* ---------------- Licht & Himmel ---------------- */
const SC=new V3(7,25,0);
const sun=new THREE.DirectionalLight(0xffffff,3);
const smSize=Math.min(lowEnd?1024:coarse?2048:4096,renderer.capabilities.maxTextureSize);
sun.castShadow=true; sun.shadow.mapSize.set(smSize,smSize);
Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:800});
sun.shadow.bias=-0.0003; sun.shadow.normalBias=0.05; sun.shadow.camera.updateProjectionMatrix();
scene.add(sun); scene.add(sun.target);
const hemi=new THREE.HemisphereLight(0xbcd4ee,0x6a5848,0.6); scene.add(hemi);
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{uL:{value:L},uZen:{value:new THREE.Color()},uHor:{value:new THREE.Color()},uGnd:{value:new THREE.Color()},uSun:{value:new THREE.Color()},uVis:{value:1},uOcc:{value:new V3(0,1,0)},uOccC:{value:1},uEcl:{value:0},uGlow:{value:1}},
  vertexShader:'varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`uniform vec3 uL,uZen,uHor,uGnd,uSun,uOcc; uniform float uVis,uOccC,uEcl,uGlow; varying vec3 vD;
  void main(){ vec3 d=normalize(vD); float h=d.y; vec3 c= h>0.0 ? mix(uHor,uZen,pow(h,0.5)) : mix(uHor,uGnd,pow(min(-h*5.0,1.0),0.5));
    float s=max(dot(d,normalize(uL)),0.0);
    c+=uSun*(pow(s,10.0)*0.28+pow(s,300.0)*0.7)*uVis*step(-0.02,h)*uGlow;
    float occ=uEcl*smoothstep(uOccC-0.000004,uOccC+0.000004,dot(d,uOcc));   // Sonnenfinsternis: dunkle Mondscheibe vor der Sonne
    c=mix(c,vec3(1.0,0.97,0.88),smoothstep(0.99982,0.99992,s)*uVis*(1.0-occ));
    gl_FragColor=vec4(c,1.0); }`});
const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,48,24),skyMat); sky.frustumCulled=false; sky.renderOrder=-10; scene.add(sky);
const SUN_MAG=Math.acos(0.99987)/rad/0.2667;   // die Sonnenscheibe ist vergrößert gezeichnet; bei Finsternissen wird der Mond im selben Maßstab davorgesetzt
const SKY_KEYS=[[-18,'#04060d','#0a0f1c'],[-6,'#101a36','#3a3550'],[-1,'#26386a','#d9845a'],[3,'#2f4f8e','#f0a86e'],[9,'#3b66ae','#efcfa4'],[22,'#3f78c8','#b8d0e8'],[70,'#3570c2','#c6daee']];
const ca=new THREE.Color(), cb=new THREE.Color();
function skyAt(el,idx,out){ let i=0; while(i<SKY_KEYS.length-1&&el>SKY_KEYS[i+1][0]) i++; const a=SKY_KEYS[i], b=SKY_KEYS[Math.min(i+1,SKY_KEYS.length-1)];
  const t=b[0]===a[0]?0:clamp01((el-a[0])/(b[0]-a[0])); ca.set(a[idx]); cb.set(b[idx]); return out.copy(ca).lerp(cb,t); }
// Mond am Himmel: Scheibe, die zur Kamera zeigt; die Lichtgrenze ergibt sich aus der Sonnenrichtung (beleuchtete Halbkugel),
// die Mare-Zeichnung ist nach dem Himmelsnordpol ausgerichtet. Dargestellt 2,2-fach vergrößert, damit er sichtbar bleibt.
let MOON_MAG=2.2; const SKY_R=1800;   // Assistent »Mond zwischen den Türmen«: Kameraansicht in wahrer Größe
const moonTex=canvasTex(256,256,(g,w,h)=>{
  const r=rng(91); g.fillStyle='#000'; g.fillRect(0,0,w,h);
  g.save(); g.beginPath(); g.arc(128,128,127,0,7); g.clip();
  g.fillStyle='#cfccc5'; g.fillRect(0,0,w,h);
  for(let i=0;i<2600;i++){ const v=r(); g.fillStyle='rgba('+(v<.5?'150,146,140':'235,232,226')+','+(r()*0.18)+')'; const s=1+r()*4; g.fillRect(r()*w,r()*h,s,s); }
  // Maria (dunkle Ebenen), Lage wie von der Nordhalbkugel gesehen: Norden oben, Mare Crisium rechts
  const P=(x,y)=>[128+x*124,128-y*124];
  const mare=(x,y,rx,ry,rot)=>{ const [cx,cy]=P(x,y); g.save(); g.translate(cx,cy); g.rotate(rot||0);
    for(let k=0;k<5;k++){ g.fillStyle='rgba(112,110,108,'+(0.22+k*0.08)+')'; g.beginPath(); g.ellipse((r()-0.5)*6,(r()-0.5)*6,rx*124*(1-k*0.12),ry*124*(1-k*0.12),0,0,7); g.fill(); } g.restore(); };
  mare(0.70,0.30,0.11,0.09); mare(0.56,-0.10,0.12,0.16,0.3); mare(0.36,0.14,0.17,0.15); mare(0.27,0.42,0.14,0.13);
  mare(-0.22,0.52,0.24,0.20); mare(0.0,0.78,0.42,0.07); mare(0.44,-0.27,0.08,0.08); mare(-0.14,-0.36,0.17,0.14);
  mare(-0.45,-0.42,0.09,0.09); mare(-0.58,0.12,0.24,0.40,0.15); mare(0.05,0.23,0.08,0.06); mare(-0.70,-0.05,0.10,0.18);
  // Krater und Strahlen von Tycho und Kopernikus
  for(let i=0;i<70;i++){ const a=r()*7, d=Math.sqrt(r())*0.92, [cx,cy]=P(Math.cos(a)*d,Math.sin(a)*d), s=1.5+r()*5;
    g.strokeStyle='rgba(90,88,86,.35)'; g.lineWidth=1; g.beginPath(); g.arc(cx,cy,s,0,7); g.stroke(); g.fillStyle='rgba(245,243,238,.25)'; g.beginPath(); g.arc(cx-s*0.3,cy-s*0.3,s*0.5,0,7); g.fill(); }
  for(const [x,y,n,l] of [[-0.12,-0.70,26,0.9],[-0.30,0.25,14,0.35]]){ const [cx,cy]=P(x,y);
    g.strokeStyle='rgba(250,248,242,.22)'; g.lineWidth=1.6; for(let k=0;k<n;k++){ const a=k/n*7+r()*0.2; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.cos(a)*l*124*(0.5+r()*0.5),cy+Math.sin(a)*l*124*(0.5+r()*0.5)); g.stroke(); }
    g.fillStyle='#f6f4ee'; g.beginPath(); g.arc(cx,cy,4,0,7); g.fill(); }
  g.restore();
},null);
const moonMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending,
  uniforms:{uTex:{value:moonTex},uSun:{value:new V3(0,1,0)},uX:{value:new V3(1,0,0)},uY:{value:new V3(0,1,0)},uZ:{value:new V3(0,0,1)},uDay:{value:0},uLow:{value:0},uShC:{value:new THREE.Vector2()},uShU:{value:0},uShP:{value:0},uShOn:{value:0}},
  vertexShader:'varying vec2 vP; void main(){ vP=position.xy*2.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`uniform sampler2D uTex; uniform vec3 uSun,uX,uY,uZ; uniform float uDay,uLow,uShU,uShP,uShOn; uniform vec2 uShC; varying vec2 vP;
  void main(){ float r2=dot(vP,vP); if(r2>1.0) discard;
    vec3 n=normalize(vP.x*uX+vP.y*uY+sqrt(1.0-r2)*uZ);
    float l=smoothstep(-0.02,0.05,dot(n,normalize(uSun)));
    vec3 t=texture2D(uTex,vP*0.5+0.5).rgb*mix(vec3(1.0),vec3(1.0,0.74,0.52),uLow);
    vec3 c=t*(l*1.08+0.03*(1.0-uDay));                           // 0,03: Erdschein auf der Nachtseite
    if(uShOn>0.5){ float dd=length(vP-uShC);   // Erdschatten in Mondradien: Halbschatten dunkelt zum Kernschatten hin, im Kernschatten kupferrot
      float pen=smoothstep(uShU,uShP,dd); vec3 cp=c*(0.32+0.68*pen*pen);
      float deep=clamp((uShU-dd)/max(uShU,0.01),0.0,1.0); vec3 cu=t*mix(vec3(0.62,0.2,0.08)*0.5,vec3(0.35,0.08,0.03)*0.3,deep);
      c=mix(cp,cu,1.0-smoothstep(uShU-0.05,uShU+0.03,dd)); }
    float a=mix(1.0,0.75,uDay)*smoothstep(1.0,0.94,r2);   // additiv: die Nachtseite lässt den Himmel durch
    gl_FragColor=vec4(c*a,1.0); }`});
const moonMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),moonMat); moonMesh.matrixAutoUpdate=false; moonMesh.frustumCulled=false; moonMesh.renderOrder=-8; moonMesh.visible=false; scene.add(moonMesh);
const LM=new V3(0,-1,0), NCP=new V3(), mX=new V3(), mY=new V3(), mZ=new V3(), mM=new THREE.Matrix4();
function placeMoonAt(){ placeMoon(); }   // die Scheibe zeigt ohnehin zum Standpunkt (Normale = Richtung zur Kamera)
function placeMoon(){   // jedes Bild: Mond in fester Entfernung vor der Kamera wie der Himmel
  if(!moonMesh.visible) return;
  sunVec(LAT,0,NCP); mZ.copy(LM).negate(); mY.copy(NCP).addScaledVector(LM,-NCP.dot(LM)).normalize(); mX.crossVectors(mY,mZ);
  const s=2*SKY_R*Math.tan(moonCur.semi*rad)*MOON_MAG;
  mM.makeBasis(mX.clone().multiplyScalar(s),mY.clone().multiplyScalar(s),mZ.clone()); mM.setPosition(camera.position.clone().addScaledVector(LM,SKY_R));
  moonMesh.matrix.copy(mM); moonMesh.matrixWorldNeedsUpdate=true;
  moonMat.uniforms.uX.value.copy(mX); moonMat.uniforms.uY.value.copy(mY); moonMat.uniforms.uZ.value.copy(mZ);
  const on=!!(eclL&&eclL.pmag>-0.05); moonMat.uniforms.uShOn.value=on?1:0;
  if(on){ const cx=eclLW.dot(mX), cy=eclLW.dot(mY), n=Math.hypot(cx,cy)||1, k=eclL.sep/eclL.sm; moonMat.uniforms.uShC.value.set(cx/n*k,cy/n*k);
    moonMat.uniforms.uShU.value=eclL.ru/eclL.sm; moonMat.uniforms.uShP.value=eclL.rp/eclL.sm; }
}
// Die hellsten Sterne (Position J2000, Helligkeit), auf das Datum präzediert
const STARS=[[101.287,-16.716,-1.46],[213.915,19.182,-0.05],[279.234,38.784,0.03],[79.172,45.998,0.08],[78.634,-8.202,0.13],[114.826,5.225,0.34],
  [88.793,7.407,0.5],[297.696,8.868,0.77],[68.980,16.509,0.87],[247.352,-26.432,1.06],[201.298,-11.161,0.98],[116.329,28.026,1.14],[344.413,-29.622,1.16],
  [310.358,45.280,1.25],[152.093,11.967,1.36],[104.656,-28.972,1.5],[113.650,31.888,1.58],[263.402,-37.104,1.62],[81.283,6.350,1.64],[81.573,28.608,1.65],
  [84.053,-1.202,1.69],[85.190,-1.943,1.77],[193.507,55.960,1.77],[51.081,49.861,1.79],[165.932,61.751,1.79],[107.098,-26.393,1.83],[206.885,49.313,1.86],
  [89.882,44.948,1.9],[99.428,16.399,1.93],[37.955,89.264,1.98],[95.675,-17.956,1.98],[141.897,-8.659,1.98],[31.793,23.462,2.0],[154.993,19.842,2.08],
  [283.816,-26.297,2.05],[2.097,29.090,2.06],[17.433,35.621,2.05],[86.939,-9.670,2.07],[222.676,74.156,2.08],[263.734,12.560,2.08],[47.042,40.956,2.1],
  [30.975,42.330,2.1],[177.265,14.572,2.14],[14.177,60.717,2.15],[233.672,26.715,2.23],[83.002,-0.299,2.23],[305.557,40.257,2.23],[10.127,56.537,2.24],
  [269.152,51.489,2.24],[2.295,59.150,2.28],[165.460,56.383,2.37],[326.046,9.875,2.39],[345.944,28.083,2.42],[178.458,53.695,2.44],[346.190,15.205,2.48],
  [21.454,60.235,2.68],[3.309,15.184,2.83],[183.857,57.033,3.31],[200.981,54.925,2.23],[292.680,27.960,3.05],[28.599,63.670,3.37],[45.570,4.090,2.53],
  [168.527,20.524,2.56],[236.067,6.426,2.63],[195.544,10.959,2.83],[83.183,-17.822,2.58]];
const starGeo=new THREE.BufferGeometry();
starGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(STARS.length*3),3));
starGeo.setAttribute('aMag',new THREE.BufferAttribute(new Float32Array(STARS.map(s=>s[2])),1));
starGeo.setAttribute('aVis',new THREE.BufferAttribute(new Float32Array(STARS.length),1));
const starMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,uniforms:{uA:{value:0},uPR:{value:renderer.getPixelRatio()}},
  vertexShader:'attribute float aMag; attribute float aVis; uniform float uA,uPR; varying float vA; void main(){ vA=aVis*uA*clamp(1.12-0.26*aMag,0.25,1.0); gl_PointSize=uPR*clamp(4.4-0.85*aMag,1.7,5.6); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:'varying float vA; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5||vA<0.004) discard; gl_FragColor=vec4(vec3(1.0,0.97,0.92),vA*smoothstep(0.5,0.12,d)); }'});
const stars=new THREE.Points(starGeo,starMat); stars.frustumCulled=false; stars.renderOrder=-9; scene.add(stars);
function updateStars(ms){
  const pa=starGeo.attributes.position, va=starGeo.attributes.aVis, lst=lstDeg(ms), T=(ms/86400000+2440587.5-2451545)/36525;
  const e=23.4393*rad, dl=1.3969713*T;   // allgemeine Präzession in Länge
  for(let i=0;i<STARS.length;i++){ const ra=STARS[i][0]*rad, de=STARS[i][1]*rad;
    const lam=Math.atan2(Math.sin(ra)*Math.cos(e)+Math.tan(de)*Math.sin(e),Math.cos(ra))/rad+dl, bet=Math.asin(Math.sin(de)*Math.cos(e)-Math.cos(de)*Math.sin(e)*Math.sin(ra))/rad;
    const q=eclToEqu(lam,bet,0), hz=horiz(lst-q.ra,q.dec), el=refract(hz.el);
    sunVec(el,hz.az,tmpS).multiplyScalar(SKY_R+80); pa.setXYZ(i,tmpS.x,tmpS.y,tmpS.z); va.setX(i,el>0.5?1:0); }
  pa.needsUpdate=true; va.needsUpdate=true; }
const tmpS=new V3();

// Bahnen von Sonne (gold) und Mond (silbern, gestrichelt) am Himmel. Die Gruppe wandert mit der Kamera wie der Himmel,
// die Bahnen liegen also „im Unendlichen“ und sind von jedem Standpunkt aus richtig.
const pathGroup=new THREE.Group(); scene.add(pathGroup);
const PATH_R=1500;
const spriteCache={};
function hourSprite(h,moon){ const key=(moon?'m':'s')+h; if(!spriteCache[key]){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  g.font='600 30px "IBM Plex Mono", monospace'; g.textAlign='center'; g.textBaseline='middle'; g.lineWidth=5; g.strokeStyle='rgba(20,16,12,.75)'; g.strokeText(String(h),32,33); g.fillStyle=moon?'#dfe6f2':'#ffe2a0'; g.fillText(String(h),32,33);
  const t=new THREE.CanvasTexture(c); spriteCache[key]=new THREE.SpriteMaterial({map:t,fog:false,depthWrite:false,transparent:true}); } return spriteCache[key]; }
const lineMat=new THREE.LineBasicMaterial({color:0xffd27a,fog:false,transparent:true,opacity:0.85});
const moonLineMat=new THREE.LineDashedMaterial({color:0xcfd8e8,fog:false,transparent:true,opacity:0.8,dashSize:14,gapSize:10});
const tmpV=new V3();
// Lauf des Mondes, der zur eingestellten Zeit am Himmel steht (Aufgang bis Untergang); steht er unter dem Horizont, der nächste Lauf.
// So entsteht keine Lücke bei Mitternacht (der Mond geht jeden Tag rund 50 min später auf). from = ab wann dieser Lauf gilt.
let moonPass=null;
function computeMoonPass(t){ const st=4*60000, up=x=>moonPos(x).el>-0.5;
  const runTo=(a,dir)=>{ for(let i=0;i<480;i++){ if(!up(a+dir*st)) return a; a+=dir*st; } return a; };
  if(up(t)){ const a=runTo(t,-1); return {t0:a,t1:runTo(t,1),from:a}; }
  let n=t, ok=false; for(let i=0;i<480;i++){ n+=st; if(up(n)){ ok=true; break; } } if(!ok) return null;
  let p=t; for(let i=0;i<480;i++){ if(up(p-st)) break; p-=st; }
  return {t0:n,t1:runTo(n,1),from:p}; }
function curMoonPass(){ const t=localToUtc(state.y,state.m,state.d,state.minutes); if(!moonPass||t>moonPass.t1||t<moonPass.from) moonPass=computeMoonPass(t); return moonPass; }
const hourOf=u=>new Date(u+berlinOffsetMin(u)*60000).getUTCHours();
function buildSunPath(){
  while(pathGroup.children.length){ const c=pathGroup.children.pop(); if(c.geometry) c.geometry.dispose(); }
  const R=PATH_R, ss=PATH_R/700*34;
  const D0=localToUtc(state.y,state.m,state.d,0), D1=localToUtc(state.y,state.m,state.d,1440);
  function arc(pos,mat,t0,t1){ let seg=[];
    const flush=()=>{ if(seg.length>1){ const g=new THREE.BufferGeometry().setFromPoints(seg); const l=new THREE.Line(g,mat); if(mat.isLineDashedMaterial) l.computeLineDistances(); l.frustumCulled=false; pathGroup.add(l); } seg=[]; };
    for(let t=t0;t<=t1+1;t+=360000){ const s=pos(Math.min(t,t1)); if(s.el>-0.5) seg.push(sunVec(s.el,s.az,new V3()).multiplyScalar(R)); else flush(); }
    flush(); }
  function labels(pos,moon,t0,t1){ for(let u=Math.ceil((t0+1)/3600000)*3600000;u<t1;u+=3600000){ const hh=hourOf(u), s=pos(u); if(s.el>1.5){ const sp=new THREE.Sprite(hourSprite(hh,moon)); sunVec(s.el,s.az,sp.position).multiplyScalar(R*0.985); sp.scale.set(ss*(moon?0.85:1),ss*(moon?0.85:1),1); sp.frustumCulled=false; pathGroup.add(sp); } } }
  if(state.sunPath){ arc(sunPos,lineMat,D0,D1); labels(sunPos,false,D0,D1); }
  if(state.moonPath&&state.moon){ const mp=curMoonPass(); if(mp){ arc(moonPos,moonLineMat,mp.t0,mp.t1); labels(moonPos,true,mp.t0-1,mp.t1+1); } }
  dirty=true;
}
/* ---------------- Fenster-Update: Besonnung, Verschattung, Lichtbahnen ---------------- */
const rc=new THREE.Raycaster(); rc.far=260;
let sunStr=0, litCount=0, eclS=null, eclObsc=0, eclL=null, eclLB=1; const eclLW=new V3(), eclTmp=new V3();
function updateWindows(){
  scene.updateMatrixWorld();
  const up=useMoon?moonCur.el>0.3:cur.el>0.15, skyLum=0.1+1.05*smooth(-6,18,cur.el), d=LD.clone().negate(), sc=sun.color; litCount=0;
  for(const w of windows){
    const facing=Math.max(0,w.outN.dot(LD)); let lit=0;
    if(up&&facing>0.01){ let ok=0; for(const o of w.occ){ rc.set(o,LD); if(!envBlocked(o)&&rc.intersectObjects(occluders,false).length===0) ok++; } lit=ok/w.occ.length; }
    const direct=lightStr*facing*lit; w.lit=direct;
    if(direct>0.02) litCount++;
    const b=skyLum*0.75+direct*2.4;
    w.paneIn.material.color.setRGB(b*(0.8+0.2*sc.r),b*(0.8+0.2*sc.g),b*(0.8+0.2*sc.b));
    if(w.med) w.med.material.color.copy(w.paneIn.material.color);
    if(state.beams&&direct>0.015){
      const C=w.center; let t=d.y<-1e-3?C.y/(-d.y):200;
      const bx0=Math.min(XW+0.6,C.x), bx1=Math.max(50.5,C.x), bz0=Math.min(-25.5,C.z), bz1=Math.max(29.2,C.z);
      if(d.x>1e-4) t=Math.min(t,(bx1-C.x)/d.x); else if(d.x<-1e-4) t=Math.min(t,(bx0-C.x)/d.x);
      if(d.z>1e-4) t=Math.min(t,(bz1-C.z)/d.z); else if(d.z<-1e-4) t=Math.min(t,(bz0-C.z)/d.z);
      t=Math.max(1.5,Math.min(t,140));
      const pa=w.beam.geometry.attributes.position, N=w.ptsIn.length;
      for(let i=0;i<N;i++){ const p=w.ptsIn[i]; pa.setXYZ(i,p.x,p.y,p.z); pa.setXYZ(N+i,p.x+d.x*t,p.y+d.y*t,p.z+d.z*t); }
      pa.needsUpdate=true;
      w.beam.material.uniforms.uI.value=direct*(w.type>=0?0.07:0.038);
      if(w.type<0) w.beam.material.uniforms.uColor.value.setRGB(sc.r,sc.g*0.95,sc.b*0.85);
      w.beam.visible=true;
    } else w.beam.visible=false;
  }
  sdUpdateLit();
}

/* ---------------- Sonne anwenden ---------------- */
let lastWin=0;
function updateSun(forceWindows){
  const utc=localToUtc(state.y,state.m,state.d,state.minutes);
  if(moonPass&&state.moon&&state.moonPath&&(utc>moonPass.t1||utc<moonPass.from)){ moonPass=null; buildSunPath(); if(state.pano) drawPanoGrid(); }
  const s=sunPos(utc); cur.el=s.el; cur.az=s.az; sunVec(s.el,s.az,L);
  sunStr=smooth(-0.8,5,s.el);
  eclS=solarEclipseAt(utc); eclObsc=(eclS&&eclS.cover>0&&s.el>-1.5)?eclS.cover:0; sunStr*=1-eclObsc;   // Sonnenfinsternis: Licht nach bedeckter Fläche
  // Mond: übernimmt nachts die Lichtquelle (mit Schatten). Echtes Mondlicht ist ~400 000-mal schwächer als die Sonne,
  // hier wird es wie beim „Day for Night“ angehoben: Stärke nach beleuchtetem Anteil, Mondhöhe und Dunkelheit.
  const mp=moonPos(utc); moonCur=mp; sunVec(mp.el,mp.az,LM);
  const night=1-smooth(-7,-1.5,s.el);
  moonStr=state.moon?0.55*smooth(-0.6,6,mp.el)*Math.pow(mp.k,1.4)*night:0;
  eclL=lunarEclipseAt(utc); eclLB=1;   // Mondfinsternis: Halbschatten dämpft leicht, im Kernschatten bleibt ein schwaches rotes Licht
  if(eclL&&eclL.pmag>-0.05){ if(eclL.pmag>0){ eclLB=(1-eclL.uCover)*(1-0.5*eclL.pCover*clamp01(eclL.pmag))+eclL.uCover*0.02; moonStr*=eclLB; }
    const m=moonEcl(utc), sa=sunPrecise(utc), qm=eclToEqu(m.lam,m.beta,m.T), qa=eclToEqu(nrm360(sa.lam+180),0,sa.T), lst=lstDeg(utc);
    const hm=horiz(nrm360(lst-qm.ra+180)-180,qm.dec), ha=horiz(nrm360(lst-qa.ra+180)-180,qa.dec); sunVec(ha.el,ha.az,eclLW).sub(sunVec(hm.el,hm.az,eclTmp)); }
  useMoon=sunStr<0.002&&moonStr>0.001;
  LD.copy(useMoon?LM:L); lightStr=useMoon?moonStr:sunStr;
  const warm=smooth(0,28,s.el), sunCol=new THREE.Color(1,0.6+0.36*warm,0.36+0.54*warm);
  if(useMoon){ sun.color.setRGB(0.5,0.62,1.0); if(eclL&&eclL.uCover>0) sun.color.lerp(new THREE.Color(1.0,0.45,0.3),eclL.uCover); sun.intensity=0.5*moonStr; } else { sun.color.copy(sunCol); sun.intensity=3.1*sunStr; }
  sun.position.copy(SC).addScaledVector(LD,400); sun.target.position.copy(SC); sun.target.updateMatrixWorld();
  const z=skyAt(s.el,1,new THREE.Color()), h=skyAt(s.el,2,new THREE.Color());
  if(state.moon){ const mb=Math.min(0.75,moonStr*1.35); z.lerp(new THREE.Color(0x1a2848),mb*night); h.lerp(new THREE.Color(0x34405e),mb*night); }
  if(eclObsc>0){ const kq=1-0.8*smooth(0.45,1,eclObsc); z.multiplyScalar(kq); h.multiplyScalar(kq); }   // Himmel dunkelt bei großer Bedeckung ab
  skyMat.uniforms.uGlow.value=1-eclObsc; skyMat.uniforms.uEcl.value=0;
  if(eclObsc>0){ const vS=sunVec(eclS.sunEl,eclS.sunAz,new V3()), w=sunVec(eclS.moonEl,eclS.moonAz,new V3()).sub(vS); w.addScaledVector(vS,-w.dot(vS));
    skyMat.uniforms.uOcc.value.copy(L).addScaledVector(w,SUN_MAG).normalize(); skyMat.uniforms.uOccC.value=Math.cos(SUN_MAG*eclS.rm*rad); skyMat.uniforms.uEcl.value=1; }
  moonMesh.visible=state.moon&&mp.el>-1.5;
  moonMat.uniforms.uSun.value.copy(L); moonMat.uniforms.uDay.value=smooth(-8,-1,s.el); moonMat.uniforms.uLow.value=1-smooth(1,14,mp.el);
  starMat.uniforms.uA.value=state.moon?(1-smooth(-12,-4,s.el))*(1-0.45*mp.k*smooth(0,10,mp.el)):0; stars.visible=state.moon;
  if(starMat.uniforms.uA.value>0) updateStars(utc);
  renderer.toneMappingExposure=state.exp*(1+0.15*night*(state.moon?1:0));
  skyMat.uniforms.uZen.value.copy(z); skyMat.uniforms.uHor.value.copy(h);
  skyMat.uniforms.uGnd.value.copy(h).multiplyScalar(0.28).lerp(new THREE.Color(0x2c2b28),0.5*smooth(-6,10,s.el));
  skyMat.uniforms.uSun.value.copy(sunCol); skyMat.uniforms.uVis.value=smooth(-2.5,0.5,s.el);
  scene.fog.color.copy(h);
  hemi.intensity=(0.06+0.6*smooth(-8,25,s.el))*(1-0.75*eclObsc)+0.08*moonStr;
  hemi.color.copy(z).lerp(new THREE.Color(0xffffff),0.45); hemi.groundColor.set(0x6a5848);
  TINT.uSunL.value.copy(LD);
  const now=performance.now();
  if(forceWindows||!state.playing||now-lastWin>110){ updateWindows(); lastWin=now; }
  sdUpdate();
  clockUpdate(utc);
  updateReadouts();
  dirty=true;
}

/* ---------------- Kamera & Steuerung ---------------- */
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.enableKeys=false; controls.dampingFactor=0.09; controls.screenSpacePanning=false;
let dirty=true, tween=null;
controls.addEventListener('change',()=>{dirty=true;});
const DR_EYE=HR+2.4+1.65;   // Augenhöhe in der Laterne des Dachreiters (Galerieboden 52,0 m, 2,4 m über dem First, nach Fotos)
const VIEWS={
  aussen:{pos:[128,74,152],tgt:[2,24,0],mode:'orbit',cut:60,exp:0.85},
  westseite:{pos:[-165,52,0],tgt:[-50,70,0],mode:'orbit',cut:60,exp:0.85},
  sued:{pos:[-92,60,150],tgt:[-4,40,0],mode:'orbit',cut:60,exp:0.85},   // etwa vom Petriturm
  chorost:{pos:[150,118,6],tgt:[-6,34,0],mode:'orbit',cut:60,exp:0.85},
  nord:{pos:[75,120,-150],tgt:[-6,30,0],mode:'orbit',cut:60,exp:0.85},
  tuermeost:{pos:[-2,57,0.5],tgt:[-44,73,0],mode:'orbit',cut:60,exp:0.85,minD:1},
  luft:{pos:[-120,190,150],tgt:[-4,20,0],mode:'orbit',cut:60,exp:0.85},
  himmel:{pos:[0,140,-170],dir:[0,0,1],mode:'pano',cut:60,exp:1.0},
  dachreiter:{pos:[10.72,DR_EYE,0.0],dir:[-1,0.1,0],mode:'inside',cut:60,exp:0.85,walk:{cx:11.9,cz:0,rMin:0.62,rMax:1.28,y:DR_EYE}},
  puppe:{pos:[48,92,86],tgt:[2,0,2],mode:'orbit',cut:13.5,exp:1.0},
  schiff:{pos:[-46,1.7,0],dir:[1,0.2,0],mode:'inside',cut:60,exp:1.8},
  chor:{pos:[21,1.7,0],dir:[1,0.2,0],mode:'inside',cut:60,exp:1.8},
  westen:{pos:[22,1.7,0],dir:[-1,0.3,0],mode:'inside',cut:60,exp:1.8},
  brief:{pos:[-23.9,1.6,24.6],dir:[-1,0.62,-0.1],mode:'inside',cut:60,exp:1.8,fov:72},
  totentanz:{pos:[8.2,1.6,-18.1],dir:[0,0.47,-1],mode:'inside',cut:60,exp:1.8,fov:80},
  totenkopf:{pos:[6.2,1.7,-17.2],dir:[-0.13,0.27,-1],mode:'inside',cut:60,exp:1.8,fov:62},   // Quiz-Tipp: Nordportal mit Lüpertz-Oberlicht, auch im Hochformat
  uhr:{pos:[2.5,1.6,CLK.z],tgt:[CLK.x,6.1,CLK.z],mode:'orbit',cut:60,exp:1.8,minD:0.8},
  uhrblatt:{pos:[CLK.x-4.2,CLK.dialY-0.4,CLK.z+0.4],tgt:[CLK.x,CLK.dialY,CLK.z],mode:'orbit',cut:60,exp:1.8,minD:0.6},
  uhrkalender:{pos:[CLK.x-4.0,CLK.calY+0.5,CLK.z-0.4],tgt:[CLK.x,CLK.calY,CLK.z],mode:'orbit',cut:60,exp:1.8,minD:0.6},
  gedenk:{pos:[-39.2,1.7,14.1],dir:[-1,1.05,0],mode:'inside',cut:60,exp:1.8},
  gewoelbe:{pos:[-14,1.7,0],dir:[0.32,1.6,0],mode:'inside',cut:60,exp:1.6},
  sonnenuhr:{pos:[sdX+1.2,SD.y-0.9,sdZ+3.4],tgt:[sdX,SD.y,sdZ],mode:'orbit',cut:60,exp:0.85,minD:0.6},
  jahr:{pos:[40,215,215],tgt:[-48,0,-125],mode:'orbit',cut:60,exp:0.85}   // Jahreslauf: Kirche und Schattenspur der Südturmspitze
};
function hintFor(){
  if(state.pano) return coarse?tr('Ziehen: Himmel drehen und kippen','Drag: turn and tilt the sky'):tr('Ziehen: Himmel drehen und kippen · Mausrad: Ausschnitt vergrößern oder verkleinern','Drag: turn and tilt the sky · Wheel: zoom in or out');
  if(state.mode==='orbit'&&coarse) return tr('Ein Finger: drehen · zwei Finger: verschieben und zoomen','One finger: rotate · two fingers: pan and zoom');
  if(state.mode==='orbit') return tr('Ziehen: drehen · Rechtsklick oder zwei Finger: verschieben · Mausrad: zoomen · WASD: gehen','Drag: rotate · Right-click or two fingers: pan · Wheel: zoom · WASD: move');
  if(state.walk) return tr('Ziehen: umsehen · W/A/S/D, Pfeiltasten oder Mausrad: in der Laterne umhergehen','Drag: look around · W/A/S/D, arrow keys or wheel: walk around the lantern');
  if(coarse) return tr('Ziehen: umsehen · Steuerkreis unten links: gehen','Drag: look around · Pad at bottom left: walk');
  return tr('Ziehen: umsehen · Mausrad oder W/S: vorwärts, rückwärts · A/D: seitlich · Q/E: hoch, runter','Drag: look around · Wheel or W/S: forward, back · A/D: sideways · Q/E: up, down'); }
function applyMode(mode,minD,walk){
  state.mode=mode; state.walk=walk||null; state.skyView=false;
  if(mode==='orbit'){ Object.assign(controls,{enableZoom:true,minDistance:minD||5,maxDistance:state.view==='mtTop'?20000:yr.on||state.view==='jahr'?1600:800,minPolarAngle:0.03,maxPolarAngle:Math.PI*0.62,rotateSpeed:0.55,panSpeed:1}); }
  else { Object.assign(controls,{enableZoom:false,minDistance:0.05,maxDistance:20,minPolarAngle:0.06*Math.PI,maxPolarAngle:0.94*Math.PI,rotateSpeed:-0.38,panSpeed:0.7}); }
  $('#hint').textContent=hintFor();
  if(state.skyView){ $('#hint').classList.remove('gone'); setTimeout(()=>$('#hint').classList.add('gone'),7000); }
  if(walk){ controls.enablePan=false; $('#hint').classList.remove('gone'); setTimeout(()=>$('#hint').classList.add('gone'),7000); } else controls.enablePan=true;
  updateLabelsVisibility(); joyShow();
}
// Himmelsansicht als Panorama: Die Szene wird in eine Würfelkarte gerendert und in Zylinderprojektion gezeigt
// (Azimut waagerecht, Höhe senkrecht, beide linear). So bleiben die Bahnen von Sonne und Mond auch über 180° und mehr
// als natürliche Bögen sichtbar. Standpunkt: 140 m hoch, 170 m von der Kirche entfernt auf der den Bahnen abgewandten Seite,
// damit die Kirche unten im Bild liegt und nichts den Himmel verdeckt.
const cubeRT=new THREE.WebGLCubeRenderTarget(lowEnd?512:coarse?768:1280,{type:THREE.HalfFloatType,generateMipmaps:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
const cubeCam=new THREE.CubeCamera(0.5,6000,cubeRT);
const panoMat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{uCube:{value:cubeRT.texture},uAz:{value:180},uElB:{value:-30},uKx:{value:6},uKy:{value:6},uYB:{value:0},uW:{value:1000},uAxis:{value:98.5}},
  vertexShader:'void main(){ gl_Position=vec4(position.xy,0.0,1.0); }',
  fragmentShader:`uniform samplerCube uCube; uniform float uAz,uElB,uKx,uKy,uYB,uW,uAxis;
  void main(){ float az=radians(uAz+(gl_FragCoord.x-0.5*uW)/uKx), el=radians(clamp(uElB+(gl_FragCoord.y-uYB)/uKy,-89.9,89.9)), b=radians(uAxis);
    float E=cos(el)*sin(az), N=cos(el)*cos(az), U=sin(el);
    vec3 d=vec3(E*sin(b)+N*cos(b),U,E*cos(b)-N*sin(b));
    gl_FragColor=vec4(textureCube(uCube,d).rgb,1.0);
    #include <encodings_fragment>
  }`});
const panoScene=new THREE.Scene(), panoCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
{ const q=new THREE.Mesh(new THREE.PlaneGeometry(2,2),panoMat); q.frustumCulled=false; panoScene.add(q); }
const PANO={az:180,elB:-38,kx:6,ky:6};
function panoGeom(){ const r=renderer.domElement.getBoundingClientRect(); const tb=document.querySelector('.timebar'); return {W:r.width,H:r.height,yb:(tb?tb.offsetHeight+22:120),top:64}; }
function fitSky(){
  const pts=[]; const add=pos=>{ for(let mi=0;mi<=1440;mi+=10){ const s=pos(localToUtc(state.y,state.m,state.d,mi)); if(s.el>-0.5) pts.push(s); } };
  if(state.sunPath) add(sunPos); if(state.moon&&state.moonPath) add(moonPos); if(!pts.length) add(sunPos); if(!pts.length) pts.push({el:20,az:180});
  let sx=0,sy=0; for(const p of pts){ sx+=Math.sin(p.az*rad); sy+=Math.cos(p.az*rad); }
  const azc=((Math.atan2(sx,sy)/rad)+360)%360; let dmax=0, emax=0;
  for(const p of pts){ dmax=Math.max(dmax,Math.abs(((p.az-azc+540)%360)-180)); emax=Math.max(emax,p.el); }
  const g=panoGeom(), Wp=g.W, Hp=Math.max(120,g.H-g.yb-g.top);
  let spanX=Math.min(360,Math.max(110,2*dmax+36)); const elB=-38; let spanY=Math.min(90-elB,Math.max(70,emax+12-elB));
  let kx=Wp/spanX, ky=Hp/spanY;
  if(kx>1.6*ky){ spanX=Math.min(360,Wp/(1.6*ky)); kx=Wp/spanX; }   // Verzerrung begrenzen: lieber mehr Umgebung zeigen
  const kmax=Hp>Wp?2.6:1.6; if(ky>kmax*kx){ ky=kmax*kx; }   // Hochformat: Höhen etwas strecken, damit der Himmel genutzt wird
  Object.assign(PANO,{az:azc,elB,kx,ky});
  const hz=sunVec(0,azc,new V3()); hz.y=0; hz.normalize();
  VIEWS.himmel.pos=[-hz.x*170+2,140,-hz.z*170];
}
function panoUniforms(){ const g=panoGeom(), pr=renderer.getPixelRatio(), u=panoMat.uniforms;
  u.uAz.value=PANO.az; u.uElB.value=PANO.elB; u.uKx.value=PANO.kx*pr; u.uKy.value=PANO.ky*pr; u.uYB.value=g.yb*pr; u.uW.value=g.W*pr; u.uAxis.value=state.axis; drawPanoGrid(); }
// Himmelsrichtungen und Höhenlinien als Overlay
function drawPanoGrid(){ const svg=$('#panoGrid'); $('#panoNote').hidden=!state.pano; if(!state.pano){ svg.setAttribute('hidden',''); return; } svg.removeAttribute('hidden');
  const g=panoGeom(), X=az=>g.W/2+(((az-PANO.az+540)%360)-180)*PANO.kx, Y=el=>g.H-g.yb-(el-PANO.elB)*PANO.ky;
  svg.setAttribute('viewBox','0 0 '+g.W+' '+g.H); let s='';
  for(const el of [0,30,60]){ const y=Y(el); if(y<0||y>g.H) continue; s+='<line class="'+(el?'el':'hz')+'" x1="0" x2="'+g.W+'" y1="'+y+'" y2="'+y+'"/>'+(el?'<text class="elt" x="8" y="'+(y-4)+'">'+el+'°</text>':''); }
  const names=LANG==='en'?['N','NE','E','SE','S','SW','W','NW']:['N','NO','O','SO','S','SW','W','NW'];
  for(let k=0;k<8;k++){ const az=k*45; for(const off of [-360,0,360]){ const x=g.W/2+(az+off-PANO.az)*PANO.kx; if(x<-20||x>g.W+20) continue;
    s+='<line class="tick" x1="'+x+'" x2="'+x+'" y1="'+(Y(0)-6)+'" y2="'+(Y(0)+6)+'"/><text class="azt" x="'+x+'" y="'+(Y(0)+20)+'">'+names[k]+'</text>'; } }
  // Bahnen von Sonne und Mond als scharfe Linien mit Stundenmarken (im Panorama statt der 3D-Linien)
  const arc=(pos,cls,t0,t1)=>{ let pts=[], out=''; const flush=()=>{ if(pts.length>1) out+=(cls==='mp'?'<polyline class="mpu" points="'+pts.join(' ')+'"/>':'')+'<polyline class="'+cls+'" points="'+pts.join(' ')+'"/>'; pts=[]; }; let lastX=null;
    for(let t=t0;t<=t1+1;t+=240000){ const p=pos(Math.min(t,t1)); if(p.el<-0.5){ flush(); lastX=null; continue; }
      const x=X(p.az), y=Y(p.el); if(lastX!==null&&Math.abs(x-lastX)>g.W*0.5){ flush(); } pts.push(x.toFixed(1)+','+y.toFixed(1)); lastX=x; }
    flush();
    for(let u=Math.ceil(t0/3600000)*3600000;u<t1;u+=3600000){ const hh=hourOf(u), p=pos(u); if(p.el<1) continue; const x=X(p.az), y=Y(p.el);
      out+='<circle class="'+cls+'d" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="2.6"/><text class="'+cls+'t" x="'+x.toFixed(1)+'" y="'+(y-8).toFixed(1)+'">'+hh+'</text>'; }
    return out; };
  if(state.sunPath) s+=arc(sunPos,'sp',localToUtc(state.y,state.m,state.d,0),localToUtc(state.y,state.m,state.d,1440)-1);
  if(state.moon&&state.moonPath){ const mp=curMoonPass(); if(mp) s+=arc(moonPos,'mp',mp.t0,mp.t1); }
  svg.innerHTML=s+'<g id="pmk"></g>'; panoMarks(); }
// Markierung des Mondes am Himmel: Ring mit Beschriftung (am Taghimmel ist die Scheibe sonst kaum zu sehen)
function panoMarks(){ const gEl=document.getElementById('pmk'); if(!gEl||!state.pano) return; let s='';
  const g=panoGeom(), X=az=>g.W/2+(((az-PANO.az+540)%360)-180)*PANO.kx, Y=el=>g.H-g.yb-(el-PANO.elB)*PANO.ky;
  if(state.moon&&moonCur&&moonCur.el>-0.5){ const x=X(moonCur.az), y=Y(moonCur.el), r=14;
    s+='<circle class="mku" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+r+'"/><circle class="mk" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+r+'"/>'
      +'<text class="mpt mkt" x="'+(x+r+6).toFixed(1)+'" y="'+(y+4).toFixed(1)+'" style="text-anchor:start">'+tr('Mond ','Moon ')+Math.round(moonCur.k*100)+' %</text>'; }
  gEl.innerHTML=s; }
let panoDrag=null;
renderer.domElement.addEventListener('pointerdown',e=>{ if(!state.pano) return; panoDrag={x:e.clientX,y:e.clientY}; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove',e=>{ if(!state.pano||!panoDrag) return; const dx=e.clientX-panoDrag.x, dy=e.clientY-panoDrag.y; panoDrag={x:e.clientX,y:e.clientY};
  PANO.az=(PANO.az-dx/PANO.kx+360)%360; PANO.elB=Math.max(-70,Math.min(20,PANO.elB+dy/PANO.ky)); panoUniforms(); dirty=true; });
renderer.domElement.addEventListener('pointerup',()=>{ panoDrag=null; });
function panoZoom(f){ const g=panoGeom(); PANO.kx=Math.max(g.W/360,Math.min(40,PANO.kx*f)); PANO.ky=Math.max(1,Math.min(40,PANO.ky*f)); panoUniforms(); dirty=true; }
const busyState={panoWarm:false,hideOnPano:false};
function busyShow(t){ $('#busyTxt').textContent=t; $('#busy').hidden=false; }
function busyText(t){ $('#busyTxt').textContent=t; }
function busyHide(){ $('#busy').hidden=true; }
function goView(name,instant){
  if(name==='himmel') fitSky();
  const v=VIEWS[name]; if(!v) return;
  { const far=name==='jahr'||name==='mtTop'||name==='mtCam'; scene.fog.near=far?2500:350; scene.fog.far=far?9000:1700; if(name==='jahr'){ scene.fog.near=1200; scene.fog.far=4000; } }
  MOON_MAG=name==='mtCam'?1:2.2;
  { const nf=name==='mtTop'?[5,15000]:[0.2,5000]; if(camera.near!==nf[0]){ camera.near=nf[0]; camera.far=nf[1]; camera.updateProjectionMatrix(); } }   // Jahreslauf: von hoch oben ohne Dunst
  { const fv=v.fov||55; if(camera.fov!==fv){ camera.fov=fv; camera.updateProjectionMatrix(); } }
  if(v.mode==='pano'&&!busyState.panoWarm){ busyShow(tr('Himmelsansicht wird berechnet …','Preparing the sky view …')); busyState.panoWarm=true; busyState.hideOnPano=true;
    requestAnimationFrame(()=>setTimeout(()=>goView(name,instant),40)); return; }
  if(v.mode==='pano'){   // Panorama: Kamera nur als Standpunkt, Steuerung über eigene Zieh- und Zoomgesten
    document.querySelectorAll('#views button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
    $('#viewTxt').textContent=tr('Himmel: Sonnen- und Mondbahn','Sky: paths of sun and moon'); state.view=name;
    tween=null; setCut(v.cut); setExp(v.exp); camera.position.set(...v.pos); state.pano=true; state.mode='pano'; state.walk=null; controls.enabled=false;
    state.pano=true; $('#hint').textContent=hintFor(); $('#hint').classList.remove('gone'); setTimeout(()=>$('#hint').classList.add('gone'),7000);
    updateLabelsVisibility(); panoUniforms(); joyShow(); dirty=true; return; }
  if(state.pano){ state.pano=false; controls.enabled=true; drawPanoGrid(); }
  document.querySelectorAll('#views button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
  state.view=name; { const vb=document.querySelector('#views button[data-view="'+name+'"]'); $('#viewTxt').textContent=vb?vb.textContent:name==='mtTop'?tr('Draufsicht: Standort wählen','Top view: choose position'):name==='mtCam'?tr('Blick vom Standort','View from your position'):name==='lkIn'?tr('Fenster von innen','Window from inside'):name==='totenkopf'?tr('Totentanz: Nordportal','Dance of Death: north portal'):name==='sonnenuhr'?tr('Sonnenuhr','Sundial'):name==='uhrblatt'?tr('Uhr: Zifferblatt','Clock: dial'):name==='finsternis'?tr('Finsternis','Eclipse'):name==='jahr'?tr('Jahreslauf','Year'):name==='uhrkalender'?tr('Uhr: Kalenderscheibe','Clock: calendar disk'):tr('eigene','custom'); }
  const tp=new V3(...v.pos);
  const tt=v.mode==='inside'?tp.clone().add(new V3(...v.dir).normalize().multiplyScalar(1.2)):new V3(...v.tgt);
  setCut(v.cut); setExp(v.exp);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(instant||reduce){ camera.position.copy(tp); controls.target.copy(tt); camera.lookAt(tt); applyMode(v.mode,v.minD,v.walk); controls.update(); dirty=true; return; }
  state.walk=null;
  controls.enabled=false;
  tween={t0:performance.now(),dur:v.walk?1800:1200,fp:camera.position.clone(),ft:controls.target.clone(),tp,tt,mode:v.mode,minD:v.minD,walk:v.walk};
}
function stepTween(now){
  const k0=clamp01((now-tween.t0)/tween.dur), k=k0<0.5?4*k0*k0*k0:1-Math.pow(-2*k0+2,3)/2;
  camera.position.lerpVectors(tween.fp,tween.tp,k); controls.target.lerpVectors(tween.ft,tween.tt,k); camera.lookAt(controls.target);
  dirty=true;
  if(k0>=1){ const m=tween.mode, md=tween.minD, wk=tween.walk; tween=null; controls.enabled=true; applyMode(m,md,wk); controls.update(); }
}
// Steuerkreis: Gehen mit dem Finger in Innenansichten (Handy, Tablet); vorwärts/rückwärts und seitlich, Umsehen weiter durch Ziehen im Bild
const joy={el:document.getElementById('joy'),k:document.getElementById('joyk'),id:null,x:0,y:0};
function joyShow(){ if(joy.el) joy.el.hidden=!(coarse&&state.mode==='inside'&&!state.pano); }
if(joy.el){ const R=40, upd=e=>{ const b=joy.el.getBoundingClientRect(); let dx=e.clientX-(b.left+b.width/2), dy=e.clientY-(b.top+b.height/2); const l=Math.hypot(dx,dy); if(l>R){ dx*=R/l; dy*=R/l; }
    joy.x=dx/R; joy.y=dy/R; joy.k.style.transform='translate('+dx+'px,'+dy+'px)'; };
  joy.el.addEventListener('pointerdown',e=>{ joy.id=e.pointerId; joy.el.setPointerCapture(e.pointerId); upd(e); e.preventDefault(); e.stopPropagation(); });
  joy.el.addEventListener('pointermove',e=>{ if(e.pointerId===joy.id) upd(e); });
  const end=e=>{ if(e.pointerId!==joy.id) return; joy.id=null; joy.x=joy.y=0; joy.k.style.transform=''; };
  joy.el.addEventListener('pointerup',end); joy.el.addEventListener('pointercancel',end); }
function joyMove(dt){ if(joy.id===null||tween||state.pano) return; const sp=(state.walk?1.2:4)*dt, dz=Math.abs(joy.y)<0.12?0:joy.y, dx=Math.abs(joy.x)<0.12?0:joy.x; if(dx||dz) moveBy(-dz*sp,dx*sp,0); }
const keys=new Set();
window.addEventListener('keydown',e=>{ const tg=e.target.tagName; if(tg==='INPUT'||tg==='SELECT'||tg==='TEXTAREA'||e.metaKey||e.ctrlKey) return;
  const k=e.key.toLowerCase(); if(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){ keys.add(k); if(k.startsWith('arrow')) e.preventDefault(); } });
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
function moveBy(fwd,side,upd){
  const f=new V3().subVectors(controls.target,camera.position); f.y=0; if(f.lengthSq()<1e-8) f.set(1,0,0); f.normalize();
  const r=new V3(-f.z,0,f.x); const m=f.multiplyScalar(fwd).add(r.multiplyScalar(side)); m.y=upd;
  camera.position.add(m); controls.target.add(m);
  if(state.walk) clampWalk();
  else if(state.mode==='inside'){ const dy=Math.max(state.skyView?2:0.4,Math.min(state.skyView?200:37,camera.position.y))-camera.position.y; camera.position.y+=dy; controls.target.y+=dy; }
  else if(camera.position.y<1){ const dy=1-camera.position.y; camera.position.y+=dy; controls.target.y+=dy; }
  dirty=true;
}
// Laufbereich (Laterne des Dachreiters): Ring um die Mittelsäule, feste Augenhöhe
function clampWalk(){ const w=state.walk; if(!w) return; const p=camera.position, dx=p.x-w.cx, dz=p.z-w.cz, r=Math.hypot(dx,dz)||1e-6, rr=Math.min(w.rMax,Math.max(w.rMin,r));
  const nx=w.cx+dx/r*rr, nz=w.cz+dz/r*rr, d=new V3(nx-p.x,w.y-p.y,nz-p.z); if(d.lengthSq()>1e-10){ p.add(d); controls.target.add(d); dirty=true; } }
function keyMove(dt){
  if(tween||state.pano) return;
  const sp=(keys.has('shift')?3:1)*(state.walk?1.2:state.skyView?25:state.mode==='inside'?5:22)*dt;
  let f=0,s=0,u=0;
  if(keys.has('w')||keys.has('arrowup')) f+=sp; if(keys.has('s')||keys.has('arrowdown')) f-=sp;
  if(keys.has('d')||keys.has('arrowright')) s+=sp; if(keys.has('a')||keys.has('arrowleft')) s-=sp;
  if(keys.has('e')) u+=sp; if(keys.has('q')) u-=sp;
  if(f||s||u) moveBy(f,s,u);
}
renderer.domElement.addEventListener('wheel',e=>{ if(state.pano){ e.preventDefault(); panoZoom(Math.exp(-e.deltaY*0.0015)); return; }
  if(state.mode!=='inside'||tween) return; e.preventDefault();
  if(state.skyView){ camera.fov=Math.max(25,Math.min(110,camera.fov+e.deltaY*0.04)); camera.updateProjectionMatrix(); dirty=true; return; } moveBy(-e.deltaY*(state.walk?0.003:0.012),0,0); },{passive:false});

/* ---------------- Beschriftungen ---------------- */
const LABELS=[['Nordturm',[TW.xc,90,-14.2],0,'North tower'],['Südturm',[TW.xc,90,14.4],0,'South tower'],['Mittelschiff',[-8,51,0],0,'Nave'],['Dachreiter',[11.9,81,0],1,'Ridge turret'],['Sonnenuhr',[sdX,SD.y+0.9,sdZ],0,'Sundial'],['Westfenster',[-51.4,24,0],0,'West window'],['Briefkapelle',[-29.6,21,27.4],0,'Briefkapelle'],
  ['Totentanzkapelle',[8.3,31,-26.5],0,'Dance of Death Chapel'],['Südvorhalle',[8.9,31,30.2],0,'South porch'],['Marientidenkapelle',[47,33.5,0],0,'Marientiden Chapel'],['Kapellenkranz',[37.5,28,-12],0,'Chapel ring'],['Gedenkkapelle',[TW.x0-0.5,19,14.4],0,'Memorial Chapel'],['Astronomische Uhr',[CLK.x-0.3,13.2,CLK.z],2,'Astronomical clock']];
const labelLayer=$('#labels');
const labelEls=LABELS.map(([t,p,nc,te])=>{ const el=document.createElement('div'); el.className='lbl'; el.textContent=tr(t,te); labelLayer.appendChild(el); return {el,p:new V3(...p),nc:nc|0,de:t,en:te}; });
function relabel(){ for(const l of labelEls){ l.el.textContent=tr(l.de,l.en); l.w=0; } }
function updateLabelsVisibility(){ labelLayer.hidden=!(state.labels&&state.mode==='orbit'); }
const pv=new V3();
function placeLabels(){
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

/* ---------------- UI ---------------- */
const pad2=n=>String(n).padStart(2,'0');
const fmtT=m=>{ m=((Math.round(m)%1440)+1440)%1440; return pad2(Math.floor(m/60))+':'+pad2(m%60); };
const fmtDeg=v=>dc(v.toFixed(1))+'°';
const DIRS_DE=['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'], DIRS_EN=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const dirName=az=>(LANG==='en'?DIRS_EN:DIRS_DE)[Math.round(az/22.5)%16];
let day={curve:[],rise:null,set:null,maxEl:0,maxT:0,mcurve:[],mrise:null,mset:null,nm0:null,nm1:null,nextFull:null,nextNew:null};
// Sonnenlauf eines Tages: Höhe alle 5 min, Auf- und Untergang (oberer Rand, mit Refraktion: scheinbare Höhe −0,27°), Höchststand. Minuten ab Mitternacht Ortszeit
function sunDay(y,m,d){ const c=[]; let maxEl=-90,maxT=0;
  for(let mi=0;mi<=1440;mi+=5){ const s=sunPos(localToUtc(y,m,d,mi)); c.push(s); if(s.el>maxEl){maxEl=s.el;maxT=mi;} }
  let rise=null,set=null; const TH=-0.27;
  for(let i=1;i<c.length;i++){ const a=c[i-1].el, b=c[i].el;
    if(a<TH&&b>=TH&&rise===null) rise=(i-1)*5+5*(TH-a)/(b-a);
    if(a>=TH&&b<TH) set=(i-1)*5+5*(TH-a)/(b-a); }
  return {c,rise,set,maxEl,maxT}; }
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
function updateReadouts(){
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
function moonTransitNear(ms){ let best=ms, be=-99; for(let t=ms-14*3600000;t<=ms+14*3600000;t+=600000){ if(sunPos(t).el>-8) continue; const e=moonPos(t).el; if(e>be){ be=e; best=t; } } return best; }
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
function setCut(v){ state.cut=v; $('#cut').value=v; cutPlane.constant=v>=60?500:v; $('#cutOut').textContent=v>=60?tr('aus','off'):dc(v.toFixed(1))+' m'; dirty=true; }
function setExp(v){ state.exp=v; $('#exp').value=v; renderer.toneMappingExposure=v*(1+0.15*(1-smooth(-7,-1.5,cur.el))*(state.moon?1:0)); $('#expOut').textContent=dc(v.toFixed(2)); dirty=true; }
function setAmb(v){ state.amb=v; $('#amb').value=v; TINT.uAmbIn.value=v; $('#ambOut').textContent=Math.round(v*100)+' %'; dirty=true; }
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
const yr={on:false,rate:0,mez:0,acc:0,year:0,group:null,marker:null,ray:null};
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
  yr.marker.visible=yr.ray.visible=!!p; if(p){ yr.marker.position.copy(p); const a=yr.ray.geometry.attributes.position; a.setXYZ(0,YR_TIP.x,YR_TIP.y,YR_TIP.z); a.setXYZ(1,p.x,p.y,p.z); a.needsUpdate=true; } dirty=true; }
function yrMez(){ return state.minutes-(berlinOffsetMin(localToUtc(state.y,state.m,state.d,state.minutes))-60); }
function yearStart(rate){ const first=!yr.on; yr.on=true; yr.rate=rate; yr.acc=0; yr.mez=yrMez(); yrBuild(); $('#yearNote').hidden=false; setPlaying(state.playing);
  if(first&&!['sonnenuhr','himmel'].includes(state.view)) goView('jahr'); }
function yearStop(){ if(!yr.on) return; yr.on=false; if(yr.group){ scene.remove(yr.group); yr.group=null; } $('#yearNote').hidden=true; setPlaying(state.playing); dirty=true; }
function yearTick(dt){ yr.acc+=yr.rate*dt; if(yr.acc<1) return; const nd=Math.floor(yr.acc); yr.acc-=nd;
  const t=new Date(Date.UTC(state.y,state.m,state.d+nd)), y=t.getUTCFullYear(), m=t.getUTCMonth(), d=t.getUTCDate();
  const off=berlinOffsetMin(Date.UTC(y,m,d,12)); state.minutes=Math.max(0,Math.min(1439,yr.mez+(off-60)));
  setDate(y,m,d); if(y!==yr.year) yrBuild(); else yrMark(); }
document.querySelectorAll('#views button').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));
$('#cut').addEventListener('input',e=>setCut(+e.target.value));
$('#exp').addEventListener('input',e=>setExp(+e.target.value));
$('#amb').addEventListener('input',e=>setAmb(+e.target.value));
$('#axis').addEventListener('input',e=>setAxis(+e.target.value));
$('#labelsTog').addEventListener('change',e=>{ state.labels=e.target.checked; updateLabelsVisibility(); dirty=true; });
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
$('#tintTog').addEventListener('change',e=>{ state.tint=e.target.checked; TINT.uTintOn.value=e.target.checked?1:0; dirty=true; });
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
function setExpert(v){ EXPERT=!!v; document.body.classList.toggle('expert',EXPERT); lsSet('stm-expert',EXPERT?'1':'0'); }
document.querySelectorAll('.more').forEach(b=>b.addEventListener('click',()=>setExpert(!EXPERT)));

/* ---------------- Sprache umschalten ---------------- */
function refreshLang(){
  applyStaticLang(); buildPresets(); relabel(); drawChart(); drawCompassStatic(); drawYearChart(); sdOrient();
  $('#playTxt').textContent=state.playing?tr('Anhalten','Pause'):tr('Tagesverlauf','Play day');
  { const vb=document.querySelector('#views button[data-view="'+state.view+'"]'); $('#viewTxt').textContent=state.pano?tr('Himmel: Sonnen- und Mondbahn','Sky: paths of sun and moon'):vb?vb.textContent:tr('eigene','custom'); }
  $('#hint').textContent=hintFor(); setCut(state.cut); setExp(state.exp); setAmb(state.amb); $('#axisOut').textContent=fmtDeg(state.axis); $('#sdWedgeOut').textContent=fmtDeg(state.sdWedge); if(state.pano) drawPanoGrid();
  if(tour.i!==null) showTour(); if(quiz.i!==null) qzRender(); mtGeo(); mtRender(); if(LK.list.length){ LK.list=[]; lkFill(); } updateShare(); updateSun(true); }
$('#langBtn').addEventListener('click',()=>{ LANG=LANG==='en'?'de':'en'; lsSet('stm-lang',LANG); refreshLang(); });

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
function updateClockCard(){
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
  MZT.axis.scale.z=Math.max(1.5,mpp*3); dirty=true; }
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
// 2 Sonnenuhr und Armbanduhr: Augenblick, in dem die Sonnenuhr 12 Uhr zeigt (wahrer Mittag), in Uhrzeit
function trueNoon(y,m,d){ let mm=720; for(let k=0;k<3;k++){ const p=sunPos(localToUtc(y,m,d,mm)), w=((12+p.H/15)%24+24)%24; mm+=(12-w)*60; } return mm; }
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
function stateCode(){ const p=new URLSearchParams();
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
  if(q.get('l')&&q.get('l')!==LANG){ LANG=q.get('l')==='en'?'en':'de'; refreshLang(); }
  const [y,mo,d]=q.get('d').split('-').map(Number); if(!Number.isFinite(y)||!Number.isFinite(mo)||!Number.isFinite(d)||mo<1||mo>12||d<1||d>31) return false;
  if(tour.i!==null) tourEnd();
  { const t=q.get('t')===null||q.get('t')===''?NaN:+q.get('t'); state.minutes=Number.isFinite(t)?Math.max(0,Math.min(1439,t)):720; } setDate(y,mo-1,Math.min(d,new Date(Date.UTC(y,mo,0)).getUTCDate()));
  const v=q.get('v'); if(v&&VIEWS[v]) goView(v,true);
  if(v==='himmel'&&q.get('p')){ const a=q.get('p').split(',').map(Number); if(a.length===4&&a.every(Number.isFinite)){ Object.assign(PANO,{az:a[0],elB:a[1],kx:a[2],ky:a[3]}); panoUniforms(); } }
  else if(q.get('c')){ const c=q.get('c').split(',').map(Number); if(c.length===6&&c.every(isFinite)){ if(state.pano){ state.pano=false; controls.enabled=true; drawPanoGrid(); }
      camera.position.set(c[0],c[1],c[2]); controls.target.set(c[3],c[4],c[5]); camera.lookAt(controls.target);
      const vw=v&&VIEWS[v]; applyMode(q.get('m')==='inside'?'inside':'orbit',vw?vw.minD:undefined,vw?vw.walk:undefined); controls.update(); } }
  dirty=true; return true; }
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
function resize(){ const w=stage.clientWidth||innerWidth, h=stage.clientHeight||innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); dirty=true; }
new ResizeObserver(resize).observe(stage);
new ResizeObserver(()=>{ if(state.pano){ panoUniforms(); dirty=true; } }).observe(stage);
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
  if(!tween&&controls.update()){ dirty=true; if(state.walk) clampWalk(); if(state.mode==='orbit'&&camera.position.y<1.5){ camera.position.y=1.5; camera.lookAt(controls.target); } }
  if(dirty){ dirty=false; renderFrame(); }
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
})();