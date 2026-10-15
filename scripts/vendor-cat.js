#!/usr/bin/env node
/*
 * Copie le moteur de la scène pixel art (dépôt cat-abw-iso3d-webanim) et ses affiches
 * dans vendor/cat-scene/, servi sous /vendor/cat-scene/.
 *
 *   npm run vendor:cat                      -> moteur cloné à côté du portfolio (../cat-abw-iso3d-webanim)
 *   CAT_ENGINE_DIR=/chemin npm run vendor:cat
 *
 * Les affiches se régénèrent dans le dépôt du moteur avec `npm run export:portfolio` (hero)
 * et `npm run export:network` (carte du trajet, chapitre « Comment ce site est servi »).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const engine = path.resolve(process.env.CAT_ENGINE_DIR || path.join(__dirname, '..', '..', 'cat-abw-iso3d-webanim'));
const dest = path.join(__dirname, '..', 'vendor', 'cat-scene');
// Le moteur, les affiches du préréglage portfolio (jour, nuit, et par thème) et celles de la carte du trajet
const posters = fs.existsSync(path.join(engine, 'exports'))
  ? fs.readdirSync(path.join(engine, 'exports')).filter((f) => /^(portfolio|network)(-[a-z]+)*.png$/.test(f)).sort()
  : [];
const files = [['src/cat-scene.js', 'cat-scene.js']].concat(posters.map((f) => ['exports/' + f, f]));
if (!posters.length) {
  console.error('Aucune affiche dans ' + path.join(engine, 'exports') + ' (lancer `npm run export:portfolio` et `npm run export:network` dans le moteur)');
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });
files.forEach(([from, to]) => {
  const src = path.join(engine, from);
  if (!fs.existsSync(src)) {
    console.error('Introuvable : ' + src);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(dest, to));
  console.log(from + ' -> vendor/cat-scene/' + to);
});
