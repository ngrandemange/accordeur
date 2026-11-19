#!/usr/bin/env node
// Serveur de l'édition NAS : fichiers statiques + HTTP/HTTPS, sans aucune dépendance (Node ≥ 18).
// Le micro et la caméra exigent HTTPS (sauf sur localhost) : en mode TLS « auto », le serveur crée une
// autorité de certification locale (téléchargeable sur /ca.crt) et un certificat pour vos noms / adresses.
//
// Variables d'environnement :
//   WWW_DIR            dossier de l'application           (défaut ./www)
//   DATA_DIR           dossier persistant (certificats…)   (défaut ./data)
//   HTTP_PORT          port HTTP                            (défaut 8080)
//   HTTPS_PORT         port HTTPS                           (défaut 8443)
//   PUBLIC_HTTPS_PORT  port HTTPS vu de l'extérieur (redirection) (défaut = HTTPS_PORT)
//   TLS                auto | files | off                   (défaut auto)
//                        auto  : CA + certificat générés dans DATA_DIR/tls (openssl requis)
//                        files : utilise DATA_DIR/tls/server.crt et server.key (vos certificats)
//                        off   : HTTP seul (derrière un reverse proxy qui fournit déjà le HTTPS)
//   HOSTNAMES          noms / IP du certificat, séparés par des virgules (ex. nas.local,192.168.1.50)
const http = require('http'); const https = require('https'); const fs = require('fs'); const path = require('path');
const zlib = require('zlib'); const { execFileSync } = require('child_process'); const os = require('os');

const DEV = process.argv.includes('--dev');          // npm run serve : sert dist/web/www en HTTP simple
if (DEV) { process.env.WWW_DIR = process.env.WWW_DIR || path.join(__dirname, '..', '..', 'dist', 'web', 'www'); process.env.TLS = process.env.TLS || 'off'; }
const cfg = {
  www: path.resolve(process.env.WWW_DIR || path.join(__dirname, 'www')),
  data: path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data')),
  httpPort: +(process.env.HTTP_PORT || 8080), httpsPort: +(process.env.HTTPS_PORT || 8443),
  tls: (process.env.TLS || 'auto').toLowerCase(),
  hostnames: (process.env.HOSTNAMES || '').split(',').map(s => s.trim()).filter(Boolean),
};
cfg.publicHttps = +(process.env.PUBLIC_HTTPS_PORT || cfg.httpsPort);
const log = (...a) => console.log(new Date().toISOString(), ...a);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const COMPRESSIBLE = new Set(['.html', '.js', '.json', '.webmanifest', '.svg', '.css', '.txt']);
const SECURITY = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

