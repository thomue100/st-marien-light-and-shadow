const chromium=require('@sparticuz/chromium'); const puppeteer=require('puppeteer-core');
(async()=>{ const b=await puppeteer.launch({protocolTimeout:600000,args:[...chromium.args,'--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files'],executablePath:await chromium.executablePath(),headless:true,defaultViewport:{width:+(process.env.VW||1400),height:+(process.env.VH||850)}});
 const p=await b.newPage(); const logs=[]; p.on('pageerror',e=>logs.push('PAGEERROR '+e.message)); p.on('console',m=>{ if((m.type()==='error'||m.type()==='warning')&&!/TUNNEL|googleapis|willReadFrequently/.test(m.text())) logs.push(m.type()+' '+m.text()); });
 await p.goto('file://'+__dirname+'/test.html');
 for(let i=0;i<60;i++){ if(await p.evaluate(()=>!!window.__LK && document.getElementById('loader').classList.contains('done'))) break; await new Promise(r=>setTimeout(r,1000)); }
 const W=ms=>new Promise(r=>setTimeout(r,ms)); const P=process.env.PFX||'ex'; const ev=(f,...a)=>p.evaluate(f,...a);
 await ev(()=>{ const b=document.querySelector('#tourChoice [data-go="free"]'); if(b) b.click(); if(document.querySelector('#langBtn').textContent.trim()==='DE') document.querySelector('#langBtn').click(); });
 const open=async k=>{ await ev(k=>{ if(document.querySelector('#card-exp').hidden) document.querySelector('.rbtn[data-card="exp"]').click(); document.querySelectorAll('.exppanel').forEach(x=>{ if(!x.hidden) x.querySelector('.expback').click(); }); document.querySelector('.explink[data-exp="'+k+'"]').click(); },k); };
 const txt=sel=>ev(s=>[...document.querySelectorAll(s)].map(x=>x.textContent.trim()).join(' | '),sel);
 // 1
 await open('ks'); await W(4000); console.log('KS Juni',await txt('#exp-ks dd')); await p.screenshot({path:P+'_ks1.png'});
 await ev(()=>document.querySelector('#ksSeg [data-m="11"]').click()); await W(2500); console.log('KS Dez',await txt('#exp-ks dd')); await p.screenshot({path:P+'_ks2.png'});
 // 2
 await open('su'); await W(4000); console.log('SU heute',await txt('#suNow')); 
 for(const k of ['min','win','sum']){ await ev(k=>document.querySelector('#suBtns [data-k="'+k+'"]').click(),k); await W(1500); console.log('SU',k,await txt('#suNow'),await ev(()=>document.querySelector('#date').value+' '+document.querySelector('#timeOut').textContent)); }
 await ev(()=>{ const d=document.querySelector('#date'); d.value='2026-04-15'; d.dispatchEvent(new Event('change')); }); await W(1500); console.log('SU Apr15',await txt('#suNow'),await ev(()=>document.querySelector('#timeOut').textContent+' sd '+JSON.stringify(window.__sd.show)));
 await p.screenshot({path:P+'_su.png'});
 // 3
 const t0=Date.now(); await open('lk'); for(let i=0;i<200;i++){ await W(500); if(await ev(()=>!window.__LK.busy&&!!window.__LK.cur)) break; } console.log('LK s',(Date.now()-t0)/1000, await txt('#lkSum'), await txt('#lkWin option'));
 await p.screenshot({path:P+'_lk.png'});
 for(const i of [1,2,3,4]){ const t1=Date.now(); await ev(i=>{ const s=document.querySelector('#lkWin'); s.value=String(i); s.dispatchEvent(new Event('change')); },i); for(let j=0;j<200;j++){ await W(500); if(await ev(()=>!window.__LK.busy)) break; } console.log('LK',i,(Date.now()-t1)/1000,await txt('#lkSum')); }
 await ev(()=>{ const s=document.querySelector('#lkWin'); s.value='0'; s.dispatchEvent(new Event('change')); }); await W(1500);
 // Klick in die Mitte des Juni-Bereichs um 19 Uhr
 const xy=await ev(()=>{ const cv=document.querySelector('#lkCv'), b=cv.getBoundingClientRect(); const L=34,B=18,cw=(cv.width-L-4)/72,ch=(cv.height-B-4)/24; const x=L+((19*60-240)/15+0.5)*cw, y=2+(10+0.5)*ch; return [b.left+x*b.width/cv.width,b.top+y*b.height/cv.height]; });
 await p.mouse.click(xy[0],xy[1]); await W(3500); console.log('LK click',await ev(()=>document.querySelector('#date').value+' '+document.querySelector('#timeOut').textContent+' '+document.querySelector('#viewTxt').textContent)); await p.screenshot({path:P+'_lkin.png'});
 // 4
 await open('au'); await W(4000); console.log('AU',await txt('#auCmp tr'),'|',await txt('#auNote'));
 for(const d of [7,7,7]){ await ev(d=>document.querySelector('#auBtns [data-d="'+d+'"]').click(),d); await W(1200); console.log('AU+'+d,await txt('#auNote'),await ev(()=>document.querySelector('#date').value)); }
 await p.screenshot({path:P+'_au.png'});
 await ev(()=>document.querySelector('#langBtn').click()); await W(1500); console.log('EN',await txt('#auNote'),await txt('#exp-au h3'));
 console.log(logs.join('\n')); await b.close(); })();
