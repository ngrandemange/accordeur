// Détection de hauteur (algorithme YIN simplifié). Retourne la fréquence en Hz ou -1.
function detectPitch(buf, sampleRate, minHz = 60, maxHz = 1200) {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return -1;

  const half = Math.floor(buf.length / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.min(half - 1, Math.floor(sampleRate / minHz));
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) { const x = buf[i] - buf[i + tau]; sum += x * x; }
    d[tau] = sum;
  }
  // différence normalisée cumulée
  let run = 0;
  d[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; d[tau] = run ? d[tau] * tau / run : 1; }

  const threshold = 0.12;
  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (d[t] < threshold) {
      while (t + 1 < tauMax && d[t + 1] < d[t]) t++;
      tau = t; break;
    }
  }
  if (tau === -1) return -1;
  // interpolation parabolique
  const a = d[tau - 1], b = d[tau], c = d[tau + 1] ?? d[tau];
  const denom = 2 * (2 * b - a - c);
  const shift = denom ? (c - a) / denom : 0;
  return sampleRate / (tau + shift);
}
if (typeof module !== 'undefined') module.exports = { detectPitch };
