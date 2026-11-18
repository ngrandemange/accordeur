// Génère omr-templates.js : gabarits (altérations, silences) appris sur des partitions LilyPond.
// Usage : node tools/train-templates.js <dossier de PNG d'entraînement>   (nécessite Playwright)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const dir = process.argv[2] || '/tmp/omr/train';
const ACC = ['sharp', 'natural', 'flat', 'natural'], A = []; for (let i = 0; i < 8; i++) A.push(...ACC);
const REST = ['rest4', 'rest8', 'rest8', 'rest4', 'rest16', 'rest8', 'rest4', 'rest4', 'rest8', 'rest8', 'rest16', 'rest8', 'rest4'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent('<canvas></canvas>'); await p.addScriptTag({ path: path.join(__dirname, '../omr.js') });
  const acc = {};
  const add = (cls, c) => { (acc[cls] = acc[cls] || []).push(c); };
  for (const f of fs.readdirSync(dir).filter(x => /^(acc|rest)_.*\.png$/.test(x))) {
    const exp = f.startsWith('acc') ? A : REST;
    for (const blur of [0, 0.8]) {
      const url = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
      let raw = await p.evaluate(async ({ url, blur }) => {
        const img = new Image(); img.src = url; await img.decode(); const W = img.naturalWidth, H = img.naturalHeight;
        const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.filter = blur ? `blur(${blur}px)` : 'none'; x.drawImage(img, 0, 0);
        const dbg = { collect: true }; OMR.analyzeStraight(OMR.toGray(x.getImageData(0, 0, W, H)), W, H, dbg, null); return dbg.raw;
      }, { url, blur });
      raw = raw.filter(c => c.xRel >= 4.2); raw.sort((a, b) => a.staff - b.staff || a.x - b.x);
      if (raw.length !== exp.length) { console.log('  ignoré', f, 'blur', blur, ': ', raw.length, 'composantes pour', exp.length, 'attendues'); continue; }
      raw.forEach((c, i) => add(exp[i], c));
    }
  }
  const out = {};
  for (const [cls, list] of Object.entries(acc)) {
    const n = list.length, g = new Array(list[0].grid.length).fill(0);
    list.forEach(c => c.grid.forEach((v, k) => g[k] += v / n));
    out[cls] = { w: +(list.reduce((s, c) => s + c.wd, 0) / n).toFixed(3), h: +(list.reduce((s, c) => s + c.hd, 0) / n).toFixed(3), grid: g.map(v => +v.toFixed(3)), n };
    console.log(cls.padEnd(8), 'n =', n, 'w/d =', out[cls].w, 'h/d =', out[cls].h);
  }
  fs.writeFileSync(path.join(__dirname, '../omr-templates.js'), '// Généré par tools/train-templates.js — ne pas modifier à la main.\nconst OMR_TEMPLATES = ' + JSON.stringify(out) + ';\nif (typeof module !== \'undefined\') module.exports = OMR_TEMPLATES;\n');
  await b.close();
})();
