#!/usr/bin/env node
// Assemble l'application pour une cible : node tools/build.js <web|desktop|nas|android|all> [--out <dossier>]
// Résultat : <out>/www/ (par défaut dist/<cible>/www) avec un platform.js propre à la cible.
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILES = ['index.html', 'manifest.webmanifest', 'sw.js', 'version.js', 'i18n.js', 'pitch.js', 'omr.js', 'omr-templates.js', 'omr-worker.js', 'score.js', 'releases.json'];
const DIRS = ['icons'];
const MATRIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'platforms', 'features.json'), 'utf8'));

function copyDir(src, dst) { fs.mkdirSync(dst, { recursive: true }); for (const e of fs.readdirSync(src, { withFileTypes: true })) { const s = path.join(src, e.name), d = path.join(dst, e.name); e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); } }
function platformJs(id) {
  const p = MATRIX[id]; if (!p) throw new Error('cible inconnue : ' + id);
  const version = /APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'version.js'), 'utf8'))[1];
  return `// Généré par tools/build.js pour la cible « ${id} » — ne pas modifier.\nconst PLATFORM = ${JSON.stringify({ id, name: p.name, edition: p.edition, features: p.features, build: { version } })};\nPLATFORM.has = f => !!PLATFORM.features[f];\n`;
}
function build(id, out) {
  const www = path.join(out || path.join(ROOT, 'dist', id), 'www');
  fs.rmSync(www, { recursive: true, force: true }); fs.mkdirSync(www, { recursive: true });
  for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(www, f));
  for (const d of DIRS) copyDir(path.join(ROOT, d), path.join(www, d));
  fs.writeFileSync(path.join(www, 'platform.js'), platformJs(id));
  // le service worker met platform.js en cache avec le reste
  const sw = fs.readFileSync(path.join(www, 'sw.js'), 'utf8'); if (!sw.includes("'platform.js'")) fs.writeFileSync(path.join(www, 'sw.js'), sw.replace("'version.js',", "'version.js', 'platform.js',"));
  return www;
}
if (require.main === module) {
  const args = process.argv.slice(2), target = args[0] || 'all', oi = args.indexOf('--out');
  const out = oi >= 0 ? path.resolve(args[oi + 1]) : null;
  for (const id of target === 'all' ? Object.keys(MATRIX) : [target]) console.log('✓', id, '→', path.relative(process.cwd(), build(id, out && target !== 'all' ? out : null)));
}
module.exports = { build, MATRIX, FILES };
