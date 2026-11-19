#!/usr/bin/env node
// Change le numéro de version partout où il doit rester identique : node tools/set-version.js 1.9.0
// (version.js = source de l'application, package.json = source de nas-deploy). Rappelle d'ajouter l'entrée de releases.json.
const fs = require('fs'); const path = require('path');
const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v || '')) { console.error('usage : node tools/set-version.js <x.y.z>'); process.exit(1); }
const root = path.join(__dirname, '..');
fs.writeFileSync(path.join(root, 'version.js'), `// Seule source de vérité pour la version : utilisée par l'interface et par le service worker.\nconst APP_VERSION = '${v}';\n`);
const pj = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); pj.version = v;
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pj, null, 2) + '\n');
const rel = JSON.parse(fs.readFileSync(path.join(root, 'releases.json'), 'utf8'));
for (const sub of ['desktop', 'android']) { const f = path.join(root, 'platforms', sub, 'package.json'), j = JSON.parse(fs.readFileSync(f, 'utf8')); j.version = v; fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n'); }
console.log('version.js, package.json et platforms/{desktop,android}/package.json →', v);
if (rel[0].version !== v) console.log(`⚠ releases.json commence par ${rel[0].version} : ajoutez l'entrée de la ${v} (fr + en).`);
