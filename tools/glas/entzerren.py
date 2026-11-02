import numpy as np
from PIL import Image, ImageOps
A='/mnt/user-data/attachments/2c484b52-542e-508b-bcec-ba8844d770de/'
def homog(src,dst):
    M=[];b=[]
    for (x,y),(u,v) in zip(src,dst):
        M.append([x,y,1,0,0,0,-u*x,-u*y]); b.append(u)
        M.append([0,0,0,x,y,1,-v*x,-v*y]); b.append(v)
    h=np.linalg.solve(np.array(M,float),np.array(b,float)); return np.append(h,1).reshape(3,3)
def ap(H,p): q=H@np.array([p[0],p[1],1.0]); return q[:2]/q[2]
def rect(name,ya,La,Ra,yb,Lb,Rb,apex,bottom,W,ratio,out,margin=0.0):
    im=Image.open(A+name+'-image.jpg').convert('RGB')
    H=homog([(La,ya),(Ra,ya),(Lb,yb),(Rb,yb)],[(0,0),(1,0),(0,1),(1,1)]); Hi=np.linalg.inv(H)
    va=ap(H,apex)[1]; vb=ap(H,bottom)[1]
    u0,u1=-margin,1+margin
    Hh=int(round(W*ratio))
    # output corners -> normalized -> source
    corners=[(0,0),(W,0),(W,Hh),(0,Hh)]; norm=[(u0,va),(u1,va),(u1,vb),(u0,vb)]
    src=[ap(Hi,n) for n in norm]
    # PIL PERSPECTIVE wants coeffs mapping output->input
    Ho=homog(corners,src); c=(Ho/Ho[2,2]).flatten()[:8]
    o=im.transform((W,Hh),Image.PERSPECTIVE,tuple(c),Image.BICUBIC)
    o=ImageOps.autocontrast(o,cutoff=(0.3,0.5))
    o.save(out,quality=88); print(out,o.size,'va',round(va,3),'vb',round(vb,3))
    return o
rect('96672071',1150,645,1175,2200,565,1227,(905,362),(905,2490),400,10.1/2.6,'n6.jpg')
rect('57e5c897',650,618,1131,2150,523,1251,(870,215),(880,2468),400,10.1/2.6,'n1.jpg')
rect('ac99317a',500,453,832,2000,416,910,(668,200),(668,2142),400,11.69/2.3,'n5.jpg')
rect('076e859f',1000,1112,1338,2340,1108,1362,(1225,873),(1235,2355),300,7.8/1.48,'n2.jpg')
# Lüpertz: fast frontal, Rechteck-Ausschnitt
im=Image.open(A+'1c79cf16-image.jpg').convert('RGB').crop((405,313,2460,1815)).resize((800,int(800*2.175/2.5)),Image.LANCZOS)
im=ImageOps.autocontrast(im,cutoff=(0.3,0.5)); im.save('n4.jpg',quality=88); print('n4',im.size)
