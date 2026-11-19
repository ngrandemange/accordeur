'use strict';
// Expose le strict minimum à la page (aucun accès Node) : la plateforme exacte du système.
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('desktop', Object.freeze({ os: process.platform, arch: process.arch }));
