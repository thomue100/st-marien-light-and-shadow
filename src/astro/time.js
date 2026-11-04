// Zeit: Ortszeit Berlin ↔ UTC, Sommerzeit seit 1980, Tage der Zeitumstellung

export function lastSundayUtc(y,m){ const d=new Date(Date.UTC(y,m+1,0)); d.setUTCDate(d.getUTCDate()-d.getUTCDay()); return Date.UTC(y,m,d.getUTCDate(),1); }
// Sommerzeit in Deutschland (MESZ), Umstellung jeweils 01:00 UTC: seit 1996 letzter Sonntag im März bis letzter Sonntag im Oktober,
// 1981–1995 bis zum letzten Sonntag im September, 1980 vom 6. April bis 28. September, davor (ab 1950) keine Sommerzeit
export function dstRange(y){ if(y<1980) return null; if(y===1980) return [Date.UTC(1980,3,6,1),Date.UTC(1980,8,28,1)];
  return [lastSundayUtc(y,2),lastSundayUtc(y,y<1996?8:9)]; }
export function berlinOffsetMin(u){ const r=dstRange(new Date(u).getUTCFullYear()); return r&&u>=r[0]&&u<r[1]?120:60; }
export function localToUtc(y,m,d,min){ const base=Date.UTC(y,m,d)+min*60000; let u=base-3600000; if(berlinOffsetMin(u)===120){ const u2=base-7200000; if(berlinOffsetMin(u2)===120) u=u2; else u=dstRange(new Date(u).getUTCFullYear())[0]; } return u; }   // 02:00–02:59 am Umstellungstag im März gibt es nicht: alle diese Minuten zeigen den Umstellungsmoment (03:00 MESZ), so läuft die Zeit nie rückwärts
// Zeitumstellung: Tag der Umstellung erkennen; 02:00–02:59 gibt es im März nicht und im Oktober zweimal (das Modell zeigt dann den zweiten Durchlauf, MEZ)
export function dstInfo(y,m,d,min){ const u=localToUtc(y,m,d,min), off=berlinOffsetMin(u), loc=(u-Date.UTC(y,m,d))/60000+off;   // tatsächliche Ortszeit in Minuten ab Mitternacht
  const dr=dstRange(y), day0=t=>{ const q=new Date(t); return Date.UTC(q.getUTCFullYear(),q.getUTCMonth(),q.getUTCDate()); }, spring=!!dr&&Date.UTC(y,m,d)===day0(dr[0]), fall=!!dr&&Date.UTC(y,m,d)===day0(dr[1]);
  return {utc:u,off,loc,gap:spring&&min>=120&&min<180,fold:fall&&min>=120&&min<180}; }
export function berlinNow(){ const u=Date.now(); const l=new Date(u+berlinOffsetMin(u)*60000); return {y:l.getUTCFullYear(),m:l.getUTCMonth(),d:l.getUTCDate(),minutes:l.getUTCHours()*60+l.getUTCMinutes()}; }
