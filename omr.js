// Lecture de partition sur l'appareil (sans service externe) — vision par ordinateur classique.
// Hypothèses : partition imprimée, une voix par portée, photo à peu près à plat et bien éclairée.
// Reconnu : portées, têtes de notes (pleines / creuses), hampes, crochets & ligatures, points de prolongation.
// NON reconnu : silences, altérations accidentelles, liaisons, nuances, changements de clé / de mesure.
const OMR = (() => {
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'], SEMI = [0, 2, 4, 5, 7, 9, 11];
  const CLEF_BASE = { alto: 24, treble: 30, bass: 18 };      // indice diatonique de la ligne du bas (F3, E4, G2)
  const SHARPS = [3, 0, 4, 1, 5, 2, 6], FLATS = [6, 2, 5, 1, 4, 0, 3]; // F C G D A E B / B E A D G C F (indices de lettre)

  function toGray(img) {
    const { data, width: w, height: h } = img, g = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
    return g;
  }
  // Seuillage adaptatif (moyenne locale par image intégrale) : robuste aux ombres et à l'éclairage inégal.
  function binarize(g, w, h) {
    const r = Math.max(8, Math.round(w / 28)), W1 = w + 1, I = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row; } }
    const B = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
        const area = (x1 - x0 + 1) * (y1 - y0 + 1);
        const sum = I[(y1 + 1) * W1 + x1 + 1] - I[y0 * W1 + x1 + 1] - I[(y1 + 1) * W1 + x0] + I[y0 * W1 + x0];
        B[y * w + x] = g[y * w + x] < (sum / area) * 0.80 && g[y * w + x] < 190 ? 1 : 0;
      }
    }
    return B;
  }
  // Zone de papier : lignes/colonnes claires (écarte la table, les bords sombres, les ombres de bord).
  function paperBox(g, w, h) {
    const col = new Float64Array(w), row = new Float64Array(h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = g[y * w + x]; col[x] += v; row[y] += v; }
    for (let x = 0; x < w; x++) col[x] /= h; for (let y = 0; y < h; y++) row[y] /= w;
    const span = (a, n) => { const sm = Array.from(a).sort((p, q) => p - q), ref = sm[Math.floor(sm.length * 0.85)], thr = ref * 0.72;
      let lo = 0, hi = n - 1; while (lo < n && a[lo] < thr) lo++; while (hi > 0 && a[hi] < thr) hi--; return [lo, Math.max(lo, hi)]; };
    const [x0, x1] = span(col, w), [y0, y1] = span(row, h), mx = Math.round(0.012 * w), my = Math.round(0.012 * h);
    return { x0: Math.min(w - 1, x0 + mx), x1: Math.max(0, x1 - mx), y0: Math.min(h - 1, y0 + my), y1: Math.max(0, y1 - my) };
  }
  function maskOutside(B, w, h, bx) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < bx.x0 || x > bx.x1 || y < bx.y0 || y > bx.y1) B[y * w + x] = 0; }
  // Inclinaison de la page : l'angle qui rend la projection horizontale la plus « pointue ».
  function estimateAngle(B, w, h) {
    const pts = []; const stride = Math.max(1, Math.round(Math.sqrt(w * h / 120000)));
    for (let y = 0; y < h; y += 1) for (let x = (y % stride); x < w; x += stride) if (B[y * w + x]) pts.push(x, y);
    const n = pts.length / 2, off = w + 2, bins = new Float64Array(h + 2 * w + 4);
    const score = deg => {
      bins.fill(0); const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
      for (let i = 0; i < n; i++) bins[Math.round(pts[2 * i + 1] * c - pts[2 * i] * s) + off]++;
      let sc = 0; for (let i = 0; i < bins.length; i++) sc += bins[i] * bins[i]; return sc;
    };
    let best = 0, bs = -1;
    for (let a = -10; a <= 10.001; a += 0.5) { const s = score(a); if (s > bs) { bs = s; best = a; } }
    const c0 = best; for (let a = c0 - 0.5; a <= c0 + 0.501; a += 0.1) { const s = score(a); if (s > bs) { bs = s; best = a; } }
    return best;
  }
  function findStaves(B, w, h) {
    const hist = new Int32Array(h); let mx = 0;
    for (let y = 0; y < h; y++) { let c = 0; for (let x = 0; x < w; x++) c += B[y * w + x]; hist[y] = c; if (c > mx) mx = c; }
    const thr = mx * 0.38, lines = [];
    for (let y = 0; y < h;) {
      if (hist[y] >= thr) { const s = y; let sw = 0, sy = 0; while (y < h && hist[y] >= thr) { sw += hist[y]; sy += hist[y] * y; y++; } lines.push({ y: sy / sw, t: y - s }); } else y++;
    }
    const staves = [];
    for (let i = 0; i + 4 < lines.length;) {
      const g = [1, 2, 3, 4].map(k => lines[i + k].y - lines[i + k - 1].y), m = (g[0] + g[1] + g[2] + g[3]) / 4;
      if (m >= 5 && m <= 90 && g.every(v => Math.abs(v - m) <= 0.22 * m)) {
        const ls = lines.slice(i, i + 5); staves.push({ lines: ls.map(l => l.y), t: Math.max(...ls.map(l => l.t)), d: m }); i += 5;
      } else i++;
    }
    if (!staves.length) return staves;
    const ds = staves.map(s => s.d).sort((a, b) => a - b), dm = ds[ds.length >> 1];
    const ok = staves.filter(s => Math.abs(s.d - dm) <= 0.3 * dm);
    for (const s of ok) {   // étendue horizontale de la portée
      let x0 = w, x1 = 0;
      for (const ly of s.lines) { const yy = Math.round(ly); let run = 0; for (let x = 0; x < w; x++) { if (B[yy * w + x]) { run++; } else { if (run > 3 * dm) { x0 = Math.min(x0, x - run); x1 = Math.max(x1, x - 1); } run = 0; } } if (run > 3 * dm) { x0 = Math.min(x0, w - run); x1 = Math.max(x1, w - 1); } }
      s.x0 = x0; s.x1 = x1;
    }
    const res = ok.filter(s => s.x1 - s.x0 > 8 * dm); if (res.length) res[0].first = true; return res;
  }
  // Supprime les lignes de portée (et les lignes supplémentaires) : on efface les traits verticaux FINS qui les croisent
  // (épaisseur ≈ celle d'une ligne). Un trait plus long (hampe, paroi d'une tête) est conservé.
  function removeLines(B, w, h, staves) {
    const B2 = B.slice();
    for (const s of staves) {
      const top = s.lines[0], step = (s.lines[4] - top) / 4, d = s.d;
      // épaisseur réelle d'une ligne : médiane des traits verticaux sur les lignes de la portée
      const th = []; for (const ly of s.lines) { const yc = Math.round(ly); for (let x = s.x0; x <= s.x1; x += 3) { if (!B[yc * w + x]) continue; let u = yc, v = yc; while (B[(u - 1) * w + x]) u--; while (B[(v + 1) * w + x]) v++; th.push(v - u + 1); } }
      th.sort((p, q) => p - q); s.lineT = th.length ? th[th.length >> 1] : s.t; const maxRun = Math.max(2, s.lineT + 1);
      for (let k = -7; k <= 11; k++) {
        const real = k >= 0 && k <= 4, yc = Math.round(top + k * step);
        if (yc < 3 || yc > h - 4) continue;
        const thin = new Uint8Array(w), runs = [];
        for (let x = s.x0; x <= s.x1; x++) {
          let yy = -1; for (const o of [0, -1, 1, -2, 2]) if (B[(yc + o) * w + x]) { yy = yc + o; break; }
          if (yy < 0) continue;
          let u = yy, v = yy; while (u > 0 && B[(u - 1) * w + x]) u--; while (v < h - 1 && B[(v + 1) * w + x]) v++;
          if (v - u + 1 <= maxRun) { thin[x] = 1; runs.push([x, u, v]); }
        }
        if (!real) {                     // ligne supplémentaire : seulement si des tronçons fins s'étendent sur ≥ 1.2d (en tolérant les trous)
          const keep = new Uint8Array(w); let i0 = 0;
          while (i0 < runs.length) { let i1 = i0; while (i1 + 1 < runs.length && runs[i1 + 1][0] - runs[i1][0] <= 0.9 * d) i1++;
            if (runs[i1][0] - runs[i0][0] >= 1.2 * d) for (let q = i0; q <= i1; q++) keep[runs[q][0]] = 1; i0 = i1 + 1; }
          for (const [x, u, v] of runs) if (keep[x]) for (let y = u; y <= v; y++) B2[y * w + x] = 0;
        } else for (const [x, u, v] of runs) for (let y = u; y <= v; y++) B2[y * w + x] = 0;
      }
    }
    return B2;
  }
  const ellipse = (a, b) => { const o = []; for (let dy = -Math.ceil(b); dy <= Math.ceil(b); dy++) for (let dx = -Math.ceil(a); dx <= Math.ceil(a); dx++) if ((dx * dx) / (a * a) + (dy * dy) / (b * b) <= 1) o.push([dx, dy]); return o; };
  function components(mask, w, h, x0, y0, x1, y1) {   // composantes connexes d'un masque, centroïdes
    const seen = new Uint8Array(w * h), out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!mask[y * w + x] || seen[y * w + x]) continue;
      const st = [[x, y]]; seen[y * w + x] = 1; let sx = 0, sy = 0, n = 0;
      while (st.length) { const [cx, cy] = st.pop(); sx += cx; sy += cy; n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy;
          if (nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1 && mask[ny * w + nx] && !seen[ny * w + nx]) { seen[ny * w + nx] = 1; st.push([nx, ny]); } } }
      out.push({ x: sx / n, y: sy / n, n });
    }
    return out;
  }
  function findHeads(B, B2, w, h, s, dbg) {
    const d = s.d, top = s.lines[0], bot = s.lines[4];
    const y0 = Math.max(2, Math.round(top - 3.6 * d)), y1 = Math.min(h - 3, Math.round(bot + 3.6 * d));
    const xs = Math.max(2, Math.round(s.x0 + 3.0 * d)), xe = Math.min(w - 3, s.x1);   // après la clé
    const xsH = Math.round(s.x0 + (s.first ? 6.5 : 4.2) * d);                        // têtes creuses : 1re portée, après le chiffrage (« C », « 4/4 »…)
    const fill = ellipse(0.56 * d, 0.40 * d), mF = new Uint8Array(w * h), mH = new Uint8Array(w * h);
    const mk = (ao, bo, af, bf, side) => {
      const outer = ellipse(ao * d, bo * d), inner = new Set(ellipse(0.28 * d, 0.14 * d).map(p => p[0] + ',' + p[1]));
      const os = new Set(outer.map(p => p[0] + ',' + p[1]));
      return { ring: outer.filter(p => !inner.has(p[0] + ',' + p[1])), hole: ellipse(0.20 * d, 0.07 * d), far: ellipse(af * d, bf * d).filter(p => !os.has(p[0] + ',' + p[1])),
        dirs: [[ao * 0.85, 0], [-ao * 0.85, 0], [0, bo * 0.8], [0, -bo * 0.8]].map(([a, b]) => [Math.round(a * d), Math.round(b * d)]), side: Math.round(side * d), wall: [ao + 0.2, ao > 0.7 ? 0.80 : 0.52] };
    };
    const TPL = [mk(0.66, 0.48, 0.98, 0.80, 1.05), mk(0.86, 0.52, 1.18, 0.86, 1.30)];   // tête normale, ronde (plus large)
    // Deux lectures : image sans lignes (B2) ou image brute (B) en ignorant les rangées de lignes (têtes posées sur une ligne)
    const band = Math.max(1, Math.ceil(s.t / 2)), skip = new Uint8Array(h), stp = (bot - top) / 4;
    for (let k = -8; k <= 12; k++) { const yc = Math.round(top + k * stp); for (let y = yc - band; y <= yc + band; y++) if (y >= 0 && y < h) skip[y] = 1; }
    const hollowAt = (x, y, T, I, sk) => {         // 0 = tête creuse, sinon code de l'échec (diagnostic)
      const has = (px, py) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (I[(py + dy) * w + px + dx]) return true; return false; };
      const cnt = set => { let b = 0, n = 0; for (const [dx, dy] of set) if (!sk || !sk[y + dy]) { n++; b += I[(y + dy) * w + x + dx]; } return [b, n]; };
      const [hb, hn] = cnt(T.hole); if (hb > 0) return 1;
      if (sk && hn < 3 && mF[y * w + x]) return 2;
      const [rb, rn] = cnt(T.ring); if (rn < 0.5 * T.ring.length || rb < (sk ? 0.42 : 0.5) * rn) return 3;
      if (T.dirs.filter(([dx, dy]) => has(x + dx, y + dy)).length < 3) return 4;
      const [fb, fn] = cnt(T.far); if (fb > 0.30 * fn) return 5;
      let yy = y; if (sk) for (const k of [0, -2, 2, -3, 3, -4, 4]) if (!sk[y + k]) { yy = y + k; break; }
      for (const sg of [1, -1]) {                   // l'anneau se referme (pas une ligature) et sa paroi est fine
        if (I[yy * w + x + sg * T.side] || I[(yy - 1) * w + x + sg * T.side] || I[(yy + 1) * w + x + sg * T.side]) return 6;
        let t = 0; const lim = Math.round(T.wall[0] * d); while (t < lim && !I[yy * w + x + sg * t]) t++;
        if (t >= lim) return 7;
        let r = 0; while (r < 0.7 * d && I[yy * w + x + sg * (t + r)]) r++;
        if (r >= T.wall[1] * d) return 8;
      }
      return 0;
    };
    // une ligature = long trait horizontal noir près de la « tête » : pas une tête creuse
    const longRun = (x, y, lim = 1.5) => { for (let dy = -Math.round(0.8 * d); dy <= Math.round(0.8 * d); dy++) { if (skip[y + dy]) continue;
        let a = x, b = x; while (a > 0 && B2[(y + dy) * w + a - 1]) a--; while (b < w - 1 && B2[(y + dy) * w + b + 1]) b++;
        let run = 0; for (let q = x - Math.round(1.1 * d); q <= x + Math.round(1.1 * d); q++) { if (B2[(y + dy) * w + q]) { run++; if (run > lim * d) return true; } else run = 0; } }
      return false; };
    const isHollow = (x, y, T) => (!hollowAt(x, y, T, B2, null) || !hollowAt(x, y, T, B, skip)) && !longRun(x, y);
    const sum = (set, x, y) => { let c = 0; for (const [dx, dy] of set) c += B2[(y + dy) * w + x + dx]; return c; };
    if (dbg) { dbg.hollowAt = (x, y, T, v) => v === undefined ? Math.min(hollowAt(x, y, T, B2, null), hollowAt(x, y, T, B, skip)) : v === 0 ? hollowAt(x, y, T, B2, null) : hollowAt(x, y, T, B, skip); dbg.longRun = longRun; dbg.TPL = TPL; dbg.mF = mF; }
    // barres de mesure : trait vertical qui couvre la portée sans la dépasser
    const staffH = bot - top, barCol = new Uint8Array(w);
    for (let x = s.x0; x <= s.x1; x++) {
      let ok = true; for (let y = Math.round(top); y <= Math.round(bot); y++) if (!B[y * w + x]) { ok = false; break; }
      if (!ok) continue;
      let u = Math.round(top); while (u > 0 && B[(u - 1) * w + x]) u--; let v = Math.round(bot); while (v < h - 1 && B[(v + 1) * w + x]) v++;
      if (v - u <= staffH + 2 * s.t + 4) barCol[x] = 1;
    }
    const nearBar = x => { for (let k = -Math.round(0.9 * d); k <= Math.round(0.9 * d); k++) if (barCol[x + k]) return true; return false; };
    const sx = Math.round(0.56 * d) + 3;
    const blackSide = (x, y, sg) => { let n = 0; for (let dy = -2; dy <= 2; dy++) if (B2[(y + dy) * w + x + sg * sx]) n++; return n >= 3; };
    const bothSides = (x, y) => blackSide(x, y, 1) && blackSide(x, y, -1);
    for (let y = y0; y <= y1; y++) for (let x = xs; x <= xe; x++)
      if (B2[y * w + x] && sum(fill, x, y) >= 0.93 * fill.length && !nearBar(x) && !bothSides(x, y)) mF[y * w + x] = 1;
    const r07 = Math.round(0.75 * d);
    const nearFilled = (x, y) => { for (let dy = -r07; dy <= r07; dy++) for (let dx = -r07; dx <= r07; dx++) if (mF[(y + dy) * w + x + dx]) return true; return false; };
    for (let y = y0; y <= y1; y++) for (let x = xsH; x <= xe; x++)
      if (!nearFilled(x, y) && TPL.some(T => isHollow(x, y, T)) && !nearBar(x)) mH[y * w + x] = 1;
    const filled = components(mF, w, h, xs, y0, xe, y1).filter(c => c.n >= 2).map(c => ({ ...c, hollow: false }));
    const hollow = components(mH, w, h, xs, y0, xe, y1).filter(c => c.n >= 2).map(c => ({ ...c, hollow: true }));
    if (dbg) dbg.mH = mH;
    const all = [...filled, ...hollow].sort((a, b) => b.n - a.n), keep = [];
    for (const c of all) if (!keep.some(k => Math.abs(k.x - c.x) < 0.9 * d && Math.abs(k.y - c.y) < 0.6 * d)) keep.push(c);
    return keep.sort((a, b) => a.x - b.x);
  }
  function hollowDiag(B, w, h, s, x, y) {   // diagnostic (tests)
    const d = s.d, top = s.lines[0], bot = s.lines[4], band = Math.max(2, Math.ceil(s.t / 2) + 1), step = (bot - top) / 4, skip = new Uint8Array(h);
    for (let k = -6; k <= 10; k++) { const yc = Math.round(top + k * step); for (let yy = yc - band; yy <= yc + band; yy++) if (yy >= 0 && yy < h) skip[yy] = 1; }
    const outer = ellipse(0.66 * d, 0.48 * d), inner = new Set(ellipse(0.30 * d, 0.16 * d).map(p => p[0] + ',' + p[1]));
    const ring = outer.filter(p => !inner.has(p[0] + ',' + p[1])), hole = ellipse(0.22 * d, 0.08 * d);
    const outSet = new Set(outer.map(p => p[0] + ',' + p[1])), far = ellipse(0.98 * d, 0.80 * d).filter(p => !outSet.has(p[0] + ',' + p[1]));
    let hb = 0, hn = 0; for (const [dx, dy] of hole) if (!skip[y + dy]) { hn++; hb += B[(y + dy) * w + x + dx]; }
    let rb = 0, rn = 0; for (const [dx, dy] of ring) if (!skip[y + dy]) { rn++; rb += B[(y + dy) * w + x + dx]; }
    let fb = 0, fn = 0; for (const [dx, dy] of far) if (!skip[y + dy]) { fn++; fb += B[(y + dy) * w + x + dx]; }
    return { holeBlack: hb, holeN: hn, ring: +(rb / rn).toFixed(2), ringN: rn, ringTot: ring.length, far: +(fb / fn).toFixed(2) };
  }
  const runLen = (B2, w, h, x, y, dir, max) => { let n = 0; for (let yy = y; yy >= 0 && yy < h && n < max; yy += dir) { if (!B2[yy * w + x]) break; n++; } return n; };
  function addStem(B2, w, h, hd, d) {
    let best = null;
    for (const side of [1, -1]) {           // hampe à droite (vers le haut) ou à gauche (vers le bas)
      const dir = side === 1 ? -1 : 1;
      for (let o = 0.40; o <= 0.78; o += 0.04) {
        const x = Math.round(hd.x + side * o * d), y = Math.round(hd.y + dir * 0.2 * d);
        const n = runLen(B2, w, h, x, y, dir, 5.5 * d);
        if (!best || n > best.len) best = { len: n, dir, x, y: hd.y };
      }
    }
    if (best && best.len >= 2.0 * d) hd.stem = { dir: best.dir, x: best.x, len: best.len, endY: best.y + best.dir * best.len }; else hd.stem = null;
  }
  function countRuns(B2, w, h, x, ya, yb, minT) {      // traits horizontaux (ligature/crochet) croisés par la colonne x
    let runs = 0, cur = 0; const lo = Math.max(0, Math.round(Math.min(ya, yb))), hi = Math.min(h - 1, Math.round(Math.max(ya, yb)));
    for (let y = lo; y <= hi + 1; y++) { if (y <= hi && B2[y * w + x]) cur++; else { if (cur >= minT) runs++; cur = 0; } }
    return runs;
  }
  function classify(B2, w, h, hd, d) {
    hd.dots = 0; hd.flags = 0;
    if (hd.stem) {
      if (hd.hollow) hd.flags = 0;
      else {
        const st = hd.stem, win = Math.min(1.9 * d, st.len - 1.1 * d), a = st.endY - st.dir * 0.15 * d, b = st.endY - st.dir * win;
        let best = 0;
        for (const side of [1, -1]) for (const o of [0.5, 0.7, 0.9]) best = Math.max(best, countRuns(B2, w, h, Math.round(st.x + side * o * d), a, b, Math.max(2, 0.17 * d)));
        hd.flags = Math.min(best, 3);
      }
    }
    // point de prolongation : petit amas noir isolé (ne touchant pas le bord de la zone) à droite de la tête
    const bx0 = Math.round(hd.x + 0.80 * d), bx1 = Math.round(hd.x + 1.75 * d), by0 = Math.round(hd.y - 0.6 * d), by1 = Math.round(hd.y + 0.6 * d);
    const seen = new Set();
    for (let y = by0; y <= by1 && !hd.dots; y++) for (let x = bx0; x <= bx1; x++) {
      if (!B2[y * w + x] || seen.has(y * w + x)) continue;
      const st = [[x, y]]; seen.add(y * w + x); let n = 0, edge = false, mnx = 1e9, mxx = -1, mny = 1e9, mxy = -1;
      while (st.length) { const [cx, cy] = st.pop(); n++; mnx = Math.min(mnx, cx); mxx = Math.max(mxx, cx); mny = Math.min(mny, cy); mxy = Math.max(mxy, cy);
        if (cx <= bx0 || cx >= bx1 || cy <= by0 || cy >= by1) edge = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy;
          if (nx >= bx0 && nx <= bx1 && ny >= by0 && ny <= by1 && B2[ny * w + nx] && !seen.has(ny * w + nx)) { seen.add(ny * w + nx); st.push([nx, ny]); } } }
      if (!edge && n >= 0.05 * d * d && n <= 0.35 * d * d && mxx - mnx <= 0.6 * d && mxy - mny <= 0.6 * d) { hd.dots = 1; break; }
    }
  }
  // img: ImageData (déjà réduite). Retourne le résultat de l'analyse + l'angle estimé.
  function analyzeGray(g, w, h) {
    const B = binarize(g, w, h); maskOutside(B, w, h, paperBox(g, w, h));
    const angle = estimateAngle(B, w, h);
    return { B, angle };
  }
  function analyzeStraight(g, w, h, dbg) {
    const B = binarize(g, w, h), box = paperBox(g, w, h); maskOutside(B, w, h, box);
    const staves = findStaves(B, w, h);
    if (!staves.length) return { staves: [], heads: [], box };
    const B2 = removeLines(B, w, h, staves), heads = [];
    staves.forEach((s, si) => {
      for (const hd of findHeads(B, B2, w, h, s, si === 0 ? dbg : null)) {
        hd.staff = si; addStem(B2, w, h, hd, s.d); classify(B2, w, h, hd, s.d); heads.push(hd);
      }
    });
    if (dbg) dbg.B2 = B2;
    return { staves, heads, box };
  }
  // Convertit les têtes détectées en notes jouables (hauteur diatonique + durée en temps).
  function toNotes(res, { clef = 'alto', key = 0 } = {}) {
    const base = CLEF_BASE[clef] ?? 24, notes = [];
    for (const [id, hd] of res.heads.entries()) {
      const s = res.staves[hd.staff], bot = s.lines[4], half = s.d / 2;
      const step = Math.round((bot - hd.y) / half), dia = base + step;
      let beats;
      if (!hd.stem) beats = hd.hollow ? 4 : 1;
      else if (hd.hollow) beats = 2;
      else beats = [1, 0.5, 0.25, 0.125][hd.flags] ?? 0.25;
      if (hd.dots) beats *= 1.5;
      notes.push({ id, staff: hd.staff, x: hd.x, y: hd.y, dia, alter: keyAlter(dia, key), beats });
    }
    notes.sort((a, b) => a.staff - b.staff || a.x - b.x);
    return notes;
  }
  function keyAlter(dia, key) {
    const li = ((dia % 7) + 7) % 7;
    if (key > 0) return SHARPS.slice(0, key).includes(li) ? 1 : 0;
    if (key < 0) return FLATS.slice(0, -key).includes(li) ? -1 : 0;
    return 0;
  }
  const midiOf = n => 12 * (Math.floor(n.dia / 7) + 1) + SEMI[((n.dia % 7) + 7) % 7] + n.alter;
  const freqOf = (n, a4 = 440) => a4 * Math.pow(2, (midiOf(n) - 69) / 12);
  const nameOf = n => LETTERS[((n.dia % 7) + 7) % 7] + (n.alter > 0 ? '♯' : n.alter < 0 ? '♭' : '') + Math.floor(n.dia / 7);
  return { _i: { removeLines, ellipse, hollowDiag, paperBox }, toGray, binarize, estimateAngle, findStaves, analyzeStraight, analyzeGray, toNotes, keyAlter, midiOf, freqOf, nameOf };
})();
if (typeof module !== 'undefined') module.exports = OMR;
