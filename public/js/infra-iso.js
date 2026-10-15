(function () {
  'use strict';

  // ── Chapitre Infrastructure : scène isométrique des services du homelab ─────
  // Données : /api/infra (nom, groupe, up, latence). La liste du partial reste la
  // version accessible ; la scène construite ici est décorative (aria-hidden).

  var root = document.querySelector('[data-infra]');
  if (!root) return;

  var scene = root.querySelector('[data-infra-scene]');
  var list = root.querySelector('[data-infra-list]');
  var summary = root.querySelector('[data-infra-summary]');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap;
  var canAnimate = !reduceMotion && !!gsap && !!window.ScrollTrigger;
  if (canAnimate) gsap.registerPlugin(window.ScrollTrigger);

  // Mêmes valeurs que les variables --iso-* de src/css/infra-iso.css
  var SIZE = 84, HEIGHT = 56, GAP = 26, PAD = 30, THICK = 16;
  var COS45 = Math.SQRT1_2, SIN60 = Math.sqrt(3) / 2;
  var REFRESH_MS = 60000;

  var services = [];
  try { services = JSON.parse(root.dataset.initial || '[]'); } catch (e) { services = []; }

  var signature = '';
  var refs = [];          // un objet { box, fill, ms, target } par service, dans l'ordre
  var dims = null;
  var entered = false;
  var entranceArmed = false;
  var onScreen = false;
  var heartbeat = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
  }
  function latScale(ms) { return ms == null ? 0 : Math.max(0.06, Math.min(ms / 200, 1)); }
  function msText(ms) { return ms == null ? 'n.d.' : ms + ' ms'; }
  function signatureOf(items) {
    return items.map(function (s) { return s.group + '/' + s.name; }).join('|');
  }

  // ── Scène 3D ───────────────────────────────────────────────
  function buildScene() {
    var n = services.length;
    var cols = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(n * 1.6))));
    var rows = Math.ceil(n / cols);
    var w = cols * SIZE + (cols - 1) * GAP + 2 * PAD;
    var d = rows * SIZE + (rows - 1) * GAP + 2 * PAD;

    var html = '<div class="iso-fit"><div class="iso-world" style="width:' + w + 'px;height:' + d + 'px">' +
      '<div class="iso-plate" data-iso-plate><span class="iso-plate__label">' + esc(root.dataset.name || '') + '</span></div>' +
      '<div class="iso-plate__side iso-plate__side--south" data-iso-plate></div>' +
      '<div class="iso-plate__side iso-plate__side--west" data-iso-plate></div>';

    services.forEach(function (s, i) {
      var x = PAD + (i % cols) * (SIZE + GAP);
      var y = PAD + Math.floor(i / cols) * (SIZE + GAP);
      html += '<div class="iso-slot" style="left:' + x + 'px;top:' + y + 'px;transform:translateZ(1px)">' +
        '<div class="iso-box" data-up="' + (s.up ? 'true' : 'false') + '">' +
          '<div class="iso-face iso-face--west"></div>' +
          '<div class="iso-face iso-face--south">' +
            '<span class="iso-name">' + esc(s.name) + '</span>' +
            '<span class="iso-meta"><span class="infra-bar"><span class="infra-bar__fill"></span></span><span class="iso-ms"></span></span>' +
          '</div>' +
          '<div class="iso-face iso-face--top"><span class="iso-ring"></span><span class="iso-led"></span></div>' +
        '</div>' +
      '</div>';
    });

    scene.innerHTML = html + '</div></div>';
    dims = { w: w, d: d };
    refs = Array.prototype.map.call(scene.querySelectorAll('.iso-box'), function (box) {
      return { box: box, fill: box.querySelector('.infra-bar__fill'), ms: box.querySelector('.iso-ms'), target: 0 };
    });
    root.classList.add('is-3d');
    layout();
  }

  // Centre la scène et l'adapte à la largeur disponible
  function layout() {
    if (!dims || !scene.firstChild) return;
    var span = (dims.w + dims.d) * COS45;
    var rise = HEIGHT * SIN60, drop = THICK * SIN60;
    var height = span / 2 + rise + drop;
    var avail = scene.clientWidth - 48;
    var scale = avail > 0 ? Math.min(1.2, avail / span) : 1;   // un peu agrandie si peu de services

    scene.style.height = Math.round(height * scale + 72) + 'px';
    var fit = scene.firstChild, world = fit.firstChild;
    fit.style.transform = 'scale(' + scale + ')';
    world.style.left = (-dims.w / 2) + 'px';
    world.style.top = (-dims.d / 2) + 'px';
    world.style.transform = 'translateY(' + ((rise - drop) / 2) + 'px) rotateX(60deg) rotateZ(-45deg)';
  }

  function applyStates() {
    services.forEach(function (s, i) {
      var r = refs[i];
      if (!r) return;
      r.box.setAttribute('data-up', s.up ? 'true' : 'false');
      r.ms.textContent = msText(s.latency);
      r.target = latScale(s.latency);
      // Avant l'apparition, les barres restent à 0 : la transition CSS les remplit ensuite
      if (entered) r.fill.style.setProperty('--lat', r.target);
    });
  }

  function fillBars() {
    refs.forEach(function (r) { r.fill.style.setProperty('--lat', r.target); });
  }

  // ── Animations (GSAP) ──────────────────────────────────────
  function armEntrance() {
    if (!canAnimate) { entered = true; fillBars(); return; }
    if (entranceArmed) return;
    entranceArmed = true;

    var plate = scene.querySelectorAll('[data-iso-plate]');
    gsap.set(plate, { opacity: 0 });
    refs.forEach(function (r) {
      gsap.set(r.box, { z: 140 });
      gsap.set(r.box.querySelectorAll('.iso-face'), { opacity: 0 });
    });

    window.ScrollTrigger.create({
      trigger: scene,
      start: 'top 80%',
      once: true,
      onEnter: function () {
        var tl = gsap.timeline({
          onComplete: function () { entered = true; startHeartbeat(); }
        });
        tl.to(plate, { opacity: 1, duration: 0.5, ease: 'power1.out' });
        refs.forEach(function (r, i) {
          var at = 0.2 + i * 0.09;
          tl.to(r.box, { z: 0, duration: 0.75, ease: 'power3.out' }, at);
          tl.to(r.box.querySelectorAll('.iso-face'), { opacity: 1, duration: 0.35, ease: 'power1.out' }, at);
        });
        tl.call(fillBars, null, 0.35 + refs.length * 0.09);
      }
    });
  }

  // Pulsation périodique : anneau qui s'élargit autour de chaque voyant, en cascade
  function startHeartbeat() {
    if (!canAnimate || heartbeat || !refs.length) return;
    var rings = refs.map(function (r) { return r.box.querySelector('.iso-ring'); });
    var leds = refs.map(function (r) { return r.box.querySelector('.iso-led'); });
    heartbeat = gsap.timeline({ repeat: -1, repeatDelay: 3.5, paused: !onScreen });
    heartbeat.fromTo(rings, { scale: 1, opacity: 0.7 }, { scale: 2.8, opacity: 0, duration: 1.4, ease: 'power2.out', stagger: 0.12, immediateRender: false }, 0);
    heartbeat.fromTo(leds, { scale: 1 }, { scale: 1.25, duration: 0.18, ease: 'power1.out', yoyo: true, repeat: 1, stagger: 0.12, immediateRender: false }, 0);
  }

  function stopHeartbeat() {
    if (!heartbeat) return;
    heartbeat.kill();
    heartbeat = null;
  }

  // ── Liste accessible ───────────────────────────────────────
  function renderList() {
    list.innerHTML = services.map(function (s) {
      return '<li class="infra-item card flex items-center gap-3 px-5 py-4" data-up="' + (s.up ? 'true' : 'false') + '">' +
        '<span class="infra-dot" aria-hidden="true"></span>' +
        '<span class="min-w-0 flex-1">' +
          '<span class="block truncate text-sm font-medium text-strong">' + esc(s.name) + '</span>' +
          '<span class="block truncate text-xs text-muted">' + esc(s.group) + ' · ' + (s.up ? 'en ligne' : 'hors ligne') + '</span>' +
        '</span>' +
        '<span class="flex w-20 flex-none flex-col items-end gap-1.5">' +
          '<span class="font-mono text-xs tabular-nums text-body">' + msText(s.latency) + '</span>' +
          '<span class="infra-bar" aria-hidden="true"><span class="infra-bar__fill" style="--lat: ' + latScale(s.latency) + '"></span></span>' +
        '</span>' +
      '</li>';
    }).join('');
  }

  function renderSummary() {
    var up = services.filter(function (s) { return s.up; }).length;
    var now = new Date();
    var time = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    summary.textContent = up + ' service' + (up > 1 ? 's' : '') + ' sur ' + services.length + ' en ligne · relevé à ' + time;
  }

  // ── Données ────────────────────────────────────────────────
  function render(fresh) {
    var sig = signatureOf(services);
    if (sig !== signature) {
      // Nouvelle liste de services : on reconstruit la scène
      signature = sig;
      stopHeartbeat();
      buildScene();
      applyStates();
      if (entered) { fillBars(); startHeartbeat(); } else { armEntrance(); }
    } else {
      applyStates();
    }
    if (fresh) { renderList(); renderSummary(); }
  }

  function refresh() {
    if (document.hidden) return;
    fetch('/api/infra', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !Array.isArray(d.services) || !d.services.length) return;
        services = d.services;
        render(true);
      })
      .catch(function () {});
  }

  if (services.length) render(false);
  else refresh();   // le rendu serveur n'avait pas de données : on réessaie tout de suite
  setInterval(refresh, REFRESH_MS);

  // Animations en pause hors écran
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (heartbeat) { if (onScreen) heartbeat.play(); else heartbeat.pause(); }
    }).observe(root);
  }

  var resizeFrame = 0;
  window.addEventListener('resize', function () {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(layout);
  });
})();
