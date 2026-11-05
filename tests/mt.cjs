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
    defaultViewport: { width: +(process.env.VW || 1400), height: +(process.env.VH || 850) },
  });
  const p = await b.newPage();
  const logs = [];
  p.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  p.on('console', m => {
    if (m.type() === 'error' && !/TUNNEL|googleapis/.test(m.text())) logs.push(m.text());
  });
  await p.goto('file://' + __dirname + '/test.html');
  for (let i = 0; i < 60; i++) {
    if (await p.evaluate(() => !!window.__MZT && document.getElementById('loader').classList.contains('done'))) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  const W = ms => new Promise(r => setTimeout(r, ms));
  const P = process.env.PFX || 'mt';
  const ev = (f, ...a) => p.evaluate(f, ...a);
  await ev(() => {
    const b = document.querySelector('#tourChoice [data-go="free"]');
    if (b) b.click();
    if (document.documentElement.lang !== 'de' && document.querySelector('#langBtn').textContent.trim() === 'DE')
      document.querySelector('#langBtn').click();
  });
  await ev(() => document.querySelector('.rbtn[data-card="exp"]').click());
  await W(600);
  await p.screenshot({ path: P + '_list.png' });
  await ev(() => document.querySelector('.explink[data-exp="mt"]').click());
  await W(2500);
  await p.screenshot({ path: P + '_top.png' });
  // Fingertipp 1000 m westlich
  const xy = await ev(() => {
    const v = window.__cam.position
      .clone()
      .set(-43.85 - 1000, 0, 0)
      .project(window.__cam);
    const r = document.querySelector('canvas').getBoundingClientRect();
    return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
  });
  console.log('tap', xy.map(Math.round));
  await p.mouse.click(xy[0], xy[1]);
  await W(2500);
  console.log(
    'after tap',
    await ev(() => window.__MZT.side + ' ' + window.__MZT.dist + ' | ' + document.querySelector('#mtGeo').textContent),
  );
  await p.screenshot({ path: P + '_top2.png' });
  const t0 = Date.now();
  await ev(() => document.querySelector('#mtFind').click());
  for (let i = 0; i < 120; i++) {
    await W(1000);
    if (await ev(() => !window.__MZT.busy && !!window.__MZT.res)) break;
  }
  console.log('search s', (Date.now() - t0) / 1000, await ev(() => document.querySelector('#mtSum').textContent));
  console.log(
    await ev(() =>
      [...document.querySelectorAll('#mtRes button')]
        .slice(0, 6)
        .map(b => b.textContent)
        .join('\n'),
    ),
  );
  await p.screenshot({ path: P + '_res.png' });
  await ev(() => {
    const b = document.querySelector('#mtRes button');
    if (b) b.click();
  });
  await W(3000);
  await p.screenshot({ path: P + '_cam.png' });
  console.log(
    'view',
    await ev(
      () =>
        document.querySelector('#viewTxt').textContent +
        ' ' +
        document.querySelector('#timeOut').textContent +
        ' ' +
        document.querySelector('#date').value,
    ),
  );
  // Osten 500 m
  await ev(() => {
    document.querySelector('.rbtn[data-card="exp"]').click();
  });
  await W(400);
  await ev(() => {
    if (document.querySelector('#card-exp').hidden) document.querySelector('.rbtn[data-card="exp"]').click();
    document.querySelector('#mtSide [data-side="e"]').click();
    const d = document.querySelector('#mtDist');
    d.value = '500';
    d.dispatchEvent(new Event('input'));
    document.querySelector('#mtFind').click();
  });
  for (let i = 0; i < 120; i++) {
    await W(1000);
    if (await ev(() => !window.__MZT.busy && !!window.__MZT.res)) break;
  }
  console.log(
    'EAST',
    await ev(() => document.querySelector('#mtSum').textContent),
    await ev(() =>
      [...document.querySelectorAll('#mtRes button')]
        .slice(0, 3)
        .map(b => b.textContent)
        .join('\n'),
    ),
  );
  await ev(() => {
    const b = document.querySelector('#mtRes button');
    if (b) b.click();
  });
  await W(3000);
  await p.screenshot({ path: P + '_cam2.png' });
  console.log(logs.join('\n'));
  await b.close();
})();
