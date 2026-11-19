#!/usr/bin/env node
'use strict';
// Construit l'APK (Capacitor + Gradle) sur Windows, macOS ou Linux, sans réglage manuel de l'environnement.
// Usage : node build-apk.js [debug|release] [--offline] [--no-sync]     (via npm : npm run apk / npm run apk:release)
//   • crée le projet Android s'il est absent, puis synchronise le site (tools/build.js android) ;
//   • trouve JAVA_HOME (JDK 21) et ANDROID_HOME (SDK) s'ils ne sont pas définis, et écrit local.properties ;
//   • sous Windows, Java utilise le magasin de certificats de Windows (Windows-ROOT) pour CE processus seulement :
//     indispensable derrière un antivirus qui inspecte le HTTPS (Avast…), sans désactiver aucune vérification ;
//   • copie l'APK dans platforms/android/dist/Accordeur-<version>-android[-release].apk.
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const HERE = __dirname, WIN = process.platform === 'win32';
const args = process.argv.slice(2), release = args.includes('release'), offline = args.includes('--offline'), noSync = args.includes('--no-sync');
const die = m => { console.error('✗ ' + m); process.exit(1); };
const exists = p => { try { return fs.existsSync(p); } catch (_) { return false; } };
const env = { ...process.env };

// ---------- Java ----------
function findJdk() {
  if (env.JAVA_HOME && exists(path.join(env.JAVA_HOME, 'bin', WIN ? 'java.exe' : 'java'))) return env.JAVA_HOME;
  const roots = WIN ? ['C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java', 'C:\\Program Files\\Microsoft', 'C:\\Program Files\\Android\\Android Studio\\jbr']
    : ['/usr/lib/jvm', '/Library/Java/JavaVirtualMachines'];
  for (const r of roots) {
    if (exists(path.join(r, 'bin', WIN ? 'java.exe' : 'java'))) return r;       // dossier JDK direct (Android Studio jbr)
    let subs = []; try { subs = fs.readdirSync(r); } catch (_) {}
    for (const s of subs.filter(x => /(^|[-_])21(\.|[-_]|$)/.test(x)).sort().reverse()) {
      for (const home of [path.join(r, s), path.join(r, s, 'Contents', 'Home')]) if (exists(path.join(home, 'bin', WIN ? 'java.exe' : 'java'))) return home;
    }
  }
  return null;
}
const jdk = findJdk();
if (!jdk) die('JDK 21 introuvable. Windows : winget install EclipseAdoptium.Temurin.21.JDK — puis définissez JAVA_HOME si besoin.');
env.JAVA_HOME = jdk; env.PATH = path.join(jdk, 'bin') + path.delimiter + (env.PATH || env.Path || '');
if (WIN) delete env.Path;                                                       // une seule variable PATH pour l'enfant

// ---------- SDK Android ----------
function findSdk() {
  const c = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, WIN && 'C:\\Android', process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Android', 'Sdk'), process.env.HOME && path.join(process.env.HOME, 'Library', 'Android', 'sdk')].filter(Boolean);
  return c.find(p => exists(path.join(p, 'platforms'))) || null;
}
const sdk = findSdk();
if (!sdk) die('SDK Android introuvable. Installez les outils en ligne de commande, puis : sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" (voir docs/PLATFORMS.md).');
env.ANDROID_HOME = sdk; env.ANDROID_SDK_ROOT = sdk;

// ---------- certificats (antivirus qui inspecte le HTTPS) ----------
if (WIN && !/trustStoreType/.test(env.JAVA_TOOL_OPTIONS || '')) env.JAVA_TOOL_OPTIONS = ((env.JAVA_TOOL_OPTIONS || '') + ' -Djavax.net.ssl.trustStoreType=Windows-ROOT').trim();

const run = (cmd, a, cwd, opts = {}) => {
  // Windows : les .cmd/.bat exigent un shell ; on passe alors une seule chaîne (arguments toujours maîtrisés, sans entrée utilisateur)
  const r = WIN ? spawnSync([cmd, ...a].join(' '), { cwd, env, stdio: 'inherit', shell: true, ...opts }) : spawnSync(cmd, a, { cwd, env, stdio: 'inherit', ...opts });
  if (r.error) die(`${cmd} : ${r.error.message}`);
  if (r.status !== 0) die(`${cmd} ${a.join(' ')} a échoué (code ${r.status})`);
};
const npx = WIN ? 'npx.cmd' : 'npx';
console.log(`JDK : ${jdk}\nSDK : ${sdk}`);

// ---------- projet + synchronisation ----------
const proj = path.join(HERE, 'android');
if (!exists(path.join(HERE, 'node_modules', '@capacitor'))) run(WIN ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], HERE);
if (!exists(proj)) { console.log('→ création du projet Android (cap add)'); run(npx, ['cap', 'add', 'android'], HERE); run('node', ['patch-project.js', 'manifest'], HERE); }
if (!noSync) { run('node', [path.join('..', '..', 'tools', 'build.js'), 'android', '--out', '.'], HERE); run(npx, ['cap', 'sync', 'android'], HERE); run('node', ['patch-project.js', 'manifest'], HERE); }
fs.writeFileSync(path.join(proj, 'local.properties'), 'sdk.dir=' + sdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:') + '\n');

// ---------- Gradle ----------
const task = release ? 'assembleRelease' : 'assembleDebug';
const gradle = WIN ? `"${path.join(proj, 'gradlew.bat')}"` : path.join(proj, 'gradlew');   // chemin absolu : cmd ne cherche pas dans le dossier courant
console.log(`→ Gradle ${task}${offline ? ' (hors ligne)' : ''}`);
run(gradle, [task, ...(offline ? ['--offline'] : [])], proj);

// ---------- résultat ----------
const kind = release ? 'release' : 'debug', dir = path.join(proj, 'app', 'build', 'outputs', 'apk', kind);
let apk = null; try { apk = fs.readdirSync(dir).find(f => f.endsWith('.apk')); } catch (_) {}
if (!apk) die('APK introuvable dans ' + dir + (release ? ' (assembleRelease produit un APK non signé sans clé de signature : utilisez debug)' : ''));
const version = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version;
const outDir = path.join(HERE, 'dist'); fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `Accordeur-${version}-android${release ? '-release' : ''}.apk`);
fs.copyFileSync(path.join(dir, apk), out);
console.log(`✓ ${path.relative(process.cwd(), out) || out} (${(fs.statSync(out).size / 1048576).toFixed(1)} Mo)`);
