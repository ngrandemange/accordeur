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
  // Rétablit les pixels de ligne effacés qui reliaient deux morceaux d'un même trait (bémol, dièse, bécarre coupés par une ligne).
  function repairLines(B, B2, w, h, staves) {
    const B3 = B2.slice();
    for (const s of staves) {
      const band = Math.max(2, Math.ceil((s.lineT || s.t) / 2) + 1);
      for (const ly of s.lines) { const yc = Math.round(ly);
        for (let x = s.x0; x <= s.x1; x++) for (let y = yc - band; y <= yc + band; y++) {
          if (!B[y * w + x] || B2[y * w + x]) continue;
          let up = false, dn = false;
          for (let k = 1; k <= 2; k++) { if (B2[(y - k) * w + x]) up = true; if (B2[(y + k) * w + x]) dn = true; }
          if (up && dn) B3[y * w + x] = 1;
        } }
    }
    return B3;
  }
  // ellipse inclinée de th radians (têtes de notes penchées, polices italiques)
  const ellipseRot = (a, b, th) => { const o = [], c = Math.cos(th), s = Math.sin(th), R = Math.ceil(Math.max(a, b)); for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const u = dx * c + dy * s, v = -dx * s + dy * c; if ((u * u) / (a * a) + (v * v) / (b * b) <= 1) o.push([dx, dy]); } return o; };
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
  function findHeads(B, B2, w, h, s, dbg, hollowOK) {
    const d = s.d, top = s.lines[0], bot = s.lines[4];
    const y0 = Math.max(2, Math.round(top - 5.2 * d)), y1 = Math.min(h - 3, Math.round(bot + 5.2 * d));
    const hdr = s.hasHeader ? s.keyEnd : s.x0 + 3.5 * d;          // début de la musique : après la clé et l'armure
    const xs = Math.max(2, Math.round(hdr + 0.3 * d)), xe = Math.min(w - 3, s.x1);
    const xsH = Math.round(hdr + (s.first ? 3.2 : 0.5) * d);          // têtes creuses : 1re portée, après le chiffrage                        // têtes creuses : 1re portée, après le chiffrage (« C », « 4/4 »…)
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
      if (hollowOK && !nearFilled(x, y) && !nearBar(x) && hollowOK(x, y) && TPL.some(T => isHollow(x, y, T))) mH[y * w + x] = 1;
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
  // Longueur d'un trait vertical (hampe) : tolère un décalage latéral de 2 px au plus et des trous de ≤ 3 lignes (ligne de portée effacée).
  const runLen = (B2, w, h, x, y, dir, max) => {
    let n = 0, cx = x, gap = 0;
    for (let yy = y; yy >= 0 && yy < h && n < max; yy += dir) {
      if (B2[yy * w + cx]) { gap = 0; n++; continue; }
      if (Math.abs(cx - 1 - x) <= 0 && B2[yy * w + cx - 1]) { cx--; gap = 0; n++; continue; }
      if (Math.abs(cx + 1 - x) <= 0 && B2[yy * w + cx + 1]) { cx++; gap = 0; n++; continue; }
      if (++gap > 3) return n - 3; n++;
    }
    return n - gap;
  };
  function addStem(B2, w, h, hd, d) {
    let best = null;
    for (const side of [1, -1]) {           // hampe à droite (vers le haut) ou à gauche (vers le bas)
      const dir = side === 1 ? -1 : 1;
      for (let o = 0.40; o <= 0.78; o += 0.04) {
        const x = Math.round(hd.x + side * o * d), y = Math.round(hd.y + dir * 0.2 * d);
        const n = runLen(B2, w, h, x, y, dir, 7.5 * d);
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
        // crochets / ligatures : traits horizontaux croisés en partant du bout de la hampe vers la tête ;
        // le 1er doit toucher le bout (≤ 0.5d), le 2e ≤ 1.25d, le 3e ≤ 2.0d (écarte les altérations voisines)
        const st = hd.stem, L = Math.min(2.8 * d, st.len - 1.0 * d), minT = Math.max(2, 0.17 * d), lim = [1.0 * d, 1.7 * d, 2.4 * d];
        let best = 0;
        for (const side of [1, -1]) for (const o of [0.5, 0.7, 0.9]) {
          const x = Math.round(st.x + side * o * d); let k = 0, cnt = 0;
          while (k <= L && cnt < 3) {
            const y = Math.round(st.endY - st.dir * k);
            if (y < 0 || y >= h || !B2[y * w + x]) { k++; continue; }
            let k1 = k; while (k1 <= L && B2[Math.round(st.endY - st.dir * k1) * w + x]) k1++;
            if (k1 - k >= minT && k <= lim[cnt]) cnt++; else if (k1 - k >= minT) break;
            k = k1 + 1;
          }
          best = Math.max(best, cnt);
        }
        hd.flags = Math.min(best, 3);
      }
    }
    hd.dots = dotAfter(B2, w, h, hd.x + 0.72 * d, hd.y, d) ? 1 : 0;
  }
  // img: ImageData (déjà réduite). Retourne le résultat de l'analyse + l'angle estimé.
  function analyzeGray(g, w, h) {
    const B = binarize(g, w, h); maskOutside(B, w, h, paperBox(g, w, h));
    const angle = estimateAngle(B, w, h);
    return { B, angle };
  }

  // ---------- nettoyage, composantes, symboles ----------
  // Efface les petites taches (bruit de photo / JPEG) : composantes 8-connexes de moins de minArea pixels.
  function despeckle(M, w, h, minArea) {
    const seen = new Uint8Array(w * h), st = [];
    for (let i = 0; i < w * h; i++) {
      if (!M[i] || seen[i]) continue;
      const comp = [i]; seen[i] = 1; st.length = 0; st.push(i);
      while (st.length) { const p = st.pop(), x = p % w, y = (p - x) / w;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const q = ny * w + nx; if (M[q] && !seen[q]) { seen[q] = 1; st.push(q); comp.push(q); } }
        if (comp.length >= minArea) break; }
      if (comp.length < minArea) for (const q of comp) M[q] = 0;
      else { // grande composante : on finit le marquage sans stocker
        while (st.length) { const p = st.pop(), x = p % w, y = (p - x) / w;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const q = ny * w + nx; if (M[q] && !seen[q]) { seen[q] = 1; st.push(q); } } } }
    }
  }
  // Composantes connexes (8-voisins) d'une zone ; remplit lab (identifiants > 0) et renvoie leurs boîtes englobantes.
  function labelRegion(M, w, h, x0, y0, x1, y1, lab, id0) {
    const comps = []; let id = id0; const st = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!M[y * w + x] || lab[y * w + x]) continue;
      id++; lab[y * w + x] = id; st.length = 0; st.push(y * w + x);
      let mnx = x, mxx = x, mny = y, mxy = y, area = 0, sx = 0, sy = 0;
      while (st.length) { const p = st.pop(), px = p % w, py = (p - px) / w; area++; sx += px; sy += py;
        if (px < mnx) mnx = px; if (px > mxx) mxx = px; if (py < mny) mny = py; if (py > mxy) mxy = py;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = px + dx, ny = py + dy;
          if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue; const q = ny * w + nx; if (M[q] && !lab[q]) { lab[q] = id; st.push(q); } } }
      comps.push({ id, x0: mnx, x1: mxx, y0: mny, y1: mxy, w: mxx - mnx + 1, h: mxy - mny + 1, area, cx: sx / area, cy: sy / area });
    }
    return comps;
  }
  const process_debug = false;
  const GW = 10, GH = 14;
  function gridOf(lab, w, c) {                                  // empreinte normalisée (fraction de pixels de la composante par cellule)
    const g = new Float32Array(GW * GH), cnt = new Float32Array(GW * GH);
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) {
      const gx = Math.min(GW - 1, Math.floor((x - c.x0) * GW / c.w)), gy = Math.min(GH - 1, Math.floor((y - c.y0) * GH / c.h)), k = gy * GW + gx;
      cnt[k]++; const L = lab[y * w + x]; if (c.ids ? c.ids.has(L) : L === c.id) g[k]++;
    }
    for (let k = 0; k < g.length; k++) g[k] = cnt[k] ? g[k] / cnt[k] : 0;
    return g;
  }
  const gridScore = (a, b) => { let mn = 0, mx = 0; for (let k = 0; k < a.length; k++) { mn += Math.min(a[k], b[k]); mx += Math.max(a[k], b[k]); } return mx ? mn / mx : 0; };
  // Barres de mesure : colonnes noires sur toute la hauteur de la portée (sans la dépasser), regroupées.
  function findBars(B, w, h, s) {
    const top = Math.round(s.lines[0]), bot = Math.round(s.lines[4]), staffH = bot - top, cols = [];
    for (let x = s.x0; x <= s.x1; x++) {
      let ok = true; for (let y = top; y <= bot; y++) if (!B[y * w + x]) { ok = false; break; }
      if (!ok) continue; let u = top; while (u > 0 && B[(u - 1) * w + x]) u--; let v = bot; while (v < h - 1 && B[(v + 1) * w + x]) v++;
      if (v - u <= staffH + 2 * s.t + 4) cols.push(x);
    }
    const bars = []; for (const x of cols) { const l = bars[bars.length - 1]; if (l && x - l.x1 <= 0.6 * s.d) { l.x1 = x; } else bars.push({ x0: x, x1: x }); }
    return bars.map(b => (b.x0 + b.x1) / 2);
  }
  // Point de prolongation à droite de (x, y) : petit amas noir isolé.
  function dotAfter(B2, w, h, xStart, y, d) {
    const bx0 = Math.round(xStart), bx1 = Math.round(xStart + 1.0 * d), by0 = Math.round(y - 0.95 * d), by1 = Math.round(y + 0.7 * d), seen = new Set();
    for (let yy = by0; yy <= by1; yy++) for (let x = bx0; x <= bx1; x++) {
      if (!B2[yy * w + x] || seen.has(yy * w + x)) continue;
      const st = [[x, yy]]; seen.add(yy * w + x); let n = 0, edge = false, mnx = 1e9, mxx = -1, mny = 1e9, mxy = -1;
      while (st.length) { const [cx, cy] = st.pop(); n++; mnx = Math.min(mnx, cx); mxx = Math.max(mxx, cx); mny = Math.min(mny, cy); mxy = Math.max(mxy, cy);
        if (cx <= bx0 || cx >= bx1 || cy <= by0 || cy >= by1) edge = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx >= bx0 && nx <= bx1 && ny >= by0 && ny <= by1 && B2[ny * w + nx] && !seen.has(ny * w + nx)) { seen.add(ny * w + nx); st.push([nx, ny]); } } }
      if (!edge && n >= 0.04 * d * d && n <= 0.40 * d * d && mxx - mnx <= 0.6 * d && mxy - mny <= 0.6 * d) return true;
    }
    return false;
  }
  // Classe une composante hors-tête : { type, score } avec type ∈ sharp, flat, natural, rest4, rest8, rest16, rest2, rest1, null.
  function classifySymbol(c, s, lab, w, TPL, minScore = 0.50) {
    const d = s.d, wd = c.w / d, hd = c.h / d, top = s.lines[0], bot = s.lines[4];
    // pauses : blocs pleins et plats posés sur / suspendus à une ligne
    const fillR = c.area / (c.w * c.h);
    if (wd >= 0.85 && wd <= 1.9 && hd >= 0.3 && hd <= 0.8 && fillR > 0.8) {
      const q = (bot - top) / 4;
      if (Math.abs(c.y1 - (top + 2 * q)) <= 0.35 * d) return { type: 'rest2', score: 1 };    // blanche : posée sur la 3e ligne
      if (Math.abs(c.y0 - (top + 1 * q)) <= 0.35 * d) return { type: 'rest1', score: 1 };    // ronde : suspendue à la 2e ligne
      return { type: null, score: 0 };
    }
    if (!TPL) return { type: null, score: 0 };
    const g = gridOf(lab, w, c); let best = { type: null, score: 0 };
    for (const [name, t] of Object.entries(TPL)) {
      if (Math.abs(wd - t.w) > Math.max(0.3, 0.38 * t.w) || Math.abs(hd - t.h) > Math.max(0.35, 0.30 * t.h)) continue;
      const sc = gridScore(g, t.grid); if (sc > best.score) best = { type: name, score: sc };
    }
    return best.score >= minScore ? best : { type: null, score: best.score, guess: best.type };
  }
  // Morceaux voisins d'un même symbole (trait coupé par une ligne de portée) : tente la fusion de c avec les 1-2 suivants.
  function mergeTry(cs, k, s, lab, w, TPL, accept) {
    for (let n = 1; n <= 3 && k + n < cs.length; n++) {
      const parts = cs.slice(k, k + n + 1); let ok = true;
      for (let q = 1; q < parts.length; q++) if (parts[q].x0 - Math.max(...parts.slice(0, q).map(p => p.x1)) > 0.6 * s.d) ok = false;
      if (!ok) continue;
      const m = { ids: new Set(parts.map(p => p.id)), x0: Math.min(...parts.map(p => p.x0)), x1: Math.max(...parts.map(p => p.x1)), y0: Math.min(...parts.map(p => p.y0)), y1: Math.max(...parts.map(p => p.y1)), area: parts.reduce((a, p) => a + p.area, 0), id: -1 };
      m.w = m.x1 - m.x0 + 1; m.h = m.y1 - m.y0 + 1; m.cx = (m.x0 + m.x1) / 2; m.cy = (m.y0 + m.y1) / 2;
      const cl = classifySymbol(m, s, lab, w, TPL, 0.36), t = cl.type;
      if (process_debug) console.log('merge', n, t, cl.score.toFixed(2), m.w, m.h);
      if (accept(t)) return { m, parts, type: t };
    }
    return null;
  }
  // Clé : composante la plus à gauche (hors barre de système), reconnue à sa hauteur.
  function clefOf(c, s) {
    const hd = c.h / s.d, top = s.lines[0], bot = s.lines[4];
    if (hd >= 5.0) return 'treble';
    if (hd >= 3.4 && hd <= 4.9 && c.y0 >= top - 0.7 * s.d && c.y1 <= bot + 0.7 * s.d) return 'alto';
    if (hd >= 2.2 && hd < 3.5 && c.y0 >= top - 0.7 * s.d) return 'bass';
    return null;
  }
  // Étape 1 d'une portée : composantes, clé et armure (avant la détection des têtes de notes).
  function readHeader(B3, w, h, s, lab, TPL, out) {
    const d = s.d, top = s.lines[0], bot = s.lines[4], y0 = Math.max(0, Math.round(top - 4 * d)), y1 = Math.min(h - 1, Math.round(bot + 4 * d));
    const comps = labelRegion(B3, w, h, Math.max(0, s.x0 - 2), y0, Math.min(w - 1, s.x1 + 2), y1, lab, out.nextId || 0);
    out.nextId = comps.length ? comps[comps.length - 1].id : (out.nextId || 0);
    const cand = comps.filter(c => c.area >= 0.04 * d * d && c.x0 >= s.x0 - 1.5 * d && c.y0 > top - 3.2 * d && c.y1 < bot + 3.6 * d && c.cy > top - 2.4 * d && c.cy < bot + 2.8 * d).sort((a, b) => a.x0 - b.x0);
    let i = 0; while (i < cand.length && cand[i].w < 0.5 * d && cand[i].h > 3 * d && cand[i].x0 < s.x0 + 1.0 * d && false) i++;
    const isAcc = c => { const t = classifySymbol(c, s, lab, w, TPL).type; return t === 'sharp' || t === 'flat' || t === 'natural' ? t : null; };
    s.clef = null; s.key = 0; s.keyEnd = s.x0; s.hasHeader = false;
    // clé = pièces collées au début de portée, jusqu'à la première altération reconnue
    let k = 0, xe = s.x0, mnY = 1e9, mxY = -1, pieces = [];
    while (k < cand.length && cand[k].x0 < xe + 1.2 * d + (k === 0 ? 2 * d : 0) && (k === 0 || cand[k].x0 < s.x0 + 3.4 * d) && !(k > 0 && isAcc(cand[k]))) {
      pieces.push(cand[k]); xe = Math.max(xe, cand[k].x1); mnY = Math.min(mnY, cand[k].y0); mxY = Math.max(mxY, cand[k].y1); k++; if (xe > s.x0 + 5 * d) break;
    }
    // barre de système isolée (fine et haute) : on l'écarte avant d'analyser la clé
    if (pieces.length > 1 && pieces[0].w < 0.45 * d && pieces[0].h > 3 * d) { const bx = pieces[0]; pieces = pieces.slice(1); mnY = Math.min(...pieces.map(p => p.y0)); mxY = Math.max(...pieces.map(p => p.y1)); }
    if (pieces.length) {
      const big = { h: mxY - mnY + 1, y0: mnY, y1: mxY }; s.clef = clefOf(big, s); s.hasHeader = true;
      pieces.forEach(c => { c.used = 'clef'; }); s.keyEnd = xe;
      let n = 0, kind = 0;
      while (k < cand.length && cand[k].x0 - xe < 1.8 * d) {
        let t = isAcc(cand[k]), used = [cand[k]];
        if (!t) { const mg = mergeTry(cand, k, s, lab, w, TPL, q => q === 'sharp' || q === 'flat' || q === 'natural'); if (!mg) break; t = mg.type; used = mg.parts; }
        const kd = t === 'sharp' ? 1 : t === 'flat' ? -1 : 0; if (kd && kind && kd !== kind) break; if (kd) kind = kd;
        n++; used.forEach(c => { c.used = 'key'; xe = Math.max(xe, c.x1); }); k += used.length; if (n >= 7) break;
      }
      s.key = kind * n; s.keyEnd = xe;
    }
    return comps;
  }
  // Une tête hors portée doit s'appuyer sur ses lignes supplémentaires (sinon : texte, annotation, bruit).
  function ledgerOK(B, w, h, s, hd) {
    const top = s.lines[0], bot = s.lines[4], st = (bot - top) / 4, d = s.d;
    let dist, base, sign; if (hd.y < top) { dist = top - hd.y; base = top; sign = -1; } else if (hd.y > bot) { dist = hd.y - bot; base = bot; sign = 1; } else return true;
    const m = Math.floor((dist + 0.25 * st) / st); if (m < 1) return true;
    return ledgerAt(B, w, h, Math.round(base + sign * m * st), hd.x, d);
  }
  // Ligne supplémentaire en (x, yl) : trait noir fin de 1.3d à 3d de long, avec du blanc juste au-dessus et au-dessous de ses extrémités.
  function ledgerAt(B, w, h, yl, x, d) {
    for (let dy = -1; dy <= 1; dy++) {
      const y = yl + dy; if (y < 3 || y >= h - 3 || !B[y * w + Math.round(x)]) { if (!B[y * w + Math.round(x)] && !B[y * w + Math.round(x - 0.3 * d)] && !B[y * w + Math.round(x + 0.3 * d)]) continue; }
      let a = Math.round(x), b = Math.round(x); while (a > 0 && B[y * w + a - 1]) a--; while (b < w - 1 && B[y * w + b + 1]) b++;
      const len = b - a + 1; if (len < 1.3 * d || len > 3.2 * d) continue;
      const th = (yy) => !B[(yy) * w + a + 1] && !B[(yy) * w + b - 1];         // ni au-dessus ni au-dessous des extrémités
      if (th(y - 3) && th(y + 3)) return true;
    }
    return false;
  }
  // Efface des matrices les composantes d'annotation (texte, nuances, coups d'archet, numéros de mesure…) : entièrement hors portée et sans ligne supplémentaire.
  function eraseAnnotations(mats, lab, comps, w, h, s, B) {
    const d = s.d, top = s.lines[0], bot = s.lines[4], st = (bot - top) / 4, keep = [];
    for (const c of comps) {
      const above = c.y1 < top - 1.15 * d, below = c.y0 > bot + 1.15 * d;
      if (!(above || below) || c.used) { keep.push(c); continue; }
      let ledger = false; const sign = above ? -1 : 1, base = above ? top : bot;
      for (let m = 1; m <= 8 && !ledger; m++) { const yl = Math.round(base + sign * m * st); if (yl < c.y0 - 2 || yl > c.y1 + 2) continue; ledger = ledgerAt(B, w, h, yl, c.cx, d) || ledgerAt(B, w, h, yl, c.x0 + 0.8 * d, d) || ledgerAt(B, w, h, yl, c.x1 - 0.8 * d, d); }
      if (ledger) { keep.push(c); continue; }
      for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if (lab[y * w + x] === c.id) { lab[y * w + x] = 0; for (const M of mats) M[y * w + x] = 0; }
    }
    return keep;
  }
  // Le trou d'une tête creuse est une petite région blanche FERMÉE (sinon : boucle d'un crochet, d'une liaison, d'un chiffre…).
  function holeEnclosed(M, w, h, x, y, d) {
    const R = Math.round(1.15 * d), near = (px, py) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (M[(py + dy) * w + px + dx]) return true; return false; };
    // départ : pixel clair le plus proche du centre (la ligne de portée / un reste de ligne peut barrer le trou)
    let sx = -1, sy = -1; for (let r = 0; r <= 4 && sx < 0; r++) for (let dy = -r; dy <= r && sx < 0; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (!M[(Math.round(y) + dy) * w + Math.round(x) + dx]) { sx = Math.round(x) + dx; sy = Math.round(y) + dy; break; } }
    if (sx < 0) return false;
    const seen = new Set([sy * w + sx]), st = [[sx, sy]], maxA = 0.75 * d * d; let area = 0;
    while (st.length) {
      const [cx, cy] = st.pop(); area++; if (area > maxA) return false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy;
        if (Math.abs(nx - x) > R || Math.abs(ny - y) > R) return false;            // fuit hors de la zone : trou ouvert
        if (M[ny * w + nx] || seen.has(ny * w + nx)) continue;
        if (area > 6 && near(nx, ny) && !near(cx, cy)) { /* franchit un petit goulot (≤ 2 px) : on bloque */ continue; }
        seen.add(ny * w + nx); st.push([nx, ny]); }
    }
    return true;
  }
  // Étape 2 : type de chaque composante hors tête (altération, silence, barre…).
  function typeComps(w, h, s, heads, comps, lab, TPL, out, si) {
    const d = s.d, top = s.lines[0], bot = s.lines[4];
    const headComp = new Set(); for (const hd of heads) if (!hd.hollow) { const p = lab[Math.round(hd.y) * w + Math.round(hd.x)]; if (p) headComp.add(p); }
    const rest = comps.filter(c => !headComp.has(c.id) && !c.used && c.area >= 0.06 * d * d && c.x0 > s.keyEnd - 0.2 * d);
    for (const c of rest) {
      if (out.raw && !(c.w < 0.45 * d && c.h > 2.5 * d)) out.raw.push({ staff: si, x: c.cx, xRel: (c.x0 - s.x0) / d, wd: c.w / d, hd: c.h / d, area: c.area / (d * d), grid: Array.from(gridOf(lab, w, c)) });
      if (c.w < 0.45 * d && c.h > 2.5 * d) { c.type = 'bar'; continue; }
      if (c.w > 3.6 * d || c.h > 5.2 * d) { c.type = 'other'; continue; }
      const sy = classifySymbol(c, s, lab, w, TPL); c.type = sy.type || 'other'; c.score = sy.score; c.guess = sy.guess;
    }
    const rs = rest.filter(c => c.type === 'other' && c.area < 1.2 * d * d).sort((a, b) => a.x0 - b.x0);       // morceaux d'altérations coupés par une ligne
    for (let k = 0; k < rs.length; k++) { const mg = mergeTry(rs, k, s, lab, w, TPL, q => q === 'sharp' || q === 'flat' || q === 'natural'); if (mg) { mg.parts.forEach(p => { p.type = 'other'; p.used = 'part'; }); const m = mg.m; m.type = mg.type; m.id = mg.parts[0].id; comps.push(m); k += mg.parts.length - 1; } }
    return headComp;
  }
  // Altération touchant la tête (composante fusionnée) : on isole les pixels à gauche de la tête et on les classe.
  function splitAccidental(B3, lab, w, h, s, hd, TPL) {
    const d = s.d, id = lab[Math.round(hd.y) * w + Math.round(hd.x)] || lab[Math.round(hd.y) * w + Math.round(hd.x - 0.5 * d)] || 0;
    if (!id) return null;
    const xa = Math.round(hd.x - 3.0 * d), xb = Math.round(hd.x - 0.72 * d), ya = Math.round(hd.y - 1.9 * d), yb = Math.round(hd.y + 1.9 * d);
    const px = []; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    const top = s.lines[0], bot = s.lines[4], st = (bot - top) / 4, onLedger = y => { for (let m = 1; m <= 8; m++) if (Math.abs(y - (top - m * st)) <= 2 || Math.abs(y - (bot + m * st)) <= 2) return true; return false; };
    const thinRun = (x, y) => { let n = 1, u = y, v = y; while (B3[(u - 1) * w + x] && n < 6) { u--; n++; } while (B3[(v + 1) * w + x] && n < 6) { v++; n++; } return n <= 3; };
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (B3[y * w + x] && lab[y * w + x] === id && !(onLedger(y) && thinRun(x, y))) { px.push(x, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const n = px.length / 2; if (n < 0.3 * d * d) return null;
    // le morceau doit se terminer près de la tête (sinon : stem, liaison…) ; on garde la partie contiguë la plus à droite
    const cols = new Array(x1 - x0 + 1).fill(0); for (let i = 0; i < px.length; i += 2) cols[px[i] - x0]++;
    let e = cols.length - 1; while (e >= 0 && !cols[e]) e--; let b = e; let gap = 0; while (b >= 0 && gap <= 2) { if (cols[b]) gap = 0; else gap++; b--; } b = Math.max(0, b + 1 + gap);
    const sel = []; let mnx = 1e9, mxx = -1, mny = 1e9, mxy = -1;
    for (let i = 0; i < px.length; i += 2) { const x = px[i], y = px[i + 1]; if (x - x0 >= b && x - x0 <= e) { sel.push(x, y); mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); } }
    const cw = mxx - mnx + 1, ch = mxy - mny + 1; if (cw < 0.45 * d || cw > 1.5 * d || ch < 1.7 * d || ch > 3.6 * d) return null;
    // empreinte des pixels retenus
    const g = new Float32Array(GW * GH), cnt = new Float32Array(GW * GH), set = new Set(); for (let i = 0; i < sel.length; i += 2) set.add(sel[i + 1] * w + sel[i]);
    for (let y = mny; y <= mxy; y++) for (let x = mnx; x <= mxx; x++) { const gx = Math.min(GW - 1, Math.floor((x - mnx) * GW / cw)), gy = Math.min(GH - 1, Math.floor((y - mny) * GH / ch)), k = gy * GW + gx; cnt[k]++; if (set.has(y * w + x)) g[k]++; }
    for (let k = 0; k < g.length; k++) g[k] = cnt[k] ? g[k] / cnt[k] : 0;
    let best = { type: null, score: 0 }; const wd = cw / d, hd2 = ch / d;
    for (const [name, t] of Object.entries(TPL || {})) {
      if (!/^(sharp|flat|natural)$/.test(name) || Math.abs(wd - t.w) > Math.max(0.3, 0.38 * t.w) || Math.abs(hd2 - t.h) > Math.max(0.4, 0.3 * t.h)) continue;
      const sc = gridScore(g, t.grid); if (sc > best.score) best = { type: name, score: sc };
    }
    return best.score >= 0.42 ? best.type : null;
  }
  // Étape 3 : rattache altérations aux notes, enregistre les silences.
  function attachSymbols(B, B2, w, h, s, si, heads, comps, headComp, out, B3, lab, TPL) {
    const d = s.d, top = s.lines[0], bot = s.lines[4];
    s.bars = findBars(B, w, h, s);
    const accs = comps.filter(c => /^(sharp|flat|natural)$/.test(c.type || '')), rests = comps.filter(c => /^rest/.test(c.type || '') && c.cy > top - 0.8 * d && c.cy < bot + 0.8 * d);
    for (const hd of heads) {
      let best = null, bd = 1e9;
      for (const a of accs) { const dx = hd.x - a.cx; if (dx < 0.4 * d || dx > 3.0 * d || Math.abs(a.cy - hd.y) > 1.7 * d || a.used) continue; if (dx < bd) { bd = dx; best = a; } }
      if (best) { hd.acc = best.type === 'sharp' ? 1 : best.type === 'flat' ? -1 : 0; best.used = 'acc'; }
      else if (B3 && TPL) { const t = splitAccidental(B3, lab, w, h, s, hd, TPL); if (t) hd.acc = t === 'sharp' ? 1 : t === 'flat' ? -1 : 0; }
    }
    // altérations restées sans note, juste après une barre de mesure : changement d'armure (ex. ♯♯ ou ♮ d'annulation)
    s.keyChanges = [];
    const free = accs.filter(a => !a.used).sort((a, b) => a.x0 - b.x0);
    for (let i = 0; i < free.length;) {
      const a0 = free[i], nb = (s.bars || []).some(bx => a0.x0 - bx > 0.2 * d && a0.x0 - bx < 3.4 * d);
      let j = i; while (j + 1 < free.length && free[j + 1].x0 - free[j].x1 < 1.6 * d) j++;
      if (nb) {
        const grp = free.slice(i, j + 1), sh = grp.filter(g => g.type === 'sharp').length, fl = grp.filter(g => g.type === 'flat').length;
        s.keyChanges.push({ x: free[j].x1, key: sh > fl ? sh : fl > sh ? -fl : 0 }); grp.forEach(g => { g.used = 'keychange'; });
      }
      i = j + 1;
    }
    for (const c of rests) {
      const beats = { rest1: 4, rest2: 2, rest4: 1, rest8: 0.5, rest16: 0.25 }[c.type];
      out.rests.push({ x: c.cx, y: c.cy, staff: si, beats: beats * (dotAfter(B2, w, h, c.x1 + 0.2 * d, c.cy - (c.type === 'rest4' ? 0.3 : 0) * d, d) ? 1.5 : 1), type: c.type });
    }
    out.comps.push(...comps.map(c => ({ staff: si, x: c.cx, y: c.cy, w: c.w, h: c.h, score: c.score, guess: c.guess, cls: c.type, type: c.used || c.type || (headComp.has(c.id) ? 'head' : null) })));
  }
  function analyzeStraight(g, w, h, dbg, TPL) {
    const B = binarize(g, w, h), box = paperBox(g, w, h); maskOutside(B, w, h, box);
    const staves = findStaves(B, w, h);
    if (!staves.length) return { staves: [], heads: [], rests: [], comps: [], box };
    const dm = staves[0].d;
    despeckle(B, w, h, Math.max(3, Math.round(0.03 * dm * dm)));            // nettoyage : taches de bruit
    const B2 = removeLines(B, w, h, staves); despeckle(B2, w, h, Math.max(3, Math.round(0.04 * dm * dm)));
    const heads = [], lab = new Int32Array(w * h), out = { rests: [], comps: [], nextId: 0 };
    if (dbg && dbg.collect) out.raw = [];
    const B3 = repairLines(B, B2, w, h, staves);
    staves.forEach((s, si) => {
      let comps = readHeader(B3, w, h, s, lab, TPL, out); const d = s.d;
      comps = eraseAnnotations([B, B2, B3], lab, comps, w, h, s, B);
      // 1) têtes pleines  2) types des autres composantes  3) têtes creuses (seulement hors altérations / silences / barres)
      const hs0 = findHeads(B, B2, w, h, s, si === 0 ? dbg : null, null), cById = new Map(comps.map(c => [c.id, c]));
      const hs = hs0.filter(hd => { const c = cById.get(lab[Math.round(hd.y) * w + Math.round(hd.x)]); return !c || c.h >= 0.85 * d; });
      for (const hd of hs) { addStem(B2, w, h, hd, d); classify(B2, w, h, hd, d); }
      const headComp = typeComps(w, h, s, hs, comps, lab, TPL, out, si), byId = new Map(comps.map(c => [c.id, c]));
      const ok = (x, y) => {                       // la tête creuse est l'union des morceaux d'anneau autour de (x, y)
        const ids = new Set(); const R = Math.round(0.9 * d);
        for (let dy = -2; dy <= 2; dy += 2) for (let k = -R; k <= R; k++) { const id = lab[(y + dy) * w + x + k]; if (id) ids.add(id); }
        if (!ids.size) return true;
        let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
        for (const id of ids) { const c = byId.get(id); if (!c) continue;
          if (headComp.has(c.id) || /^(sharp|flat|natural|bar|rest)/.test(c.type || '') || c.used === 'clef' || c.used === 'key') return false;
          x0 = Math.min(x0, c.x0); x1 = Math.max(x1, c.x1); y0 = Math.min(y0, c.y0); y1 = Math.max(y1, c.y1); }
        const hh = y1 - y0 + 1; if ((x1 - x0 + 1) < 1.1 * d || hh < 0.8 * d || hh > 7.8 * d) return false;
        if (hh > 5.2 * d) {                         // comp. très haute : tolérée si l'excédent (en haut ou en bas) est un petit signe (coup d'archet) et non une ligature
          const ex = Math.round(hh - 5.2 * d + 0.4 * d); let okTop = true, okBot = true;
          for (const [ya, yb, flag] of [[y0, y0 + ex, 'top'], [y1 - ex, y1, 'bot']]) {
            let cnt = 0, mr = 0; for (let yy = ya; yy <= yb; yy++) { let run = 0; for (let xx = x0; xx <= x1; xx++) { if (B2[yy * w + xx]) { cnt++; run++; if (run > mr) mr = run; } else run = 0; } }
            const good = mr <= 1.9 * d && cnt <= 1.3 * d * d; if (flag === 'top') okTop = good; else okBot = good;
          }
          if (!(okTop || okBot)) return false;
        }
        return true;
      };
      for (const hd of findHeads(B, B2, w, h, s, null, ok)) if (hd.hollow) { hd.staff = si; addStem(B2, w, h, hd, d); classify(B2, w, h, hd, d); hs.push(hd); }
      hs.forEach(hd => { hd.staff = si; });
      for (let k = hs.length - 1; k >= 0; k--) {                    // boucle de crochet = « tête creuse » au bout de la hampe d'une tête pleine
        const q = hs[k]; if (!q.hollow) continue;
        if (hs.some(f => !f.hollow && f.stem && Math.abs(q.y - f.stem.endY) < 1.3 * d && q.x - f.stem.x > -0.4 * d && q.x - f.stem.x < 1.5 * d)) hs.splice(k, 1);
      }
      for (let k = hs.length - 1; k >= 0; k--) if (!ledgerOK(B, w, h, s, hs[k])) hs.splice(k, 1);
      attachSymbols(B, B2, w, h, s, si, hs, comps, headComp, out, B3, lab, TPL);
      heads.push(...hs);
    });
    // une tête n'appartient qu'à la portée la plus proche (les zones de recherche de portées voisines se recouvrent)
    const mid = staves.map(s => s.lines[2]);
    for (let k = heads.length - 1; k >= 0; k--) { const hd = heads[k]; let bi = 0; mid.forEach((m, i) => { if (Math.abs(m - hd.y) < Math.abs(mid[bi] - hd.y)) bi = i; }); if (bi !== hd.staff) heads.splice(k, 1); }
    // clé / armure de la page : valeur la plus fréquente parmi les portées
    const mode = arr => { const m = {}; let best = null, bn = 0; for (const v of arr) { m[v] = (m[v] || 0) + 1; if (m[v] > bn) { bn = m[v]; best = v; } } return best; };
    const clef = mode(staves.map(s => s.clef).filter(Boolean));
    const ks = staves.map(s => s.key), nz = ks.filter(k => k !== 0);        // une armure oubliée sur une portée est plus probable qu'une armure inventée
    const key = nz.length && nz.length >= Math.ceil(ks.length / 4) ? mode(nz) : 0;
    if (dbg) { dbg.B2 = B2; dbg.B3 = B3; dbg.lab = lab; dbg.raw = out.raw; }
    return { staves, heads, rests: out.rests, comps: out.comps, clef, key: key == null ? 0 : +key, box };
  }
  // Convertit les têtes détectées en notes jouables (hauteur diatonique + durée en temps).
  function toNotes(res, { clef = 'alto', key = 0, keyAuto = false } = {}) {
    const base = CLEF_BASE[clef] ?? 24, items = [];
    for (const [id, hd] of res.heads.entries()) {
      const s = res.staves[hd.staff], bot = s.lines[4], half = s.d / 2;
      const step = Math.round((bot - hd.y) / half), dia = base + step;
      let beats;
      if (!hd.stem) beats = hd.hollow ? 4 : 1;
      else if (hd.hollow) beats = 2;
      else beats = [1, 0.5, 0.25, 0.125][hd.flags] ?? 0.25;
      if (hd.dots) beats *= 1.5;
      items.push({ id, staff: hd.staff, x: hd.x, y: hd.y, dia, acc: hd.acc, beats });
    }
    (res.rests || []).forEach((r, i) => items.push({ id: 1000 + i, staff: r.staff, x: r.x, y: r.y, rest: true, beats: r.beats }));
    items.sort((a, b) => a.staff - b.staff || a.x - b.x);
    // altérations : armure, puis altération accidentelle valable jusqu'à la barre de mesure suivante
    let cur = -1, bars = [], memo = {}, meas = -1;
    for (const n of items) {
      if (n.staff !== cur) { cur = n.staff; bars = res.staves[cur].bars || []; memo = {}; meas = -1; }
      const m = bars.filter(bx => bx < n.x - 2).length;
      if (m !== meas) { meas = m; memo = {}; }
      if (n.rest) continue;
      let kk = keyAuto && res.staves[cur].hasHeader ? res.staves[cur].key : key; for (const kc of (res.staves[cur].keyChanges || [])) if (kc.x <= n.x) kk = kc.key;
      if (n.acc !== undefined) memo[n.dia] = n.acc;
      n.alter = memo[n.dia] !== undefined ? memo[n.dia] : keyAlter(n.dia, kk);
    }
    return items;
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
  return { _i: { removeLines, ellipse, hollowDiag, paperBox, dotAfter, countRuns, splitAccidental }, CLEF_BASE, toGray, binarize, estimateAngle, findStaves, analyzeStraight, analyzeGray, toNotes, keyAlter, midiOf, freqOf, nameOf };
})();
if (typeof module !== 'undefined') module.exports = OMR;
