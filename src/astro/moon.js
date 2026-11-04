// Mond: Bahn, Stand, Phase, Auf- und Untergang, Kulmination
import { EARTH_R, OBS_RC, OBS_RS, eclToEqu, horiz, lstDeg, nrm360, rad, refract } from './common.js';
import { sunEcl, sunPos } from './sun.js';

// Verkürzte Mondtheorie nach Meeus, Astronomical Algorithms, Kap. 47 (die größten Glieder; Fehler etwa 0,01°),
// topozentrisch (Parallaxe bis ~1°) für Lübeck, Lichtbrechung wie bei der Sonne. Phase nach Kap. 48.
export const MOON_L=[[0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],
  [0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],
  [2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],[0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],
  [0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],
  [2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
  [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],
  [2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],[0,2,0,0,-2069,0],
  [2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],[2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],
  [3,0,-1,0,-892,3258],[2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],[0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354]];
export const MOON_B=[[0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],
  [2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],
  [2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],
  [0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],[0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107]];
// geozentrisch, ekliptikal: λ, β (Grad), Abstand (km)
export function moonEcl(ms){
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
export function moonPos(ms){
  const m=moonEcl(ms), q=eclToEqu(m.lam,m.beta,m.T), H=nrm360(lstDeg(ms)-q.ra+180)-180;
  const sp=EARTH_R/m.dist, d=q.dec*rad, Hr=H*rad;   // topozentrische Korrektur (Meeus Kap. 40)
  const dA=Math.atan2(-OBS_RC*sp*Math.sin(Hr),Math.cos(d)-OBS_RC*sp*Math.cos(Hr));
  const dec2=Math.atan2((Math.sin(d)-OBS_RS*sp)*Math.cos(dA),Math.cos(d)-OBS_RC*sp*Math.cos(Hr))/rad;
  const H2=H-dA/rad, hz=horiz(H2,dec2);
  const s=sunEcl(ms), elong=nrm360(m.lam-s.lam);
  const psi=Math.acos(Math.cos(m.beta*rad)*Math.cos((m.lam-s.lam)*rad)), i=Math.atan2(s.R*Math.sin(psi),m.dist-s.R*Math.cos(psi));
  return {el:refract(hz.el), elTrue:hz.el, az:hz.az, H:nrm360(H2+180)-180, ra:q.ra, dec:dec2, dist:m.dist, lam:m.lam, beta:m.beta,
          elong, k:(1+Math.cos(i))/2, waxing:elong<180, raSun:s.ra, semi:Math.asin(1737.4/m.dist)/rad}; }
export function moonElong(ms){ return nrm360(moonEcl(ms).lam-sunEcl(ms).lam); }
// nächster (dir=+1) bzw. letzter (dir=−1) Zeitpunkt, an dem die Elongation den Zielwert (0 Neumond, 180 Vollmond) erreicht
export function moonPhaseTime(ms,target,dir){
  const f=t=>{ const e=nrm360(moonElong(t)-target); return e>180?e-360:e; };   // −180…180, steigt mit der Zeit
  const step=6*3600000*dir; let a=ms, fa=f(a);
  for(let i=0;i<140;i++){ const b=a+step, fb=f(b);
    const cross=dir>0?(fa<0&&fb>=0&&fb-fa<90):(fa>=0&&fb<0&&fa-fb<90);
    if(cross){ let lo=dir>0?a:b, hi=dir>0?b:a; for(let k=0;k<30;k++){ const mid=(lo+hi)/2; if(f(mid)<0) lo=mid; else hi=mid; } return (lo+hi)/2; }
    a=b; fa=fb; }
  return null; }
// Auf- und Untergang (Oberrand am mathematischen Horizont, mit Lichtbrechung) zwischen t0 und t1, Abtastung 5 min
export function moonRiseSet(t0,t1){ let rise=null,set=null,prev=null; const st=300000;
  const f=t=>{ const m=moonPos(t); return m.el+m.semi; };
  for(let t=t0;t<=t1;t+=st){ const v=f(t);
    if(prev!==null){ if(prev<0&&v>=0&&rise===null){ let a=t-st,b=t; for(let k=0;k<12;k++){ const c=(a+b)/2; if(f(c)<0) a=c; else b=c; } rise=(a+b)/2; }
      if(prev>=0&&v<0&&set===null){ let a=t-st,b=t; for(let k=0;k<12;k++){ const c=(a+b)/2; if(f(c)>=0) a=c; else b=c; } set=(a+b)/2; } }
    prev=v; }
  return {rise,set}; }
export function moonTransitNear(ms){ let best=ms, be=-99; for(let t=ms-14*3600000;t<=ms+14*3600000;t+=600000){ if(sunPos(t).el>-8) continue; const e=moonPos(t).el; if(e>be){ be=e; best=t; } } return best; }
