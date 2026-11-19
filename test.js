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
// --- cohérence version / notes de version / traductions
const fs = require('fs');
const ver = /APP_VERSION = '([^']+)'/.exec(fs.readFileSync('./version.js', 'utf8'))[1];
const rel = JSON.parse(fs.readFileSync('./releases.json', 'utf8'));
let bad3 = 0;
if (rel[0].version !== ver) { bad3++; console.log('ÉCHEC: releases.json[0] =', rel[0].version, 'mais APP_VERSION =', ver); }
rel.forEach(x => { if (!x.fr?.length || !x.en?.length) { bad3++; console.log('ÉCHEC: notes fr/en manquantes pour', x.version); } });
const { I18N } = require('./i18n.js');
Object.keys(I18N.fr).filter(k => !(k in I18N.en)).forEach(k => { bad3++; console.log('ÉCHEC: clé anglaise manquante', k); });
console.log(`version ${ver}, ${rel.length} entrées de notes, traductions ${bad3 ? 'KO' : 'OK'}`);
// --- plateformes : package.json / deploy.json (format nas-deploy) / build des 4 cibles / serveur NAS
const path = require('path'); const { execSync, spawn } = require('child_process'); const http = require('http'); const net = require('net'); const os = require('os');
let bad4 = 0; const ko = m => { bad4++; console.log('ÉCHEC:', m); };
const pj = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
if (pj.version !== ver) ko(`package.json (${pj.version}) ≠ version.js (${ver}) : node tools/set-version.js <x.y.z>`);
['desktop', 'android'].forEach(sub => { const v = JSON.parse(fs.readFileSync(`./platforms/${sub}/package.json`, 'utf8')).version; if (v !== ver) ko(`platforms/${sub}/package.json (${v}) ≠ version.js (${ver}) : node tools/set-version.js <x.y.z>`); });
const { resolveAppFile } = require('./platforms/desktop/appfiles');
{ const base = path.resolve('/x/www'); for (const u of ['/', '/../../etc/passwd', '/%2e%2e/%2e%2e/secret', '/a/../../b']) { const r = resolveAppFile(base, u); if (!r || !r.file.startsWith(base + path.sep)) ko('édition PC : ' + u + ' sort du dossier de l’application'); }
  if (resolveAppFile(base, '/%00') !== null) ko('édition PC : octet nul accepté'); if (resolveAppFile(base, '/omr-worker.js').type.indexOf('javascript') < 0) ko('édition PC : type MIME des scripts'); }
const dj = JSON.parse(fs.readFileSync('./deploy.json', 'utf8'));
const ALLOWED = ['id', 'name', 'version', 'build', 'test', 'run', 'health', 'volumes', 'smokeTest', 'backup', 'imageGuard'];
Object.keys(dj).filter(k => !ALLOWED.includes(k)).forEach(k => ko('deploy.json : champ inconnu ' + k));
if (!/^[a-z][a-z0-9-]*$/.test(dj.id) || dj.version?.from !== 'package.json' || !dj.health?.path?.startsWith('/') || !(dj.run?.internalPort > 0)) ko('deploy.json : profil invalide');
if (!fs.existsSync(dj.build.dockerfile)) ko('deploy.json : Dockerfile introuvable ' + dj.build.dockerfile);
const feats = JSON.parse(fs.readFileSync('./platforms/features.json', 'utf8')), keysOf = o => Object.keys(o.features).sort().join();
const ids = Object.keys(feats); if (ids.sort().join() !== 'android,desktop,nas,web') ko('platforms/features.json : cibles ' + ids);
ids.forEach(i => { if (keysOf(feats[i]) !== keysOf(feats.web)) ko(`features.json : « ${i} » n'a pas les mêmes fonctions que « web »`); });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-'));
execSync(`node tools/build.js all`, { stdio: 'pipe' });
for (const i of ids) {
  const www = path.join('dist', i, 'www'), pf = fs.readFileSync(path.join(www, 'platform.js'), 'utf8');
  for (const f of ['index.html', 'sw.js', 'platform.js', 'omr.js', 'score.js', 'releases.json', 'icons/icon-192.png']) if (!fs.existsSync(path.join(www, f))) ko(`${i} : ${f} manquant`);
  if (!pf.includes(`"id":"${i}"`) || !pf.includes(`"version":"${ver}"`)) ko(`${i} : platform.js incorrect`);
  if (!fs.readFileSync(path.join(www, 'sw.js'), 'utf8').includes("'platform.js'")) ko(`${i} : sw.js ne met pas platform.js en cache`);
}
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (url, headers = {}) => new Promise((res, rej) => http.get(url, { headers }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: b })); }).on('error', rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const port = await freePort();   // même environnement que le profil nas-deploy (TLS=off) ; aucune écriture hors DATA_DIR
  const srv = spawn(process.execPath, ['platforms/nas/server.js'], { env: { ...process.env, TLS: 'off', WWW_DIR: path.join('dist', 'nas', 'www'), DATA_DIR: tmp, HTTP_PORT: String(port) }, stdio: 'ignore' });
  try {
    let h; for (let k = 0; k < 40; k++) { try { h = await get(`http://127.0.0.1:${port}${dj.health.path}`); break; } catch (e) { await sleep(100); } }
    if (!h || h.status !== 200 || !JSON.parse(h.body).ok) ko('serveur NAS : /api/health');
    for (const c of dj.smokeTest.extraChecks) { const r = await get(`http://127.0.0.1:${port}${c.get}`); if (r.status !== c.expect) ko(`serveur NAS : GET ${c.get} → ${r.status} (attendu ${c.expect})`); }
    const r1 = await get(`http://127.0.0.1:${port}/omr.js`), r2 = await get(`http://127.0.0.1:${port}/omr.js`, { 'If-None-Match': r1.headers.etag });
    if (r2.status !== 304) ko('serveur NAS : ETag / 304');
    if ((await get(`http://127.0.0.1:${port}/%2e%2e/%2e%2e/etc/passwd`)).status === 200) ko('serveur NAS : traversée de répertoire !');
    if (!/microphone=\(self\)/.test(r1.headers['permissions-policy'] || '')) ko('serveur NAS : Permissions-Policy');
    if ((await get(`http://127.0.0.1:${port}/platform.js`)).body.indexOf('"id":"nas"') < 0) ko('serveur NAS : platform.js n’est pas celui de la cible nas');
  } catch (e) { ko('serveur NAS : ' + e.message); } finally { srv.kill(); }
  console.log(`plateformes : package.json/deploy.json/${ids.length} cibles/serveur NAS ${bad4 ? 'KO' : 'OK'}`);
  process.exit(bad || bad2 || bad3 || bad4 ? 1 : 0);
})();
