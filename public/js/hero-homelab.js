(function () {
  'use strict';

  // ── Hero : scène pixel art du homelab ─────────────────────────────
  // L'affiche est déjà à l'écran (LCP). Après le chargement de la page, on charge le moteur,
  // on mesure ce que la machine tient, puis le canvas prend le relais par-dessus l'affiche.
  // Trop lent, mouvement réduit ou canvas absent : l'affiche reste, rien ne tourne.

  var root = document.querySelector('[data-hero]');
  if (!root) return;
  var canvas = root.querySelector('[data-hero-canvas]');
  var pauseBtn = root.querySelector('[data-hero-pause]');
  var pauseLabel = root.querySelector('[data-hero-pause-label]');

  if (!canvas || !canvas.getContext) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var STORE_KEY = 'hero-paused';
  // Budgets en ms (moyenne par image ; le moteur est plafonné à 30 fps et recalcule la chatonne à 15 fps)
  var BUDGET_HD = 16;          // au-delà, qualité standard
  var BUDGET_STANDARD = 22;    // au-delà, on garde l'affiche
  var MAX_FRAME = 45;          // une image plus lente que ça gênerait le défilement de la page

  var small = window.matchMedia('(max-width: 639px)').matches;
  var weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

  // Mobile : recadrage sur la baie et l'espace de jeu, sans les activités qui se passent hors champ
  var MOBILE_CROP = { width: 360, height: 560, OX: 60, OY: 300 };   // même ratio que le hero mobile, baie et arbre à chat au-dessus du texte
  var MOBILE_ACTIVITIES = { napSofa: 0, napSun: 0, window: 0, box: 0, roll: 0 };

  function options(quality, extra) {
    var o = { preset: 'portfolio', quality: quality, hour: parisHour() }, k;
    if (small) {
      // Les cadrages passés en option ne sont pas réduits par le moteur : on applique nous-mêmes la qualité
      var f = quality === 'standard' ? 0.5 : 1;
      for (k in MOBILE_CROP) o[k] = MOBILE_CROP[k] * f;
      o.activities = MOBILE_ACTIVITIES;
    }
    for (k in extra) o[k] = extra[k];
    return o;
  }

  // Le homelab est à Saint-Étienne : jour et nuit suivent l'heure de Paris, quel que soit le visiteur
  function parisHour() {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      var h = 0, m = 0;
      parts.forEach(function (p) { if (p.type === 'hour') h = +p.value; if (p.type === 'minute') m = +p.value; });
      return h + m / 60;
    } catch (e) {
      var d = new Date();
      return d.getHours() + d.getMinutes() / 60;
    }
  }

  function readPaused() { try { return window.localStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; } }
  function savePaused(v) { try { window.localStorage.setItem(STORE_KEY, v ? '1' : '0'); } catch (e) { /* stockage indisponible */ } }

  function later(fn) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2000 });
    else setTimeout(fn, 200);
  }

  function loadEngine(done) {
    if (window.CatScene) return done();
    var s = document.createElement('script');
    s.src = root.dataset.engine;
    s.async = true;
    s.onload = done;
    document.head.appendChild(s);
  }

  // Temps de rendu mesuré sur une scène jetable, une image par tâche pour ne pas bloquer la page.
  // Renvoie la moyenne et le pire cas (une image sur deux recalcule la chatonne).
  function measure(quality, done) {
    var scene = window.CatScene.create(document.createElement('canvas'), options(quality, { autoplay: false, interactive: false }));
    var total = 0, worst = 0, n = 0, i = 0;
    (function step() {
      var t0 = performance.now();
      scene.frame(3000 + i * 33);
      var dt = performance.now() - t0;
      if (i >= 2) { total += dt; worst = Math.max(worst, dt); n++; }   // les deux premières images chauffent le moteur
      i++;
      if (i < 14) return setTimeout(step, 0);
      done(total / n, worst);
    })();
  }

  function fits(budget, mean, worst) { return mean <= budget && worst <= MAX_FRAME; }

  function pickQuality(done) {
    var first = small || weak ? 'standard' : 'hd';
    measure(first, function (mean, worst) {
      if (first === 'hd' && !fits(BUDGET_HD, mean, worst)) {
        measure('standard', function (m2, w2) { done(fits(BUDGET_STANDARD, m2, w2) ? 'standard' : null); });
      } else {
        done(fits(BUDGET_STANDARD, mean, worst) ? first : null);
      }
    });
  }

  function setPausedUi(paused) {
    pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    pauseBtn.setAttribute('aria-label', paused ? 'Reprendre l\'animation' : 'Mettre l\'animation en pause');
    pauseLabel.textContent = paused ? 'Lecture' : 'Pause';
  }

  function run(quality) {
    var scene = window.CatScene.create(canvas, options(quality, { autoplay: false, inputTarget: canvas }));
    scene.frame(0);
    root.classList.add('is-live');                     // le canvas apparaît en fondu au-dessus de l'affiche
    root.setAttribute('data-quality', quality);

    var paused = readPaused();
    if (paused) scene.pause();
    scene.start();

    setPausedUi(paused);
    pauseBtn.hidden = false;
    pauseBtn.addEventListener('click', function () {
      paused = !scene.isPaused();
      if (paused) scene.pause(); else scene.resume();
      setPausedUi(paused);
      savePaused(paused);
    });
  }

  function boot() {
    later(function () {
      loadEngine(function () {
        if (!window.CatScene) return;
        pickQuality(function (quality) { if (quality) run(quality); });
      });
    });
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
