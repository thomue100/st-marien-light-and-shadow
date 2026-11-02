import json, ephem, math, datetime as dt
r=json.load(open('acc.json'))
def ed(ms): return ephem.Date(dt.datetime.utcfromtimestamp(ms/1000))
def ob(press=0):
    o=ephem.Observer(); o.lat='53.8677'; o.lon='10.6850'; o.elevation=20; o.pressure=press; o.temp=10; return o
D=math.degrees
# positions (refracted, pressure 1010)
se=[];sa=[];me=[];ma=[];mt=[]
for t,sel,saz,mel,maz,met in r['pos']:
    o=ob(1010); o.date=ed(t); s=ephem.Sun(o); m=ephem.Moon(o)
    if D(s.alt)>-1: se.append(abs(sel-D(s.alt))); sa.append(abs((saz-D(s.az)+180)%360-180))
    if D(m.alt)>-1: me.append(abs(mel-D(m.alt))); ma.append(abs((maz-D(m.az)+180)%360-180))
    o0=ob(0); o0.date=ed(t); m0=ephem.Moon(o0); mt.append(abs(met-D(m0.alt)))
st=lambda a:(max(a),sum(a)/len(a))
print('sun el max/mean %.4f %.4f'%st(se),'az %.4f %.4f'%st(sa))
print('moon el(refr) max/mean %.4f %.4f'%st(me),'az %.4f %.4f'%st(ma),' elTrue %.4f %.4f'%st(mt))
# rise/set: standard: upper limb, refraction 34'
def rs(body,t0,kind,horizon='-0:34'):
    o=ob(0); o.horizon=horizon; o.date=ed(t0)
    try:
        d=(o.next_rising if kind=='r' else o.next_setting)(body)
    except Exception: return None
    m=(d.datetime()-dt.datetime.utcfromtimestamp(t0/1000)).total_seconds()/60
    return m if m<1440 else None
for name,key,body in [('Sonne','sun',ephem.Sun()),('Mond','moon',ephem.Moon())]:
    ds=[]
    for t0,ri,se_ in r[key]:
        for v,k in [(ri,'r'),(se_,'s')]:
            e=rs(body,t0,k)
            if v is not None and e is not None: ds.append((v-e)*60)
    print(name,'Auf/Unter: n=%d max %.0f s mean |%.0f| s, bias %.0f s'%(len(ds),max(map(abs,ds)),sum(map(abs,ds))/len(ds),sum(ds)/len(ds)))
# phases
dp=[]
for k,t in r['ph']:
    e=(ephem.next_new_moon if k=='n' else ephem.next_full_moon)(ed(t-3*86400000))
    dp.append((t/1000-(e.datetime()-dt.datetime(1970,1,1)).total_seconds()))
print('Phasen n=%d max %.0f s mean |%.0f| s'%(len(dp),max(map(abs,dp)),sum(map(abs,dp))/len(dp)))
