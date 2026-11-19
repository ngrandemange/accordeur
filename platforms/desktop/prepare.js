'use strict';
// Assemble www/ (cible « desktop ») et l'icône avant `electron .` ou `electron-builder`.
const path = require('path'); const fs = require('fs');
const { build } = require('../../tools/build.js');
build('desktop', __dirname);
fs.mkdirSync(path.join(__dirname, 'build'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '..', '..', 'icons', 'icon-512.png'), path.join(__dirname, 'build', 'icon.png'));
console.log('✓ desktop prêt (www/, build/icon.png)');
