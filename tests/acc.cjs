const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
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
    defaultViewport: { width: 800, height: 600 },
  });
  const p = await b.newPage();
  await p.goto('file://' + __dirname + '/test.html');
  for (let i = 0; i < 60; i++) {
    if (await p.evaluate(() => !!window.__A && document.getElementById('loader').classList.contains('done'))) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  const r = await p.evaluate(() => {
    const A = window.__A,
      out = { pos: [], sun: [], moon: [], ph: [] };
    for (let k = 0; k < 48; k++) {
      const t = Date.UTC(2026, 0, 3) + k * 7.6 * 86400000 + k * 3600000 * 5;
      const s = A.sunPos(t),
        m = A.moonPos(t);
      out.pos.push([t, s.el, s.az, m.el, m.az, m.elTrue]);
    }
    for (let k = 0; k < 36; k++) {
      const d = new Date(Date.UTC(2026, 0, 5) + k * 10 * 86400000);
      A.setDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const dy = A.day(),
        t0 = A.localToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0);
      out.sun.push([t0, dy.rise, dy.set]);
      out.moon.push([t0, dy.mrise, dy.mset]);
    }
    let t = Date.UTC(2026, 0, 1);
    for (let k = 0; k < 26; k++) {
      const n = A.moonPhaseTime(t, 0, 1),
        f = A.moonPhaseTime(t, 180, 1);
      out.ph.push(['n', n], ['f', f]);
      t = Math.min(n, f) + 86400000 * 3;
    }
    return out;
  });
  fs.writeFileSync('acc.json', JSON.stringify(r));
  await b.close();
})();
