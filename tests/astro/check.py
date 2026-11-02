#!/usr/bin/env python3
"""Prüft das Lichtmodell gegen unabhängige Astronomie-Programme.

Referenz: Skyfield mit der JPL-Ephemeride DE421 (Sonne, Mond, Auf-/Untergänge, Phasen, Meridiandurchgänge, Mondfinsternisse,
örtliche Sonnenfinsternisse) und Pythons Zeitzonen-Datenbank (Europe/Berlin) für die Sommerzeit.
Optional (--usno, braucht Internet): Auf-/Untergänge und Phasen beim U.S. Naval Observatory.
Aufruf: node dump.js && python3 check.py   → report.md, report.html; Rückgabewert 1, wenn eine Grenze überschritten ist.
"""
import json, math, sys, os, datetime as dt, argparse
from zoneinfo import ZoneInfo
from skyfield import almanac, eclipselib
from skyfield.api import load, wgs84
try:
    import skyfield_data; LOADER=load.__class__(skyfield_data.get_skyfield_data_path())
except Exception: LOADER=load
ap=argparse.ArgumentParser(); ap.add_argument('--usno',action='store_true',help='zusätzlich USNO-Webdienst abfragen (Internet nötig)'); args=ap.parse_args()
H=os.path.dirname(os.path.abspath(__file__)); M=json.load(open(os.path.join(H,'model.json')))
ts=LOADER.timescale(builtin=True); eph=LOADER('de421.bsp'); earth,sun,moon=eph['earth'],eph['sun'],eph['moon']
site=wgs84.latlon(M['lat'],M['lon'],elevation_m=20); obs=earth+site
T=lambda ms: ts.from_datetime(dt.datetime.fromtimestamp(ms/1000,dt.timezone.utc))
ms=lambda t: t.utc_datetime().timestamp()*1000
UTC=dt.timezone.utc; BER=ZoneInfo('Europe/Berlin')
notes=[]
rows=[]   # (Bereich, Prüfung, n, max, mittel, Grenze, ok, Einheit)
def stat(name,check,vals,lim,unit,fmt='{:.3f}'):
    v=[abs(x) for x in vals if x is not None]; n=len(v)
    mx=max(v) if v else float('nan'); mean=sum(v)/n if n else float('nan'); ok=n>0 and mx<=lim
    rows.append((name,check,n,fmt.format(mx),fmt.format(mean),fmt.format(lim),ok,unit)); return v
def angd(a,b): return (a-b+180)%360-180

# 1 Örter
se,sa,me,mt,ma=[],[],[],[],[]
for t,sel,saz,mel,metrue,maz in M['pos']:
    tt=T(t); a=obs.at(tt)
    alt,az,_=a.observe(sun).apparent().altaz(temperature_C=10,pressure_mbar=1010)
    if alt.degrees>3: se.append(sel-alt.degrees); sa.append(angd(saz,az.degrees))
    alt,az,_=a.observe(moon).apparent().altaz(temperature_C=10,pressure_mbar=1010); alt0,_,_=a.observe(moon).apparent().altaz()
    if alt.degrees>3: me.append(mel-alt.degrees); ma.append(angd(maz,az.degrees))
    mt.append(metrue-alt0.degrees)
stat('Sonne','Höhe (mit Lichtbrechung, > 3°)',se,0.03,'°'); stat('Sonne','Azimut',sa,0.03,'°')
stat('Mond','Höhe (topozentrisch, mit Lichtbrechung, > 3°)',me,0.03,'°'); stat('Mond','Höhe ohne Lichtbrechung',mt,0.03,'°'); stat('Mond','Azimut',ma,0.03,'°')

# 2/3 Auf- und Untergänge (Standard: oberer Rand, Refraktion 34′)
def events(body,t0,t1):
    r,_=almanac.find_risings(obs,body,T(t0),T(t1)); s,_=almanac.find_settings(obs,body,T(t0),T(t1))
    return [ms(x) for x in r],[ms(x) for x in s]
def near(x,lst,tol=3*3600e3):
    if x is None or not lst: return None
    b=min(lst,key=lambda y:abs(y-x)); return (x-b)/1000 if abs(x-b)<tol else None
sr,ss=[],[]
for t0,r,s in M['sun']:
    R,S=events(sun,t0,t0+864e5); sr.append(near(r,R)); ss.append(near(s,S))
stat('Sonne','Aufgang',sr,60,'s','{:.0f}'); stat('Sonne','Untergang',ss,60,'s','{:.0f}')
mr,ms_=[],[]
for t0,t1,r,s in M['moon']:
    R,S=events(moon,t0,t1); mr.append(near(r,R)); ms_.append(near(s,S))
stat('Mond','Aufgang',mr,60,'s','{:.0f}'); stat('Mond','Untergang',ms_,60,'s','{:.0f}')

# Wahrer Mittag (Sonnenuhr zeigt 12 Uhr) = oberer Meridiandurchgang
tr=almanac.meridian_transits(eph,sun,site); nn=[]
for t0,noon in M['noon']:
    t,y=almanac.find_discrete(T(t0),T(t0+864e5),tr); up=[ms(a) for a,b in zip(t,y) if b==1]; nn.append(near(noon,up))
