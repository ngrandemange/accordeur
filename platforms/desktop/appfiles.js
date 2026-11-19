'use strict';
// Résolution des fichiers servis par le protocole app:// (testable sans Electron).
const path = require('path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
// urlPath : « /index.html », « / », « /icons/icon-192.png »… → { file, type } ou null si hors du dossier de l'application.
function resolveAppFile(wwwDir, urlPath) {
  let p; try { p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch (e) { return null; }
  if (p.includes('\0')) return null;
  if (p === '' || p.endsWith('/')) p += 'index.html';
  const root = path.resolve(wwwDir), file = path.resolve(root, '.' + path.posix.normalize('/' + p));
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return { file, type: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' };
}
module.exports = { resolveAppFile, MIME };
