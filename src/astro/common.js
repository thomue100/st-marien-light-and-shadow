// Grundlagen: Ort (Lübeck, St. Marien), Winkel, Koordinaten-Umrechnungen, Lichtbrechung, Beobachterort auf dem Erdellipsoid
export const rad=Math.PI/180;
export const LAT=53.8677, LON=10.6850;

export const AU_KM=149597870.7, EARTH_R=6378.14;
export function nrm360(x){ return ((x%360)+360)%360; }
export function eclToEqu(lam,beta,T){ const eps=(23.4392911-0.0130042*T)*rad, l=lam*rad, b=beta*rad;
  const ra=Math.atan2(Math.sin(l)*Math.cos(eps)-Math.tan(b)*Math.sin(eps),Math.cos(l));
  const dec=Math.asin(Math.sin(b)*Math.cos(eps)+Math.cos(b)*Math.sin(eps)*Math.sin(l));
  return {ra:nrm360(ra/rad), dec:dec/rad}; }
export function lstDeg(ms){ const n=ms/86400000+2440587.5-2451545.0; return nrm360((18.697374558+24.06570982441908*n)*15+LON); }
export function horiz(Hdeg,dec){ const H=Hdeg*rad, d=dec*rad, phi=LAT*rad;
  const el=Math.asin(Math.sin(phi)*Math.sin(d)+Math.cos(phi)*Math.cos(d)*Math.cos(H));
  const az=Math.atan2(-Math.cos(d)*Math.sin(H),Math.sin(d)*Math.cos(phi)-Math.cos(d)*Math.cos(H)*Math.sin(phi));
  return {el:el/rad, az:nrm360(az/rad)}; }
export function refract(e){ return e>-1.5? e+1.02/Math.tan((e+10.3/(e+5.11))*rad)/60 : e; }
export const OBS_U=Math.atan(0.99664719*Math.tan(LAT*rad)), OBS_RS=0.99664719*Math.sin(OBS_U)+20/6378140*Math.sin(LAT*rad), OBS_RC=Math.cos(OBS_U)+20/6378140*Math.cos(LAT*rad);