stat('Sonnenuhr','Wahrer Mittag (Meridiandurchgang)',nn,30,'s','{:.0f}')

# 4 Mondphasen
Y0,Y1=M['years']; t,y=almanac.find_discrete(ts.utc(Y0,1,1),ts.utc(Y1+1,1,1),almanac.moon_phases(eph)); ref={0:[],1:[],2:[],3:[]}
for a,b in zip(t,y): ref[int(b)].append(ms(a))
key={'new':0,'first':1,'full':2,'last':3}; ph={k:[] for k in key}
for nm,x in M['phase']: ph[nm].append(near(x,ref[key[nm]],2*864e5))
for nm,lab in [('new','Neumond'),('first','Erstes Viertel'),('full','Vollmond'),('last','Letztes Viertel')]: stat('Mondphasen',lab,ph[nm],90,'s','{:.0f}')
nref=sum(len(v) for v in ref.values()); rows.append(('Mondphasen','Anzahl gefunden / Referenz',len(M['phase']),str(len(M['phase'])),'',str(nref),len(M['phase'])==nref,''))

# 5 Mondfinsternisse (Kern- oder Halbschatten), Zeit des Maximums und Art
t,y,det=eclipselib.lunar_eclipses(ts.utc(Y0,1,1),ts.utc(Y1+1,1,1),eph); refL=[(ms(a),eclipselib.LUNAR_ECLIPSES[b]) for a,b in zip(t,y)]
modL=[e for e in M['ecl'] if e['kind']=='l']; ld,lt=[],0
for e in modL:
    b=min(refL,key=lambda r:abs(r[0]-e['max'])) if refL else None
    if b and abs(b[0]-e['max'])<6*3600e3:
        ld.append((e['max']-b[0])/1000); typ={'Penumbral':'penumbral','Partial':'partial','Total':'total'}[b[1]]
        if typ==e['type']: lt+=1
        elif abs(e['mag']-1)<0.01 or abs(e['mag'])<0.01:   # Grenzfall: Kernschatten-Größe nahe 1 bzw. 0, je nach Schattenvergrößerung (Danjon/Chauvenet) unterschiedlich eingestuft
            lt+=1; notes.append(f"Grenzfall {dt.datetime.fromtimestamp(e['max']/1000,UTC):%d.%m.%Y}: Modell {e['type']} (Kernschatten {e['mag']:.4f}), Skyfield {typ}")
stat('Finsternisse','Mondfinsternis, Zeit des Maximums',ld,120,'s','{:.0f}')
rows.append(('Finsternisse','Mondfinsternisse: Anzahl / Art stimmt',len(modL),f'{len(modL)} / {lt}','',f'{len(refL)} Referenz',len(modL)==len(refL) and lt==len(modL),''))

# Örtliche Sonnenfinsternisse: für jeden Neumond Bedeckung der Sonnenscheibe in Lübeck (Sonne über dem Horizont)
def cover(rs,rm,d):
    if d>=rs+rm: return 0.0
    if d<=abs(rm-rs): return min(1.0,(rm/rs)**2)
    a=math.acos((d*d+rs*rs-rm*rm)/(2*d*rs)); b=math.acos((d*d+rm*rm-rs*rs)/(2*d*rm))
    return (rs*rs*a+rm*rm*b-0.5*math.sqrt(max(0,(-d+rs+rm)*(d+rs-rm)*(d-rs+rm)*(d+rs+rm))))/(math.pi*rs*rs)
refS=[]
for tn in ref[0]:
    best=None
    for k in range(-240,241,2):
        tt=T(tn+k*6e4); a=obs.at(tt); s_=a.observe(sun).apparent(); m_=a.observe(moon).apparent()
        alt=s_.altaz()[0].degrees
        if alt<-0.6: continue
        rs=math.degrees(math.asin(696000/s_.distance().km)); rm=math.degrees(math.asin(1737.4/m_.distance().km)); d=s_.separation_from(m_).degrees
        c=cover(rs,rm,d)
        if c>0 and (best is None or c>best[1]): best=(tn+k*6e4,c)
    if best: refS.append(best)
modS=[e for e in M['ecl'] if e['kind']=='s']; sd_,sc=[],[]
for e in modS:
    b=min(refS,key=lambda r:abs(r[0]-e['max'])) if refS else None
    if b and abs(b[0]-e['max'])<6*3600e3: sd_.append((e['max']-b[0])/1000); sc.append((e['cover']-b[1])*100)
stat('Finsternisse','Sonnenfinsternis in Lübeck, Zeit des Maximums',sd_,180,'s','{:.0f}'); stat('Finsternisse','Sonnenfinsternis, Bedeckung',sc,2,'%','{:.1f}')
rows.append(('Finsternisse','Sonnenfinsternisse in Lübeck: Anzahl',len(modS),str(len(modS)),'',f'{len(refS)} Referenz',len(modS)==len(refS),''))

