(function () {
  'use strict';

  // ── Index des chapitres : met en évidence le chapitre lu ─────
  var links = document.querySelectorAll('[data-chapter-link]');
  if (!links.length || !('IntersectionObserver' in window)) return;

  function setActive(id) {
    links.forEach(function (link) {
      if (link.dataset.chapterLink === id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  // Bande fine au milieu de l'écran : le chapitre qui la traverse est l'actif
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) setActive(entry.target.id);
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  links.forEach(function (link) {
    var section = document.getElementById(link.dataset.chapterLink);
    if (section) observer.observe(section);
  });

  // Au-dessus du premier chapitre (hero), aucun lien actif
  var first = document.getElementById(links[0].dataset.chapterLink);
  if (first) {
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      if (!e.isIntersecting && e.boundingClientRect.top > 0) setActive(null);
    }, { rootMargin: '0px 0px -50% 0px' }).observe(first);
  }
})();
