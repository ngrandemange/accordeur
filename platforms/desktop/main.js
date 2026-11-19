'use strict';
// Édition PC d'Accordeur : fenêtre Electron qui sert l'application depuis www/ via le protocole sécurisé app://
// (nécessaire pour le micro, la caméra, IndexedDB et les Web Workers, comme sur HTTPS).
const { app, BrowserWindow, protocol, session, systemPreferences, Menu, shell } = require('electron');
const path = require('path'); const fs = require('fs');
const { resolveAppFile } = require('./appfiles');

const WWW = path.join(__dirname, 'www'), ORIGIN = 'app://accordeur';
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 820, minWidth: 420, minHeight: 600, backgroundColor: '#0b0f14', title: 'Accordeur', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) e.preventDefault(); });
  win.loadURL(ORIGIN + '/index.html');
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  protocol.handle('app', async req => {
    const r = resolveAppFile(WWW, new URL(req.url).pathname);
    if (!r) return new Response('Interdit', { status: 403 });
    try { return new Response(await fs.promises.readFile(r.file), { headers: { 'content-type': r.type, 'cache-control': 'no-cache' } }); }
    catch (e) { return new Response('Introuvable', { status: 404 }); }
  });
  // Micro et caméra : uniquement pour notre propre page ; tout le reste est refusé.
  const ours = wc => wc && wc.getURL().startsWith(ORIGIN);
  session.defaultSession.setPermissionCheckHandler((wc, permission) => permission === 'media' && ours(wc));
  session.defaultSession.setPermissionRequestHandler(async (wc, permission, cb, details) => {
    if (permission !== 'media' || !ours(wc)) return cb(false);
    if (process.platform === 'darwin') {          // macOS : autorisation système (Réglages > Confidentialité)
      try { for (const t of details.mediaTypes || []) if (!(await systemPreferences.askForMediaAccess(t === 'video' ? 'camera' : 'microphone'))) return cb(false); } catch (e) { return cb(false); }
    }
    cb(true);
  });
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
