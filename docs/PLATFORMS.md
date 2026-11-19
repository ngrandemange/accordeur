# Les quatre éditions d'Accordeur

Un seul code (à la racine du dépôt), quatre emballages. Chaque édition a un fichier `platform.js` **généré** à la construction
(`node tools/build.js <cible>`), qui dit à l'application où elle tourne et quelles fonctions sont actives.

| Édition | Cible | Emballage | Livrable | Mise à jour |
|---|---|---|---|---|
| **Web** (limitée) | `web` | fichiers statiques à la racine du dépôt | GitHub Pages (inchangé) | automatique (service worker) |
| **PC** | `desktop` | Electron (`platforms/desktop`) | installateur Windows / macOS / Linux | nouvel installateur |
| **NAS** | `nas` | serveur Node + Docker (`platforms/nas`) | image Docker, déployée par **nas-deploy** | `nas-deploy deploy accordeur` |
| **Tablette** | `android` | Capacitor (`platforms/android`) | APK | nouvel APK |

## Fonctions par édition

Les fonctions sont des drapeaux dans `platforms/features.json` ; le code les lit avec `PLATFORM.has('nom')`.

| Fonction (drapeau) | Web | PC | NAS | Tablette |
|---|:-:|:-:|:-:|:-:|
| Accordeur, métronome, partition, réglages, FR/EN | ✔ | ✔ | ✔ | ✔ |
| Mise à jour par service worker (`serviceWorker`) | ✔ | — | ✔ | — |
| Tirer pour rafraîchir (`pullToRefresh`) | ✔ | — | ✔ | ✔ |
| Mise en page large sur grand écran (`wideLayout`) | — | ✔ | ✔ | ✔ |
| API serveur (`serverApi`) | — | — | ✔ (`/api/health` pour l'instant) | — |

**Ajouter une fonction à une seule édition** : ajouter le drapeau dans `platforms/features.json` (mêmes clés pour les quatre
cibles — un test le vérifie), puis dans le code `if (PLATFORM.has('maFonction')) { … }`. Le code propre à une édition
vit dans `platforms/<cible>/`. Idées déjà identifiées : bibliothèque de partitions sur le NAS (partagée PC/tablette),
ouverture de fichiers et export (PC), partage natif et caméra native (tablette).

## Web — GitHub Pages
Rien ne change : Pages sert la racine de la branche. Le dossier `platforms/` est présent dans le dépôt mais n'est pas utilisé par cette édition.

## NAS — avec nas-deploy
`nas-deploy` (projet `ngrandemange/nas-deploy`) construit l'image sur le portable, la teste, l'envoie au NAS en SSH et bascule le
conteneur derrière un contrôle de santé. L'application se décrit elle-même, sans toucher à la plateforme :

- `deploy.json` (racine) : profil de l'appli (port interne 8080, santé `GET /api/health`, volume `/data`, `run.user: "nas-account"`,
  tests `npm test`, garde-fou d'image).
- `package.json` : fournit la version (`version.from`). Garder les numéros alignés avec `node tools/set-version.js <x.y.z>`.
- `platforms/nas/Dockerfile` : image `node:22-alpine`, serveur sans dépendance (`platforms/nas/server.js`), non-root.

Sur le portable Windows (PowerShell), une seule fois puis à chaque version :

```powershell
nas-deploy register C:\Projets\Accordeur --port 8085      # 8085 : à adapter (8080 Filmo, 8096 Jellyfin, 5055 Jellyseerr déjà pris)
nas-deploy deploy accordeur --dry-run                     # montre tout, ne change rien
nas-deploy deploy accordeur
nas-deploy status accordeur
```

Données : `/<volume racine>/docker/accordeur/data` (monté en `/data`). `nas-deploy rollback accordeur` fonctionne comme pour les autres applis.

### HTTPS (obligatoire pour le micro et la caméra)
Les navigateurs n'autorisent micro et caméra qu'en **HTTPS** (ou sur `localhost`). Le conteneur parle en HTTP simple
(`TLS=off`, c'est ce que le contrôle de santé de nas-deploy attend). Le plus simple et le plus propre :

1. **Proxy inversé DSM** : *Panneau de configuration › Portail de connexion › Avancé › Proxy inversé › Créer* —
   source `HTTPS`, nom d'hôte de votre choix (par exemple `accordeur.<votre-ddns>`), port 443 ;
   destination `HTTP`, `localhost`, port `8085`. Associez un certificat (Let's Encrypt via *Sécurité › Certificat*).
2. Ouvrez ensuite `https://accordeur.<votre-ddns>` depuis la tablette ou le PC, puis « Installer l'application ».

*Autre option (hors nas-deploy)* : l'image sait aussi faire du HTTPS elle-même (`TLS=auto`) : elle crée une autorité locale
dans `/data/tls` et la sert sur `http://<adresse>:<port>/ca.crt` pour l'installer sur chaque appareil. Comme nas-deploy ne publie
qu'un seul port, ce mode sert pour un lancement manuel : `docker run -p 8080:8080 -p 8443:8443 -e TLS=auto -e HOSTNAMES=nas.local,192.168.1.50 -v accordeur-data:/data <image>`.

Variables du serveur : `TLS` (`off` | `auto` | `files`), `HOSTNAMES`, `HTTP_PORT`, `HTTPS_PORT`, `PUBLIC_HTTPS_PORT`, `WWW_DIR`, `DATA_DIR` (détails en tête de `platforms/nas/server.js`).

Essai local sans Docker : `npm run serve` (http://localhost:8080, édition web).

## PC — Electron
L'application est servie par un protocole sécurisé `app://` (micro, caméra, IndexedDB et Web Workers fonctionnent comme sur HTTPS),
sans service worker. Aucun accès Node n'est donné à la page.

**Sur votre portable Windows** (Node ≥ 22) :
```powershell
cd platforms\desktop
npm install
npm start            # essai : ouvre la fenêtre
npm run dist:win     # installateur + version portable dans platforms\desktop\release
```
**Ou sans rien installer** : onglet *Actions › Édition PC (installateurs) › Run workflow* ; les installateurs Windows, macOS et Linux
sont téléchargeables dans les *Artifacts* du lancement. Un tag `vX.Y.Z` les attache en plus à une *Release*.

Installateurs **non signés** : Windows SmartScreen affiche « Windows a protégé votre ordinateur » (*Informations complémentaires › Exécuter quand même*) ;
macOS demande *clic droit › Ouvrir* ; sous Linux, `chmod +x Accordeur-*.AppImage`.

## Tablette Android — Capacitor
Le projet Android est généré (`npx cap add android`) puis ajusté par `platforms/android/patch-project.js` (permissions caméra / micro,
matériel facultatif, numéro de version = celui de l'application). Il n'est pas versionné dans le dépôt.

**Sans Android Studio** : onglet *Actions › Édition tablette Android (APK) › Run workflow*, ou poussez un tag `vX.Y.Z` :
l'APK est alors un fichier de la *Release* GitHub, téléchargeable directement depuis la tablette.
Installation : autoriser « Installer des applis inconnues » pour le navigateur utilisé, ouvrir l'APK, accepter.
L'APK est signé avec la clé de débogage (suffisant pour votre usage ; pas pour le Play Store).

**Avec Android Studio / SDK sur le portable** : `cd platforms/android && npm install && npm run add-android && npm run apk`.

Alternative sans APK : ouvrir l'adresse HTTPS du NAS (ou de GitHub Pages) dans Chrome sur la tablette › « Installer l'application ».

## Tests et vérifications
`npm test` (celui que nas-deploy exécute avant chaque déploiement) vérifie : détection de hauteur, version / notes de version /
traductions, cohérence des numéros de version (3 `package.json`), validité de `deploy.json`, construction des 4 éditions,
serveur NAS (santé, contrôles de fumée du profil, ETag, traversée de répertoire, en-têtes de sécurité) et résolution des fichiers de l'édition PC.
`node tests/omr-check.js` (Playwright) vérifie la lecture de partition.

## Ce qui a été essayé, et ce qui ne l'a pas été
- **Essayé** : les 4 constructions ; le serveur NAS en HTTP et en HTTPS (autorité locale, nom du certificat, redémarrage, changement de nom) ;
  les contrôles de fumée de `deploy.json` contre le serveur ; l'édition PC lancée avec Electron (sous Xvfb) : fenêtre, `app://`, partition lue par le Web Worker, nom d'édition ;
  la génération du projet Android et son ajustement (idempotent).
- **Non essayé** (pas de démon Docker, pas de SDK Android, pas de Windows/macOS dans l'environnement de travail) : `docker build` de l'image NAS,
  le déploiement réel sur le NAS, la compilation de l'APK, les installateurs Windows / macOS, l'autorisation micro dans l'APK.
  Les workflows GitHub (`.github/workflows/desktop.yml`, `android.yml`) n'ont pas été lancés : un premier essai peut demander un ajustement.
