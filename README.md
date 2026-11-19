# Accordeur

Accordeur, métronome et lecteur de partition (photo). Aucune dépendance, aucun service externe.

**Quatre éditions, un seul code** — Web (GitHub Pages), PC (Electron), NAS (Docker, déployé avec [nas-deploy](https://github.com/ngrandemange/nas-deploy)) et tablette Android (APK).
Voir [docs/PLATFORMS.md](docs/PLATFORMS.md) pour les fonctions de chaque édition et le déploiement pas à pas.
`node tools/build.js all` assemble les quatre éditions dans `dist/<cible>/www`.

- **Accordeur** : alto (défaut), violon, guitare, chromatique.
- **Métronome** : tempo, mesures, subdivisions, tap, flash, volume.
- **Partition** : une photo gardée sur l'appareil ; `omr.js` (vision par ordinateur classique, gabarits `omr-templates.js`)
  lit portées, clé, armure, notes, altérations accidentelles, silences et points ; on peut corriger / ajouter des notes puis les jouer.
  Limites : liaisons, nuances, triolets et changements de clé/mesure non lus ; surtout fiable sur partitions imprimées, nettes, à plat.
- **Réglages** : langue (FR/EN), instrument par défaut, aide, notes de version (`releases.json`).

Édition Web : le micro et la caméra exigent **HTTPS** ; GitHub Pages sert le dossier, ouvrir l'URL dans Safari,
puis Partager → « Sur l'écran d'accueil ».

Tests : `node test.js` (détection de hauteur, version/notes de version/traductions),
`node tests/omr-check.js` (lecture de partition, nécessite Playwright ; partitions générées avec LilyPond dans `tests/omr/`).
Gabarits des symboles : `node tools/train-templates.js <dossier de PNG>` (entraînement sur `tools/train/*.ly`).
Nouvelle version : `node tools/set-version.js <x.y.z>` (aligne `version.js` et les `package.json`), puis ajouter une entrée en tête de `releases.json`.
