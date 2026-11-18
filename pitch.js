// Détection de hauteur (YIN). detectPitchEx -> {freq, clarity} (freq=-1 si rien), clarity 0..1.
function detectPitchEx(buf, sampleRate, minHz = 60, maxHz = 1200, gate = 0.002) {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < gate) return { freq: -1, clarity: 0, rms };

  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.floor(sampleRate / minHz);
  const W = buf.length - tauMax - 1;           // fenêtre fixe, indépendante de tau
  if (W < tauMax) return { freq: -1, clarity: 0, rms };
  const d = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let sum = 0;
    for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; sum += x * x; }
    d[tau] = sum;
  }
  let run = 0; d[0] = 1;
  for (let tau = 1; tau <= tauMax + 1; tau++) { run += d[tau]; d[tau] = run ? d[tau] * tau / run : 1; }

  // premier creux sous le seuil ; sinon, creux global (cordes frottées : fondamentale faible)
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < 0.15) { while (t + 1 <= tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau === -1) {
    let best = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (d[t] < d[best]) best = t;
    if (d[best] > 0.35) return { freq: -1, clarity: 0, rms };
    tau = best;
    // évite l'erreur d'octave : si 2*tau est presque aussi bon, on garde tau (hauteur la plus aiguë cohérente)
  }
  const a = d[tau - 1], b = d[tau], c = d[tau + 1];
  const denom = 2 * (2 * b - a - c);
  const shift = denom ? (c - a) / denom : 0;
  return { freq: sampleRate / (tau + Math.max(-1, Math.min(1, shift))), clarity: 1 - d[tau], rms };
}
function detectPitch(buf, sampleRate, minHz, maxHz) { return detectPitchEx(buf, sampleRate, minHz, maxHz).freq; }

// Détection ciblée (NSDF/MPM) : on cherche la hauteur seulement autour des notes attendues
// (fenêtres [hz*(1-tol), hz*(1+tol)]) et on garde la fenêtre la plus convaincante.
// Aucune erreur d'octave possible entre cordes ; robuste aux fondamentales faibles.
// wins: [{hz, tol}] -> {index, freq, clarity, rms}
function detectNearest(buf, sr, wins, gate = 0.002) {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  const none = { index: -1, freq: -1, clarity: 0, rms };
  if (rms < gate) return none;
  const res = wins.map((w, index) => {
    const t0 = Math.max(2, Math.floor(sr / (w.hz * (1 + w.tol)))), t1 = Math.ceil(sr / (w.hz * (1 - w.tol)));
    const W = buf.length - t1 - 1; if (W < t1) return { index, clarity: 0 };
    const n = new Float32Array(t1 + 2);
    for (let tau = t0 - 1; tau <= t1 + 1; tau++) {
      let r = 0, m = 0;
      for (let i = 0; i < W; i++) { const a = buf[i], b = buf[i + tau]; r += a * b; m += a * a + b * b; }
      n[tau] = m ? 2 * r / m : 0;
    }
    let best = t0; for (let t = t0; t <= t1; t++) if (n[t] > n[best]) best = t;
    const a = n[best - 1], b = n[best], c = n[best + 1], den = a - 2 * b + c;
    const shift = den < 0 ? Math.max(-1, Math.min(1, 0.5 * (a - c) / den)) : 0;
    return { index, clarity: b, freq: sr / (best + shift), hz: w.hz };
  });
  const top = Math.max(...res.map(x => x.clarity));
  if (top < 0.75) return none;
  // en cas d'égalité, la note la plus aiguë (sous-multiples d'une note grave plus aiguë)
  const cand = res.filter(x => x.clarity >= top - 0.04).sort((x, y) => y.hz - x.hz)[0];
  return { index: cand.index, freq: cand.freq, clarity: cand.clarity, rms };
}
if (typeof module !== 'undefined') module.exports = { detectPitch, detectPitchEx, detectNearest };
