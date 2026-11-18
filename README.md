# Accordeur

Accordeur, métronome et lecteur de partition (photo) en PWA pour iPhone. Aucune dépendance, aucun service externe.

- **Accordeur** : alto (défaut), violon, guitare, chromatique.
- **Métronome** : tempo, mesures, subdivisions, tap, flash, volume.
- **Partition** : une photo gardée sur l'appareil ; `omr.js` (vision par ordinateur classique, gabarits `omr-templates.js`)
  lit portées, clé, armure, notes, altérations accidentelles, silences et points ; on peut corriger / ajouter des notes puis les jouer.
  Limites : liaisons, nuances, triolets et changements de clé/mesure non lus ; surtout fiable sur partitions imprimées, nettes, à plat.
- **Réglages** : langue (FR/EN), instrument par défaut, aide, notes de version (`releases.json`).

Le micro et la caméra exigent **HTTPS** : héberger le dossier (ex. GitHub Pages), ouvrir l'URL dans Safari,
puis Partager → « Sur l'écran d'accueil ».

Tests : `node test.js` (détection de hauteur, version/notes de version/traductions),
`node tests/omr-check.js` (lecture de partition, nécessite Playwright ; partitions générées avec LilyPond dans `tests/omr/`).
Gabarits des symboles : `node tools/train-templates.js <dossier de PNG>` (entraînement sur `tools/train/*.ly`).
Nouvelle version : modifier `version.js` et ajouter une entrée en tête de `releases.json`.
