const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--allow-file-access-from-files',
    ],
    executablePath: await chromium.executablePath(),
    headless: true,
    defaultViewport: { width: +(process.env.VW || 1400), height: +(process.env.VH || 850), deviceScaleFactor: 1 },
  });
  const p = await b.newPage();
  const logs = [];
  p.on('console', m => logs.push(m.type() + ': ' + m.text()));
  p.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  await p.goto('file://' + __dirname + '/test.html');
  let ok = false;
  for (let i = 0; i < 60; i++) {
    ok = await p.evaluate(() => !!window.__dbg && document.getElementById('loader').classList.contains('done'));
    if (ok) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!ok) {
    console.log('NOT READY\n' + logs.join('\n').slice(0, 3000));
    await b.close();
    return;
  }
  const W = ms => new Promise(r => setTimeout(r, ms));
  const P = process.env.PFX || 'q';
  const st = async n => {
    const r = await p.evaluate(() => {
      const $ = s => document.querySelector(s);
      return {
        step: $('#qzStep').textContent,
        title: $('#qzTitle').textContent,
        fb: $('#qzFb').hidden ? '' : $('#qzFb').textContent,
        opts: [...document.querySelectorAll('#qzOpts button')]
          .map(
            b =>
              b.textContent + (b.className.includes('ok') ? '[ok]' : '') + (b.className.includes('no') ? '[no]' : ''),
          )
          .join(' / '),
        date: $('#date').value,
        time: $('#time').value,
      };
    });
    console.log(n, JSON.stringify(r));
    await p.screenshot({ path: P + '_' + n + '.png' });
  };
  const ev = (f, ...a) => p.evaluate(f, ...a);
  // Willkommen
  await W(1500);
  await p.screenshot({ path: P + '_welcome.png' });
  if (process.env.LANGQ) {
    await ev(() => document.querySelector('#langBtn').click());
    await W(800);
  }
  await ev(() => document.querySelector('#tourChoice [data-go="quiz"]').click());
  await W(2500);
  await st('1a');
  await ev(() => {
    const d = document.querySelector('#date');
    d.value = '2027-03-01';
    d.dispatchEvent(new Event('change'));
  });
  await W(1500);
  await st('1b');
  await ev(() => {
    const d = document.querySelector('#date');
    d.value = '2027-06-25';
    d.dispatchEvent(new Event('change'));
  });
  await W(1500);
  await st('1c');
  await ev(() => document.querySelector('#qzNext').click());
  await W(3000);
  await st('2a');
  await ev(() => [...document.querySelectorAll('#qzOpts button')].find(b => b.textContent === '2002').click());
  await W(500);
  await st('2b');
  await ev(() => document.querySelector('#qzHint').click());
  await W(3000);
  await st('2c');
  await ev(() => [...document.querySelectorAll('#qzOpts button')].find(b => b.textContent === '1968').click());
  await W(500);
  await st('2d');
  await ev(() => document.querySelector('#qzNext').click());
  await W(3000);
  await st('3a');
  let solved = false;
  for (let m = 770; m <= 830 && !solved; m += 2) {
    await ev(m => {
      const t = document.querySelector('#time');
      t.value = String(m);
      t.dispatchEvent(new Event('input'));
    }, m);
    await W(450);
    solved = await ev(() => !document.querySelector('#qzNext').hidden);
  }
  await st('3b');
  await ev(() => document.querySelector('#qzNext').click());
  await W(3000);
  await st('4a');
  await ev(() => {
    const d = document.querySelector('#date');
    d.value = '2026-05-10';
    d.dispatchEvent(new Event('change'));
  });
  await W(500);
  await ev(() => document.querySelector('#qzHint').click());
  await W(2500);
  console.log('MOONCARD', await ev(() => document.querySelector('#mEcl').textContent));
  await p.screenshot({ path: P + '_4h.png' });
  await ev(() => [...document.querySelectorAll('#qzOpts button')].find(b => b.dataset.ok === '0').click());
  await W(500);
  await st('4b');
  if (process.env.SKIP4) await ev(() => document.querySelector('#qzSkip').click());
  else await ev(() => [...document.querySelectorAll('#qzOpts button')].find(b => b.dataset.ok === '1').click());
  await W(500);
  await st('4c');
  await ev(() => document.querySelector('#qzNext').click());
  await W(3000);
  await st('5a');
  await ev(() => document.querySelector('#qzHint').click());
  await W(3500);
  await st('5b');
  const tap = async type => {
    const xy = await ev(type => {
      const w = window.__win.find(w => w.type === type);
      const v = w.center.clone().project(window.__cam);
      const r = document.querySelector('canvas').getBoundingClientRect();
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height, v.z];
    }, type);
    console.log('tap', type, xy.map(x => x.toFixed(1)).join(','));
    await p.mouse.click(xy[0], xy[1]);
    await W(600);
  };
  await tap(1);
  await st('5c');
  await tap(4);
  await st('5d');
  await ev(() => document.querySelector('#qzNext').click());
  await W(1500);
  await st('6');
  if (process.env.LANGQ2) {
    await ev(() => document.querySelector('#langBtn').click());
    await W(800);
    await st('6en');
  }
  await ev(() => document.querySelector('#qzOpts [data-go="free"]').click());
  await W(2500);
  console.log(
    'end quiz hidden',
    await ev(() => document.querySelector('#quiz').hidden + ' ' + document.querySelector('#viewTxt').textContent),
  );
  console.log(
    logs
      .filter(l => /error|PAGEERROR/i.test(l) && !/TUNNEL/.test(l))
      .slice(0, 10)
      .join('\n')
      .slice(0, 3000),
  );
  await b.close();
})();
