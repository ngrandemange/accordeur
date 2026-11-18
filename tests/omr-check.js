// Test de non-régression de la lecture de partition (nécessite Playwright + Chromium).
// Les partitions de test sont générées avec LilyPond (tests/omr/*.ly). Usage : node tests/omr-check.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const CASES = [
  ['t1.png', 'alto', 0, 'C4:1 D4:1 E4:1 F4:1 G4:2 A4:2 B4:0.5 C5:0.5 D5:0.5 E5:0.5 F5:1 E5:1 C5:4 G3:1 A3:1 B3:1 C4:1 C3:0.5 D3:0.5 E3:0.5 F3:0.5 G3:1 G3:1 F5:0.25 E5:0.25 D5:0.25 C5:0.25 B4:0.5 A4:0.5 G4:1 C4:4', 1.0],
  ['t2.png', 'alto', 2, 'D4:1.5 E4:0.5 F♯4:1 r:1 G4:1 G♯4:1 A4:1 r:0.5 B4:0.5 C♯5:1 C5:1 D5:2 r:2 r:1 r:0.5 E5:0.5 F♯5:0.25 G5:0.25 r:0.25 A5:0.25 B4:1 r:1 D4:4', 1.0],
  ['t3.png', 'treble', -2, 'B♭4:1 A4:1 B4:1 E♭5:1.5 D5:0.5 r:1 G♭5:1 F5:0.5 r:0.5 E5:1 r:1 r:0.5 C5:0.5 D5:1 B♭4:3 r:3', 1.0],
  ['t4.png', 'bass', 4, 'E3:1 F♯3:1 G♯3:0.5 r:0.5 A3:1 B3:1 B♯3:1 r:1 r:0.5 C♯4:0.5 D♯4:2 E3:2', 1.0],
  ['d1.jpg', 'alto', 0, 'C4:1 D4:1 E4:1 F4:1 G4:2 A4:2 B4:0.5 C5:0.5 D5:0.5 E5:0.5 F5:1 E5:1 C5:4 G3:1 A3:1 B3:1 C4:1 C3:0.5 D3:0.5 E3:0.5 F3:0.5 G3:1 G3:1 F5:0.25 E5:0.25 D5:0.25 C5:0.25 B4:0.5 A4:0.5 G4:1 C4:4', 0.85],   // t1 « photographiée » (inclinée, ombrée, floue)
];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent('<canvas></canvas>');
  for (const f of ['omr.js', 'omr-templates.js']) await p.addScriptTag({ path: path.join(__dirname, '..', f) });
  let fail = 0;
  for (const [file, clef, key, expect, minScore] of CASES) {
    const url = 'data:image/' + (file.endsWith('png') ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(path.join(__dirname, 'omr', file)).toString('base64');
    const r = await p.evaluate(async url => {
      const img = new Image(); img.src = url; await img.decode(); const W = Math.min(1800, img.naturalWidth), H = Math.round(img.naturalHeight * W / img.naturalWidth);
      const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#3a3a3a'; x.fillRect(0, 0, W, H); return [c, x]; };
      const [c0, x0] = mk(); x0.drawImage(img, 0, 0, W, H);
      const a = OMR.analyzeGray(OMR.toGray(x0.getImageData(0, 0, W, H)), W, H).angle;
      const [c1, x1] = mk(); x1.translate(W / 2, H / 2); x1.rotate(-a * Math.PI / 180); x1.drawImage(c0, -W / 2, -H / 2);
      const res = OMR.analyzeStraight(OMR.toGray(x1.getImageData(0, 0, W, H)), W, H, null, OMR_TEMPLATES);
      return { clef: res.clef, key: res.key, notes: OMR.toNotes(res, { clef: res.clef || 'alto', key: res.key }).map(n => n.rest ? 'r:' + n.beats : OMR.nameOf(n) + ':' + n.beats) };
    }, url);
    const exp = expect.split(' '), hit = exp.filter((e, i) => r.notes[i] === e).length, score = Math.max(0, hit - Math.max(0, r.notes.length - exp.length)) / exp.length;
    const okHdr = r.clef === clef && r.key === key;
    console.log(file.padEnd(8), `clé ${r.clef} (attendu ${clef}), armure ${r.key} (attendu ${key}), éléments ${r.notes.length}/${exp.length}, exacts ${(score * 100).toFixed(0)} %`);
    if (!okHdr) { fail++; console.log('  ÉCHEC : clé / armure'); }
    if (score < minScore - 1e-9) { fail++; console.log('  ÉCHEC : score sous', minScore, '\n  lu     :', r.notes.join(' '), '\n  attendu:', expect); }
  }
  await b.close(); process.exit(fail ? 1 : 0);
})();
