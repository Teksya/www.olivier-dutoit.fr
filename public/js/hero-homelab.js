(function () {
  'use strict';

  // ── Hero : scène pixel art du homelab ─────────────────────────────
  // L'affiche est déjà à l'écran (LCP). Après le chargement et la première interaction (ou 8 s), on charge le moteur,
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
    // birthDate : les proportions de Blue suivent son âge ; adoptionDate : bougies du gâteau d'anniversaire
    var o = { preset: 'portfolio', quality: quality, hour: parisHour(), birthDate: root.dataset.catBirth, adoptionDate: root.dataset.catAdoption }, k;
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

  // ── Vraies données (/api/homelab) ──────────────────────────
  // Sans réponse, tout reste "unknown" : voyants éteints, jamais de vert inventé.
  var REFRESH_MS = 60000;
  var SCREEN = {
    up: { text: 'OK', color: '#3ddc84' },
    degraded: { text: 'DEGRADE', color: '#f97316' },
    down: { text: 'PANNE', color: '#ef4444' },
    unknown: { text: 'INCONNU', color: '#86868b' }
  };
  var homelab = null;

  function fetchHomelab(done) {
    if (!window.fetch) return done(null);
    fetch('/api/homelab', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { done(d && d.ok ? d : null); })
      .catch(function () { done(null); });
  }

  // Texte de l'écran du bureau : état global, avec le nombre de services en ligne quand on le connaît
  function screenOf(d) {
    var g = d ? d.global : 'unknown', s = SCREEN[g] || SCREEN.unknown, text = s.text;
    if (d && d.groups && d.groups.length && (g === 'up' || g === 'down')) {
      var up = d.groups.filter(function (x) { return x.status === 'up'; }).length;
      text += ' ' + up + '/' + d.groups.length;
    }
    return { text: text, color: s.color };
  }

  function applyHomelab(scene, d) {
    scene.setStatus(d ? d.devices : {});
    var sc = screenOf(d);
    scene.setScreenText(sc.text, sc.color);
    if (d && d.weather !== null && d.weather !== undefined) scene.setWeather(d.weather);
  }

  // ── Zones interactives : un bouton par appareil connu et un pour Blue ──────
  // Boutons transparents posés sur la scène (accessibles au clavier), infobulle au survol ou au focus,
  // panneau de détail au clic. Les positions viennent de scene.getHotspots() (pixels du canvas).
  var STATUS_FR = { up: 'en ligne', degraded: 'dégradé', down: 'hors ligne', unknown: 'état inconnu' };

  // ── Accessibilité : le canvas devient l'image décrite (role img), l'état du homelab reste lisible en texte ──
  var ACTIVITY_FR = {
    napRack: 'fait la sieste sur la baie', napSofa: 'dort sur le canapé', napTree: 'dort en haut de l\'arbre à chat',
    napSun: 'fait la sieste au soleil', eat: 'mange', drink: 'boit', window: 'regarde par la fenêtre',
    groom: 'fait sa toilette', roll: 'se roule par terre', ball: 'joue à la balle', scratch: 'fait ses griffes',
    zoomies: 'court dans tous les sens', box: 'joue dans son carton', sit: 'est assise sur le tapis',
    incident: 'fixe un appareil en panne', celebrate: 'fait la fête', laser: 'poursuit le point laser'
  };
  var SUMMARY = {
    up: 'Tous les services suivis sont en ligne.',
    degraded: 'Au moins un service répond lentement.',
    down: 'Au moins un service est hors ligne.',
    unknown: 'État du homelab indisponible pour le moment.'
  };

  function setupDescription(scene) {
    var poster = root.querySelector('.hero__poster');
    var summary = root.querySelector('[data-hero-status-summary]');
    var list = root.querySelector('[data-hero-status-list]');
    var last = '';

    function homelabText() {
      var g = homelab ? homelab.global : 'unknown';
      if (homelab && homelab.groups && homelab.groups.length) {
        var up = homelab.groups.filter(function (x) { return x.status === 'up'; }).length;
        return 'Homelab : ' + up + ' service' + (up > 1 ? 's' : '') + ' sur ' + homelab.groups.length + ' en ligne.';
      }
      return SUMMARY[g] || SUMMARY.unknown;
    }
    function label() {
      var act = ACTIVITY_FR[scene.activity()] || 'vit sa vie';
      return 'Scène animée en pixel art, un bureau avec une baie serveur : ' + root.dataset.catName + ', la chatonne, ' + act + '. ' + homelabText();
    }
    function refreshLabel() {
      var l = label();
      if (l !== last) { canvas.setAttribute('aria-label', l); last = l; }
    }
    // Liste des services : mêmes textes que le rendu serveur
    function sync() {
      var g = homelab ? homelab.global : 'unknown';
      summary.textContent = (SUMMARY[g] || SUMMARY.unknown) + (homelab && g !== 'unknown' && homelab.time ? ' Relevé à ' + homelab.time.hhmm + ' (heure de Paris).' : '');
      list.innerHTML = '';
      ((homelab && homelab.groups) || []).forEach(function (x) {
        var li = document.createElement('li');
        li.textContent = x.name + ' : ' + STATUS_FR[x.status] + (x.latency !== null && x.status !== 'down' ? ', ' + x.latency + ' ms' : '');
        list.appendChild(li);
      });
      refreshLabel();
    }

    // Le canvas prend le relais de l'affiche : une seule image décrite pour les lecteurs d'écran
    canvas.removeAttribute('aria-hidden');
    canvas.setAttribute('role', 'img');
    poster.setAttribute('aria-hidden', 'true');
    sync();
    setInterval(function () { if (!document.hidden) refreshLabel(); }, 2000);   // l'activité de Blue change
    return { sync: sync };
  }
  var HOTSPOT_MS = 250;

  function catAge() {
    var b = new Date(root.dataset.catBirth + 'T00:00:00'), now = new Date();
    if (isNaN(b)) return '';
    var m = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth() - (now.getDate() < b.getDate() ? 1 : 0);
    if (m < 1) return 'moins d\'un mois';
    if (m < 12) return m + ' mois';
    var y = Math.floor(m / 12), r = m % 12;
    return y + (y > 1 ? ' ans' : ' an') + (r ? ' et ' + r + ' mois' : '');
  }

  // Appareils présents dans /api/homelab : noms publics, pire état, latence max
  function devicesOf(d) {
    var out = {};
    ((d && d.groups) || []).forEach(function (g) {
      var e = out[g.device] || (out[g.device] = { names: [], groups: [], latency: null });
      e.names.push(g.name);
      e.groups.push(g);
      if (g.latency !== null && (e.latency === null || g.latency > e.latency)) e.latency = g.latency;
      e.status = d.devices[g.device] || 'unknown';
    });
    return out;
  }

  function deviceLabel(e) {
    return e.names.join(', ') + ' · ' + STATUS_FR[e.status] + (e.latency !== null && e.status !== 'down' ? ' · ' + e.latency + ' ms' : '');
  }

  function setupHotspots(scene) {
    var stage = root.querySelector('[data-hero-stage]');
    var layer = root.querySelector('[data-hero-hotspots]');
    var tip = root.querySelector('[data-hero-tip]');
    var panel = root.querySelector('[data-hero-panel]');
    var panelTitle = root.querySelector('[data-hero-panel-title]');
    var panelList = root.querySelector('[data-hero-panel-list]');
    var panelTime = root.querySelector('[data-hero-panel-time]');
    var buttons = {}, catBtn = null, tipFor = null, pinned = false, opener = null;

    function button(key, onClick) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hero__hotspot';
      b.addEventListener('mouseenter', function () { showTip(b); });
      b.addEventListener('mouseleave', function () { if (!pinned) hideTip(); });
      b.addEventListener('focus', function () { showTip(b); });
      b.addEventListener('blur', function () { pinned = false; hideTip(); });
      b.addEventListener('click', onClick);
      layer.appendChild(b);
      return b;
    }

    function showTip(b) {
      tipFor = b;
      tip.textContent = b.getAttribute('aria-label');
      tip.hidden = false;
      placeTip();
    }
    function hideTip() { tipFor = null; tip.hidden = true; }
    function placeTip() {
      if (!tipFor) return;
      var r = root.getBoundingClientRect(), br = tipFor.getBoundingClientRect();
      var x = br.left - r.left + br.width / 2 - tip.offsetWidth / 2, y = br.top - r.top - tip.offsetHeight - 8;
      if (y < 8) y = br.bottom - r.top + 8;
      tip.style.left = Math.max(8, Math.min(r.width - tip.offsetWidth - 8, x)) + 'px';
      tip.style.top = y + 'px';
    }

    function openPanel(e, b) {
      opener = b;
      panelTitle.textContent = e.names.join(', ');
      panelList.innerHTML = '';
      e.groups.forEach(function (g) {
        var li = document.createElement('li');
        li.textContent = g.name + ' : ' + STATUS_FR[g.status] + (g.latency !== null && g.status !== 'down' ? ', ' + g.latency + ' ms' : '');
        panelList.appendChild(li);
      });
      panelTime.textContent = homelab && homelab.time ? 'Relevé à ' + homelab.time.hhmm + ' (heure de Paris)' : '';
      panel.hidden = false;
      panelTitle.focus();
    }
    function closePanel() {
      if (panel.hidden) return;
      panel.hidden = true;
      if (opener) opener.focus();
    }
    root.querySelector('[data-hero-panel-close]').addEventListener('click', closePanel);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { closePanel(); pinned = false; hideTip(); } });
    document.addEventListener('click', function (ev) { if (!panel.hidden && !panel.contains(ev.target) && !layer.contains(ev.target)) closePanel(); });

    // Blue : infobulle avec son âge ; au doigt, un tap l'épingle
    catBtn = button('cat', function () { pinned = !pinned; if (pinned) showTip(catBtn); else hideTip(); });
    function catLabel() { return root.dataset.catName + ' · ' + catAge(); }
    catBtn.setAttribute('aria-label', catLabel());

    function sync() {
      var devs = devicesOf(homelab);
      Object.keys(buttons).forEach(function (k) { if (!devs[k]) { layer.removeChild(buttons[k]); delete buttons[k]; } });
      Object.keys(devs).forEach(function (k) {
        if (!buttons[k]) buttons[k] = button(k, function () { openPanel(devicesOf(homelab)[k], buttons[k]); });
        buttons[k].setAttribute('aria-label', deviceLabel(devs[k]));
      });
      catBtn.setAttribute('aria-label', catLabel());
      if (tipFor) showTip(tipFor);
    }

    // Pixels du canvas -> CSS : le canvas est affiché en object-fit: cover dans la scène.
    // Façade d'appareil : le bouton est découpé à la forme du parallélogramme (clic et focus exacts).
    // Blue : rectangle d'au moins 24 px de côté.
    function place(b, r, sc, ox, oy, sw, sh) {
      if (!r) { b.hidden = true; return; }
      var poly = !!r.points, w = poly ? r.w * sc : Math.max(24, r.w * sc), h = poly ? r.h * sc : Math.max(24, r.h * sc);
      var x = ox + r.x * sc + (r.w * sc - w) / 2, y = oy + r.y * sc + (r.h * sc - h) / 2;
      b.hidden = x + w < 0 || y + h < 0 || x > sw || y > sh;
      b.style.left = x + 'px';
      b.style.top = y + 'px';
      b.style.width = w + 'px';
      b.style.height = h + 'px';
      if (poly) b.style.clipPath = 'polygon(' + r.points.map(function (p) { return ((ox + p[0] * sc) - x).toFixed(1) + 'px ' + ((oy + p[1] * sc) - y).toFixed(1) + 'px'; }).join(', ') + ')';
    }
    function layout() {
      var hs = scene.getHotspots(), sw = stage.clientWidth, sh = stage.clientHeight;
      var sc = Math.max(sw / hs.width, sh / hs.height), ox = (sw - hs.width * sc) / 2, oy = (sh - hs.height * sc) / 2;
      Object.keys(buttons).forEach(function (k) { place(buttons[k], hs.devices[k], sc, ox, oy, sw, sh); });
      place(catBtn, hs.cat, sc, ox, oy, sw, sh);
      placeTip();
    }

    sync();
    layout();
    setInterval(function () { if (!document.hidden && !scene.isPaused()) layout(); }, HOTSPOT_MS);   // Blue bouge
    window.addEventListener('resize', layout);
    return { sync: sync };
  }

  function run(quality) {
    var sc = screenOf(homelab);
    var stage = root.querySelector('[data-hero-stage]');
    var extra = { autoplay: false, inputTarget: stage, status: homelab ? homelab.devices : {}, screenText: sc.text, screenColor: sc.color };
    if (homelab && homelab.weather !== null && homelab.weather !== undefined) extra.weather = homelab.weather;
    if (homelab && homelab.theme) extra.theme = homelab.theme;
    var scene = window.CatScene.create(canvas, options(quality, extra));
    scene.frame(0);
    var spots = setupHotspots(scene);
    var a11y = setupDescription(scene);

    setInterval(function () {
      if (document.hidden) return;
      fetchHomelab(function (d) { homelab = d; applyHomelab(scene, d); spots.sync(); a11y.sync(); });
    }, REFRESH_MS);
    root.classList.add('is-live');                     // le canvas apparaît en fondu au-dessus de l'affiche
    root.setAttribute('data-quality', quality);

    // Petit indice pour le laser, selon le type d'écran
    var hint = root.querySelector('[data-hero-hint]');
    hint.textContent = window.matchMedia('(hover: none)').matches ? 'Appui long : laser' : 'Double-clic : laser';
    hint.hidden = false;

    // Code Konami (effects.js) : Blue fait la fête au lieu des confettis
    document.addEventListener('konami', function (ev) {
      if (!scene.isPaused() && scene.play('celebrate')) ev.preventDefault();
    });

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
      var pending = 2, quality = null;
      function ready() { if (--pending === 0 && quality) run(quality); }
      fetchHomelab(function (d) { homelab = d; ready(); });     // en parallèle du moteur
      loadEngine(function () {
        if (!window.CatScene) return;
        pickQuality(function (q) { quality = q; ready(); });
      });
    });
  }

  // Le moteur coûte du calcul (chargement, mesure, premier rendu) : on attend que le visiteur interagisse
  // (souris, doigt, défilement, clavier) ou 8 s sans interaction, pour ne pas ralentir l'arrivée sur la page.
  var ENGAGE_EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'scroll', 'wheel', 'keydown'];
  var ENGAGE_FALLBACK_MS = 8000;
  function whenEngaged(fn) {
    var done = false, timer = 0, opts = { passive: true, capture: true };
    function go() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      ENGAGE_EVENTS.forEach(function (e) { window.removeEventListener(e, go, opts); });
      fn();
    }
    ENGAGE_EVENTS.forEach(function (e) { window.addEventListener(e, go, opts); });
    timer = setTimeout(go, ENGAGE_FALLBACK_MS);
  }

  function start() { whenEngaged(boot); }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
