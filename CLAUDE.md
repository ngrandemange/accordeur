# Accordeur

Accordeur, métronome et lecteur de partition (photo). PWA en JavaScript pur : **aucune dépendance, aucun framework, aucun bundler, aucun service externe**.
Un seul code à la racine, quatre éditions : Web (GitHub Pages), PC (Electron), NAS (Docker) et tablette Android (Capacitor). Langue du projet : français (code commenté en français, UI FR/EN).

## Commandes

```
npm test                               # = node test.js : hauteur (YIN), version/releases/i18n, 4 cibles, serveur NAS, deploy.json
node tests/omr-check.js                # lecture de partition, nécessite Playwright (tests/omr/*.png)
npm run build                          # = node tools/build.js all → dist/<cible>/www
npm run serve                          # build web + serveur NAS en dev → http://localhost:8080
node tools/set-version.js <x.y.z>      # aligne version.js + 3 package.json
node tools/train-templates.js <dossier de PNG>   # régénère omr-templates.js (sources LilyPond : tools/train/*.ly)
```

Node ≥ 22 requis. `npm test` est aussi lancé par nas-deploy avant chaque déploiement : il doit toujours passer.

## Architecture

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'UI et la logique accordeur/métronome/réglages (script inline), vues `v-accueil`, `v-accordeur`, `v-metronome`, `v-partition`, `v-reglages` |
| `pitch.js` | Détection de hauteur YIN (`detectPitchEx`, `detectNearest`), testée par `test.js` |
| `omr.js` + `omr-worker.js` + `omr-templates.js` | Lecture de partition par vision classique, exécutée dans un Web Worker (repli : fil principal). `omr-templates.js` est **généré** (ne pas éditer à la main) |
| `score.js` | Page Partition : photo (IndexedDB, une seule), correction des notes, lecture audio |
| `i18n.js` | Textes FR/EN ; clé absente en anglais → repli sur le français |
| `version.js` | `APP_VERSION`, seule source de vérité de la version (UI + service worker) |
| `platform.js` | Édition courante. **Remplacé à la construction** ; celui de la racine sert l'édition Web |
| `sw.js` | Service worker, réseau d'abord (3 s) puis cache, nom de cache = version |
| `releases.json` | Notes de version affichées dans l'app (fr + en, plus récent en tête) |
| `platforms/features.json` | Matrice des drapeaux par édition ; lus par `PLATFORM.has('nom')` |
| `platforms/{desktop,android,nas}/` | Code propre à chaque édition |
| `deploy.json` | Profil nas-deploy (port 8080, santé `/api/health`, volume `/data`) |

Détail des éditions, du déploiement NAS/HTTPS et de ce qui n'a pas été essayé : `docs/PLATFORMS.md`.

## Règles à respecter

- **Pas de dépendance** dans l'app ni dans le serveur NAS (Node natif uniquement). Les `package.json` de `platforms/desktop` et `platforms/android` n'ont que les outils d'emballage.
- **Fichier ajouté à l'app = à déclarer à deux endroits** : `FILES` dans `tools/build.js` et la liste `F` de `sw.js` (hors-ligne). Oublier l'un casse une édition ou le mode hors ligne.
- **Fonction propre à une édition** : ajouter le drapeau dans `platforms/features.json` pour les **quatre** cibles (un test le vérifie), puis `if (PLATFORM.has('x'))`. Ne jamais tester `PLATFORM.id` directement.
- **Version** : ne jamais éditer les numéros à la main, utiliser `tools/set-version.js`, puis ajouter l'entrée en tête de `releases.json` (fr **et** en). Un message de commit de version suit le style `Sujet court (vX.Y.Z)`.
- **Textes d'interface** : toujours via `i18n.js` (FR et EN), jamais en dur dans `index.html`.
- **HTTPS obligatoire** pour micro et caméra (sauf `localhost`). Ne rien enregistrer ni envoyer : le micro sert uniquement à l'accordeur, la photo reste dans IndexedDB.
- **Sécurité du serveur NAS** : le test vérifie traversée de répertoire, en-têtes de sécurité et ETag. Ne pas les affaiblir.
- Après toute modification de `omr.js` ou des gabarits : lancer `node tests/omr-check.js`. Limites connues de l'OMR (liaisons, nuances, triolets, changements de clé/mesure) listées dans le README.
- Ne pas committer : `dist/`, `node_modules/`, `platforms/*/www`, `platforms/desktop/{release,build}`, `platforms/android/android` (déjà dans `.gitignore`).

## Documentation

Les exigences, spécifications et plans sont des fichiers **HTML autonomes** (règle globale de l'utilisateur), jamais du Markdown ; modèles attendus dans `docs/requirements/_template.html` et `docs/specs/_template.html` (à créer avant le premier document). `docs/PLATFORMS.md` est l'exception historique.

## Git

Branche principale : `main` (contient tout le code). GitHub Pages sert la racine de la branche publiée. Ne pas pousser ni créer de tag `vX.Y.Z` sans demande : un tag déclenche les workflows Android (APK) et PC (installateurs) et crée une Release.
