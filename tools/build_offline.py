import base64, os, re
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(ROOT+'/dist',exist_ok=True)
s=open(ROOT+'/src/marienkirche.html',encoding='utf-8').read()
nm=ROOT+'/node_modules/'
three=open(nm+'three/build/three.min.js').read(); orbit=open(nm+'three/examples/js/controls/OrbitControls.js').read()
fonts=[('Alegreya SC','alegreya-sc',[500,700]),('Alegreya Sans','alegreya-sans',[400,500,700]),('IBM Plex Mono','ibm-plex-mono',[400,500])]
ff=''
for fam,pkg,ws in fonts:
    for w in ws:
        for sub,rng in [('latin','U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'),('latin-ext',None)]:
            try: b=open(f'{nm}@fontsource/{pkg}/files/{pkg}-{sub}-{w}-normal.woff2','rb').read()
            except FileNotFoundError: continue
            ff+="@font-face{font-family:'%s';font-style:normal;font-weight:%d;font-display:block;src:url(data:font/woff2;base64,%s) format('woff2');%s}\n"%(fam,w,base64.b64encode(b).decode(),('unicode-range:'+rng+';') if rng else '')
s=re.sub(r'<link rel="preconnect"[^>]*>\n','',s); s=re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>\n','',s)
s=s.replace('<style>\n','<style>\n'+ff,1)
s=s.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>','<script>\n'+three.replace('</script','<\\/script')+'\n</script>')
s=s.replace('<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>','<script>\n'+orbit.replace('</script','<\\/script')+'\n</script>')
s=s.replace("Die 3D-Bibliothek konnte nicht geladen werden. Bitte Seite neu laden.","Die 3D-Bibliothek fehlt in dieser Datei.")
head='<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>:root{color-scheme:light dark}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'
i=s.index('<div id="app">'); s=head+s[:i]+'</head>\n<body>\n'+s[i:]+'\n</body>\n</html>\n'
assert 'https://cdn' not in s and 'googleapis' not in s
open(ROOT+'/dist/St-Marien-Licht-und-Schatten-offline.html','w',encoding='utf-8').write(s); print(len(s)//1024,'KB')
