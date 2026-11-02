# Webfassung aus der Arbeitsdatei: Code, Stil, Schriften, three.js, Daten und Bilder als eigene Dateien.
import base64, json, os, re, shutil
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC=ROOT+'/src/marienkirche.html'; OUT=ROOT+'/web'; nm=ROOT+'/node_modules/'
s=open(SRC,encoding='utf-8').read()
if os.path.exists(OUT): shutil.rmtree(OUT)
for d in ['css','js','vendor','fonts','data','img']: os.makedirs(f'{OUT}/{d}')

def b64file(uri,path):
    m=re.match(r'data:image/(\w+);base64,(.*)',uri,re.S); ext={'jpeg':'jpg'}.get(m.group(1),m.group(1))
    open(f'{OUT}/{path}.{ext}','wb').write(base64.b64decode(m.group(2))); return f'{path}.{ext}'

# 1 Daten: Glasmalereien und Uhrbilder als Bilddateien, übrige Daten als JSON
blocks={}
for id in ['glassdata','clockdata','envdata']:
    m=re.search(r'<script type="application/json" id="'+id+r'">(.*?)</script>\n?',s,re.S); blocks[id]=json.loads(m.group(1)); s=s.replace(m.group(0),'')
glass={k:b64file(v,f'img/glas-{k}') for k,v in blocks['glassdata'].items()}
ck=blocks['clockdata']; ck['img']={k:b64file(v,f'img/uhr-{k}') for k,v in ck['img'].items()}
json.dump(glass,open(f'{OUT}/data/glas.json','w'),separators=(',',':'))
json.dump(ck,open(f'{OUT}/data/uhr.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(blocks['envdata'],open(f'{OUT}/data/umgebung.json','w'),separators=(',',':'))

# 2 Schriften selbst ausliefern (keine Verbindung zu Google)
fonts=[('Alegreya SC','alegreya-sc',[500,700]),('Alegreya Sans','alegreya-sans',[400,500,700]),('IBM Plex Mono','ibm-plex-mono',[400,500])]
LATIN='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
ff=''
for fam,pkg,ws in fonts:
    for w in ws:
        for sub,rng in [('latin',LATIN),('latin-ext',None)]:
            src=f'{nm}@fontsource/{pkg}/files/{pkg}-{sub}-{w}-normal.woff2'
            if not os.path.exists(src): continue
            shutil.copy(src,f'{OUT}/fonts/'); fn=os.path.basename(src)
            ff+="@font-face{font-family:'%s';font-style:normal;font-weight:%d;font-display:swap;src:url(../fonts/%s) format('woff2');%s}\n"%(fam,w,fn,('unicode-range:'+rng+';') if rng else '')
s=re.sub(r'<link rel="preconnect"[^>]*>\n','',s); s=re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>\n','',s)

# 3 Stil und Programm in eigene Dateien
m=re.search(r'<style>\n(.*?)</style>\n',s,re.S); open(f'{OUT}/css/app.css','w',encoding='utf-8').write(ff+m.group(1)); s=s.replace(m.group(0),'<link rel="stylesheet" href="css/app.css">\n')
m=re.search(r'<script>\n(\(async function\(\)\{.*?\}\)\(\);)\n</script>',s,re.S); js=m.group(1)
def rep(a,b):
    global js; assert js.count(a)==1,a[:60]; js=js.replace(a,b)
# Daten gleich zu Beginn parallel anfordern, an der jeweiligen Stelle abwarten
rep("(async function(){\n'use strict';","(async function(){\n'use strict';\nconst getJSON=(u,f)=>fetch(u).then(r=>{ if(!r.ok) throw new Error(u+': '+r.status); return r.json(); }).catch(e=>{ console.warn('[St. Marien] Daten fehlen',e); return f; });\nconst DATA={glass:getJSON('data/glas.json',{}),clock:getJSON('data/uhr.json',null),env:getJSON('data/umgebung.json',null)};   // Webfassung: Daten als eigene Dateien")
rep("const GLASS=(function(){ try{ return JSON.parse(document.getElementById('glassdata').textContent); }catch(e){ return {}; } })();","const GLASS=await DATA.glass;")
rep("const CK=(function(){ try{ return JSON.parse(document.getElementById('clockdata').textContent); }catch(e){ return null; } })();","const CK=await DATA.clock;")
rep("const ENV=(function(){ try{ return JSON.parse(document.getElementById('envdata').textContent); }catch(e){ return null; } })();","const ENV=await DATA.env;")
open(f'{OUT}/js/app.js','w',encoding='utf-8').write(js); s=s.replace(m.group(0),'<script src="js/app.js"></script>')

# 4 three.js lokal statt vom CDN
shutil.copy(nm+'three/build/three.min.js',f'{OUT}/vendor/'); shutil.copy(nm+'three/examples/js/controls/OrbitControls.js',f'{OUT}/vendor/')
s=s.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>','<script src="vendor/three.min.js"></script>')
s=s.replace('<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>','<script src="vendor/OrbitControls.js"></script>')

# 5 Seitenrahmen; Daten schon beim Laden der Seite vorab anfordern
pre=''.join(f'<link rel="preload" href="data/{f}" as="fetch" crossorigin="anonymous">\n' for f in ['umgebung.json','uhr.json','glas.json'])
head=('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
      '<meta name="description" content="Interaktives 3D-Modell von St. Marien zu Lübeck: Sonne, Mond, Sonnenuhr und Astronomische Uhr zu jeder Stunde des Jahres.">\n'
      '<link rel="preload" href="vendor/three.min.js" as="script">\n'+pre)
i=s.index('<div id="app">'); s=head+s[:i]+'</head>\n<body>\n'+s[i:]+'\n</body>\n</html>\n'
assert 'https://cdn' not in s and 'googleapis' not in s and 'base64' not in js[:0]
open(f'{OUT}/index.html','w',encoding='utf-8').write(s)
tot=0
for r,_,fs in os.walk(OUT):
    for f in fs: p=os.path.join(r,f); tot+=os.path.getsize(p); print(f'{os.path.relpath(p,OUT):48s}{os.path.getsize(p)//1024:6d} KB')
print('gesamt',tot//1024,'KB')
for f in ['LIESMICH.txt','.htaccess']: shutil.copy(os.path.join(ROOT,'tools',f),os.path.join(OUT,f))
