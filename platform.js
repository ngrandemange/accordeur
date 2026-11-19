// Plateforme courante. Ce fichier est REMPLACÉ à la construction (tools/build.js) pour chaque cible ;
// celui-ci sert la version Web (GitHub Pages, lancée depuis la racine du dépôt).
const PLATFORM = { id: 'web', name: 'Web (GitHub Pages)', edition: 'Limitée', features: { serviceWorker: true, pullToRefresh: true, wideLayout: false, serverApi: false, updates: 'service-worker' } };
PLATFORM.has = f => !!PLATFORM.features[f];
