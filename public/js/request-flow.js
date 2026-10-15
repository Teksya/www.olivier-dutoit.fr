(function () {
  'use strict';

  // ── Chapitre « Comment ce site est servi » : carte pixel art du trajet d'une requête ─────
  // La carte (moteur cat-abw-iso3d-webanim, préréglage network) reste collée pendant que les étapes défilent.
  // Quand le nœud d'une étape franchit la ligne de lecture, le paquet atteint le repère correspondant du moteur
  // (data-stop, scene.stops) et l'étape passe au vert ; entre deux étapes, il avance au prorata du défilement.
  // Mouvement réduit : rien ne bouge, affiche de la carte entière et toutes les étapes validées (rendu sans JS).

  var root = document.querySelector('[data-flow]');
  if (!root) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var steps = Array.prototype.slice.call(root.querySelectorAll('[data-flow-step]'));
  var nodes = steps.map(function (s) { return s.querySelector('[data-flow-node]'); });
  var map = root.querySelector('[data-flow-map]');
  var frameEl = root.querySelector('[data-flow-frame]');
  var canvas = root.querySelector('[data-flow-canvas]');
  var pauseBtn = root.querySelector('[data-flow-pause]');
  if (!nodes.length || !map || !canvas) return;

  var wide = window.matchMedia('(min-width: 64rem)');
  var weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  var STORE_KEY = 'hero-paused';      // même préférence que le hero : une pause vaut pour les deux scènes

  // Repères de chaque étape : répartis régulièrement en attendant le moteur, puis ceux de scene.stops
  var stops = steps.map(function (s, i) { return i / (steps.length - 1); });
  var scene = null, status = {}, progress = 0, visible = false, raf = 0, size = '';

  // Ligne de lecture : en mobile la carte occupe le haut de l'écran, la ligne passe sous elle
  function readLine() {
    var vh = window.innerHeight;
    if (wide.matches) return vh * 0.55;
    var b = map.getBoundingClientRect().bottom;
    return Math.max(vh * 0.55, Math.min(vh * 0.85, b + (vh - b) * 0.3));
  }

  function update() {
    raf = 0;
    var line = readLine(), reached = -1;
    var ys = nodes.map(function (n) { var r = n.getBoundingClientRect(); return r.top + r.height / 2; });
    ys.forEach(function (y, i) { if (y <= line) reached = i; });
    if (reached < 0) progress = 0;
    else if (reached === ys.length - 1) progress = stops[reached];
    else {
      var f = (line - ys[reached]) / Math.max(1, ys[reached + 1] - ys[reached]);
      progress = stops[reached] + (stops[reached + 1] - stops[reached]) * Math.max(0, Math.min(1, f));
    }
    steps.forEach(function (s, i) {
      s.classList.toggle('is-done', i <= reached);
      s.classList.toggle('is-active', i === reached);
    });
    if (scene) scene.setProgress(progress);
  }

  function schedule() { if (visible && !raf) raf = requestAnimationFrame(update); }

  // ── Moteur : partagé avec le hero (même fichier), chargé une seule fois ──
  function loadEngine(done) {
    if (window.CatScene) return done();
    var src = root.dataset.engine, s = document.querySelector('script[src="' + src + '"]');
    if (!s) {
      s = document.createElement('script');
      s.src = src;
      s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener('load', done);
  }

  // Qualité standard (zoom 4) : Blue en HD coûte trop cher à recalculer pendant le défilement.
  // Sur une carte large, un pixel du canvas vaut 2 pixels CSS (même cadrage qu'en HD, gros pixels nets).
  var BUDGET_MS = weak ? 16 : 22;      // au-delà, on garde l'affiche
  function create() {
    var w = Math.round(frameEl.clientWidth), h = Math.round(frameEl.clientHeight);
    if (!w || !h || !window.CatScene) return;
    size = w + 'x' + h;
    if (scene) scene.pause();
    var scale = w >= 440 ? 2 : 1;
    var next = window.CatScene.create(canvas, {
      preset: 'network', quality: 'standard', width: Math.round(w / scale), height: Math.round(h / scale),
      birthDate: root.dataset.catBirth, status: status, progress: progress, autoplay: false
    });
    // Temps de rendu mesuré sur quelques images (la chatonne est recalculée une image sur deux)
    var total = 0;
    for (var i = 0; i < 8; i++) { var t0 = performance.now(); next.frame(i * 34); if (i >= 2) total += performance.now() - t0; }
    if (total / 6 > BUDGET_MS) { scene = null; root.classList.remove('is-map-live'); return; }
    scene = next;
    var byId = {};
    scene.stops.forEach(function (s) { byId[s.id] = s.progress; });
    stops = steps.map(function (s, k) { var v = byId[s.dataset.stop]; return v === undefined ? stops[k] : v; });
    update();
    scene.start();
    if (readPaused()) scene.pause();
    root.classList.add('is-map-live');
  }

  // État réel de la baie : voyants éteints tant qu'il n'y a pas de donnée, jamais de vert inventé
  function fetchStatus() {
    if (!window.fetch) return;
    fetch('/api/homelab', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { status = d && d.ok && d.devices ? d.devices : {}; if (scene) scene.setStatus(status); })
      .catch(function () { /* reste inconnu */ });
  }

  function readPaused() { try { return window.localStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; } }
  function savePaused(v) { try { window.localStorage.setItem(STORE_KEY, v ? '1' : '0'); } catch (e) { /* stockage indisponible */ } }
  function setPausedUi(paused) {
    pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    pauseBtn.setAttribute('aria-label', paused ? 'Reprendre l\'animation de la carte' : 'Mettre la carte en pause');
    root.classList.toggle('is-paused', paused);
  }
  pauseBtn.addEventListener('click', function () {
    var paused = !(scene && scene.isPaused());
    if (scene) { if (paused) scene.pause(); else scene.resume(); }
    setPausedUi(paused);
    savePaused(paused);
  });

  root.classList.add('is-live');
  update();

  // Hors écran : plus de calcul au défilement, animations CSS en pause (le moteur se met aussi en veille)
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    root.classList.toggle('is-visible', visible);
    if (visible) schedule();
  }).observe(root);

  window.addEventListener('scroll', schedule, { passive: true });
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    schedule();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (scene && size !== Math.round(frameEl.clientWidth) + 'x' + Math.round(frameEl.clientHeight)) create();
    }, 250);
  });

  fetchStatus();
  loadEngine(function () {
    create();
    if (!scene) return;
    setPausedUi(readPaused());
    pauseBtn.hidden = false;
  });
})();
