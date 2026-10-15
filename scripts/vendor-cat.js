#!/usr/bin/env node
/*
 * Copie le moteur de la scène pixel art (dépôt cat-abw-iso3d-webanim) et ses affiches
 * dans vendor/cat-scene/, servi sous /vendor/cat-scene/.
 *
 *   npm run vendor:cat                      -> moteur cloné à côté du portfolio (../cat-abw-iso3d-webanim)
 *   CAT_ENGINE_DIR=/chemin npm run vendor:cat
 *
 * Les affiches se régénèrent dans le dépôt du moteur avec `npm run export:portfolio`.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const engine = path.resolve(process.env.CAT_ENGINE_DIR || path.join(__dirname, '..', '..', 'cat-abw-iso3d-webanim'));
const dest = path.join(__dirname, '..', 'vendor', 'cat-scene');
const files = [
  ['src/cat-scene.js', 'cat-scene.js'],
  ['exports/portfolio-jour.png', 'portfolio-jour.png'],
  ['exports/portfolio-nuit.png', 'portfolio-nuit.png']
];

fs.mkdirSync(dest, { recursive: true });
files.forEach(([from, to]) => {
  const src = path.join(engine, from);
  if (!fs.existsSync(src)) {
    console.error('Introuvable : ' + src + (from.startsWith('exports/') ? ' (lancer `npm run export:portfolio` dans le moteur)' : ''));
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(dest, to));
  console.log(from + ' -> vendor/cat-scene/' + to);
});
