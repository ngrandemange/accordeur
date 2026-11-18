// Page « Partition » : une photo gardée sur l'appareil, lecture des notes (omr.js), correction à la main, lecture audio.
(() => {
  const $ = id => document.getElementById(id);
  const FR = { C: 'Do', D: 'Ré', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  const S = { blob: null, quarter: 0, angle: 0, res: null, clef: null, key: 0, bpm: 90, zoom: 0, edits: {}, extra: [], base: null, crop: null, notes: [], sel: -1, playing: null, busy: false, loaded: false };

  // ---------- stockage : une seule photo (IndexedDB) ----------
  const idb = () => new Promise((ok, ko) => { const r = indexedDB.open('accordeur', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  const kv = async (mode, k, v) => { const db = await idb(); return new Promise((ok, ko) => { const st = db.transaction('kv', mode === 'get' ? 'readonly' : 'readwrite').objectStore('kv'); const q = mode === 'get' ? st.get(k) : mode === 'set' ? st.put(v, k) : st.delete(k); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); }); };
  const saveScan = () => kv('set', 'scan', { keyManual: !!S.keyManual, extra: S.extra, scale: S.scale || 1, quarter: S.quarter, angle: S.angle, res: S.res, clef: S.clef, key: S.key, bpm: S.bpm, zoom: S.zoom, edits: S.edits }).catch(() => {});

  // ---------- calculs lourds dans un Worker (repli : fil principal) ----------
  let worker = null, wid = 0; const pend = {};
  try { worker = new Worker('omr-worker.js'); worker.onmessage = e => { const p = pend[e.data.id]; if (!p) return; if (e.data.progress !== undefined) { if (p.onp) p.onp(e.data.progress); return; } delete pend[e.data.id]; e.data.error ? p.ko(new Error(e.data.error)) : p.ok(e.data); }; worker.onerror = () => { worker = null; }; } catch (e) { worker = null; }
  const pack = r => ({ staves: r.staves, box: r.box, clef: r.clef, key: r.key, rests: r.rests, heads: r.heads.map(x => ({ x: x.x, y: x.y, staff: x.staff, hollow: x.hollow, flags: x.flags, dots: x.dots, acc: x.acc, stem: x.stem ? { dir: x.stem.dir, len: x.stem.len } : null })) });
  const call = (type, g, w, h, onp) => new Promise((ok, ko) => {
    if (worker) { const id = ++wid; pend[id] = { ok, ko, onp }; worker.postMessage({ type, g, w, h, id }, [g.buffer]); return; }
    setTimeout(() => { try { if (type === 'angle') ok({ angle: OMR.analyzeGray(g, w, h).angle }); else ok({ res: pack(OMR.analyzeStraight(g, w, h, null, OMR_TEMPLATES)) }); } catch (e) { ko(e); } }, 20);
  });
  // barre de progression (0..1) : ne recule jamais pendant une analyse
  const prog = (p, key) => { S.progress = Math.max(S.progress || 0, Math.min(1, p)); if (key) S.step = key; showProg(); };
  function showProg() {
    const pct = Math.round((S.progress || 0) * 100);
    $('sc-bar').style.width = pct + '%'; $('sc-pct').textContent = pct + ' %'; $('sc-step').textContent = tr(S.step || 'score.busy');
    $('sc-bar').parentElement.setAttribute('aria-valuenow', pct);
  }

  // ---------- image ----------
  async function loadBitmap(blob) {
    if (window.createImageBitmap) { try { return await createImageBitmap(blob); } catch (e) {} }
    const img = new Image(); img.src = URL.createObjectURL(blob); await img.decode(); return img;
  }
  async function downscale(file) {         // photo réduite (≤ 2000 px de large) : c'est elle qui est gardée
    const bmp = await loadBitmap(file), W = Math.min(2000, bmp.width), H = Math.round(bmp.height * W / bmp.width);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(bmp, 0, 0, W, H);
    return new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.88));
  }
  async function renderBase(blob, quarter, angle, scale = 1) {   // image redressée (quart de tour + inclinaison), éventuellement agrandie
    const bmp = await loadBitmap(blob), bw = bmp.width, bh = bmp.height, sw = Math.round((quarter % 2 ? bh : bw) * scale), sh = Math.round((quarter % 2 ? bw : bh) * scale);
    const c = document.createElement('canvas'); c.width = sw; c.height = sh; const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.fillStyle = '#3a3a3a'; x.fillRect(0, 0, sw, sh);
    x.translate(sw / 2, sh / 2); x.scale(scale, scale); x.rotate(-angle * Math.PI / 180); x.rotate(quarter * Math.PI / 2); x.drawImage(bmp, -bw / 2, -bh / 2);
    return c;
  }
  const grayOf = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height); return OMR.toGray(d); };

  async function analyze(blob) {
    for (const q of [0, 1, 3, 2]) {                       // si aucune portée : photo prise de travers, on essaie les quarts de tour
      prog(0.06 + q * 0.01, 'score.step.angle');
      const c0 = await renderBase(blob, q, 0);
      const { angle } = await call('angle', grayOf(c0), c0.width, c0.height);
      prog(0.2, 'score.step.read');
      const c1 = await renderBase(blob, q, angle);
      const { res } = await call('analyze', grayOf(c1), c1.width, c1.height, p => prog(0.2 + 0.4 * p, 'score.step.read'));
      if (res.staves.length) {
        S.quarter = q; S.angle = angle; S.res = res; S.base = c1; S.scale = 1;
        const d = res.staves[0].d;
        if (d < 12) {                                   // portées trop petites (photo basse résolution) : on agrandit puis on relit
          const f = Math.min(14 / d, 3600 / Math.max(c1.width, c1.height));
          if (f > 1.25) { prog(0.62, 'score.step.zoom'); const c2 = await renderBase(blob, q, angle, f), r2 = await call('analyze', grayOf(c2), c2.width, c2.height, p => prog(0.62 + 0.36 * p, 'score.step.zoom')); if (r2.res.staves.length) { S.res = r2.res; S.base = c2; S.scale = f; } }
        }
        S.clef = S.res.clef || defClef(); S.key = S.res.key || 0; prog(1, 'score.step.done');
        return true;
      }
    }
    S.res = { staves: [], heads: [], rests: [] }; S.base = null; return false;
  }

  // ---------- notes ----------
  const defClef = () => (typeof PREFS !== 'undefined' && PREFS.instrument === 'alto') ? 'alto' : 'treble';
  function rebuildNotes() {
    S.notes = [];
    if (!S.res || !S.res.staves.length) return;
    const items = OMR.toNotes(S.res, { clef: S.clef, key: S.key, keyAuto: !S.keyManual });
    S.extra.forEach((x, k) => { const dia = OMR.CLEF_BASE[S.clef] + x.step; items.push({ id: 2000 + k, staff: x.staff, x: x.x, y: x.y, dia, alter: OMR.keyAlter(dia, S.key), beats: x.beats }); });
    items.sort((a, b) => a.staff - b.staff || a.x - b.x);
    for (const n of items) {
      const e = S.edits[n.id] || {};
      if (e.del) continue;
      if (!n.rest) {
        if (e.shift) { n.dia += e.shift; n.alter = OMR.keyAlter(n.dia, S.key); }
        if (e.alter !== undefined) n.alter = e.alter;
      }
      if (e.beats !== undefined) n.beats = e.beats;
      S.notes.push(n);
    }
  }
  const label = n => { if (n.rest) return tr('score.rest'); const nm = OMR.nameOf(n); return (LANG === 'fr' ? FR[nm[0]] : nm[0]) + nm.slice(1); };
  const beatsTxt = b => ({ 4: '𝅝', 2: '𝅗𝅥', 1: '♩', 0.5: '♪', 0.25: '𝅘𝅥𝅯' }[b] || (b >= 1 ? String(b) : '·'));

  // ---------- affichage ----------
  function cropBox() {
    const st = S.res.staves, d = st[0].d, W = S.base.width, H = S.base.height;
    const x0 = Math.max(0, Math.min(...st.map(s => s.x0)) - 0.6 * d), x1 = Math.min(W, Math.max(...st.map(s => s.x1)) + 0.6 * d);
    const y0 = Math.max(0, st[0].lines[0] - 6 * d), y1 = Math.min(H, st[st.length - 1].lines[4] + 6 * d);
    return { x0: Math.round(x0), y0: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
  }
  function draw() {
    const cv = $('sc-canvas');
    if (!S.base || !S.res.staves.length) { cv.width = cv.height = 1; return; }
    const cr = S.crop, x = cv.getContext('2d'), d = S.res.staves[0].d;
    if (cv.width !== cr.w || cv.height !== cr.h) { cv.width = cr.w; cv.height = cr.h; applyZoom(); }
    x.drawImage(S.base, cr.x0, cr.y0, cr.w, cr.h, 0, 0, cr.w, cr.h);
    x.textAlign = 'center'; x.font = `bold ${Math.round(0.95 * d)}px sans-serif`;
    const cur = S.playing ? S.playing.cur : -1;
    S.notes.forEach((n, i) => {
      const px = n.x - cr.x0, py = n.y - cr.y0, on = S.playing && S.playing.live.has(i), sel = i === S.sel;
      x.lineWidth = Math.max(2, d * 0.15); x.strokeStyle = on ? '#2ee59d' : sel ? '#ffb020' : n.rest ? 'rgba(255,150,0,.95)' : 'rgba(255,70,70,.9)';
      x.fillStyle = on ? 'rgba(46,229,157,.45)' : 'rgba(0,0,0,0)';
      x.beginPath(); if (n.rest) x.rect(px - 0.7 * d, py - 1.2 * d, 1.4 * d, 2.4 * d); else x.arc(px, py, 0.85 * d, 0, 7); x.fill(); x.stroke();
      const t = label(n) + (!n.rest && n.alter > 0 ? '♯' : !n.rest && n.alter < 0 ? '♭' : !n.rest && n.acc === 0 ? '♮' : '');
      x.fillStyle = 'rgba(255,255,255,.88)'; const tw = x.measureText(t + ' ' + beatsTxt(n.beats)).width + 6, ty = py + (n.y < S.res.staves[n.staff].lines[2] ? -1.3 * d : 2.1 * d);
      x.fillRect(px - tw / 2, ty - 1.0 * d, tw, 1.25 * d);
      x.fillStyle = on ? '#007a4f' : '#0a2a8a'; x.fillText(t + ' ' + beatsTxt(n.beats), px, ty);
    });
  }
  function applyZoom() {
    const wrap = $('sc-wrap'), cr = S.crop, d = S.res.staves[0].d;
    if (!S.zoom) S.zoom = Math.max(100, Math.min(500, Math.round(100 * (11 / d) * cr.w / Math.max(1, wrap.clientWidth))));
    $('sc-zoom').value = S.zoom;
    $('sc-canvas').style.width = Math.round(wrap.clientWidth * S.zoom / 100) + 'px';
  }
  function chips(box, items, cur, fn) {
    box.innerHTML = ''; items.forEach(([lab, val]) => { const b = document.createElement('button'); b.textContent = lab; b.style.cssText = 'padding:9px 14px;border-radius:20px;border:0;font-size:15px;background:' + (val === cur ? 'var(--fg)' : 'var(--card)') + ';color:' + (val === cur ? 'var(--bg)' : 'var(--mut)'); b.onclick = () => fn(val); box.appendChild(b); });
  }
  function render() {
    const has = !!(S.res && S.res.staves.length);
    $('sc-tools').style.display = has ? '' : 'none';
    $('sc-wrap').style.display = has ? '' : 'none';
    $('sc-del').style.display = S.blob ? '' : 'none';
    $('sc-pick').firstElementChild.textContent = tr(S.blob ? 'score.again' : 'score.photo');
    $('sc-busy').style.display = S.busy ? 'block' : 'none'; if (S.busy) showProg();
    $('sc-info').textContent = S.busy ? '' : !S.blob ? tr('score.empty') : has ? tr('score.found', S.res.staves.length, S.notes.filter(n => !n.rest).length) + ' ' + tr('score.detected', tr('score.clef.' + (S.res.clef || S.clef)), S.key === 0 ? '♮' : S.key > 0 ? S.key + '♯' : -S.key + '♭', S.notes.filter(n => n.rest).length) : tr('score.none');
    if (!has) return;
    chips($('sc-clef'), [['alto', 'alto'], ['treble', 'treble'], ['bass', 'bass']].map(([k, v]) => [tr('score.clef.' + k), v]), S.clef, v => { S.clef = v; refresh(); });
    const keys = []; for (let k = -7; k <= 7; k++) keys.push([k === 0 ? '♮' : k > 0 ? k + '♯' : -k + '♭', k]);
    const kb = $('sc-key'); kb.innerHTML = ''; const sel = document.createElement('select');
    sel.style.cssText = 'padding:9px 12px;border-radius:12px;border:0;background:var(--card);color:var(--fg);font-size:16px';
    keys.forEach(([t, v]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === S.key) o.selected = true; sel.appendChild(o); });
    sel.onchange = () => { S.key = +sel.value; S.keyManual = true; refresh(); }; kb.appendChild(sel);
    $('sc-bpm').textContent = S.bpm; $('sc-tempo').value = S.bpm;
    $('sc-play').textContent = tr(S.playing ? 'score.stop' : 'score.play');
    S.crop = cropBox(); draw();
  }
  function refresh() { rebuildNotes(); saveScan(); render(); if (S.sel >= 0) openSheet(S.sel); }

  // ---------- correction d'une note ----------
  const DURS = [4, 2, 1, 0.5, 0.25];
  function openSheet(i) {
    S.sel = i; const n = S.notes[i], sh = $('sheet'); if (!n) return closeSheet();
    const dot = !DURS.includes(n.beats) && DURS.includes(n.beats / 1.5), base = dot ? n.beats / 1.5 : n.beats;
    sh.innerHTML = `<h3></h3>${n.rest ? '' : `<div class="lbl">${tr('edit.pitch')}</div><div class="chips"><button data-a="up">▲</button><button data-a="down">▼</button></div>
      <div class="lbl">${tr('edit.alter')}</div><div class="chips"><button data-a="alt-1" class="${n.alter < 0 ? 'on' : ''}">♭</button><button data-a="alt0" class="${n.alter === 0 ? 'on' : ''}">♮</button><button data-a="alt1" class="${n.alter > 0 ? 'on' : ''}">♯</button></div>`}
      <div class="lbl">${tr('edit.dur')}</div><div class="chips">${DURS.map(b => `<button data-a="d${b}" class="${b === base ? 'on' : ''}">${tr('dur.' + b)}</button>`).join('')}<button data-a="dot" class="${dot ? 'on' : ''}">${tr('edit.dot')}</button></div>
      <div class="chips" style="margin-top:12px"><button class="del" data-a="del">${tr('edit.delete')}</button><button data-a="close">${tr('edit.close')}</button></div>`;
    sh.querySelector('h3').textContent = label(n) + (!n.rest && n.alter > 0 ? '♯' : !n.rest && n.alter < 0 ? '♭' : !n.rest && n.acc === 0 ? '♮' : '');
    sh.classList.add('on');
    sh.querySelectorAll('button').forEach(b => b.onclick = () => {
      const a = b.dataset.a, e = S.edits[n.id] = S.edits[n.id] || {};
      if (a === 'up') e.shift = (e.shift || 0) + 1; else if (a === 'down') e.shift = (e.shift || 0) - 1;
      else if (a.startsWith('alt')) e.alter = +a.slice(3);
      else if (a === 'dot') e.beats = dot ? base : base * 1.5;
      else if (a[0] === 'd' && a !== 'del') e.beats = +a.slice(1) * (dot ? 1.5 : 1);
      else if (a === 'del') { e.del = true; S.sel = -1; refresh(); return closeSheet(); }
      else return closeSheet();
      if (a === 'up' || a === 'down') delete e.alter;     // l'armure s'applique à la nouvelle hauteur
      refresh();
    });
    draw();
  }
  function closeSheet() { S.sel = -1; $('sheet').classList.remove('on'); draw(); }

  // ---------- lecture audio ----------
  let wave = null;
  function stopPlay() {
    if (!S.playing) return; const p = S.playing; S.playing = null; cancelAnimationFrame(p.raf);
    p.nodes.forEach(({ o, g }) => { try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0, ctx.currentTime, 0.02); o.stop(ctx.currentTime + 0.1); } catch (e) {} });
    render();
  }
  async function play() {
    if (!S.notes.length) return;
    audioMode('playback');
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); await ctx.resume(); unlockAudio();
    wave = wave || ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.45, 0.2, 0.1]));
    const d = S.res.staves[0].d, groups = []; const sorted = S.notes.map((n, i) => ({ n, i }));
    for (const it of sorted) { const g = groups[groups.length - 1]; if (g && !it.n.rest && !g.n[0].rest && g.n[0].staff === it.n.staff && Math.abs(g.n[0].x - it.n.x) < 0.8 * d) { g.n.push(it.n); g.i.push(it.i); } else groups.push({ n: [it.n], i: [it.i] }); }
    const spb = 60 / S.bpm, t0 = ctx.currentTime + 0.15; let t = t0; const nodes = [], ev = [];
    for (const g of groups) {
      const dur = g.n[0].beats * spb;
      for (const n of g.n) {
        if (n.rest) continue;
        const o = ctx.createOscillator(), gn = ctx.createGain(); o.setPeriodicWave(wave); o.frequency.value = OMR.freqOf(n, a4);
        const end = t + dur * 0.96, pk = 0.32 / Math.sqrt(g.n.length);
        gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(pk, t + 0.02); gn.gain.setValueAtTime(pk, Math.max(t + 0.03, end - 0.06)); gn.gain.linearRampToValueAtTime(0, end);
        o.connect(gn).connect(ctx.destination); o.start(t); o.stop(end + 0.05); nodes.push({ o, g: gn });
      }
      ev.push({ t0: t, t1: t + dur, idx: g.i }); t += dur;
    }
    S.playing = { nodes, live: new Set(), cur: -1, raf: 0 };
    const tick = () => {
      if (!S.playing) return; const now = ctx.currentTime; if (now > t + 0.2) return stopPlay();
      const e = ev.find(q => now >= q.t0 && now < q.t1), live = new Set(e ? e.idx : []);
      if (e && S.playing.cur !== e.idx[0]) {
        S.playing.cur = e.idx[0]; const n = S.notes[e.idx[0]], wrap = $('sc-wrap'), k = $('sc-canvas').clientWidth / $('sc-canvas').width;
        const px = (n.x - S.crop.x0) * k, py = (n.y - S.crop.y0) * k;
        if (px < wrap.scrollLeft + 20 || px > wrap.scrollLeft + wrap.clientWidth - 40) wrap.scrollLeft = px - wrap.clientWidth / 4;
        if (py < wrap.scrollTop + 20 || py > wrap.scrollTop + wrap.clientHeight - 20) wrap.scrollTop = py - wrap.clientHeight / 2;
      }
      S.playing.live = live; draw(); S.playing.raf = requestAnimationFrame(tick);
    };
    $('sc-play').textContent = tr('score.stop'); tick();
  }

  // ---------- événements ----------
  async function setPhoto(file) {
    stopPlay(); S.busy = true; S.progress = 0; S.step = 'score.step.prep'; S.blob = null; S.res = null; S.edits = {}; S.sel = -1; S.notes = []; closeSheet(); render();
    try {
      S.progress = 0; prog(0.01, 'score.step.prep'); S.blob = await downscale(file); await kv('set', 'photo', S.blob); prog(0.05, 'score.step.prep');
      S.zoom = 0; S.clef = null; S.key = 0; S.keyManual = false; await analyze(S.blob); rebuildNotes(); await saveScan();
    } catch (e) { S.res = { staves: [], heads: [] }; }
    S.busy = false; render();
  }
  $('sc-file').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) setPhoto(f); };
  $('sc-del').onclick = async () => { stopPlay(); closeSheet(); await kv('del', 'photo').catch(() => {}); await kv('del', 'scan').catch(() => {}); Object.assign(S, { blob: null, res: null, base: null, notes: [], edits: {}, zoom: 0 }); render(); };
  $('sc-tempo').oninput = e => { S.bpm = +e.target.value; $('sc-bpm').textContent = S.bpm; saveScan(); };
  $('sc-zoom').oninput = e => { S.zoom = +e.target.value; applyZoom(); };
  $('sc-play').onclick = () => S.playing ? stopPlay() : play();
  $('sc-canvas').addEventListener('click', e => {
    if (!S.notes.length) return;
    const cv = $('sc-canvas'), r = cv.getBoundingClientRect(), k = cv.width / r.width, px = (e.clientX - r.left) * k + S.crop.x0, py = (e.clientY - r.top) * k + S.crop.y0, d = S.res.staves[0].d;
    let best = -1, bd = 1e9; S.notes.forEach((n, i) => { const dd = Math.hypot(n.x - px, n.y - py); if (dd < bd) { bd = dd; best = i; } });
    if (best >= 0 && bd < 1.6 * d) return openSheet(best);
    // zone vide : ajoute une note à l'endroit touché (portée la plus proche, hauteur arrondie au demi-interligne)
    let bs = 0; S.res.staves.forEach((st, i) => { if (Math.abs(st.lines[2] - py) < Math.abs(S.res.staves[bs].lines[2] - py)) bs = i; });
    const st = S.res.staves[bs], half = st.d / 2, step = Math.round((st.lines[4] - py) / half);
    if (Math.abs(step) > 14) return closeSheet();
    S.extra.push({ staff: bs, x: px, y: st.lines[4] - step * half, step, beats: 1 }); rebuildNotes(); saveScan(); render();
    const ni = S.notes.findIndex(n => n.id === 2000 + S.extra.length - 1); if (ni >= 0) openSheet(ni);
  });

  async function load() {
    if (S.loaded) return; S.loaded = true; S.busy = true; render();
    try {
      const blob = await kv('get', 'photo'), scan = await kv('get', 'scan');
      if (blob) {
        S.blob = blob;
        if (scan && scan.res) { Object.assign(S, { keyManual: !!scan.keyManual, extra: scan.extra || [], scale: scan.scale || 1, quarter: scan.quarter, angle: scan.angle, res: scan.res, clef: scan.clef, key: scan.key, bpm: scan.bpm || 90, zoom: scan.zoom || 0, edits: scan.edits || {} }); S.base = await renderBase(blob, S.quarter, S.angle, S.scale || 1); }
        else { await analyze(blob); }
        S.clef = S.clef || defClef(); rebuildNotes();
      }
    } catch (e) {}
    S.busy = false; S.clef = S.clef || defClef(); render();
  }
  window.scoreRoute = page => { if (page === 'partition') load(); else { stopPlay(); closeSheet(); } };
  window.scoreRefresh = () => { render(); if (S.sel >= 0) openSheet(S.sel); };
  window.SCORE = S;      // diagnostic / tests
  S.clef = null; render(); if (location.hash === '#partition') load();
})();
