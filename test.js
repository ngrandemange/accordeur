const { detectPitch } = require('./pitch.js');
const sr = 48000;
for (const f of [82.41, 110, 196, 329.63, 440, 880]) {
  const buf = new Float32Array(4096);
  for (let i = 0; i < buf.length; i++) buf[i] = 0.5*Math.sin(2*Math.PI*f*i/sr) + 0.25*Math.sin(4*Math.PI*f*i/sr);
  const r = detectPitch(buf, sr);
  console.log(f, r.toFixed(2), (1200*Math.log2(r/f)).toFixed(1)+' cents');
}
