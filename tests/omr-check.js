// Test de non-régression de la lecture de partition (nécessite Playwright + Chromium).
// Usage : node tests/omr-check.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const EXPECT = 'C4:1 D4:1 E4:1 F4:1 G4:2 A4:2 B4:0.5 C5:0.5 D5:0.5 E5:0.5 F5:1 E5:1 C5:4 G3:1 A3:1 B3:1 C4:1 C3:0.5 D3:0.5 E3:0.5 F3:0.5 G3:1 G3:1 F5:0.25 E5:0.25 D5:0.25 C5:0.25 B4:0.5 A4:0.5 G4:1 C4:4'.split(' ');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent('<canvas></canvas>'); await p.addScriptTag({ path: path.join(__dirname, '../omr.js') });
  let fail = 0;
  for (const [file, minScore] of [['t1.png', 1.0], ['d1.jpg', 0.9]]) {
    const url = 'data:image/' + (file.endsWith('png') ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(path.join(__dirname, 'omr', file)).toString('base64');
    const got = await p.evaluate(async url => {
      const img = new Image(); img.src = url; await img.decode(); const W = Math.min(1800, img.naturalWidth), H = Math.round(img.naturalHeight * W / img.naturalWidth);
      const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#3a3a3a'; x.fillRect(0, 0, W, H); return [c, x]; };
      const [c0, x0] = mk(); x0.drawImage(img, 0, 0, W, H);
      const a = OMR.analyzeGray(OMR.toGray(x0.getImageData(0, 0, W, H)), W, H).angle;
      const [c1, x1] = mk(); x1.translate(W / 2, H / 2); x1.rotate(-a * Math.PI / 180); x1.drawImage(c0, -W / 2, -H / 2);
      const res = OMR.analyzeStraight(OMR.toGray(x1.getImageData(0, 0, W, H)), W, H);
      return OMR.toNotes(res, { clef: 'alto', key: 0 }).map(n => OMR.nameOf(n) + ':' + n.beats);
    }, url);
    const hit = EXPECT.filter((e, i) => got.includes(e)).length, extra = Math.max(0, got.length - EXPECT.length), score = (hit - extra) / EXPECT.length;
    console.log(file.padEnd(8), `attendu ${EXPECT.length}, lu ${got.length}, score ${(score * 100).toFixed(0)} %`);
    if (file === 't1.png' && got.join(' ') !== EXPECT.join(' ')) { fail++; console.log('ÉCHEC: lecture exacte attendue\n', got.join(' ')); }
    if (score < minScore - 1e-9) { fail++; console.log('ÉCHEC: score sous', minScore); }
  }
  await b.close(); process.exit(fail ? 1 : 0);
})();
