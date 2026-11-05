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
    defaultViewport: { width: 1300, height: 800 },
  });
  const p = await b.newPage();
  const logs = [];
  p.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  await p.goto('file://' + __dirname + '/test.html' + (process.env.HASH || ''));
  for (let i = 0; i < 60; i++) {
    if (await p.evaluate(() => !!window.__A && document.getElementById('loader').classList.contains('done'))) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  await p.evaluate(() => {
    const b = document.querySelector('#tourChoice [data-go="free"]');
    if (b) b.click();
  });
  const cases = [
    [2026, 0, 15, 720],
    [2026, 6, 15, 720],
    [2026, 2, 29, 90],
    [2026, 2, 29, 119],
    [2026, 2, 29, 120],
    [2026, 2, 29, 150],
    [2026, 2, 29, 179],
    [2026, 2, 29, 180],
    [2026, 2, 29, 200],
    [2026, 9, 25, 90],
    [2026, 9, 25, 150],
    [2026, 9, 25, 200],
    [2027, 2, 28, 150],
    [2030, 9, 27, 150],
  ];
  for (const [y, m, d, mi] of cases) {
    const r = await p.evaluate(
      (y, m, d, mi) => {
        const A = window.__A;
        A.setDate(y, m, d);
        A.setMinutes(mi);
        const di = A.dstInfo(y, m, d, mi);
        return `${y}-${m + 1}-${d} Regler ${Math.floor(mi / 60)}:${String(mi % 60).padStart(2, '0')} → UTC ${new Date(di.utc).toISOString().slice(11, 16)} Anzeige ${document.querySelector('#timeOut').textContent} ${document.querySelector('#tzName').textContent} | ${document.querySelector('#night').hidden ? '' : document.querySelector('#night').textContent}`;
      },
      y,
      m,
      d,
      mi,
    );
    console.log(r);
  }
  await p.evaluate(() => {
    window.__A.setDate(2026, 2, 29);
    window.__A.setMinutes(150);
  });
  await new Promise(r => setTimeout(r, 800));
  await p.screenshot({ path: 'dst.png' });
  console.log(logs.join('\n'));
  await b.close();
})();
