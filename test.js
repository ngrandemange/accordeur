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
process.exit(bad ? 1 : 0);