// ---------- TLS ----------
const tlsDir = path.join(cfg.data, 'tls');
function sans() {
  const names = new Set(['localhost', os.hostname(), ...cfg.hostnames]), ips = new Set(['127.0.0.1']);
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.family === 'IPv4' && !i.internal) ips.add(i.address);
  const isIp = s => /^\d+\.\d+\.\d+\.\d+$/.test(s);
  const dns = [...names].filter(n => !isIp(n)), ip = [...new Set([...ips, ...[...names].filter(isIp)])];
  return dns.map(n => 'DNS:' + n).concat(ip.map(a => 'IP:' + a)).join(',');
}
function openssl(args, input) { return execFileSync('openssl', args, { stdio: ['pipe', 'pipe', 'pipe'], input }); }
function ensureCerts() {
  fs.mkdirSync(tlsDir, { recursive: true });
  const f = n => path.join(tlsDir, n), have = n => fs.existsSync(f(n));
  if (cfg.tls === 'files') { if (!have('server.crt') || !have('server.key')) throw new Error(`TLS=files : ${f('server.crt')} / server.key introuvables`); return; }
  const want = sans(), sansFile = f('server.sans');
  if (have('server.crt') && have('server.key') && have('ca.crt') && fs.existsSync(sansFile) && fs.readFileSync(sansFile, 'utf8') === want) return;   // déjà prêt, mêmes noms
  log('TLS : génération de la CA locale et du certificat pour', want);
  if (!have('ca.key') || !have('ca.crt')) {
    openssl(['genrsa', '-out', f('ca.key'), '3072']);
    openssl(['req', '-x509', '-new', '-key', f('ca.key'), '-sha256', '-days', '3650', '-subj', '/CN=Accordeur local CA/O=Accordeur', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-out', f('ca.crt')]);
  }
  openssl(['genrsa', '-out', f('server.key'), '2048']);
  openssl(['req', '-new', '-key', f('server.key'), '-subj', '/CN=accordeur', '-out', f('server.csr')]);
  fs.writeFileSync(f('server.ext'), `basicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${want}\n`);
  openssl(['x509', '-req', '-in', f('server.csr'), '-CA', f('ca.crt'), '-CAkey', f('ca.key'), '-CAcreateserial', '-days', '825', '-sha256', '-extfile', f('server.ext'), '-out', f('server.crt')]);
  fs.writeFileSync(sansFile, want); fs.chmodSync(f('server.key'), 0o600); fs.chmodSync(f('ca.key'), 0o600);
}

// ---------- fichiers statiques ----------
const version = (() => { try { return /APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(cfg.www, 'version.js'), 'utf8'))[1]; } catch (e) { return 'inconnue'; } })();
function send(res, code, body, headers = {}) { res.writeHead(code, { ...SECURITY, ...headers }); res.end(body); }
function handler(req, res, secure) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Méthode non autorisée', { Allow: 'GET, HEAD' });
  let url; try { url = new URL(req.url, 'http://x'); } catch (e) { return send(res, 400, 'Requête invalide'); }
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === '/api/health') return send(res, 200, JSON.stringify({ ok: true, app: 'accordeur', version, platform: 'nas', tls: secure }), { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  if (pathname === '/ca.crt') {
    const ca = path.join(tlsDir, 'ca.crt'); if (!fs.existsSync(ca)) return send(res, 404, 'Pas d’autorité locale (TLS=' + cfg.tls + ')');
    return send(res, 200, fs.readFileSync(ca), { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="accordeur-ca.crt"', 'Cache-Control': 'no-store' });
  }
  // HTTP → HTTPS (sauf /api/health et /ca.crt, utiles sans confiance préalable)
  if (!secure && cfg.tls !== 'off') {
    const host = (req.headers.host || 'localhost').replace(/:\d+$/, '');
    return send(res, 301, '', { Location: `https://${host}${cfg.publicHttps === 443 ? '' : ':' + cfg.publicHttps}${req.url}` });
  }
  let rel = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, ''); if (rel.endsWith(path.sep) || rel === '.') rel = path.join(rel, 'index.html');
  const file = path.join(cfg.www, rel);
  if (!file.startsWith(cfg.www + path.sep) && file !== cfg.www) return send(res, 403, 'Interdit');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Introuvable', { 'Content-Type': MIME['.txt'] });
    const ext = path.extname(file).toLowerCase(), type = MIME[ext] || 'application/octet-stream', etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = { 'Content-Type': type, ETag: etag, 'Last-Modified': st.mtime.toUTCString(), 'Cache-Control': ext === '.png' ? 'public, max-age=86400' : 'no-cache', Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === etag) return send(res, 304, '', headers);
    const gz = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gz) headers['Content-Encoding'] = 'gzip'; else headers['Content-Length'] = st.size;
    res.writeHead(200, { ...SECURITY, ...headers });
    if (req.method === 'HEAD') return res.end();
    const rs = fs.createReadStream(file); rs.on('error', () => res.destroy()); gz ? rs.pipe(zlib.createGzip()).pipe(res) : rs.pipe(res);
  });
}

// ---------- démarrage ----------
function start() {
  if (!fs.existsSync(path.join(cfg.www, 'index.html'))) throw new Error('Application introuvable dans ' + cfg.www);
  const servers = [];
  const httpServer = http.createServer((q, r) => handler(q, r, false)); servers.push(httpServer);
  httpServer.listen(cfg.httpPort, () => log(`HTTP  : http://0.0.0.0:${cfg.httpPort}${cfg.tls === 'off' ? '' : '  (redirige vers HTTPS)'}`));
  if (cfg.tls !== 'off') {
    ensureCerts();
    const opts = { key: fs.readFileSync(path.join(tlsDir, 'server.key')), cert: fs.readFileSync(path.join(tlsDir, 'server.crt')), minVersion: 'TLSv1.2' };
    const s = https.createServer(opts, (q, r) => handler(q, r, true)); servers.push(s);
    s.listen(cfg.httpsPort, () => log(`HTTPS : https://0.0.0.0:${cfg.httpsPort}   autorité à installer : http://<adresse>:${cfg.httpPort}/ca.crt`));
  }
  const stop = () => { log('arrêt'); servers.forEach(x => x.close()); setTimeout(() => process.exit(0), 500).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  return servers;
}
if (require.main === module) { try { start(); } catch (e) { console.error('Erreur :', e.message); process.exit(1); } }
module.exports = { start, handler, cfg };
