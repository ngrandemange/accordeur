'use strict';
// Ajuste le projet Android généré par `npx cap add android` : permissions (micro, caméra, écran allumé),
// fonctions matérielles facultatives (une tablette sans caméra peut quand même l'installer), icône.
// Idempotent : on peut le relancer à chaque synchronisation.   Usage : node patch-project.js manifest|assets
const fs = require('fs'); const path = require('path');
const mode = process.argv[2] || 'manifest';
const manifest = path.join(__dirname, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (mode === 'manifest') {
  if (!fs.existsSync(manifest)) { console.error('Projet Android absent : lancez d’abord « npm run add-android »'); process.exit(1); }
  let x = fs.readFileSync(manifest, 'utf8');
  const perms = ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.WAKE_LOCK'];
  const feats = ['android.hardware.camera', 'android.hardware.microphone'];
  let add = '';
  for (const p of perms) if (!x.includes(`"${p}"`)) add += `    <uses-permission android:name="${p}" />\n`;
  for (const f of feats) if (!x.includes(`"${f}"`)) add += `    <uses-feature android:name="${f}" android:required="false" />\n`;
  if (add) x = x.replace(/<\/manifest>\s*$/, add + '</manifest>\n');
  fs.writeFileSync(manifest, x);
  console.log('✓ AndroidManifest.xml :', perms.length, 'permissions, caméra/micro facultatifs');
  // numéro de version de l'APK = version de l'application (1.9.0 → versionName "1.9.0", versionCode 10900)
  const gradle = path.join(__dirname, 'android', 'app', 'build.gradle');
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')).version, [M, m, p] = v.split('.').map(Number);
  let g = fs.readFileSync(gradle, 'utf8');
  g = g.replace(/versionCode\s+\d+/, `versionCode ${M * 10000 + m * 100 + p}`).replace(/versionName\s+"[^"]*"/, `versionName "${v}"`);
  fs.writeFileSync(gradle, g);
  console.log('✓ build.gradle : versionName', v, 'versionCode', M * 10000 + m * 100 + p);
} else if (mode === 'assets') {
  // icône source (utilisée par @capacitor/assets si vous l'ajoutez) : même icône que les autres éditions
  fs.mkdirSync(path.join(__dirname, 'resources'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '..', '..', 'icons', 'icon-512.png'), path.join(__dirname, 'resources', 'icon.png'));
  console.log('✓ resources/icon.png');
}
