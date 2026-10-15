(function () {
  'use strict';

  // ── Chapitre « Comment ce site est servi » : trajet d'une requête ─────
  // Un chemin SVG relie les étapes et se trace au fil du défilement (stroke-dashoffset) ;
  // un paquet lumineux le parcourt (transform) ; chaque étape franchie passe au vert,
  // la dernière atteinte est l'étape active (bordure animée, halo).
  // Mouvement réduit : rien ne bouge, toutes les étapes restent affichées validées (rendu sans JS).

  var root = document.querySelector('[data-flow]');
  if (!root) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var trace = root.querySelector('[data-flow-trace]');
  var track = root.querySelector('[data-flow-track]');
  var svg = root.querySelector('[data-flow-path]');
  var packet = root.querySelector('[data-flow-packet]');
  var steps = Array.prototype.slice.call(root.querySelectorAll('[data-flow-step]'));
  var nodes = steps.map(function (s) { return s.querySelector('[data-flow-node]'); });
  if (!trace || !trace.getTotalLength || !nodes.length) return;

  var START = 0.6;          // le paquet suit la ligne située à 60 % de la hauteur de l'écran
  var WAVE = 12;            // amplitude de la courbe entre deux étapes (px)
  var length = 0, nodeY = [], frame = 0, visible = false;

  // Chemin passant par le centre de chaque nœud, avec une légère ondulation entre deux étapes
  function geometry() {
    var r = root.getBoundingClientRect();
    var pts = nodes.map(function (n) {
      var b = n.getBoundingClientRect();
      return [b.left - r.left + b.width / 2, b.top - r.top + b.height / 2];
    });
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var x = pts[i][0], y0 = pts[i - 1][1], dy = pts[i][1] - y0;
      d += ' C' + (x + WAVE) + ' ' + (y0 + dy * 0.35) + ' ' + (x - WAVE) + ' ' + (y0 + dy * 0.65) + ' ' + x + ' ' + pts[i][1];
    }
    svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
    track.setAttribute('d', d);
    trace.setAttribute('d', d);
    length = trace.getTotalLength();
    trace.style.strokeDasharray = length;
    nodeY = pts.map(function (p) { return p[1]; });
    update();
  }

  function progress() {
    var top = root.getBoundingClientRect().top, span = nodeY[nodeY.length - 1] - nodeY[0];
    var p = (window.innerHeight * START - (top + nodeY[0])) / (span || 1);
    return Math.max(0, Math.min(1, p));
  }

  function update() {
    frame = 0;
    var p = progress(), pt = trace.getPointAtLength(length * p), active = -1;
    trace.style.strokeDashoffset = length * (1 - p);
    packet.style.transform = 'translate(' + (pt.x - 6) + 'px,' + (pt.y - 6) + 'px)';
    steps.forEach(function (s, i) {
      var done = pt.y >= nodeY[i] - 1;
      s.classList.toggle('is-done', done);
      if (done) active = i;
    });
    steps.forEach(function (s, i) { s.classList.toggle('is-active', i === active); });
  }

  function schedule() { if (visible && !frame) frame = requestAnimationFrame(update); }

  root.classList.add('is-live');
  geometry();

  // Hors écran : plus de calcul au défilement, animations CSS en pause
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    root.classList.toggle('is-visible', visible);
    if (visible) schedule();
  }).observe(root);

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', function () { requestAnimationFrame(geometry); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(geometry);   // hauteurs définitives
})();
