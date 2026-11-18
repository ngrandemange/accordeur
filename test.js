const { detectPitchEx } = require('./pitch.js');
function sig(f, sr, n, {amp = 0.5, noise = 0, harm = [1, .25, .1], seed = 1} = {}) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647 - .5;
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = 0; harm.forEach((h, k) => v += h * Math.sin(2 * Math.PI * f * (k + 1) * i / sr)); b[i] = amp * v + noise * rnd(); }
  return b;
}
let bad = 0;
const cases = [
  ['La4 normal', 440, {}], ['Do3 alto', 130.81, {}], ['Sol3 faible', 196, {amp: 0.01}],
  ['Do3 fondamentale faible', 130.81, {harm: [.15, 1, .8, .5]}], ['Ré4 bruité', 293.66, {amp: .2, noise: .04}],
  ['La4 harmoniques fortes', 440, {harm: [.3, 1, .7, .4]}], ['Mi5 violon', 659.26, {}],
];
for (const sr of [44100, 48000]) for (const [name, f, o] of cases) {
  const r = detectPitchEx(sig(f, sr, 8192, o), sr, f * 0.8, f * 1.25);
  const err = r.freq > 0 ? 1200 * Math.log2(r.freq / f) : NaN;
  const ok = Math.abs(err) < 2; if (!ok) bad++;
  console.log(sr, name.padEnd(26), r.freq > 0 ? err.toFixed(2).padStart(6) + ' ¢' : '  rien', 'clarté', r.clarity.toFixed(2), ok ? '' : '<-- ÉCHEC');
}

// --- détection ciblée par corde : chaque corde, désaccordée de -40 à +40 cents, timbres variés
const { detectNearest } = require('./pitch.js');
const SETS = {
  alto: [130.81, 196, 293.66, 440], violon: [196, 293.66, 440, 659.26],
  guitare: [82.41, 110, 146.83, 196, 246.94, 329.63],
};
let bad2 = 0, tot = 0;
for (const sr of [44100, 48000]) for (const [inst, hzs] of Object.entries(SETS)) {
  const wins = hzs.map(hz => ({ hz, tol: 0.10 }));
  hzs.forEach((hz, k) => {
    for (const cents of [-40, 0, 25]) for (const harm of [[1, .25, .1], [.1, 1, .7, .4], [.3, 1, .8, .5, .3]]) {
      const f = hz * Math.pow(2, cents / 1200);
      const r = detectNearest(sig(f, sr, 8192, { amp: .02, noise: .004, harm }), sr, wins);
      const err = r.index === k ? 1200 * Math.log2(r.freq / f) : NaN;
      tot++; if (!(Math.abs(err) < 3)) { bad2++; console.log('ÉCHEC', sr, inst, hz, cents, harm.join(','), 'trouvé index', r.index, err); }
    }
  });
}
console.log(`détection ciblée: ${tot - bad2}/${tot} OK`);
process.exit(bad || bad2 ? 1 : 0);
