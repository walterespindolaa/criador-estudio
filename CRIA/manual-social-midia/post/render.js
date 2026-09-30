const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file:///home/claude/msm/post/out/manual.html');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  // quais páginas estouram
  const over = await p.evaluate(() => [...document.querySelectorAll('.page')].map((pg, i) => {
    const r = pg.getBoundingClientRect(); let max = 0;
    pg.querySelectorAll('*').forEach(e => { if (e.closest('.rodape')||e.classList.contains('bolha')||e.closest('.topo')) return; const b = e.getBoundingClientRect(); if (b.height>0) max = Math.max(max, b.bottom - r.top); });
    return [i + 1, Math.round(max / r.height * 297)];
  }).filter(x => x[1] > 283));
  console.log('estouro(mm):', JSON.stringify(over));
  await p.pdf({ path: '/home/claude/msm/post/out/Manual-Cria-Post.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  await b.close();
})();
