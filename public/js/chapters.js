(function () {
  'use strict';

  if (!('IntersectionObserver' in window)) return;

  // ── Header = index des chapitres : met en évidence le chapitre lu ─────
  var nav = document.querySelector('[data-nav-chapters]');
  var links = document.querySelectorAll('[data-chapter-link]');
  var sections = [];
  links.forEach(function (link) {
    var section = document.getElementById(link.dataset.chapterLink);
    if (section) sections.push(section);
  });

  function setActive(id) {
    links.forEach(function (link) {
      var on = link.dataset.chapterLink === id;
      if (on) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
      // En mobile, la liste défile : on garde le lien actif visible
      if (on && nav && nav.scrollWidth > nav.clientWidth) {
        var li = link.parentNode;
        var left = li.offsetLeft - (nav.clientWidth - li.offsetWidth) / 2;
        nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
      }
    });
  }

  if (sections.length) {
    // Bande fine au milieu de l'écran : le chapitre qui la traverse est l'actif
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { observer.observe(s); });

    // Au-dessus du premier chapitre (hero), aucun lien actif
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      if (!e.isIntersecting && e.boundingClientRect.top > 0) setActive(null);
    }, { rootMargin: '0px 0px -50% 0px' }).observe(sections[0]);
  }

  // ── Scripts chargés à l'approche de leur chapitre (widgets, Turnstile) ─────
  var lazy = document.querySelectorAll('[data-lazy-script]');
  if (lazy.length) {
    var loader = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        var s = document.createElement('script');
        s.src = entry.target.dataset.lazyScript;
        s.async = true;
        document.body.appendChild(s);
      });
    }, { rootMargin: '600px 0px' });
    lazy.forEach(function (el) { loader.observe(el); });
  }
})();
