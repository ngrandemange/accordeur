# Accordeur

Accordeur, métronome et lecteur de partition (photo) en PWA pour iPhone. Aucune dépendance, aucun service externe.

- **Accordeur** : alto (défaut), violon, guitare, chromatique.
- **Métronome** : tempo, mesures, subdivisions, tap, flash, volume.
- **Partition** : une photo gardée sur l'appareil ; `omr.js` détecte portées et notes (vision par ordinateur classique),
  la page permet de corriger les notes puis de les jouer. Limites : silences, altérations accidentelles, liaisons,
  changements de clé/mesure non lus ; fonctionne surtout sur partitions imprimées, nettes et bien éclairées.
- **Réglages** : langue (FR/EN), instrument par défaut, aide, notes de version (`releases.json`).

Le micro et la caméra exigent **HTTPS** : héberger le dossier (ex. GitHub Pages), ouvrir l'URL dans Safari,
puis Partager → « Sur l'écran d'accueil ».

Tests : `node test.js` (détection de hauteur, version/notes de version/traductions),
`node tests/omr-check.js` (lecture de partition, nécessite Playwright).
Nouvelle version : modifier `version.js` et ajouter une entrée en tête de `releases.json`.
