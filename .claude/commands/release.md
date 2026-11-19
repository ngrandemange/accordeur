---
description: Prépare une nouvelle version (numéro, notes de version, tests) sans pousser
argument-hint: <x.y.z>
---

Prépare la version **$ARGUMENTS** d'Accordeur :

1. Vérifie que `$ARGUMENTS` est de la forme `x.y.z` et supérieure à la version de `version.js`.
2. Lance `node tools/set-version.js $ARGUMENTS`.
3. Ajoute en tête de `releases.json` une entrée `{ "version", "date" (aujourd'hui, AAAA-MM-JJ), "fr": [...], "en": [...] }` résumant `git log` depuis la version précédente, en français et en anglais, dans le ton des entrées existantes.
4. Lance `npm test` et, si `omr.js` ou `omr-templates.js` ont changé, `node tests/omr-check.js`.
5. Montre le `git diff --stat` et propose un message de commit `Sujet court (v$ARGUMENTS)`.

Ne committe pas, ne pousse pas et ne crée pas de tag sans que l'utilisateur le demande.