# 6 Zeitumstellung gegen die Zeitzonen-Datenbank
bad=[]; n=0
for y,mo,da,mi,u,off in M['dst']:
    n+=1; loc=dt.datetime(y,mo+1,da)+dt.timedelta(minutes=mi)
    ut=dt.datetime.fromtimestamp(u/1000,UTC); refoff=ut.astimezone(BER).utcoffset().total_seconds()/60
    l0=loc.replace(tzinfo=BER,fold=1); back=l0.astimezone(UTC).replace(tzinfo=None)   # Oktober: zweiter Durchlauf
    exists=(l0.astimezone(UTC).astimezone(BER).replace(tzinfo=None)==loc)
    if exists: ok=(abs(ut.replace(tzinfo=None)-back).total_seconds()<1) and off==refoff
    else:   # März 02:00–02:59 gibt es nicht: das Modell zeigt den Umstellungsmoment (01:00 UTC)
        ok=ut.hour==1 and ut.minute==0 and off==120
    if not ok: bad.append((y,mo+1,da,mi,ut.isoformat(),off,refoff))
rows.append(('Zeit','Ortszeit ↔ UTC und Sommerzeit 1981–2040 (Viertelstunden)',n,str(len(bad))+' Abweichungen','','0',not bad,''))

# Optional: USNO
if args.usno:
    import urllib.request
    try:
        uu=[]
        for t0,r,s in M['sun'][::30]:
            d=dt.datetime.fromtimestamp(t0/1000+7200,UTC).date()
            url=f"https://aa.usno.navy.mil/api/rstt/oneday?date={d}&coords={M['lat']},{M['lon']}&tz=0"
            j=json.load(urllib.request.urlopen(url,timeout=20)); sd=j['properties']['data']['sundata']
            rise=[x for x in sd if x['phen']=='Rise']
            if rise and r:
                hh,mm=map(int,rise[0]['time'].split(' ')[0].split(':')); uref=dt.datetime(d.year,d.month,d.day,hh,mm,tzinfo=UTC).timestamp()*1000; uu.append((r-uref)/1000)
        stat('USNO (Internet)','Sonnenaufgang (USNO rundet auf Minuten)',uu,90,'s','{:.0f}')
    except Exception as e: rows.append(('USNO (Internet)','nicht erreichbar: '+str(e)[:60],0,'','','',True,''))

# Bericht
ok_all=all(r[6] for r in rows); now=dt.datetime.now().strftime('%d.%m.%Y %H:%M')
md=[f'# Prüfbericht Astronomie – St. Marien Licht und Schatten\n',f'Stand {now}. Zeitraum {Y0}–{Y1}, Lübeck {M["lat"]}° N, {M["lon"]}° O. Referenz: Skyfield {__import__("skyfield").__version__} mit JPL DE421; Zeitzonen: Python zoneinfo (Europe/Berlin).\n',
    f'**Ergebnis: {"alle Prüfungen bestanden" if ok_all else "Grenzen überschritten"}**\n','| Bereich | Prüfung | Fälle | größte Abw. | mittlere Abw. | Grenze | |','|---|---|---:|---:|---:|---:|---|']
for a,b,n,mx,mean,lim,ok,u in rows: md.append(f'| {a} | {b} | {n} | {mx} {u} | {mean} {u if mean else ""} | {lim} {u} | {"✓" if ok else "✗"} |')
if notes: md+=['','Hinweise:']+['- '+x for x in notes]
open(os.path.join(H,'report.md'),'w').write('\n'.join(md)+'\n')
html='<!doctype html><meta charset="utf-8"><title>Prüfbericht Astronomie</title><style>body{font:14px system-ui,sans-serif;max-width:1000px;margin:24px auto;padding:0 16px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:5px 8px;text-align:left}td.n{text-align:right;font-variant-numeric:tabular-nums}.ok{color:#2c7a45}.no{color:#b5482f;font-weight:700}</style>'
html+=f'<h1>Prüfbericht Astronomie</h1><p>{md[1]}</p><p class="{"ok" if ok_all else "no"}"><b>{"Alle Prüfungen bestanden" if ok_all else "Grenzen überschritten"}</b></p><table><tr><th>Bereich<th>Prüfung<th>Fälle<th>größte Abw.<th>mittlere Abw.<th>Grenze<th></tr>'
for a,b,n,mx,mean,lim,ok,u in rows: html+=f'<tr><td>{a}<td>{b}<td class=n>{n}<td class=n>{mx} {u}<td class=n>{mean} {u if mean else ""}<td class=n>{lim} {u}<td class={"ok" if ok else "no"}>{"✓" if ok else "✗"}</tr>'
open(os.path.join(H,'report.html'),'w').write(html+'</table>'+(('<h2>Hinweise</h2><ul>'+''.join('<li>'+x for x in notes)+'</ul>') if notes else ''))
print('\n'.join(md))
if bad: print('\nZeitumstellung, erste Abweichungen:',bad[:5])
sys.exit(0 if ok_all else 1)
