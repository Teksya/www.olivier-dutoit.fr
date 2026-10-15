/*!
 * cat-scene : chatonne écaille de tortue en pixel art isométrique (bannière + avatar)
 * Moteur autonome, sans dépendance. Voir README.md.
 *
 *   CatScene.create(canvas, { preset: 'banner' })   // bannière 480x160
 *   CatScene.create(canvas, { preset: 'avatar' })   // avatar 128x128
 */
(function (root) {
  'use strict';

  /* ================= Préréglages (cadrage + scénario) ================= */
  var PRESETS = {
    banner: { width: 960, height: 320, K: 8, OX: 464, OY: 280, scenario: 'banner', vignette: 'banner', stillAt: 3000 },
    avatar: { width: 256, height: 256, K: 24, OX: -472, OY: 520, scenario: 'avatar', vignette: 'avatar', stillAt: 4300 },
    wallpaper: { width: 960, height: 540, K: 8, OX: 464, OY: 360, scenario: 'live', vignette: 'wallpaper', room: 'large', stillAt: 3000, fps: 30 },
    /* Bandeau 21:9 du grand appartement (baie, bureau, tapis), sans la coupure de la baie par le clavier */
    portfolio: { width: 960, height: 412, K: 8, OX: 464, OY: 290, scenario: 'live', vignette: 'wallpaper', room: 'large', stillAt: 3000, fps: 30, catFps: 15, activities: { keyboard: 0 } }
  };

  /* ================= Apparence de la chatonne (à faire évoluer) ================= */
  var CAT_STYLE = {
    fur:      ['#030202', '#080605', '#0e0b09', '#15110e', '#221b16', '#342920'],   // pelage presque noir, avec un reflet brillant sur les parties éclairées
    flecks:   ['#120e0b', '#1b1510', '#261d16', '#32261d', '#3f3025', '#4d3b2e'],   // mouchetures brunes discrètes
    earInner: '#6b5650',
    eyes:     '#5fb8ad',      // yeux bleu-vert
    eyesHalf: '#4a9289',
    eyesShut: '#6a4a30',
    pupil:    '#100a06',
    nose:     '#4a3430',
    flecksAmount: 1,          // 0 = pelage uni, 1 = actuel, 2 = très moucheté
    hat: false                // chapeau (sorcière à Halloween, père Noël à Noël)
  };

  function createScene(cv, options) {
    var opt = {}, k0;
    var base = PRESETS[(options && options.preset) || 'banner'];
    for (k0 in base) opt[k0] = base[k0];
    if (options && options.quality === 'standard') { opt.width /= 2; opt.height /= 2; opt.K /= 2; opt.OX /= 2; opt.OY /= 2; }
    for (k0 in (options || {})) opt[k0] = options[k0];
    if (base.activities && options && options.activities) {   // les poids passés complètent ceux du préréglage
      opt.activities = {};
      for (k0 in base.activities) opt.activities[k0] = base.activities[k0];
      for (k0 in options.activities) opt.activities[k0] = options.activities[k0];
    }
    var HW = opt.theme === 'halloween';      // thème Halloween
    var XM = opt.theme === 'noel';           // thème Noël
    var LARGE = opt.room === 'large';        // grand appartement (fond d'écran)
    var STYLE = {};
    for (k0 in CAT_STYLE) STYLE[k0] = CAT_STYLE[k0];
    for (k0 in (opt.cat || {})) STYLE[k0] = opt.cat[k0];

    /* ================= Configuration ================= */
    cv.width = opt.width; cv.height = opt.height;
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    var K = opt.K;                   // 1 unité du monde = 5 cm = K pixels
    var OX = opt.OX, OY = opt.OY;    // origine du monde à l'écran
    var g = ctx;                     // contexte de dessin courant (calques)

    function layer() { var c = document.createElement('canvas'); c.width = W; c.height = H; return c; }

    /* ================= Couleurs ================= */
    function hex2rgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function rgb2hex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
    function shade(h, a) { var c = hex2rgb(h); return rgb2hex(c.map(function (v) { return a < 0 ? v * (1 + a) : v + (255 - v) * a; })); }
    function pal(h) { return [shade(h, -0.55), shade(h, -0.38), shade(h, -0.2), h, shade(h, 0.1), shade(h, 0.2)]; }

    var RACK = ['#0b0c0f', '#121418', '#191c21', '#21252b', '#2a2f36', '#343a42'];
    var METAL = ['#111317', '#181b20', '#20242a', '#2a2f36', '#363c44', '#424952'];
    var WOOD = pal('#6c4d35');
    var FRAME = pal('#5d6270');
    var TERRA = pal('#a4583a');
    var CERAM = pal('#8d8983');
    var MUG = pal('#b9b4ad');

    /* ================= Primitives de dessin ================= */
    function P(x, y, z) { return [OX + (x - y) * K, OY + ((x + y) / 2 - z) * K]; }

    function shift(dx, dy, dz, fn) { var ox = OX, oy = OY; OX += (dx - dy) * K; OY += ((dx + dy) / 2 - dz) * K; fn(); OX = ox; OY = oy; }

    function fillPoly(pts, col) {
      g.fillStyle = col;
      var minY = Infinity, maxY = -Infinity, i;
      for (i = 0; i < pts.length; i++) { if (pts[i][1] < minY) minY = pts[i][1]; if (pts[i][1] > maxY) maxY = pts[i][1]; }
      minY = Math.max(minY, -1); maxY = Math.min(maxY, H + 1);
      for (var py = Math.floor(minY); py <= Math.ceil(maxY); py++) {
        var sy = py + 0.5, xs = [];
        for (i = 0; i < pts.length; i++) {
          var a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + (sy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        xs.sort(function (m, n) { return m - n; });
        for (i = 0; i + 1 < xs.length; i += 2) {
          var x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]);
          if (x1 > x0) g.fillRect(x0, py, x1 - x0, 1);
        }
      }
    }

    function line(a, b, col) {
      g.fillStyle = col;
      var x0 = Math.round(a[0]), y0 = Math.round(a[1]), x1 = Math.round(b[0]), y1 = Math.round(b[1]);
      var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
      for (var n = 0; n < 2000; n++) {
        g.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        var e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    function thick(a, b, col, w) { for (var i = 0; i < w; i++) line([a[0] + i, a[1]], [b[0] + i, b[1]], col); }
    function px(p, col, w, h) { g.fillStyle = col; g.fillRect(Math.round(p[0]), Math.round(p[1]), w || 1, h || w || 1); }

    /* Quadrilatères dans les plans x = X, y = Y, z = Z */
    function qX(X, y0, y1, z0, z1, c) { fillPoly([P(X, y0, z0), P(X, y1, z0), P(X, y1, z1), P(X, y0, z1)], c); }
    function qY(Y, x0, x1, z0, z1, c) { fillPoly([P(x0, Y, z0), P(x1, Y, z0), P(x1, Y, z1), P(x0, Y, z1)], c); }
    function qZ(Z, x0, x1, y0, y1, c) { fillPoly([P(x0, y0, Z), P(x1, y0, Z), P(x1, y1, Z), P(x0, y1, Z)], c); }
    function discX(X, yc, zc, r, c) { var p = []; for (var i = 0; i < 20; i++) { var a = i / 20 * 6.2832; p.push(P(X, yc + r * Math.cos(a), zc + r * Math.sin(a))); } fillPoly(p, c); }
    function discY(Y, xc, zc, r, c) { var p = []; for (var i = 0; i < 20; i++) { var a = i / 20 * 6.2832; p.push(P(xc + r * Math.cos(a), Y, zc + r * Math.sin(a))); } fillPoly(p, c); }

    /* Extrusion verticale ombrée selon l'orientation de chaque face */
    function loft(bot, top, z0, z1, pl, topCol) {
      var n = bot.length, cx = 0, cy = 0, i;
      for (i = 0; i < n; i++) { cx += bot[i][0]; cy += bot[i][1]; }
      cx /= n; cy /= n;
      for (i = 0; i < n; i++) {
        var a = bot[i], b = bot[(i + 1) % n];
        var nx = b[1] - a[1], ny = a[0] - b[0];
        if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
        var l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        if (nx + ny <= 0.01) continue;
        var f = (ny - nx + 1.4143) / 2.8286;
        var ta = top[i], tb = top[(i + 1) % n];
        fillPoly([P(a[0], a[1], z0), P(b[0], b[1], z0), P(tb[0], tb[1], z1), P(ta[0], ta[1], z1)], pl[Math.round(f * (pl.length - 2))]);
      }
      if (topCol !== null) fillPoly(top.map(function (p) { return P(p[0], p[1], z1); }), topCol || pl[pl.length - 1]);
    }
    function extrude(pts, z0, z1, pl, topCol) { loft(pts, pts, z0, z1, pl, topCol); }
    function box(x0, y0, z0, x1, y1, z1, pl, topCol) { extrude([[x1, y1], [x0, y1], [x0, y0], [x1, y0]], z0, z1, pl, topCol); }
    function circle(x, y, r, n) { n = n || 18; var p = []; for (var i = 0; i < n; i++) { var a = i / n * 6.2832; p.push([x + r * Math.cos(a), y + r * Math.sin(a)]); } return p; }
    function cyl(x, y, z0, z1, r, pl, topCol) { extrude(circle(x, y, r), z0, z1, pl, topCol); }
    function rrect(x0, y0, x1, y1, r) {
      var p = [], cs = [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180], [x1 - r, y0 + r, 270]];
      cs.forEach(function (c) { for (var i = 0; i <= 3; i++) { var a = (c[2] + 30 * i) * Math.PI / 180; p.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } });
      return p;
    }
    function flat(pts, z, c) { fillPoly(pts.map(function (q) { return P(q[0], q[1], z); }), c); }
    function glow(x, y, z, r, rgba) {
      var c = P(x, y, z), gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
      gr.addColorStop(0, rgba); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(c[0] - r, c[1] - r, r * 2, r * 2);
    }

    /* Petit générateur pseudo-aléatoire déterministe */
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function hash(a, b) { var s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); }

    /* ================= Géométrie du décor ================= */
    var RACK_TOP = 13.3, DESK_TOP = 15.2, KB_TOP = 15.85;
    var YE = -10.6;                                  // façade des équipements (en retrait de la porte vitrée)
    var UH = 11.2 / 12;                              // hauteur d'un U
    function U(n) { return 1.35 + (n - 1) * UH; }    // bas du U n (1 = en bas)

    var STARS = [], CITY = [], LEDS = [], BLDG = [];

    /* ---------- Pièce ---------- */
    function drawRoom() {
      /* Parquet */
      flat([[-20, -20], [70, -20], [70, 70], [-20, 70]], 0, '#33261d');
      for (var y = -20, row = 0; y < 70; y += 2.4, row++) {
        line(P(-20, y, 0), P(70, y, 0), '#261b14');
        if (row % 3 === 0) line(P(-20, y + 0.6, 0), P(70, y + 0.6, 0), '#382a20');
        for (var x = -20 + (row * 3.7) % 9; x < 70; x += 9) line(P(x, y, 0), P(x, y + 2.4, 0), '#261b14');
      }
      /* Clair de lune au sol */
      fillPoly([P(-19.5, 22, 0), P(-19.5, 34, 0), P(-8, 37, 0), P(-8, 25, 0)], 'rgba(140,170,235,0.07)');

      /* Murs */
      qX(-20, -20, 90, 0, 95, '#232834');
      qY(-20, -20, 90, 0, 95, '#2b3140');
      line(P(-20, -20, 0), P(-20, -20, 95), '#1b1f28');
      /* Plinthes */
      qX(-19.97, -20, 70, 0, 0.9, '#30364a'); line(P(-19.96, -20, 0.9), P(-19.96, 70, 0.9), '#3c4358');
      qY(-19.97, -20, 70, 0, 0.9, '#384054'); line(P(-20, -19.96, 0.9), P(70, -19.96, 0.9), '#454d63');

      /* Tapis devant la baie */
      flat(rrect(-1, -8, 15, 6.5, 2.5), 0.03, '#2f2539');
      flat(rrect(-0.3, -7.3, 14.3, 5.8, 2), 0.04, '#3d3049');
      flat(rrect(0.6, -6.4, 13.4, 4.9, 1.6), 0.05, '#2f2539');
      for (var rx = 2; rx <= 12; rx += 2.5) for (var ry = -4.8; ry <= 3.6; ry += 2.8) {
        flat([[rx, ry - 0.6], [rx + 0.6, ry], [rx, ry + 0.6], [rx - 0.6, ry]], 0.06, '#47385a');
      }

      drawWindow();
      drawCurtains();
      if (LARGE) { shift(0, 0, 5, drawPoster); shift(5, 0, 0, drawRadiator); } else { drawPoster(); drawRadiator(); }
      drawShelf();

      /* Prise murale et câble de la baie */
      qY(-19.95, 18.4, 19.6, 1.4, 2.6, '#5a5f6b'); px(P(18.8, -19.94, 2.1), '#1a1c20', 1); px(P(19.2, -19.94, 2.1), '#1a1c20', 1);
      line(P(16, -17.5, 0.15), P(18.9, -17.5, 0.15), '#0d0e10'); line(P(18.9, -17.5, 0.15), P(18.9, -19.9, 1.9), '#0d0e10');

      /* Gamelle du chat (et bol d'eau dans le grand appartement) */
      var bx0 = LARGE ? -6 : -9, by0 = LARGE ? -14.2 : -15;
      cyl(bx0, by0, 0, 0.6, 1.1, pal('#3f6d8a'), '#2b4d63');
      flat(circle(bx0, by0, 0.8), 0.55, '#5a3a22');
      for (var k = 0; k < 6; k++) px(P(bx0 + Math.cos(k) * 0.45, by0 + Math.sin(k * 2) * 0.45, 0.62), '#8a5a32', Math.max(1, Math.round(K / 6)));
      if (LARGE) { cyl(-3.3, -15, 0, 0.6, 1.1, pal('#7a8a96'), '#5a6a76'); flat(circle(-3.3, -15, 0.8), 0.5, '#3d6f9a'); drawCatTree(); }
    }

    function drawWindow() {
      var X = -19.95;
      qX(X - 0.01, 21.5, 34.5, 15.5, 31.5, '#4a4f5c');
      /* Ciel de nuit en bandes */
      var sky = ['#0c1328', '#0e162e', '#111a35', '#131d3b', '#162142', '#19254a', '#1c2a51', '#202f58'];
      for (var b = 0; b < sky.length; b++) {
        var z1 = 30.8 - b * (14.6 / sky.length), z0 = z1 - 14.6 / sky.length;
        qX(X, 22.2, 33.8, z0, z1, sky[b]);
      }
      /* Lune */
      if (HW) { discX(X + 0.01, 31.0, 28.0, 1.45, '#f2b25c'); discX(X + 0.02, 31.3, 28.3, 0.5, '#d9963f'); discX(X + 0.02, 30.6, 27.6, 0.35, '#d9963f'); }
      else { discX(X + 0.01, 31.2, 28.2, 1.05, '#e9e4cc'); discX(X + 0.02, 31.65, 28.45, 0.85, '#0f172f'); }
      /* Étoiles (scintillent en dynamique) */
      for (var i = 0; i < 18; i++) STARS.push([22.6 + rnd() * 10.8, 24 + rnd() * 6.5, rnd() * 6]);
      /* Silhouette de la ville */
      var bl = BLDG = [[22.2, 23.7, 19.6], [23.7, 25.3, 22.1], [25.3, 26.3, 18.7], [26.3, 28.2, 23.6], [28.2, 29.3, 20.4], [29.3, 31.2, 22.6], [31.2, 32.3, 19.2], [32.3, 33.8, 21.2]];
      bl.forEach(function (bd, j) {
        qX(X + 0.01, bd[0], bd[1], 16.2, bd[2], j % 2 ? '#090d19' : '#0b1020');
        if (XM) qX(X + 0.015, bd[0], bd[1], bd[2] - 0.35, bd[2], '#c9d3e2');
        for (var wy = bd[0] + 0.25; wy < bd[1] - 0.2; wy += 0.5) {
          for (var wz = 16.8; wz < bd[2] - 0.5; wz += 0.75) {
            var r = rnd();
            if (r < 0.22) CITY.push([wy, wz, r < 0.05 ? '#8fb0ff' : '#f0c56a', rnd()]);
          }
        }
      });
      /* Montants et appui */
      qX(X + 0.03, 27.85, 28.15, 16.2, 30.8, '#4a4f5c');
      qX(X + 0.03, 22.2, 33.8, 23.4, 23.7, '#4a4f5c');
      box(-20, 21.2, 15.0, -18.9, 34.8, 15.5, FRAME);
    }

    function drawCurtains() {
      line(P(-19.4, 19.0, 32.9), P(-19.4, 37.0, 32.9), '#6f7480');
      line(P(-19.4, 19.0, 33.1), P(-19.4, 37.0, 33.1), '#8a8f9c');
      var cols = ['#3b2a37', '#4a3445', '#56404f', '#46323f'];
      [[34.2, 37.2], [18.8, 21.8]].forEach(function (c) {
        var n = 0;
        for (var y = c[0]; y < c[1] - 0.01; y += 0.5, n++) qX(-19.4, y, Math.min(y + 0.5, c[1]), 4.4, 32.8, cols[n % 4]);
        qX(-19.38, c[0], c[1], 4.4, 4.8, '#2e2129');
      });
    }

    /* Affiche originale du grand appartement : chatonne astronaute et planète à anneaux */
    function drawSpacePoster() {
      var Y = -19.96;
      qY(Y, 21, 30.5, 14.5, 26.5, '#101216');                                  // cadre
      qY(Y + 0.01, 21.4, 30.1, 14.9, 26.1, '#5f5c57');                         // passe-partout
      var bg = ['#0b1030', '#101640', '#161d4f', '#1c2560', '#232d6e'];
      for (var i = 0; i < bg.length; i++) qY(Y + 0.02, 22, 29.5, 25.5 - (i + 1) * 1.6, 25.5 - i * 1.6, bg[i]);
      qY(Y + 0.02, 22, 29.5, 15.5, 17.5, '#232d6e');
      var st = [[22.6, 24.8], [24.1, 25.1], [26.9, 24.6], [28.8, 25.0], [23.2, 22.2], [29.0, 21.6], [25.3, 23.6], [27.8, 19.4], [22.8, 18.6]];
      st.forEach(function (q) { px(P(q[0], Y + 0.03, q[1]), '#dfe6ff', Math.max(1, Math.round(K / 6))); });
      /* Planète à anneaux : sphère ombrée avec bandes, anneau incliné qui passe derrière puis devant */
      var pcx = 27.0, pcz = 18.3, pr = 1.5, ra = 2.35, rb = 0.5, tilt = 0.22;
      function ringPt(t) { var x = pcx + Math.cos(t) * ra; return [x, pcz - Math.sin(t) * rb - tilt * (x - pcx) / ra]; }
      function ringArc(t0, t1, cols) {
        for (var k = 0; k < 24; k++) {
          var a0 = t0 + (t1 - t0) * k / 24, a1 = t0 + (t1 - t0) * (k + 1) / 24, p0 = ringPt(a0), p1 = ringPt(a1);
          line(P(p0[0], Y + 0.04, p0[1]), P(p1[0], Y + 0.04, p1[1]), cols[0]);
          line(P(p0[0], Y + 0.04, p0[1] - 0.13), P(p1[0], Y + 0.04, p1[1] - 0.13), cols[1]);
        }
      }
      ringArc(Math.PI, 2 * Math.PI, ['#a9824e', '#7a5a34']);                  // moitié arrière (derrière la planète)
      var bands = ['#b8582a', '#d9773a', '#e8955a', '#d06a33', '#efb26f', '#d9773a', '#b8582a'];
      for (var zz = pcz - pr; zz < pcz + pr; zz += 1 / K) {
        var dz = zz + 0.5 / K - pcz, hw = Math.sqrt(Math.max(0, pr * pr - dz * dz)); if (hw <= 0) continue;
        var bc = bands[Math.min(bands.length - 1, Math.floor((dz / pr + 1) / 2 * bands.length))];
        var x0 = pcx - hw, x1 = pcx + hw, xs = pcx + hw * 0.25 - dz * 0.2;          // terminateur : ombre côté droit
        qY(Y + 0.035, x0, Math.min(x1, xs), zz, zz + 1 / K, bc);
        if (xs < x1) qY(Y + 0.035, Math.max(x0, xs), x1, zz, zz + 1 / K, shade(bc, -0.35));
        if (x1 - 0.25 > Math.max(x0, xs)) qY(Y + 0.036, x1 - 0.22, x1, zz, zz + 1 / K, shade(bc, -0.55));
      }
      discY(Y + 0.037, pcx - 0.6, pcz + 0.65, 0.32, '#f6c993');                // reflet
      ringArc(0, Math.PI, ['#f1c27a', '#c99a55']);                             // moitié avant (devant la planète)
      px(P(25.2, Y + 0.04, 20.2), '#c9d3e2', Math.max(1, Math.round(K / 6)));   // petite lune
      /* Chatonne dans un casque rond qui flotte */
      discY(Y + 0.03, 24.4, 22.4, 1.75, '#9fb7d9');                            // bulle du casque
      discY(Y + 0.035, 24.4, 22.4, 1.5, '#2a3a5a');
      discY(Y + 0.04, 24.4, 22.1, 0.95, '#141012');                            // tête
      fillPoly([P(23.55, Y + 0.045, 22.6), P(23.85, Y + 0.045, 23.65), P(24.15, Y + 0.045, 22.75)], '#141012');   // oreilles
      fillPoly([P(24.65, Y + 0.045, 22.75), P(24.95, Y + 0.045, 23.65), P(25.25, Y + 0.045, 22.6)], '#141012');
      px(P(24.05, Y + 0.05, 22.25), '#5fb8ad', Math.max(1, Math.round(K / 6))); px(P(24.75, Y + 0.05, 22.25), '#5fb8ad', Math.max(1, Math.round(K / 6)));
      line(P(23.3, Y + 0.05, 23.6), P(23.75, Y + 0.05, 23.95), '#e6eefc');      // reflet sur la vitre
      qY(Y + 0.03, 23.7, 25.1, 19.9, 20.7, '#c9d3e2');                          // col de la combinaison
      qY(Y + 0.035, 24.2, 24.6, 20.0, 20.6, '#d9773a');
      /* Titre : trois barres façon lettrage rétro */
      qY(Y + 0.03, 22.5, 26.2, 16.1, 16.6, '#f1c27a'); qY(Y + 0.03, 22.5, 24.6, 15.75, 15.95, '#9fb7d9');
    }

    function drawPoster() {
      if (LARGE) return drawSpacePoster();
      var Y = -19.96;
      qY(Y, 21, 30.5, 14.5, 26.5, '#101216');
      qY(Y + 0.01, 21.4, 30.1, 14.9, 26.1, '#5f5c57');
      var sky = ['#2a2250', '#3c2858', '#552f62', '#743a69', '#93466c'];
      for (var i = 0; i < sky.length; i++) qY(Y + 0.02, 22, 29.5, 25.5 - (i + 1) * 1.2, 25.5 - i * 1.2, sky[i]);
      discY(Y + 0.03, 25.75, 19.6, 2.3, '#f0a050');
      for (var s = 0; s < 3; s++) qY(Y + 0.04, 23.3, 28.2, 19.65 + s * 0.55, 19.85 + s * 0.55, sky[4]);
      fillPoly([P(22, Y + 0.05, 19.4), P(24.2, Y + 0.05, 22.2), P(26, Y + 0.05, 19.4)], '#1f1739');
      fillPoly([P(25, Y + 0.05, 19.4), P(27.6, Y + 0.05, 21.4), P(29.5, Y + 0.05, 19.4)], '#271c45');
      qY(Y + 0.05, 22, 29.5, 15.5, 19.4, '#140f24');
      for (var gx = 22.5; gx < 29.5; gx += 1.1) line(P(gx, Y + 0.06, 15.5), P(25.75 + (gx - 25.75) * 0.3, Y + 0.06, 19.4), '#5a2357');
      line(P(22, Y + 0.06, 17.4), P(29.5, Y + 0.06, 17.4), '#5a2357');
    }

    function drawRadiator() {
      box(-15, -20, 1.6, -6, -19.3, 7.6, pal('#767c85'));
      for (var x = -14.6; x < -6.2; x += 0.6) line(P(x, -19.29, 1.9), P(x, -19.29, 7.3), '#535860');
      cyl(-6.4, -19.0, 1.0, 1.6, 0.25, METAL);
    }

    function drawShelf() {
      box(3, -20, 24.0, 17, -17.4, 24.5, WOOD);
      line(P(5, -19.9, 24), P(5, -19.9, 22.8), '#15171b'); line(P(15, -19.9, 24), P(15, -19.9, 22.8), '#15171b');
      var bw = [0.55, 0.7, 0.5, 0.65, 0.6, 0.75, 0.5, 0.6], bh = [2.6, 3.1, 2.4, 2.9, 2.2, 3.0, 2.5, 2.7];
      var bc = ['#7a4848', '#46677a', '#8a7748', '#4a5c3a', '#6a4a6a', '#3e4f6e', '#8a5a3a', '#5a6a72'];
      var x = 3.6;
      for (var i = 0; i < bw.length; i++) { box(x, -19.6, 24.5, x + bw[i], -17.9, 24.5 + bh[i], pal(bc[i])); x += bw[i] + 0.05; }
      box(x + 0.2, -19.6, 24.5, x + 0.9, -17.9, 25.0, pal('#6a4a6a'));          // livre couché
      /* Plante retombante */
      cyl(12.6, -18.7, 24.5, 25.7, 0.8, TERRA, '#2a1d14');
      var leaf = ['#2f6040', '#3e7c4c', '#55945e'];
      for (var v = 0; v < 4; v++) {
        var bx = 11.9 + v * 0.45, len = 2.5 + v % 2 * 1.6;
        for (var k = 0; k < 10; k++) {
          var t = k / 9;
          var q = P(bx + Math.sin(t * 3 + v) * 0.3, -17.3 + t * 0.2, 25.6 - t * len - (t > 0.2 ? 0 : 0));
          px(q, leaf[(k + v) % 3], 2, 2);
        }
      }
      for (var l = 0; l < 7; l++) px(P(12.2 + rnd() * 0.9, -18.5 + rnd() * 0.6, 25.8 + rnd() * 0.8), leaf[l % 3], 2, 2);
      /* Petit cadre photo */
      box(15.3, -19.4, 24.5, 15.6, -18.2, 26.0, METAL);
      qX(15.61, -19.2, -18.4, 24.8, 25.7, '#7d8a96');
    }

    /* ---------- Bureau ---------- */
    function drawDesk() {
      [[-19.2, -5.2], [-19.2, 17.2], [-8.8, -5.2], [-8.8, 17.2]].sort(function (a, b) { return a[0] + a[1] - b[0] - b[1]; })
        .forEach(function (l) { box(l[0] - 0.4, l[1] - 0.4, 0, l[0] + 0.4, l[1] + 0.4, 14.4, METAL); });
      box(-20, -6, 14.4, -8, 18, DESK_TOP, WOOD);
      line(P(-8, -6, DESK_TOP), P(-8, 18, DESK_TOP), WOOD[5]);

      /* Écran */
      extrude(rrect(-18.5, 3.5, -15.8, 7.5, 0.6), DESK_TOP, DESK_TOP + 0.25, METAL);
      box(-17.9, 5.2, DESK_TOP + 0.25, -17.3, 5.8, 18.4, METAL);
      box(-17.6, -0.8, 17.0, -16.9, 11.8, 23.6, RACK);
      qX(-16.88, -0.4, 11.4, 17.4, 23.2, '#05070a');

      /* Lampe de bureau */
      cyl(-18, -4.5, DESK_TOP, DESK_TOP + 0.3, 1.0, METAL);
      thick(P(-18, -4.5, DESK_TOP + 0.3), P(-17.2, -3.6, 20.6), '#3a3f47', 2);
      thick(P(-17.2, -3.6, 20.6), P(-14.8, -2.6, 21.3), '#3a3f47', 2);
      loft(circle(-14.6, -2.5, 1.25, 14), circle(-14.6, -2.5, 0.5, 14), 20.2, 21.5, pal('#c9a24a'));
      flat(circle(-14.6, -2.5, 1.0, 14), 20.21, '#ffe7b3');

      /* Tasse */
      cyl(-14.5, 14.2, DESK_TOP, DESK_TOP + 1.7, 0.85, MUG, MUG[4]);
      flat(circle(-14.5, 14.2, 0.68), DESK_TOP + 1.65, '#3b2112');
      thick(P(-14.5, 15.0, DESK_TOP + 1.3), P(-14.5, 15.5, DESK_TOP + 1.0), MUG[2], 2);
      thick(P(-14.5, 15.5, DESK_TOP + 1.0), P(-14.5, 15.0, DESK_TOP + 0.5), MUG[2], 2);

      /* Plante grasse (ou citrouille pour Halloween) */
      if (HW) pumpkin(PUMPKINS[1]); else {
      cyl(-18.3, 15.6, DESK_TOP, DESK_TOP + 1.2, 0.9, TERRA, '#2a1d14');
      var lv = ['#3e7c4c', '#4f8f58', '#2f6040'];
      for (var i = 0; i < 7; i++) {
        var a = i * 0.9, r = 0.35 + (i % 3) * 0.2;
        thick(P(-18.3, 15.6, DESK_TOP + 1.2), P(-18.3 + Math.cos(a) * r * 1.6, 15.6 + Math.sin(a) * r * 1.6, DESK_TOP + 1.6 + (i % 3) * 0.5), lv[i % 3], 2);
      }
      }

      /* Ombre de la chaise de bureau */
      flat(circle(-4.6, 14.2, 3.6, 16), 0.01, 'rgba(0,0,0,0.35)');

      /* Lumière chaude de la lampe */
      glow(-14.6, -2.5, 18.5, 95, 'rgba(255,186,110,0.16)');
      glow(-14.6, -2.5, 17.0, 34, 'rgba(255,214,150,0.12)');
    }

    /* ---------- Chaise de bureau noire (premier plan) ---------- */
    function drawChair() {
      var cx = -4.6, cy = 14.2, a = 0.28, ca = Math.cos(a), sa = Math.sin(a);
      var BLK = pal('#2b2d32'), PIST = pal('#6b7079');
      function L(x, y) { return [cx + x * ca - y * sa, cy + x * sa + y * ca]; }
      function LP(pts) { return pts.map(function (p) { return L(p[0], p[1]); }); }

      /* Piétement 5 branches + roulettes */
      var sp = [];
      for (var i = 0; i < 5; i++) { var an = i * 1.2566 + 0.35, e = L(Math.cos(an) * 3.1, Math.sin(an) * 3.1); sp.push({ an: an, e: e }); }
      sp.sort(function (u, v) { return u.e[0] + u.e[1] - v.e[0] - v.e[1]; });
      sp.forEach(function (s) {
        cyl(s.e[0], s.e[1], 0, 0.85, 0.42, METAL);
        var dx = s.e[0] - cx, dy = s.e[1] - cy, l = Math.hypot(dx, dy), nx = -dy / l * 0.3, ny = dx / l * 0.3;
        extrude([[cx + nx, cy + ny], [s.e[0] + nx, s.e[1] + ny], [s.e[0] - nx, s.e[1] - ny], [cx - nx, cy - ny]], 0.85, 1.35, BLK);
      });
      cyl(cx, cy, 0.85, 1.6, 0.85, BLK);
      cyl(cx, cy, 1.6, 4.6, 0.6, BLK);
      cyl(cx, cy, 4.6, 7.8, 0.4, PIST);
      extrude(LP([[1.6, 1.6], [-1.6, 1.6], [-1.6, -1.6], [1.6, -1.6]]), 7.6, 8.3, BLK);

      function arm(s) {
        extrude(LP([[1.4, s * 4.6 + 0.35], [0.6, s * 4.6 + 0.35], [0.6, s * 4.6 - 0.35], [1.4, s * 4.6 - 0.35]]), 9.4, 12.3, BLK);
        extrude(LP(rrect(-2.6, s * 4.9 - 0.5, 2.6, s * 4.9 + 0.5, 0.4)), 12.3, 12.9, BLK, '#383b41');
      }
      arm(-1);
      /* Assise rembourrée */
      extrude(LP(rrect(-4.8, -4.6, 4.6, 4.6, 1.6)), 8.3, 9.7, BLK, '#303338');
      line(P(L(-4.6, 0)[0], L(-4.6, 0)[1], 9.7), P(L(-4.6, 3)[0], L(-4.6, 3)[1], 9.7), '#3d4046');
      arm(1);

      /* Dossier en maille, relié à l'assise */
      var s0 = L(3.8, 0), s1 = L(4.5, 0);
      thick(P(s0[0], s0[1], 8.8), P(s1[0], s1[1], 11.2), BLK[1], 2);
      function back(X, col) {
        var pts = [], r = 1.6, y0 = -4.3, y1 = 4.3, z0 = 10.9, z1 = 21.0;
        [[y1 - r, z1 - r, 0], [y0 + r, z1 - r, 90], [y0 + r, z0 + r, 180], [y1 - r, z0 + r, 270]].forEach(function (c) {
          for (var k = 0; k <= 4; k++) { var t = (c[2] + 22.5 * k) * Math.PI / 180, q = L(X, c[0] + r * Math.cos(t)); pts.push(P(q[0], q[1], c[1] + r * Math.sin(t))); }
        });
        fillPoly(pts, col);
        return pts;
      }
      back(4.2, BLK[1]);
      var outl = back(4.9, '#1b1c20');
      for (var z = 11.8; z < 20.4; z += 0.9) { var l0 = L(4.92, -3.6), l1 = L(4.92, 3.6); line(P(l0[0], l0[1], z), P(l1[0], l1[1], z), '#25272c'); }
      for (var y = -3.6; y <= 3.6; y += 0.9) { var m = L(4.92, y); line(P(m[0], m[1], 11.6), P(m[0], m[1], 20.3), '#222429'); }
      for (var k = 0; k < outl.length; k++) line(outl[k], outl[(k + 1) % outl.length], '#34373d');
    }

    /* ---------- Halloween : citrouilles, bougie, toiles, guirlandes ---------- */
    var PUMPKINS = [
      { x: -15.2, y: -15.8, z: 0, r: 1.6, s: 1 },         // au sol, dans le coin près du radiateur
      { x: -18.0, y: 15.4, z: 15.2, r: 1.0, s: 2 },       // sur le bureau
      { x: 5.6, y: -18.4, z: 13.3, r: 1.1, s: 3 },        // sur la baie, derrière la chatonne
      { x: -17.6, y: -18.2, z: 0, r: 1.05, s: 4 }         // petite citrouille dans le coin
    ];
    var CANDLE = { x: 7.7, y: -19.0, z: 13.3 };
    var PUMP = pal('#d9721f');

    function pumpkin(pk) {
      var R0 = pk.r, H0 = pk.r * 1.25, rr = [0.55, 0.92, 1.0, 0.88, 0.45];
      for (var i = 0; i < 4; i++) {
        loft(circle(pk.x, pk.y, R0 * rr[i], 16), circle(pk.x, pk.y, R0 * rr[i + 1], 16), pk.z + H0 * i / 4, pk.z + H0 * (i + 1) / 4, PUMP, i === 3 ? undefined : null);
      }
      for (var m = -2; m <= 2; m++) {                                      // côtes
        var a = Math.PI / 4 + m * 0.42, pts = [];
        for (var k = 0; k <= 4; k++) pts.push(P(pk.x + Math.cos(a) * R0 * rr[k], pk.y + Math.sin(a) * R0 * rr[k], pk.z + H0 * k / 4));
        for (k = 0; k < 4; k++) line(pts[k], pts[k + 1], PUMP[1]);
      }
      cyl(pk.x, pk.y, pk.z + H0, pk.z + H0 + R0 * 0.35, R0 * 0.14, pal('#4a5a2a'));
    }
    /* Visage creusé qui vacille (dessiné à chaque image) */
    function pumpkinFace(pk, t) {
      var f = 0.7 + 0.3 * Math.abs(Math.sin(t / 95 + pk.s * 2.1) * Math.sin(t / 41 + pk.s));
      var R0 = pk.r, H0 = pk.r * 1.25, d = 0.7071, cx = pk.x + d * R0 * 0.98, cy = pk.y + d * R0 * 0.98, cz = pk.z + H0 * 0.5;
      function F(sv, uv) { return P(cx - d * sv * R0, cy + d * sv * R0, cz + uv * R0); }
      var col = f > 0.85 ? '#ffe27a' : f > 0.72 ? '#ffc94a' : '#f0a030';
      [-1, 1].forEach(function (s) { fillPoly([F(s * 0.5, 0.05), F(s * 0.2, 0.05), F(s * 0.35, 0.33)], col); });
      fillPoly([F(-0.1, -0.05), F(0.1, -0.05), F(0, 0.12)], col);
      fillPoly([F(-0.55, -0.2), F(-0.35, -0.32), F(-0.15, -0.22), F(0.05, -0.34), F(0.25, -0.22), F(0.45, -0.32), F(0.58, -0.2), F(0.3, -0.48), F(-0.3, -0.48)], col);
      glow(pk.x, pk.y, pk.z + H0 * 0.5, 14 * pk.r * K / 4, 'rgba(255,150,40,' + (0.14 * f).toFixed(3) + ')');
    }
    function candle() {
      cyl(CANDLE.x, CANDLE.y, CANDLE.z, CANDLE.z + 1.1, 0.3, pal('#d8cfb8'), '#efe6cf');
    }
    function candleFlame(t) {
      var f = 0.75 + 0.25 * Math.sin(t / 70) * Math.sin(t / 23), q = P(CANDLE.x, CANDLE.y, CANDLE.z + 1.35 + 0.08 * Math.sin(t / 60));
      var e = Math.max(1, Math.round(K / 4));
      g.fillStyle = '#ffd36a'; g.fillRect(Math.round(q[0]), Math.round(q[1]) - e, e, 2 * e);
      g.fillStyle = '#fff3c4'; g.fillRect(Math.round(q[0]), Math.round(q[1]), e, e);
      glow(CANDLE.x, CANDLE.y, CANDLE.z + 1.4, 10 * K / 4, 'rgba(255,190,90,' + (0.18 * f).toFixed(3) + ')');
    }
    /* Toile d'araignée dans un coin : rayons + arcs */
    function web(corner, dirA, dirB, len) {
      var col = 'rgba(215,222,235,0.32)', sp = [];
      for (var i = 0; i <= 4; i++) {
        var t = i / 4, d = [dirA[0] * (1 - t) + dirB[0] * t, dirA[1] * (1 - t) + dirB[1] * t, dirA[2] * (1 - t) + dirB[2] * t];
        sp.push(d); line(P(corner[0], corner[1], corner[2]), P(corner[0] + d[0] * len, corner[1] + d[1] * len, corner[2] + d[2] * len), col);
      }
      [0.35, 0.65, 0.95].forEach(function (f) {
        for (var i = 0; i < 4; i++) {
          var a = sp[i], b = sp[i + 1], m = 0.88;
          var A = P(corner[0] + a[0] * len * f, corner[1] + a[1] * len * f, corner[2] + a[2] * len * f);
          var B = P(corner[0] + b[0] * len * f, corner[1] + b[1] * len * f, corner[2] + b[2] * len * f);
          var M = P(corner[0] + (a[0] + b[0]) / 2 * len * f * m, corner[1] + (a[1] + b[1]) / 2 * len * f * m, corner[2] + (a[2] + b[2]) / 2 * len * f * m);
          line(A, M, col); line(M, B, col);
        }
      });
    }
    /* Guirlande : fil qui pend + positions des ampoules */
    var BULBS = [];
    function garland(a, b, sag, n) {
      var prev = null;
      for (var i = 0; i <= 24; i++) {
        var t = i / 24, q = P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - sag * 4 * t * (1 - t));
        if (prev) line(prev, q, '#1a1c22');
        prev = q;
      }
      for (var k = 1; k < n; k++) {
        var u = k / n;
        BULBS.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u - sag * 4 * u * (1 - u) - 0.25, k]);
      }
    }
    function drawHalloweenStatic() {
      web([-19.85, 34.5, 31.5], [0, -1, 0], [0, 0, -1], 3.2);           // coin de la fenêtre
      web([16.0, -19.9, 13.3], [1, 0, 0], [0, 0, 1], 3.0);              // entre la baie et le mur
      garland([3.2, -17.2, 23.9], [16.8, -17.2, 23.9], 0.8, 11);        // sous l'étagère
      garland([-19.3, 19.3, 32.6], [-19.3, 36.7, 32.6], 0.9, 12);       // sur la tringle
    }
    function drawHalloweenDynamic(t) {
      PUMPKINS.forEach(function (pk) { pumpkinFace(pk, t); });
      candleFlame(t);
      var cols = ['#ff8a1e', '#a85cff', '#7dff6a'];
      BULBS.forEach(function (b, i) {
        var on = Math.sin(t / 380 + i * 1.7) > -0.3;
        px(P(b[0], b[1], b[2]), on ? cols[i % 3] : '#2a2230', Math.max(1, Math.round(K / 4)));
      });
      /* Chauves-souris */
      var e = Math.max(1, Math.round(K / 4)), bats = opt.scenario === 'avatar' ? [[0, 0.0], [1, 0.45]] : [[0, 0.0], [1, 0.33], [2, 0.66]];
      bats.forEach(function (bt) {
        var ph = (t / 6500 + bt[1]) % 1, flap = Math.floor(t / 110 + bt[0] * 3) % 2, q;
        if (opt.scenario === 'avatar') q = P(2 + ph * 16, -19.6, 15.3 + Math.sin(t / 300 + bt[0] * 2) * 0.5 + bt[0] * 0.8);
        else {
          var y = 33.6 - ph * 11.4, z = 26.5 + Math.sin(t / 320 + bt[0] * 2) * 1.0 + bt[0] * 0.9;
          if (y < 22.4 || y > 33.6 || z < 16.4 || z > 30.6) return;
          q = P(-19.92, y, z);
        }
        var x0 = Math.round(q[0]) - 2 * e, y0 = Math.round(q[1]);
        g.fillStyle = '#07050b';
        g.fillRect(x0 + 2 * e, y0, e, e);
        if (flap) { g.fillRect(x0, y0 - e, e, e); g.fillRect(x0 + e, y0, e, e); g.fillRect(x0 + 3 * e, y0, e, e); g.fillRect(x0 + 4 * e, y0 - e, e, e); }
        else { g.fillRect(x0, y0 + e, e, e); g.fillRect(x0 + e, y0, e, e); g.fillRect(x0 + 3 * e, y0, e, e); g.fillRect(x0 + 4 * e, y0 + e, e, e); }
      });
      /* Petit fantôme qui flotte près de l'affiche (bannière) */
      if (opt.scenario !== 'avatar') {
        var G = ['...XXXXX...', '..XXXXXXX..', '.XXXXXXXXX.', '.XX..X..XX.', '.XX..X..XX.', '.XXXXXXXXX.', '.XXXX..XXXX'.slice(0, 11), '.XXXXXXXXX.', '.XXXXXXXXX.', '.XXXXXXXXX.', '.X.XX.XX.X.', '...........'];
        var gq = P(34, -19.3, 15.5 + Math.sin(t / 700) * 0.6), gx = Math.round(gq[0] + Math.sin(t / 1100) * 3) - 5, gy = Math.round(gq[1]) - 6;
        g.globalAlpha = 0.78;
        for (var r = 0; r < G.length; r++) for (var c = 0; c < 11; c++) {
          var ch = G[r][c];
          if (ch === 'X') { g.fillStyle = r < 3 ? '#f4f1ff' : '#dcd7ef'; g.fillRect(gx + c, gy + r, 1, 1); }
          else if ((r === 3 || r === 4) && (c === 3 || c === 4 || c === 6 || c === 7)) { g.fillStyle = '#1a1424'; g.fillRect(gx + c, gy + r, 1, 1); }
        }
        g.globalAlpha = 1;
        glow(34, -19.3, 15.5, 16, 'rgba(200,190,255,0.07)');
      }
    }

    /* ---------- Noël : sapin, cadeaux, chaussettes, neige ---------- */
    var TREE = { x: -15.4, y: -15.8 }, TREE_LIGHTS = [], ORNAMENTS = [];
    var TIERS = [[2.9, 1.2, 1.8, 6.6], [2.3, 0.85, 5.6, 9.8], [1.7, 0.12, 8.8, 13.2]];   // rayon bas, rayon haut, z bas, z haut
    function giftBox(x0, y0, x1, y1, h, col, rib, z0) {
      z0 = z0 || 0; var z1 = z0 + h;
      box(x0, y0, z0, x1, y1, z1, pal(col));
      var mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      line(P(mx, y0, z1 + 0.01), P(mx, y1, z1 + 0.01), rib); line(P(x0, my, z1 + 0.01), P(x1, my, z1 + 0.01), rib);
      line(P(x1 + 0.01, my, z0), P(x1 + 0.01, my, z1), rib); line(P(mx, y1 + 0.01, z0), P(mx, y1 + 0.01, z1), rib);
      px(P(mx - 0.25, my + 0.25, z1 + 0.25), rib, Math.max(1, Math.round(K / 4))); px(P(mx + 0.25, my - 0.25, z1 + 0.25), rib, Math.max(1, Math.round(K / 4)));
    }
    function treeSurface(tier, ang, f) {
      var T = TIERS[tier], r = (T[0] + (T[1] - T[0]) * f) * 0.97;
      return [TREE.x + Math.cos(ang) * r, TREE.y + Math.sin(ang) * r, T[2] + (T[3] - T[2]) * f];
    }
    function drawTree() {
      cyl(TREE.x, TREE.y, 0, 1.6, 1.25, pal('#8a1e1e'), '#2a1a12');
      cyl(TREE.x, TREE.y, 1.4, 1.65, 1.32, pal('#c9a24a'), null);
      cyl(TREE.x, TREE.y, 1.6, 2.2, 0.35, pal('#5a3a22'));
      TIERS.forEach(function (T, i) {
        loft(circle(TREE.x, TREE.y, T[0], 18), circle(TREE.x, TREE.y, T[1], 18), T[2], T[3], pal('#2f6b3e'), i === 2 ? undefined : null);
        /* Bord du rang légèrement plus sombre et dentelé */
        for (var k = 0; k < 18; k++) { var a = k / 18 * 6.2832; if (Math.cos(a) + Math.sin(a) > 0) px(P(TREE.x + Math.cos(a) * T[0], TREE.y + Math.sin(a) * T[0], T[2] - 0.15), '#1d4a2a', 1); }
      });
      var cols = ['#c9302c', '#e0b03a', '#3a7bd5', '#d9dde3'];
      for (var n = 0; n < 16; n++) {
        var tier = n % 3, ang = -0.6 + rnd() * 2.75, f = 0.12 + rnd() * 0.7;
        ORNAMENTS.push([treeSurface(tier, ang, f), cols[n % 4]]);
      }
      for (n = 0; n < 26; n++) TREE_LIGHTS.push(treeSurface(n % 3, -0.7 + rnd() * 2.9, 0.08 + rnd() * 0.8));
      ORNAMENTS.forEach(function (o) { px(P(o[0][0], o[0][1], o[0][2]), o[1], Math.max(2, Math.round(K / 2))); });
      giftBox(-13.4, -15.2, -11.8, -13.6, 1.4, '#a8282a', '#e0b03a');
      giftBox(-12.2, -18.4, -10.8, -17.0, 1.0, '#2f7a45', '#e6e6e6');
      giftBox(-18.1, -13.4, -16.3, -12.0, 1.2, '#2c5aa8', '#e0b03a');
    }
    function stocking(x0) {
      var Y = -17.35, top = 24.0;
      fillPoly([P(x0 + 0.08, Y, top - 0.6), P(x0 + 0.82, Y, top - 0.6), P(x0 + 0.82, Y, top - 2.0), P(x0 + 1.55, Y, top - 2.2), P(x0 + 1.55, Y, top - 2.7), P(x0 + 0.3, Y, top - 2.75), P(x0 + 0.08, Y, top - 2.4)], '#b3262a');
      qY(Y + 0.01, x0, x0 + 0.9, top - 0.65, top, '#e8ecf1');
      line(P(x0 + 1.2, Y + 0.01, top - 2.2), P(x0 + 1.5, Y + 0.01, top - 2.5), '#e8ecf1');
    }
    function drawChristmasStatic() {
      drawTree();
      stocking(5.6); stocking(11.6);
      garland([3.2, -17.2, 23.9], [16.8, -17.2, 23.9], 0.8, 11);
      garland([-19.3, 19.3, 32.6], [-19.3, 36.7, 32.6], 0.9, 12);
      /* Sur la baie : un cadeau et une bougie rouge (visibles sur l'avatar) */
      giftBox(4.8, -19.3, 6.5, -17.6, 1.5, '#a8282a', '#e0b03a', RACK_TOP);
      cyl(CANDLE.x, CANDLE.y, CANDLE.z, CANDLE.z + 1.1, 0.3, pal('#b3262a'), '#d9463c');
      px(P(CANDLE.x + 0.35, CANDLE.y + 0.1, CANDLE.z + 0.15), '#2f6b3e', Math.max(1, Math.round(K / 4)));
    }
    var FLAKES = [];
    for (var fl = 0; fl < 34; fl++) FLAKES.push([22.4 + rnd() * 11.2, rnd(), 2600 + rnd() * 2400, rnd() * 6]);
    function drawChristmasDynamic(t) {
      /* Neige derrière la vitre */
      g.fillStyle = '#e9f0ff';
      FLAKES.forEach(function (f) {
        var z = 30.6 - ((t / f[2] + f[1]) % 1) * 14.2, y = f[0] + Math.sin(t / 700 + f[3]) * 0.35;
        if (y < 22.3 || y > 33.7) return;
        g.globalAlpha = 0.85; var q = P(-19.92, y, z); g.fillRect(Math.round(q[0]), Math.round(q[1]), 1, 1);
      });
      g.globalAlpha = 1;
      /* Guirlandes chaudes */
      var cols = ['#ffd27a', '#ff5a5a', '#7dff8a', '#6ab8ff'], e = Math.max(1, Math.round(K / 4));
      BULBS.forEach(function (b, i) { px(P(b[0], b[1], b[2]), Math.sin(t / 420 + i * 1.3) > -0.4 ? cols[i % 4] : '#2a2620', e); });
      /* Lumières du sapin + étoile */
      TREE_LIGHTS.forEach(function (l, i) { if (Math.sin(t / 300 + i * 2.1) > -0.2) px(P(l[0], l[1], l[2]), i % 2 ? '#fff1b0' : '#ffd060', 1); });
      var st = P(TREE.x, TREE.y, 13.6), tw = 0.8 + 0.2 * Math.sin(t / 250);
      g.fillStyle = '#ffd84a';
      g.fillRect(Math.round(st[0]) - 1, Math.round(st[1]) - 1, 3, 3); g.fillRect(Math.round(st[0]), Math.round(st[1]) - 3, 1, 7); g.fillRect(Math.round(st[0]) - 3, Math.round(st[1]), 7, 1);
      glow(TREE.x, TREE.y, 13.6, 18, 'rgba(255,215,90,' + (0.18 * tw).toFixed(3) + ')');
      glow(TREE.x, TREE.y, 7, 40, 'rgba(255,190,90,0.07)');
      candleFlame(t);
    }

    /* ---------- Grand appartement : canapé, arbre à chat, banquette de fenêtre, carton ---------- */
    var COUCH = pal('#4a6458'), FELT = pal('#8a7d6a'), SISAL = pal('#b59a6a'), KRAFT2 = pal('#a07a4a');
    var BOX = { x0: -15.6, y0: 29.6, x1: -11.4, y1: 34.0, h: 3.8 };      // coin de la fenêtre
    function drawCouch() {
      /* Canapé scandinave : bas, fin, accoudoirs étroits, pieds en bois fuselés (on voit le sol dessous) */
      var C1 = pal('#5f7a6a'), C2 = pal('#6b8877'), LEG = pal('#8a6440');
      [[22.4, -19.4], [36.6, -19.4], [22.4, -14.8], [36.6, -14.8]].forEach(function (l) { loft(circle(l[0], l[1], 0.14, 8), circle(l[0], l[1], 0.22, 8), 0, 2.4, LEG); });
      extrude(rrect(22, -19.8, 37, -14.4, 0.5), 2.4, 3.5, C1);                         // cadre fin
      extrude(rrect(22, -19.8, 37, -19.0, 0.35), 3.5, 9.8, C1, C1[4]);                 // dossier fin
      [22.9, 29.6].forEach(function (x) {                                               // coussins de dossier
        loft(rrect(x, -19.05, x + 6.5, -18.2, 0.45), rrect(x, -19.15, x + 6.5, -18.55, 0.4), 5.2, 9.3, C2, C2[4]);
      });
      extrude(rrect(22, -19.8, 22.8, -14.4, 0.35), 3.5, 7.0, C1, C1[4]);               // accoudoir gauche
      extrude(rrect(22.8, -18.3, 36.2, -14.3, 0.55), 3.5, 5.2, C2, C2[5]);             // assise d'un seul tenant
      line(P(29.5, -18.2, 5.21), P(29.5, -14.4, 5.21), C2[2]);                          // couture
      extrude(rrect(36.2, -19.8, 37, -14.4, 0.35), 3.5, 7.0, C1, C1[4]);               // accoudoir droit
      loft(rrect(23.3, -18.0, 25.3, -17.2, 0.4), rrect(23.2, -18.3, 25.2, -17.6, 0.4), 5.2, 7.6, pal('#c9a24a'));   // coussin moutarde
      /* Plaid crème plié sur l'accoudoir droit */
      var PL = pal('#d9cfbd');
      qZ(7.02, 35.9, 37.1, -18.6, -15.4, PL[4]);
      fillPoly([P(37.1, -18.6, 7.0), P(37.1, -15.4, 7.0), P(37.1, -15.4, 4.4), P(37.1, -18.6, 4.2)], PL[2]);
      line(P(37.12, -17.0, 6.9), P(37.12, -17.0, 4.4), PL[1]);
    }
    function drawCatTree() {
      extrude(rrect(-19.6, -19.6, -11.8, -11.8, 0.8), 0, 0.8, FELT);
      [[-17, -17, 0.7, 17.2], [-14, -14.5, 0.6, 9]].forEach(function (pp) {
        cyl(pp[0], pp[1], 0.8, pp[3], pp[2], SISAL);
        for (var z = 1.2; z < pp[3]; z += 0.5) line(P(pp[0] + pp[2] * 0.7, pp[1] + pp[2] * 0.7, z), P(pp[0] + pp[2] * 0.7, pp[1] + pp[2] * 0.7, z + 0.2), SISAL[1]);
      });
      extrude(rrect(-16.5, -17, -11.5, -12, 0.8), 9, 9.8, FELT);                       // plateforme
      line(P(-12.5, -12.2, 9), P(-12.5, -12.2, 6.8), '#c9c2b3'); cyl(-12.5, -12.2, 6.2, 6.9, 0.35, pal('#c94f4f'));   // pompon qui pend
      cyl(-17, -17, 17.2, 18.8, 2.4, FELT, null);                                        // panier du haut
      flat(circle(-17, -17, 2.4), 18.8, FELT[5]);
      flat(circle(-17, -17, 1.9), 18.81, '#5e5446');
    }
    function drawSill() {
      box(-20, 22, 14, -16.6, 35, 15.2, WOOD);
      extrude(rrect(-19.6, 23, -17, 29, 0.6), 15.2, 15.7, pal('#6f7f9a'));               // petit coussin
    }
    function drawBoxBack() {
      var b = BOX, c = KRAFT2;
      flat([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], 0.03, c[1]);
      fillPoly([P(b.x0, b.y0, 0), P(b.x0, b.y1, 0), P(b.x0, b.y1, b.h), P(b.x0, b.y0, b.h)], c[3]);   // paroi du fond (vue de l'intérieur)
      fillPoly([P(b.x0, b.y0, 0), P(b.x1, b.y0, 0), P(b.x1, b.y0, b.h), P(b.x0, b.y0, b.h)], c[2]);
      fillPoly([P(b.x0, b.y0, b.h), P(b.x0, b.y1, b.h), P(b.x0 - 1.4, b.y1, b.h + 1.6), P(b.x0 - 1.4, b.y0, b.h + 1.6)], c[4]);   // rabats ouverts
      fillPoly([P(b.x0, b.y0, b.h), P(b.x1, b.y0, b.h), P(b.x1, b.y0 - 1.4, b.h + 1.6), P(b.x0, b.y0 - 1.4, b.h + 1.6)], c[3]);
    }
    function drawBoxFront() {
      var b = BOX, c = KRAFT2;
      fillPoly([P(b.x1, b.y1, 0), P(b.x1, b.y0, 0), P(b.x1, b.y0, b.h), P(b.x1, b.y1, b.h)], c[1]);
      fillPoly([P(b.x0, b.y1, 0), P(b.x1, b.y1, 0), P(b.x1, b.y1, b.h), P(b.x0, b.y1, b.h)], c[3]);
      line(P(b.x0, b.y1, b.h), P(b.x1, b.y1, b.h), c[5]); line(P(b.x1, b.y1, b.h), P(b.x1, b.y0, b.h), c[5]);
      fillPoly([P(b.x1, b.y1, b.h), P(b.x1, b.y0, b.h), P(b.x1 + 1.2, b.y0, b.h + 1.0), P(b.x1 + 1.2, b.y1, b.h + 1.0)], c[2]);
      qY(b.y1 + 0.01, -14.9, -12.9, 1.1, 2.4, '#e6dccb'); line(P(-14.6, b.y1 + 0.02, 2.0), P(-13.2, b.y1 + 0.02, 2.0), '#b33a3a');   // étiquette
    }

    /* ---------- Plante d'intérieur ---------- */
    function drawPlant() {
      var cx = -16.6, cy = 20.6;
      cyl(cx, cy, 0, 3.0, 1.5, CERAM, null);
      flat(circle(cx, cy, 1.5), 3.0, CERAM[4]);
      flat(circle(cx, cy, 1.25), 3.01, '#24180f');
      var leaves = [];
      for (var i = 0; i < 8; i++) {
        var ang = i * 0.82 + 0.3, bz = 5.5 + (i % 3) * 2.4 + (i > 5 ? 1.5 : 0), Ln = 2.5 + (i % 2) * 0.9;
        leaves.push({ ang: ang, bz: bz, L: Ln, bx: cx + Math.cos(ang) * 1.2, by: cy + Math.sin(ang) * 1.2 });
      }
      leaves.sort(function (a, b) { return a.bx + a.by - b.bx - b.by; });
      leaves.forEach(function (lf) {
        thick(P(cx, cy, 3.0), P(lf.bx, lf.by, lf.bz), '#2c4f33', 1);
        var ax = Math.cos(lf.ang), ay = Math.sin(lf.ang), sx = -ay, sy = ax, pts = [];
        for (var k = 0; k < 16; k++) {
          var t = k / 16 * 6.2832, u = lf.L * (1 - Math.cos(t)) / 2, v = lf.L * 0.42 * Math.sin(t) * (k % 4 === 2 ? 0.7 : 1);
          pts.push(P(lf.bx + ax * u + sx * v, lf.by + ay * u + sy * v, lf.bz - u * 0.35));
        }
        fillPoly(pts, (lf.ang % 1.6) > 0.8 ? '#33663f' : '#2b5937');
        line(P(lf.bx, lf.by, lf.bz), P(lf.bx + ax * lf.L, lf.by + ay * lf.L, lf.bz - lf.L * 0.35), '#4a8a56');
      });
    }

    /* ---------- Baie 12U ---------- */
    function led(x, z, kind, i) { LEDS.push({ x: x, z: z, kind: kind, i: i, thr: 0.05 + rnd() * 0.9 }); px(P(x, YE - 0.01, z), '#0e1410', 1); }

    function drawRack() {
      [[4.8, -19.2], [15.2, -19.2], [4.8, -10.8], [15.2, -10.8]].sort(function (a, b) { return a[0] + a[1] - b[0] - b[1]; })
        .forEach(function (c) { cyl(c[0], c[1], 0, 0.8, 0.42, RACK); });
      box(4, -20, 0.8, 16, -10, 13.0, RACK);
      box(4.1, -19.9, 13.0, 15.9, -10.1, RACK_TOP, RACK, '#1d2127');
      for (var x = 5.4; x < 15; x += 1.2) line(P(x, -18.6, RACK_TOP), P(x, -11.6, RACK_TOP), '#101215');
      for (var z = 11.1; z < 12.6; z += 0.45) line(P(16.01, -18.8, z), P(16.01, -11.2, z), '#0c0e11');
      for (z = 1.6; z < 3.1; z += 0.45) line(P(16.01, -18.8, z), P(16.01, -11.2, z), '#0c0e11');
      line(P(16, -10, 0.8), P(16, -10, 13.0), RACK[4]);
      line(P(4, -10, RACK_TOP), P(16, -10, RACK_TOP), RACK[5]);
      line(P(16, -10, RACK_TOP), P(16, -20, RACK_TOP), RACK[4]);
      qX(16.02, -12.4, -11.4, 6.6, 7.2, '#3a3f47');

      /* Intérieur + profondeur */
      qY(-10.01, 4.55, 15.45, 1.35, 12.55, '#060708');
      fillPoly([P(4.6, -10, 1.35), P(4.6, YE, 1.35), P(4.6, YE, 12.55), P(4.6, -10, 12.55)], '#121418');
      fillPoly([P(4.6, -10, 1.36), P(15.4, -10, 1.36), P(15.4, YE, 1.36), P(4.6, YE, 1.36)], '#16191d');
      /* Montants perforés */
      qY(YE, 4.75, 5.05, 1.35, 12.55, '#2a2e35'); qY(YE, 14.95, 15.25, 1.35, 12.55, '#2a2e35');
      for (z = 1.5; z < 12.5; z += UH / 3) { px(P(4.88, YE - 0.01, z), '#0b0c0e', 1); px(P(15.08, YE - 0.01, z), '#0b0c0e', 1); }

      var X0 = 5.05, X1 = 14.95, n;
      function face(n0, size, col) { var a = U(n0) + 0.04, b = U(n0) + size * UH - 0.04; qY(YE, X0, X1, a, b, col); line(P(X0, YE - 0.005, b), P(X1, YE - 0.005, b), shade(col, 0.22)); return [a, b]; }

      /* U12 : panneau de brassage 24 ports */
      var f = face(12, 1, '#23272d');
      qY(YE - 0.01, X0 + 0.3, X1 - 0.3, f[1] - 0.3, f[1] - 0.05, '#2c3038');
      var ports = [];
      for (n = 0; n < 24; n++) { var xp = 5.7 + n * (8.6 / 23); ports.push(xp); px(P(xp, YE - 0.01, f[0] + 0.25), '#040506', 1); }
      var zPatch = f[0] + 0.25;

      /* U11 : passe-câbles */
      f = face(11, 1, '#131519');
      qY(YE - 0.01, X0 + 0.4, X1 - 0.4, (f[0] + f[1]) / 2 - 0.08, (f[0] + f[1]) / 2 + 0.08, '#060708');
      for (n = 0; n < 5; n++) px(P(5.8 + n * 2.1, YE - 0.02, f[1] - 0.2), '#2a2e35', 2, 1);

      /* U10 : switch 24 ports */
      f = face(10, 1, '#2e343c');
      qY(YE - 0.01, X0 + 0.15, X0 + 0.55, f[0] + 0.1, f[1] - 0.1, '#30363e');
      var zSw = f[0] + 0.25;
      ports.forEach(function (xp, i) { px(P(xp, YE - 0.01, zSw), '#040506', 1); led(xp, f[1] - 0.2, 'port', i); });
      qY(YE - 0.01, 14.2, 14.85, f[0] + 0.15, f[0] + 0.5, '#0b0c0e');

      /* Câbles de brassage colorés */
      var cc = ['#2c5aa8', '#a8861a', '#23824a', '#9c3434', '#8d9097', '#6c43a0'];
      ports.forEach(function (xp, i) {
        if (hash(i, 5) < 0.4) return;
        var c = cc[Math.floor(i / 4) % cc.length], zm = U(11) + UH * 0.5;
        line(P(xp, YE + 0.05, zPatch - 0.05), P(xp + 0.06, YE + 0.15, zm), c);
        line(P(xp + 0.06, YE + 0.15, zm), P(xp, YE + 0.05, zSw + 0.05), c);
      });

      /* U9 : pare-feu */
      f = face(9, 1, '#2d333b');
      qY(YE - 0.01, 7.8, 10.2, f[0] + 0.15, f[1] - 0.15, '#0a1018');
      for (n = 0; n < 4; n++) { led(5.6 + n * 0.45, (f[0] + f[1]) / 2, 'fw', n); px(P(12.6 + n * 0.55, YE - 0.01, f[0] + 0.3), '#040506', 2, 1); }

      /* U8 : obturateur ventilé */
      f = face(8, 1, '#17191d');
      for (x = 5.6; x < 14.5; x += 0.5) px(P(x, YE - 0.01, (f[0] + f[1]) / 2), '#0b0c0e', 1);

      /* U7-U6 : serveur 2U, 6 baies */
      f = face(6, 2, '#1f2328');
      qY(YE - 0.01, X0 + 0.15, 6.6, f[0] + 0.15, f[1] - 0.15, '#262a30');
      led(5.6, f[1] - 0.45, 'power', 0); led(6.1, f[1] - 0.45, 'sys', 0); led(6.1, f[0] + 0.45, 'sys', 1);
      for (n = 0; n < 6; n++) {
        var bx = 6.9 + n * 1.33;
        qY(YE - 0.01, bx, bx + 1.22, f[0] + 0.15, f[1] - 0.15, '#2b3038');
        line(P(bx + 0.1, YE - 0.02, f[1] - 0.35), P(bx + 1.1, YE - 0.02, f[1] - 0.35), '#3f454e');
        led(bx + 1.0, f[0] + 0.35, 'disk', n);
      }

      /* U5-U4 : NAS 4 baies */
      f = face(4, 2, '#444a53');
      qY(YE - 0.01, 5.4, 8.6, f[1] - 0.5, f[1] - 0.3, '#3b414a');
      led(5.7, f[0] + 0.5, 'sys', 2); led(6.2, f[0] + 0.5, 'sys', 3);
      for (n = 0; n < 4; n++) {
        var nx = 9.3 + n * 1.4;
        qY(YE - 0.01, nx, nx + 1.3, f[0] + 0.15, f[1] - 0.15, '#22262c');
        for (var gz = f[0] + 0.35; gz < f[1] - 0.4; gz += 0.3) line(P(nx + 0.15, YE - 0.02, gz), P(nx + 1.15, YE - 0.02, gz), '#1a1d21');
        led(nx + 0.65, f[1] - 0.3, 'nas', n);
      }

      /* U3 : tablette avec box internet + mini PC */
      var a3 = U(3);
      qY(YE, X0, X1, a3, a3 + 0.12, '#2a2e35');
      qY(YE + 0.1, 5.8, 9.2, a3 + 0.12, a3 + UH - 0.1, '#7f848c');
      qY(YE + 0.09, 5.8, 9.2, a3 + UH - 0.22, a3 + UH - 0.1, '#959aa2');
      for (n = 0; n < 4; n++) LEDS.push({ x: 6.4 + n * 0.5, z: a3 + 0.4, kind: 'isp', i: n, thr: 0.05 + rnd() * 0.9, y: YE + 0.09 });
      qY(YE + 0.1, 10.0, 12.6, a3 + 0.12, a3 + UH - 0.25, '#15171a');
      LEDS.push({ x: 12.2, z: a3 + 0.4, kind: 'mini', i: 0, thr: 0.05 + rnd() * 0.9, y: YE + 0.09 });

      /* U2-U1 : onduleur avec écran */
      f = face(1, 2, '#272b31');
      qY(YE - 0.01, 6.0, 9.2, f[0] + 0.45, f[1] - 0.45, '#0a121a');
      for (n = 0; n < 3; n++) px(P(9.8 + n * 0.5, YE - 0.01, f[0] + 0.6), '#30353d', 1);
      for (x = 11.6; x < 14.6; x += 0.4) line(P(x, YE - 0.01, f[0] + 0.25), P(x, YE - 0.01, f[1] - 0.25), '#121418');
      led(9.8, f[1] - 0.45, 'ups', 0);

      /* Cadre de porte par-dessus (masque le débord du retrait) */
      var fc = RACK[3];
      qY(-9.99, 4.0, 4.6, 0.8, 13.0, fc); qY(-9.99, 15.4, 16.0, 0.8, 13.0, fc);
      qY(-9.99, 4.0, 16.0, 12.5, 13.0, fc); qY(-9.99, 4.0, 16.0, 0.8, 1.4, fc);
      for (x = 4.6; x < 15.4; x += 0.45) { px(P(x, -9.98, 12.75), '#0c0d10', 1); px(P(x, -9.98, 1.1), '#0c0d10', 1); }
    }

    /* Vitre teintée + reflets + poignée (calque au-dessus des voyants) */
    function drawGlass() {
      qY(-9.97, 4.6, 15.4, 1.4, 12.5, 'rgba(140,180,230,0.07)');
      fillPoly([P(6.2, -9.96, 12.5), P(7.6, -9.96, 12.5), P(5.2, -9.96, 4.0), P(4.6, -9.96, 4.0), P(4.6, -9.96, 6.4)], 'rgba(255,255,255,0.05)');
      fillPoly([P(9.0, -9.96, 12.5), P(9.5, -9.96, 12.5), P(6.8, -9.96, 1.4), P(6.3, -9.96, 1.4)], 'rgba(255,255,255,0.035)');
      line(P(4.62, -9.95, 1.5), P(4.62, -9.95, 12.4), 'rgba(255,255,255,0.08)');
      thick(P(15.05, -9.9, 5.6), P(15.05, -9.9, 8.6), '#8e959f', 2);
      line(P(15.05, -9.88, 5.6), P(15.05, -9.88, 8.6), '#c3c9d1');
      px(P(15.05, -9.9, 4.9), '#0a0b0d', 1, 2);
    }

    function drawVignette() {
      var gr = opt.vignette === 'wallpaper' ? g.createRadialGradient(W / 2, H * 0.5, H * 0.45, W / 2, H * 0.5, W * 0.62) : opt.vignette === 'avatar'
        ? g.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.72)
        : g.createRadialGradient(W / 2, H * 0.55, H * 0.6, W / 2, H * 0.55, W * 0.62);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, HW ? 'rgba(28,6,40,0.6)' : XM ? 'rgba(4,14,34,0.55)' : 'rgba(0,0,0,0.5)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }

    /* ================= Éléments animés du décor ================= */
    function drawSky(t) {
      STARS.forEach(function (s) {
        var b = 0.5 + 0.5 * Math.sin(t / 650 + s[2] * 3);
        if (b < 0.3) return;
        g.globalAlpha = b; px(P(-19.93, s[0], s[1]), '#dfe6ff', 1);
      });
      g.globalAlpha = 1;
      CITY.forEach(function (w, i) {
        if (hash(i, Math.floor(t / 5000 + w[3] * 10)) < 0.1) return;
        px(P(-19.93, w[0], w[1]), w[2], 1);
      });
    }

    /* ================= État réel des appareils (option status, setStatus) =================
       Sans carte d'état, la baie vit sa vie (voyants animés). Dès qu'une carte est donnée, chaque appareil affiche
       son état : 'up' (activité normale), 'down' (rouge fixe), 'degraded' (orange fixe), 'unknown' (éteint, gris).
       Un appareil absent de la carte est 'unknown' : jamais de vert sans donnée. */
    var DEVICES = ['fw', 'switch', 'server', 'nas', 'isp', 'mini', 'ups'];
    var STATUS = null;
    function setStatus(map) {
      STATUS = {};
      DEVICES.forEach(function (d) { var s = map && map[d]; STATUS[d] = s === 'up' || s === 'down' || s === 'degraded' ? s : 'unknown'; });
    }
    if (opt.status) setStatus(opt.status);
    function statusOf(dev) { return STATUS ? STATUS[dev] : 'up'; }
    function ledDevice(l) {
      if (l.kind === 'port') return 'switch';
      if (l.kind === 'power' || l.kind === 'disk') return 'server';
      if (l.kind === 'sys') return l.i < 2 ? 'server' : 'nas';
      return l.kind;                                                // fw, nas, isp, mini, ups
    }
    var LED_DOWN = '#ef4444', LED_DEGRADED = '#f97316', LED_UNKNOWN = '#3a3f47';

    function drawLeds(st) {
      var t = st.t;
      LEDS.forEach(function (l) {
        if (st.power <= l.thr) return;
        var col, s = statusOf(ledDevice(l));
        if (l.kind === 'port' && !st.halting && hash(l.i, 3) < 0.25) return;   // ports libres : pas de voyant
        if (st.halting) col = '#ef4444';
        else if (s === 'down') col = LED_DOWN;
        else if (s === 'degraded') col = LED_DEGRADED;
        else if (s === 'unknown') col = LED_UNKNOWN;
        else if (l.kind === 'port') col = hash(l.i, Math.floor(t / 90) + l.i) > 0.72 ? '#f2b33d' : '#3ddc84';
        else if (l.kind === 'fw') col = l.i === 0 || hash(l.i, Math.floor(t / 160)) > 0.5 ? '#3ddc84' : '#1d5c36';
        else if (l.kind === 'power') col = '#5aa9ff';
        else if (l.kind === 'disk') col = hash(l.i, Math.floor(t / 110)) > 0.62 ? '#5aa9ff' : '#3ddc84';
        else if (l.kind === 'nas') col = hash(l.i + 7, Math.floor(t / 140)) > 0.55 ? '#f2b33d' : '#3ddc84';
        else if (l.kind === 'isp') col = l.i === 3 ? (Math.floor(t / 400) % 2 ? '#3ddc84' : '#1d5c36') : '#3ddc84';
        else if (l.kind === 'mini') col = '#e8f0ff';
        else col = '#3ddc84';
        px(P(l.x, l.y !== undefined ? l.y : YE - 0.02, l.z), col, Math.max(1, Math.round(K / 6)));
      });
      var f0 = U(1) + 0.49, f1 = U(1) + 2 * UH - 0.49;
      var sUps = statusOf('ups'), sFw = statusOf('fw');
      if (st.power > 0.3 && !st.halting && sUps !== 'unknown') {   // écran de l'onduleur
        if (sUps === 'down') qY(YE - 0.02, 6.05, 9.15, f0, f1, '#3b0f12');
        else {
          qY(YE - 0.02, 6.05, 9.15, f0, f1, '#0f3b5e');
          var bars = 3 + Math.round(1.5 + 1.5 * Math.sin(t / 900));
          for (var b = 0; b < 7; b++) qY(YE - 0.03, 6.3 + b * 0.38, 6.55 + b * 0.38, f0 + 0.15, f1 - 0.15, b < bars ? (sUps === 'degraded' ? LED_DEGRADED : '#86d4ff') : '#1d5478');
        }
      }
      if (st.power > 0.5 && !st.halting && sFw !== 'unknown') {    // écran du pare-feu
        var z9 = U(9) + 0.25, fwCol = sFw === 'down' ? LED_DOWN : sFw === 'degraded' ? LED_DEGRADED : '#3ddc84';
        for (var k = 0; k < 5; k++) if (sFw === 'down' || hash(k, Math.floor(t / 300)) > 0.3) px(P(8.0 + k * 0.42, YE - 0.02, z9 + 0.2), fwCol, 1);
      }
      if (st.power > 0.2) glow(10, -7, 0.5, 46, 'rgba(70,190,255,' + (0.05 * Math.min(1, st.power)).toFixed(3) + ')');
    }

    /* ---------- Texte en police pixel 3x5 sur l'écran du bureau (setScreenText) ---------- */
    var FONT = {
      '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
      '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
      A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
      F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
      K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
      P: '111101111100100', Q: '010101101110011', R: '111101110101101', S: '011100010001110', T: '111010010010010',
      U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
      Z: '111001010100111', '/': '001001010100100', '?': '110001010000010', ':': '000010000010000', '.': '000000000000010', ' ': '000000000000000'
    };
    var SCREEN = null;
    function setScreenText(text, color) {
      if (!text) { SCREEN = null; return; }
      var s = String(text).toUpperCase();
      if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');   // É -> E
      SCREEN = { text: s.slice(0, 11), color: color || '#3ddc84' };
    }
    if (opt.screenText) setScreenText(opt.screenText, opt.screenColor);
    function drawScreenText(X) {
      var e = Math.max(1, Math.round(K / 4)), u = e / K;            // un pixel de police = e pixels écran
      for (var c = 0; c < SCREEN.text.length; c++) {
        var gl = FONT[SCREEN.text[c]] || FONT['?'];
        for (var k = 0; k < 15; k++) if (gl[k] === '1') px(P(X, 11.0 - (c * 4 + k % 3) * u, 19.55 - Math.floor(k / 3) * u), SCREEN.color, e);
      }
    }

    function drawMonitor(st) {
      var X = -16.86, t = st.t;
      if (st.screen === 'off') return;
      qX(X, -0.4, 11.4, 17.4, 23.2, st.screen === 'boot' ? '#05070a' : '#0b0f17');
      if (st.screen === 'boot') {
        if (Math.floor(t / 350) % 2 === 0) discX(X + 0.01, 5.5, 20.4, 0.8, '#d8dde6');
        return;
      }
      if (st.screen === 'halt') {
        for (var h = 0; h < 6; h++) qX(X + 0.01, 11.0 - (2 + (h * 7) % 6), 11.0, 22.4 - h * 0.75, 22.7 - h * 0.75, '#ef4444');
        qX(X + 0.01, 2.0, 9.0, 17.9, 18.8, '#7f1d1d');
        glow(-16, 5.5, 20, 70, 'rgba(255,70,70,0.10)');
        return;
      }
      /* Tableau de bord façon Grafana */
      qX(X + 0.005, -0.2, 11.2, 22.6, 23.0, '#161d2a');
      for (var d = 0; d < 3; d++) px(P(X + 0.01, 10.8 - d * 0.4, 22.8), ['#ef4444', '#f2b33d', '#3ddc84'][d], 1);
      qX(X + 0.005, 5.9, 11.0, 19.8, 22.3, '#111827');
      var prev = null;
      for (var i = 0; i <= 16; i++) {
        var y = 10.8 - i * (4.7 / 16), v = 0.5 + 0.3 * Math.sin(i * 0.8 + t / 500) + 0.15 * Math.sin(i * 2.1 - t / 300);
        var q = P(X + 0.01, y, 20.0 + v * 2.0);
        if (prev) line(prev, q, '#3ddc84');
        prev = q;
      }
      qX(X + 0.005, 0.0, 5.5, 19.8, 22.3, '#111827');
      for (var b = 0; b < 6; b++) {
        var y0 = 5.2 - b * 0.85, hg = 0.4 + 1.6 * (0.5 + 0.5 * Math.sin(t / 700 + b * 1.3));
        qX(X + 0.01, y0 - 0.55, y0, 20.0, 20.0 + hg, '#5aa9ff');
      }
      if (SCREEN && st.screen !== 'typing') drawScreenText(X + 0.01);  // texte imposé (setScreenText) à la place des lignes de log
      else for (var l = 0; l < 3; l++) {
        var len = 2 + ((Math.floor(t / 400) + l * 5) % 6);
        var zl = 19.15 - l * 0.55;
        if (st.screen === 'typing' && l === 2) { len = Math.min(10.5, st.typed * 10.5); qX(X + 0.01, 11.0 - len, 11.0, zl, zl + 0.3, '#f2b33d'); }
        else qX(X + 0.01, 11.0 - len, 11.0, zl, zl + 0.3, '#5b6b82');
      }
      glow(-16, 5.5, 20, 72, 'rgba(110,160,255,' + (0.09 * (st.glow === undefined ? 1 : st.glow)).toFixed(3) + ')');
    }

    var KEYP = pal('#3b4048');
    function drawKeyboard(paws) {
      extrude(rrect(-12.6, 0.3, -9.6, 11.3, 0.4), DESK_TOP, DESK_TOP + 0.35, METAL);
      var keys = [];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 14; c++) keys.push([-12.1 + r * 0.9, 10.75 - c * 0.75]);
      keys.sort(function (a, b) { return a[0] + a[1] - b[0] - b[1]; });
      keys.forEach(function (k) {
        var hit = paws.some(function (p) { var r = p[3] || 0; return Math.abs(p[0] - k[0]) < 0.6 + r && Math.abs(p[1] - k[1]) < 0.55 + r; });
        var s = 0.31, sq = [[k[0] + s, k[1] + s], [k[0] - s, k[1] + s], [k[0] - s, k[1] - s], [k[0] + s, k[1] - s]];
        extrude(sq, DESK_TOP + 0.35, hit ? KB_TOP - 0.17 : KB_TOP, KEYP, hit ? '#f2b33d' : null);
      });
      extrude(rrect(-11.6, 12.7, -10.4, 13.8, 0.45), DESK_TOP, DESK_TOP + 0.4, METAL);
      px(P(-10.4, 13.25, DESK_TOP + 0.2), '#c93a3a', 1);
    }

    function drawMugSteam(t) {
      g.fillStyle = '#d9dde3';
      for (var w = 0; w < 2; w++) for (var k = 0; k < 9; k++) {
        var h = k / 9, flow = 0.5 + 0.5 * Math.sin(k * 0.9 - t / 240 + w * 2.4);
        g.globalAlpha = 0.35 * (1 - h) * Math.min(1, k / 2) * flow;
        if (g.globalAlpha < 0.03) continue;
        var sw = Math.sin(t / 650 + k * 0.5 + w * 1.8) * (0.2 + h);
        var q = P(-14.5 + sw * 0.6 + (w - 0.5) * 0.4, 14.2 - sw * 0.6, DESK_TOP + 2.0 + k * 0.55);
        g.fillRect(Math.round(q[0]), Math.round(q[1]), 1, 2);
      }
      g.globalAlpha = 1;
    }

    /* ================= Chat : modèle 3D (champ de distance + lancer de rayons) ================= */
    var D3 = 1 / Math.sqrt(3);
    var C_DK = STYLE.fur.map(hex2rgb);       // pelage principal
    var C_OR = STYLE.flecks.map(hex2rgb);    // mouchetures
    var C_CR = ['#4a3a2c', '#6e5845', '#937862', '#b59a80', '#cdb59a', '#e2ceb5'].map(hex2rgb);   // crème
    var C_PK = hex2rgb(STYLE.earInner);
    function hash3(x, y, z) { var h = Math.imul((x | 0) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul((y | 0) + 0x9e3779b9, 0x85ebca6b) ^ Math.imul((z | 0) + 0x632be5ab, 0xc2b2ae35); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; }
    function vnoise(x, y, z) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
      function L(a, b, t) { return a + (b - a) * t; }
      return L(L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
               L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
    }
    function fbm(x, y, z) { return vnoise(x, y, z); }
    var LIGHT = (function () { var v = [-0.3, 0.55, 0.78], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
    var CURL_SIGN = -1;
    var ID_BODY = 0, ID_NECK = 1, ID_HEAD = 2, ID_CHEEK = 3, ID_MUZ = 4, ID_EAR = 5, ID_LEG = 6, ID_PAW = 7, ID_TAIL = 8, ID_HAT = 9, ID_BRIM = 10, ID_POM = 11;
    var C_HAT = ['#0e0814', '#170d20', '#22132f', '#2e1a3f', '#3c2451', '#4b2f63'].map(hex2rgb);
    var C_BAND = ['#3a1a06', '#5e2c0c', '#8a4214', '#b5591c', '#d77327', '#ef9140'].map(hex2rgb);
    var HAT = HW || XM || STYLE.hat;
    var C_RED = ['#2a0606', '#4a0c0c', '#701515', '#982020', '#bd2e2a', '#d9463c'].map(hex2rgb);
    var C_SNOW = ['#7c8794', '#9aa5b1', '#b9c2cc', '#d3dae1', '#e6ebf0', '#f5f8fb'].map(hex2rgb);

    function prim(a, b, ra, rb, k, id, ex) {
      var p = { ax: a[0], ay: a[1], az: a[2], bx: b[0] - a[0], by: b[1] - a[1], bz: b[2] - a[2], ra: ra, rb: rb, k: k, id: id };
      p.bb = p.bx * p.bx + p.by * p.by + p.bz * p.bz;
      p.cx = a[0] + p.bx / 2; p.cy = a[1] + p.by / 2; p.cz = a[2] + p.bz / 2;
      p.R = Math.sqrt(p.bb) / 2 + Math.max(ra, rb) + k * 0.5 + 0.05;
      if (ex) for (var e in ex) p[e] = ex[e];
      return p;
    }
    /* Cylindre plat (bord du chapeau) : centre c, axe u, rayon r, demi-épaisseur hh */
    function primCyl(c, u, r, hh, k, id, ex) {
      var p = { cyl: true, ax: c[0], ay: c[1], az: c[2], ux: u[0], uy: u[1], uz: u[2], r: r, hh: hh, bx: 0, by: 0, bz: 0, bb: 0, ra: r, rb: r, k: k, id: id };
      p.cx = c[0]; p.cy = c[1]; p.cz = c[2]; p.R = Math.sqrt(r * r + hh * hh) + k * 0.5 + 0.05;
      if (ex) for (var e in ex) p[e] = ex[e];
      return p;
    }
    /* Triangle épais (oreille) : sommets a, b, c (c = pointe), épaisseur r */
    function primTri(a, b, c, r, k, id, ex) {
      var p = { tri: true, ax: a[0], ay: a[1], az: a[2], bx: 0, by: 0, bz: 0, bb: 0, ra: r, rb: r, k: k, id: id, A: a, B: b, C: c };
      p.cx = (a[0] + b[0] + c[0]) / 3; p.cy = (a[1] + b[1] + c[1]) / 3; p.cz = (a[2] + b[2] + c[2]) / 3;
      p.R = Math.max(vlen([a[0] - p.cx, a[1] - p.cy, a[2] - p.cz]), vlen([b[0] - p.cx, b[1] - p.cy, b[2] - p.cz]), vlen([c[0] - p.cx, c[1] - p.cy, c[2] - p.cz])) + r + k * 0.5 + 0.05;
      if (ex) for (var e in ex) p[e] = ex[e];
      return p;
    }
    function triDist(p, x, y, z) {
      var a = p.A, b = p.B, c = p.C;
      var bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2], pax = x - a[0], pay = y - a[1], paz = z - a[2];
      var cbx = c[0] - b[0], cby = c[1] - b[1], cbz = c[2] - b[2], pbx = x - b[0], pby = y - b[1], pbz = z - b[2];
      var acx = a[0] - c[0], acy = a[1] - c[1], acz = a[2] - c[2], pcx = x - c[0], pcy = y - c[1], pcz = z - c[2];
      var nx = bay * acz - baz * acy, ny = baz * acx - bax * acz, nz = bax * acy - bay * acx;
      function sg(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
      function crossDot(ux, uy, uz, qx, qy, qz) { return (uy * nz - uz * ny) * qx + (uz * nx - ux * nz) * qy + (ux * ny - uy * nx) * qz; }
      var inside = sg(crossDot(bax, bay, baz, pax, pay, paz)) + sg(crossDot(cbx, cby, cbz, pbx, pby, pbz)) + sg(crossDot(acx, acy, acz, pcx, pcy, pcz)) >= 2;
      var d2;
      if (!inside) {
        function seg(ux, uy, uz, qx, qy, qz) { var t = (ux * qx + uy * qy + uz * qz) / (ux * ux + uy * uy + uz * uz); t = t < 0 ? 0 : t > 1 ? 1 : t; var ex = ux * t - qx, ey = uy * t - qy, ez = uz * t - qz; return ex * ex + ey * ey + ez * ez; }
        d2 = Math.min(seg(bax, bay, baz, pax, pay, paz), seg(cbx, cby, cbz, pbx, pby, pbz), seg(acx, acy, acz, pcx, pcy, pcz));
      } else { var dn = nx * pax + ny * pay + nz * paz; d2 = dn * dn / (nx * nx + ny * ny + nz * nz); }
      /* hauteur relative vers la pointe (pour assombrir le bout) */
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2, hx = c[0] - mx, hy = c[1] - my, hz = c[2] - mz;
      var hh = ((x - mx) * hx + (y - my) * hy + (z - mz) * hz) / (hx * hx + hy * hy + hz * hz);
      PH_H = hh < 0 ? 0 : hh > 1 ? 1 : hh;
      return Math.sqrt(d2) - p.ra;
    }
    var PH_H = 0;                                   // paramètre le long de la primitive (0 à 1), mis à jour par pdist
    function pdist(p, x, y, z) {
      if (p.tri) return triDist(p, x, y, z);
      var ax = x - p.ax, ay = y - p.ay, az = z - p.az;
      if (p.cyl) {
        var t = ax * p.ux + ay * p.uy + az * p.uz, rx = ax - p.ux * t, ry = ay - p.uy * t, rz = az - p.uz * t;
        var d1 = Math.sqrt(rx * rx + ry * ry + rz * rz) - p.r, d2 = Math.abs(t) - p.hh;
        PH_H = (t + p.hh) / (2 * p.hh);
        var o1 = d1 > 0 ? d1 : 0, o2 = d2 > 0 ? d2 : 0;
        return Math.min(Math.max(d1, d2), 0) + Math.sqrt(o1 * o1 + o2 * o2) - 0.02;
      }
      var h = p.bb > 0 ? (ax * p.bx + ay * p.by + az * p.bz) / p.bb : 0;
      h = h < 0 ? 0 : h > 1 ? 1 : h;
      PH_H = h;
      var dx = ax - p.bx * h, dy = ay - p.by * h, dz = az - p.bz * h;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - (p.ra + (p.rb - p.ra) * h);
    }
    function vadd(a, b, s) { return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]; }
    function vlen(a) { return Math.hypot(a[0], a[1], a[2]); }
    function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    var STD = { ax: 1, ay: 1, az: 1, bx: 1, by: 1, bz: 1, ra: 1, rb: 1, k: 1, id: 1, bb: 1, cx: 1, cy: 1, cz: 1, R: 1, cyl: 1, ux: 1, uy: 1, uz: 1, r: 1, hh: 1, tri: 1, A: 1, B: 1, C: 1 };
    /* Rotation d'un point autour d'un axe (Rodrigues) */
    function rotAxis(p, C, u, th) {
      var vx = p[0] - C[0], vy = p[1] - C[1], vz = p[2] - C[2], c = Math.cos(th), s = Math.sin(th), d = (u[0] * vx + u[1] * vy + u[2] * vz) * (1 - c);
      return [C[0] + vx * c + (u[1] * vz - u[2] * vy) * s + u[0] * d, C[1] + vy * c + (u[2] * vx - u[0] * vz) * s + u[1] * d, C[2] + vz * c + (u[0] * vy - u[1] * vx) * s + u[2] * d];
    }

    /* Construit les primitives du chat à partir d'une pose */
    function buildCat(q, t) {
      var prims = [], info = { paws: [] };
      var cs = CURL_SIGN * q.curl * 1.25, seg = 1.0 * q.stretch;
      var cp = Math.cos(q.pitch), sp = Math.sin(q.pitch);
      var pts = [[0, 0, 0]], yaws = [], i;
      for (i = 0; i < 3; i++) {
        var yw = q.h + (i - 1) * cs; yaws.push(yw);
        var l = pts[i];
        pts.push([l[0] + Math.cos(yw) * cp * seg, l[1] + Math.sin(yw) * cp * seg, l[2] + sp * seg]);
      }
      var mx = 0, my = 0, mz = 0;
      pts.forEach(function (p) { mx += p[0]; my += p[1]; mz += p[2]; });
      mx /= 4; my /= 4; mz /= 4;
      var br = q.breath * 0.05 * Math.sin(t / 700);
      pts = pts.map(function (p) { return [q.x + p[0] - mx, q.y + p[1] - my, q.z + q.bodyZ + br + p[2] - mz]; });
      info.spine = pts; info.root = [q.x, q.y, q.z, q.h]; info.bodyUp = [0, 0, 1];

      /* Corps : 3 segments arrondis */
      var rs = [0.92 + br, 0.98 + br, 1.0 + br, 0.97 + br];
      for (i = 0; i < 3; i++) prims.push(prim(pts[i], pts[i + 1], rs[i], rs[i + 1], 0.5, ID_BODY, { s0: i * seg, len: seg, chest: i === 2, fx: Math.cos(yaws[i]), fy: Math.sin(yaws[i]) }));

      /* Tête */
      var yE = yaws[2] + cs * 0.9, yH = yE + q.headYaw, hp = q.headPitch;
      var fH = [Math.cos(yH) * Math.cos(hp), Math.sin(yH) * Math.cos(hp), Math.sin(hp)];
      var sH = [-Math.sin(yH), Math.cos(yH), 0];
      var upH = [-Math.cos(yH) * Math.sin(hp), -Math.sin(yH) * Math.sin(hp), Math.cos(hp)];
      var ch = pts[3], nd = [Math.cos(yE), Math.sin(yE), 0];
      var hc = [ch[0] + nd[0] * 1.2 + fH[0] * 0.15, ch[1] + nd[1] * 1.2 + fH[1] * 0.15, ch[2] + 0.95 + q.headLift];
      prims.push(prim(vadd(vadd(ch, nd, 0.3), [0, 0, 1], 0.2), hc, 0.72, 0.6, 0.35, ID_NECK, { fx: fH[0], fy: fH[1] }));
      var hl0 = vadd(hc, sH, -0.2), hr0 = vadd(hc, sH, 0.2);
      prims.push(prim(hl0, hr0, 0.93, 0.93, 0.3, ID_HEAD));               // crâne large (tête de chat, pas de rongeur)
      [-1, 1].forEach(function (s) {
        var c = vadd(vadd(vadd(hc, sH, s * 0.52), upH, -0.32), fH, 0.2);
        prims.push(prim(c, c, 0.6, 0.6, 0.25, ID_CHEEK));
      });
      var mz2 = vadd(vadd(hc, fH, 0.7), upH, -0.34);                     // museau court, légèrement en avant
      var br0 = vadd(vadd(hc, fH, 0.56), upH, 0.06), br1 = vadd(vadd(mz2, upH, 0.13), fH, 0.06);
      prims.push(prim(br0, br1, 0.2, 0.17, 0.2, ID_MUZ));                  // arête du nez (relief entre les yeux et le nez)
      [-1, 1].forEach(function (s) {                                       // arcades au-dessus des yeux
        var bw = vadd(vadd(vadd(hc, fH, 0.58), sH, s * 0.42), upH, 0.32);
        prims.push(prim(bw, bw, 0.28, 0.28, 0.25, ID_HEAD));
      });
      [-1, 1].forEach(function (s) {                                       // deux coussinets de moustaches
        var wp = vadd(vadd(mz2, sH, s * 0.15), fH, 0.06);
        prims.push(prim(wp, wp, 0.23, 0.23, 0.18, ID_MUZ));
      });
      var chin = vadd(vadd(mz2, upH, -0.2), fH, -0.04);
      prims.push(prim(chin, chin, 0.17, 0.17, 0.15, ID_MUZ));
      info.muzzle = mz2;
      var eb = q.earsBack;
      [-1, 1].forEach(function (s) {
        /* Oreille plate et pointue : base large sur le crâne, pointe vers le haut */
        var b1 = vadd(vadd(vadd(hc, upH, 0.72), sH, s * 0.28), fH, 0.02);
        var b2 = vadd(vadd(vadd(hc, upH, 0.5), sH, s * 0.9), fH, -0.06);
        var tp = vadd(vadd(vadd(hc, upH, 1.48 - 0.5 * eb), sH, s * (0.8 + 0.3 * eb)), fH, -(0.1 + 0.5 * eb));
        prims.push(primTri(b1, b2, tp, 0.1, 0.08, ID_EAR));
      });
      if (HAT && XM) {                              // bonnet de père Noël qui retombe sur le côté
        var sx0 = vadd(vadd(upH, fH, -0.25), sH, 0.1), sl = vlen(sx0); sx0 = [sx0[0] / sl, sx0[1] / sl, sx0[2] / sl];
        var sb = vadd(vadd(hc, upH, 0.78), fH, -0.08);
        prims.push(primCyl(sb, sx0, 0.98, 0.14, 0.06, ID_BRIM));
        var s1 = vadd(sb, sx0, 0.75), s2 = vadd(vadd(vadd(sb, sx0, 1.05), fH, -0.5), sH, 0.35);
        prims.push(prim(vadd(sb, sx0, 0.1), s1, 0.62, 0.36, 0.05, ID_HAT, { s0: 0 }));
        prims.push(prim(s1, s2, 0.36, 0.12, 0.05, ID_HAT, { s0: 1 }));
        prims.push(prim(s2, s2, 0.24, 0.24, 0.05, ID_POM));
      } else if (HAT) {                             // chapeau de sorcière légèrement penché
        var hx = vadd(vadd(upH, fH, -0.22), sH, 0.14), hl = vlen(hx); hx = [hx[0] / hl, hx[1] / hl, hx[2] / hl];
        var hb = vadd(vadd(hc, upH, 0.82), fH, -0.08);
        prims.push(primCyl(hb, hx, 1.08, 0.05, 0.04, ID_BRIM));
        var m1 = vadd(hb, hx, 0.95), tipH = vadd(vadd(hb, hx, 1.42), fH, -0.42);
        prims.push(prim(vadd(hb, hx, 0.04), m1, 0.6, 0.3, 0.04, ID_HAT, { s0: 0 }));
        prims.push(prim(m1, tipH, 0.3, 0.06, 0.04, ID_HAT, { s0: 1 }));
      }
      info.head = hc; info.fH = fH; info.sH = sH; info.upH = upH;
      info.eyes = [-1, 1].map(function (s) { return vadd(vadd(vadd(hc, fH, 0.86), sH, s * 0.44), upH, 0.08); });
      info.nose = vadd(vadd(hc, fH, 1.02), upH, -0.19);
      info.mouth = vadd(vadd(hc, fH, 0.96), upH, -0.47);

      /* Pattes : cinématique inverse à 2 os */
      [[1, 1, 0.5 * Math.PI], [1, -1, 1.5 * Math.PI], [0, 1, 0], [0, -1, Math.PI]].forEach(function (lg) {
        var front = lg[0] === 1, s = lg[1];
        var bp = front ? pts[3] : pts[0], yw = front ? yaws[2] : yaws[0];
        var f = [Math.cos(yw), Math.sin(yw), 0], sv = [-Math.sin(yw), Math.cos(yw), 0];
        var J = vadd(vadd(vadd(bp, f, front ? -0.15 : 0.25), sv, s * (front ? 0.45 : 0.5)), [0, 0, 1], front ? -0.45 : -0.35);
        var paw = front ? (s > 0 ? q.pawL : q.pawR) : 0;
        var reach = (front ? q.frontReach : q.backReach) + paw * 0.45, lift = (front ? q.frontLift : q.backLift) + paw;
        var ph = q.walkPh + lg[2];
        var G = vadd([J[0], J[1], q.z + 0.32 + lift], f, reach + Math.sin(ph) * 0.75 * q.walk);
        G[2] += Math.max(0, Math.cos(ph)) * 0.6 * q.walk;
        var tk = front ? q.frontTuck : q.backTuck;
        var T0 = vadd([J[0], J[1], q.z + 0.3], f, front ? 0.75 : 0.95);
        var A = vadd(vadd(J, f, reach), [0, 0, 1], -(front ? q.frontDrop : q.backDrop));
        var T = [0, 1, 2].map(function (k) { var v = G[k] + (T0[k] - G[k]) * tk; return v + (A[k] - v) * q.air; });
        var a = front ? 1.12 : 1.2, b = front ? 1.12 : 1.28;
        var v = [T[0] - J[0], T[1] - J[1], T[2] - J[2]], d = vlen(v);
        if (d > a + b - 0.02) { T = vadd(J, v, (a + b - 0.02) / d); d = a + b - 0.02; v = [T[0] - J[0], T[1] - J[1], T[2] - J[2]]; }
        var knee = T;
        if (d > 0.05) {
          var vh = [v[0] / d, v[1] / d, v[2] / d], along = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - along * along));
          var bend = front ? [-f[0], -f[1], 0] : [f[0], f[1], 0], bd = vadd(bend, vh, -vdot(bend, vh)), bl = vlen(bd) || 1;
          knee = vadd(vadd(J, vh, along), bd, hh / bl);
        }
        prims.push(prim(J, knee, front ? 0.32 : 0.44, front ? 0.27 : 0.3, 0.16, ID_LEG, { s0: 0, len: a, li: lg[2] }));
        prims.push(prim(knee, T, 0.25, 0.22, 0.1, ID_LEG, { s0: a, len: b, li: lg[2] }));
        prims.push(prim(T, T, 0.32, 0.32, 0.1, ID_PAW, { fx: f[0], fy: f[1] }));
        if (T[2] < q.z + 0.6 && q.air < 0.5) info.paws.push(T);
      });

      /* Roulade : tout le corps tourne autour de son axe ; la queue reste au sol */
      if (q.roll) {
        var C = [(pts[0][0] + pts[3][0]) / 2, (pts[0][1] + pts[3][1]) / 2, q.z + q.bodyZ], U = [Math.cos(q.h), Math.sin(q.h), 0];
        var rp = function (p) { return rotAxis(p, C, U, q.roll); }, rv = function (v) { return rotAxis(v, [0, 0, 0], U, q.roll); };
        prims = prims.map(function (p) {
          if (p.tri) { var ta = rp(p.A), tb = rp(p.B), tc = rp(p.C); return primTri(ta, tb, tc, p.ra, p.k, p.id); }
          if (p.cyl) { var cc = rp([p.ax, p.ay, p.az]); if (cc[2] < q.z + 0.15) cc[2] = q.z + 0.15; return primCyl(cc, rv([p.ux, p.uy, p.uz]), p.r, p.hh, p.k, p.id); }
          var A = rp([p.ax, p.ay, p.az]), B = rp([p.ax + p.bx, p.ay + p.by, p.az + p.bz]);
          if (A[2] < q.z + p.ra * 0.6) A[2] = q.z + p.ra * 0.6;
          if (B[2] < q.z + p.rb * 0.6) B[2] = q.z + p.rb * 0.6;
          var ex = {}; for (var k in p) if (STD[k] === undefined) ex[k] = p[k];
          return prim(A, B, p.ra, p.rb, p.k, p.id, ex);
        });
        info.spine = info.spine.map(rp); info.head = rp(info.head); info.eyes = info.eyes.map(rp);
        info.nose = rp(info.nose); info.mouth = rp(info.mouth); info.muzzle = rp(info.muzzle); info.paws = info.paws.map(rp);
        info.fH = rv(info.fH); info.sH = rv(info.sH); info.upH = rv(info.upH);
        info.rollC = C; info.rollU = U; info.roll = q.roll; info.bodyUp = rv([0, 0, 1]);
      }

      /* Queue : chaîne de segments (balancement, enroulement) */
      var hip = pts[0], ty = yaws[0] + Math.PI, prev = [hip[0] - Math.cos(yaws[0]) * 0.85, hip[1] - Math.sin(yaws[0]) * 0.85, hip[2] + 0.15];
      var tr = [0.38, 0.42, 0.43, 0.42, 0.4, 0.37, 0.33, 0.27], L = 0;
      for (i = 0; i < 7; i++) {
        ty += -CURL_SIGN * q.tailWrap * 0.38 + Math.sin(t / 430 * q.swayF + i * 0.65) * 0.06 * i * q.sway / 4;
        var tp = (q.tailUp + i * q.tailCurl * 0.22) * (1 - q.tailWrap) + (-0.06) * q.tailWrap;
        var dir = [Math.cos(ty) * Math.cos(tp), Math.sin(ty) * Math.cos(tp), Math.sin(tp)];
        var nx2 = vadd(prev, dir, 0.48);
        if (nx2[2] < q.z + 0.3) nx2[2] = q.z + 0.3;
        prims.push(prim(prev, nx2, tr[i], tr[i + 1], i === 0 ? 0.3 : 0.1, ID_TAIL, { s0: L, len: 0.48, tip: i >= 5 }));
        L += 0.48; prev = nx2;
      }
      return { prims: prims, info: info, q: q };
    }

    /* ---- Évaluation du champ de distance ---- */
    var LIST = new Int32Array(64);
    function sdf(pr, n, x, y, z) {
      var d = 1e9;
      for (var i = 0; i < n; i++) {
        var p = pr[LIST[i]], di = pdist(p, x, y, z);
        if (i === 0) d = di;
        else { var k = p.k, w = k - Math.abs(d - di); d = (d < di ? d : di) - (w > 0 ? w * w / (4 * k) : 0); }
      }
      return d;
    }
    function frac(v) { return v - Math.floor(v); }

    /* Couleur d'un point de surface : écaille de tortue (noir-brun marbré de caramel), liseré roux sur le nez */
    function surfColor(pr, n, x, y, z, nx, ny, nz, info, sx, sy) {
      var best = 1e9, bp = null, bh = 0, i;
      for (i = 0; i < n; i++) {
        var p = pr[LIST[i]], di = pdist(p, x, y, z);
        if (di < best) { best = di; bp = p; bh = PH_H; }
      }
      /* Chapeau de sorcière : violet nuit, bande orange */
      if (bp.id === ID_HAT || bp.id === ID_BRIM || bp.id === ID_POM) {
        var lam0 = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], rim0 = 1 - Math.max(0, (nx + ny + nz) * D3);
        var v0 = 0.22 + 0.7 * (lam0 > 0 ? lam0 : 0) + 0.3 * rim0 * rim0 * rim0;
        if (XM) v0 += (hash3(Math.floor(x * 9), Math.floor(y * 9), Math.floor(z * 9)) - 0.5) * (bp.id === ID_HAT ? 0.06 : 0.18);   // fourrure
        var hp = XM ? (bp.id === ID_HAT ? C_RED : C_SNOW) : (bp.id === ID_HAT && bp.s0 === 0 && bh < 0.24) ? C_BAND : C_HAT;
        return hp[Math.min(5, Math.max(0, Math.floor(v0 * 6)))];
      }
      /* Coordonnées locales au chat : le motif suit l'animal */
      /* Coordonnées attachées à chaque partie du corps : les taches suivent tous les mouvements */
      var lx, ly, lz, dxh = x - info.head[0], dyh = y - info.head[1], dzh = z - info.head[2];
      if (bp.id === ID_HEAD || bp.id === ID_CHEEK || bp.id === ID_MUZ || bp.id === ID_EAR) {
        lx = dxh * info.fH[0] + dyh * info.fH[1] + dzh * info.fH[2];
        ly = dxh * info.sH[0] + dyh * info.sH[1] + dzh * info.sH[2];
        lz = dxh * info.upH[0] + dyh * info.upH[1] + dzh * info.upH[2] + 20;
      } else if (bp.id === ID_PAW) {
        lx = x - bp.ax; ly = y - bp.ay; lz = z - bp.az + 40;
      } else {
        /* Coordonnées cylindriques autour de l'axe du segment (le long + autour) */
        var bl = Math.sqrt(bp.bb) || 1, ux = bp.bx / bl, uy = bp.by / bl, uz = bp.bz / bl;
        var cx = bp.ax + bp.bx * bh, cy = bp.ay + bp.by * bh, cz = bp.az + bp.bz * bh, rx = x - cx, ry = y - cy, rz = z - cz;
        var up = info.bodyUp, ud = up[0] * ux + up[1] * uy + up[2] * uz;
        var ax = up[0] - ux * ud, ay = up[1] - uy * ud, az = up[2] - uz * ud, al = Math.hypot(ax, ay, az);
        if (al < 0.2) { ax = info.sH[0]; ay = info.sH[1]; az = info.sH[2]; al = 1; }
        ax /= al; ay /= al; az /= al;
        var sx2 = uy * az - uz * ay, sy2 = uz * ax - ux * az, sz2 = ux * ay - uy * ax;
        lx = (bp.s0 || 0) + bh * (bp.len || bl);
        ly = Math.atan2(rx * sx2 + ry * sy2 + rz * sz2, rx * ax + ry * ay + rz * az) * 1.1;
        lz = bp.id * 13 + (bp.li || 0) * 3;
      }
      var noise = fbm(lx * 1.6 + 3.1, ly * 1.6 + 7.3, lz * 1.6);
      var pix = hash3(Math.floor(lx * 4.5), Math.floor(ly * 4.5), Math.floor(lz * 4.5));
      var palt = C_DK, shift = 0, earLift = false;
      var fa = STYLE.flecksAmount;
      if (fa > 0 && noise > 1 - 0.22 * fa && pix > 0.35) palt = C_OR;           // petites taches
      else if (fa > 0 && noise > 1 - 0.38 * fa && pix > 0.72) palt = C_OR;      // mouchetures fines
      else if (fa > 0 && pix > 1 - 0.035 * fa) palt = C_OR;                     // poils clairs épars
      var up = nx * info.upH[0] + ny * info.upH[1] + nz * info.upH[2];
      var fw = nx * info.fH[0] + ny * info.fH[1] + nz * info.fH[2];
      switch (bp.id) {
        case ID_HEAD: case ID_MUZ: case ID_CHEEK:
          var sd = (x - info.head[0]) * info.sH[0] + (y - info.head[1]) * info.sH[1];
          if (palt === C_OR && fw > 0.2) palt = C_DK;                             // face bien sombre
          break;
        case ID_EAR:
          palt = C_DK; earLift = true;
          if (fw > 0.35 && bh < 0.6) { var li = 0.45 + 0.55 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]); return C_PK.map(function (c) { return c * li; }); }
          break;
        case ID_PAW:
          palt = C_DK;
          if (nx * bp.fx + ny * bp.fy > 0.1 && nz < 0.4 && pix > 0.45) palt = C_CR;  // doigts clairs mouchetés
          break;
        case ID_TAIL: if (bp.tip && bh > 0.4) palt = C_DK; break;
      }
      var lam = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      var rim = 1 - Math.max(0, (nx + ny + nz) * D3);
      var v = 0.14 + 0.82 * (lam > 0 ? lam : 0) + 0.4 * rim * rim * rim + (hash3(Math.floor(lx * 9), Math.floor(ly * 9), Math.floor(lz * 9) + 7) - 0.5) * 0.06;   // + reflet de bord + texture de poil
      if (earLift) v = 0.3 + 0.7 * v;                                           // dos de l'oreille jamais noir (sinon on lit un trou)
      var idx = Math.min(5, Math.max(0, Math.floor(v * 6) - shift));
      return palt[idx];
    }

    /* ---- Rendu par lancer de rayons (caméra orthographique le long de (1,1,1)) ---- */
    var CW = 420, CHh = 320;
    var catCv = document.createElement('canvas'); catCv.width = CW; catCv.height = CHh;
    var catCtx = catCv.getContext('2d');
    var SB = new Float32Array(CW * CHh), MK = new Uint8Array(CW * CHh);

    function renderCat(cat) {
      var pr = cat.prims, n = pr.length, i;
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (i = 0; i < n; i++) {
        var s = P(pr[i].cx, pr[i].cy, pr[i].cz), r = pr[i].R * K * 1.2 + 2;
        if (s[0] - r < x0) x0 = s[0] - r; if (s[0] + r > x1) x1 = s[0] + r;
        if (s[1] - r < y0) y0 = s[1] - r; if (s[1] + r > y1) y1 = s[1] + r;
      }
      x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
      x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
      var w = Math.min(CW, x1 - x0), h = Math.min(CHh, y1 - y0);
      if (w <= 0 || h <= 0) return null;
      var img = catCtx.createImageData(w, h), data = img.data;
      MK.fill(0, 0, w * h);

      for (var py = 0; py < h; py++) {
        for (var qx = 0; qx < w; qx++) {
          var u = (x0 + qx + 0.5 - OX) / K, ww = (y0 + py + 0.5 - OY) / K;
          var ox = ww + u / 2, oy = ww - u / 2, m = 0, sMax = -1e9, sMin = 1e9;
          for (i = 0; i < n; i++) {
            var p = pr[i], cx = p.cx - ox, cy = p.cy - oy, cz = p.cz;
            var sc = (cx + cy + cz) * D3, d2 = cx * cx + cy * cy + cz * cz - sc * sc;
            if (d2 < p.R * p.R) { LIST[m++] = i; if (sc + p.R > sMax) sMax = sc + p.R; if (sc - p.R < sMin) sMin = sc - p.R; }
          }
          if (!m) continue;
          var st = sMax, hit = false, X = 0, Y = 0, Z = 0;
          for (var it = 0; it < 48; it++) {
            X = ox + st * D3; Y = oy + st * D3; Z = st * D3;
            var d = sdf(pr, m, X, Y, Z);
            if (d < 0.012) { hit = true; break; }
            st -= d * 0.92 + 0.002;
            if (st < sMin) break;
          }
          if (!hit) continue;
          var e = 0.03;
          var f0 = sdf(pr, m, X + e, Y - e, Z - e), f1 = sdf(pr, m, X - e, Y - e, Z + e);
          var f2 = sdf(pr, m, X - e, Y + e, Z - e), f3 = sdf(pr, m, X + e, Y + e, Z + e);
          var nx = f0 - f1 - f2 + f3, ny = -f0 - f1 + f2 + f3, nz = -f0 + f1 - f2 + f3, nl = Math.hypot(nx, ny, nz) || 1;
          var col = surfColor(pr, m, X, Y, Z, nx / nl, ny / nl, nz / nl, cat.info, x0 + qx, y0 + py);
          var o = (py * w + qx) * 4;
          data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
          MK[py * w + qx] = 1; SB[py * w + qx] = st;
        }
      }
      /* Contour sombre d'un pixel */
      for (py = 0; py < h; py++) for (qx = 0; qx < w; qx++) {
        var k = py * w + qx;
        if (MK[k]) continue;
        if ((qx > 0 && MK[k - 1]) || (qx < w - 1 && MK[k + 1]) || (py > 0 && MK[k - w]) || (py < h - 1 && MK[k + w])) {
          var o2 = k * 4; data[o2] = 8; data[o2 + 1] = 5; data[o2 + 2] = 4; data[o2 + 3] = 110;
        }
      }
      catCtx.putImageData(img, 0, 0);
      ctx.drawImage(catCv, 0, 0, w, h, x0, y0, w, h);
      return { x0: x0, y0: y0, w: w, h: h };
    }

    /* Yeux, nez et bouche, dessinés seulement s'ils sont visibles (test de profondeur) */
    function drawFace(cat, bx) {
      if (!bx) return;
      function vis(p) {
        var s = P(p[0], p[1], p[2]), ix = Math.floor(s[0]), iy = Math.floor(s[1]);
        var lx = ix - bx.x0, ly = iy - bx.y0;
        if (lx < 0 || ly < 0 || lx >= bx.w || ly >= bx.h) return null;
        var k = ly * bx.w + lx;
        if (!MK[k]) return null;
        var u = (ix + 0.5 - OX) / K, ww = (iy + 0.5 - OY) / K, ox = ww + u / 2, oy = ww - u / 2;
        if (((p[0] - ox) + (p[1] - oy) + p[2]) * D3 < SB[k] - 0.3) return null;
        return [ix, iy];
      }
      var q = cat.q, inf = cat.info, E = Math.max(1, Math.round(K / 4));
      if (inf.fH[0] + inf.fH[1] + inf.fH[2] < -0.5) return;
      inf.eyes.forEach(function (e) {
        var v = vis(e); if (!v) return;
        var ew = E > 1 ? 2 * E : 2, eh = E > 1 ? 2 * E - 1 : 1, ex = v[0] - (ew >> 1), ey = v[1] - (eh >> 1);
        if (q.eyes > 0.6) {
          if (E > 1) {                                              // œil en amande tracé dans le plan du visage
            var ep = function (a, b) { var r = vadd(vadd(vadd(e, inf.sH, a), inf.upH, b), inf.fH, 0.03); return P(r[0], r[1], r[2]); };
            var ring = function (w, h, n) { var o = []; for (var k = 0; k < n; k++) { var t = k / n * 6.2832, c = Math.cos(t); o.push(ep(c * w, Math.sin(t) * h * (1 - 0.18 * c * c))); } return o; };
            fillPoly(ring(0.235, 0.17, 22), STYLE.pupil);           // contour
            fillPoly(ring(0.2, 0.14, 22), STYLE.eyes);             // iris
            fillPoly(ring(0.05, 0.125, 12), STYLE.pupil);             // pupille fendue
            var hl = ep(-0.09, 0.06); ctx.fillStyle = '#eafffb'; ctx.fillRect(Math.round(hl[0]), Math.round(hl[1]), Math.max(1, E >> 2), Math.max(1, E >> 2));
          } else { ctx.fillStyle = STYLE.eyes; ctx.fillRect(ex, ey, ew, eh); }
        }
        else {
          /* Paupières en 3D : petit arc qui suit l'orientation de la tête (et plus un rectangle à l'écran) */
          var hw = 0.17, half = q.eyes > 0.25;
          var A = vadd(vadd(e, inf.sH, -hw), inf.upH, 0.03), M = vadd(e, inf.upH, half ? 0.0 : -0.05), B = vadd(vadd(e, inf.sH, hw), inf.upH, 0.03);
          var pa = P(A[0], A[1], A[2]), pm = P(M[0], M[1], M[2]), pb = P(B[0], B[1], B[2]);
          if (half) {                                              // mi-clos : un trait de couleur sous la paupière
            var off = Math.max(1, E >> 1);
            line([pa[0], pa[1] + off], [pm[0], pm[1] + off], STYLE.eyesHalf); line([pm[0], pm[1] + off], [pb[0], pb[1] + off], STYLE.eyesHalf);
          }
          for (var th = 0; th < (E > 2 ? 2 : 1); th++) {
            line([pa[0], pa[1] + th], [pm[0], pm[1] + th], STYLE.eyesShut); line([pm[0], pm[1] + th], [pb[0], pb[1] + th], STYLE.eyesShut);
          }
        }
      });
      var ns = vis(inf.nose);
      if (ns) {
        var nv = function (a, b) { var r = vadd(vadd(inf.nose, inf.sH, a), inf.upH, b); return P(r[0], r[1], r[2]); };
        if (E > 1) {
          fillPoly([nv(-0.1, 0.05), nv(0.1, 0.05), nv(0, -0.07)], STYLE.nose);            // nez triangulaire
          var mc = '#2c211c';                                                                // bouche : petit trait puis deux arcs
          line(nv(0, -0.07), nv(0, -0.15), mc);
          line(nv(0, -0.15), nv(-0.07, -0.19), mc); line(nv(-0.07, -0.19), nv(-0.14, -0.15), mc);
          line(nv(0, -0.15), nv(0.07, -0.19), mc); line(nv(0.07, -0.19), nv(0.14, -0.15), mc);
          ctx.fillStyle = '#3a2d26';                                                         // points des moustaches
          [-1, 1].forEach(function (s) { [[0.13, -0.08], [0.2, -0.12], [0.15, -0.16]].forEach(function (d) { var q = nv(s * d[0], d[1]); ctx.fillRect(Math.round(q[0]), Math.round(q[1]), 1, 1); }); });
        } else { ctx.fillStyle = STYLE.nose; ctx.fillRect(ns[0], ns[1], 1, 1); }
      }
      /* Moustaches : 3 de chaque côté, partent du museau */
      if (inf.muzzle) {
        var big = K >= 8, wl = big ? 1.15 : 0.8;
        ctx.globalAlpha = big ? 0.32 : 0.22;
        [-1, 1].forEach(function (s) {
          var o = vadd(vadd(inf.muzzle, inf.sH, s * 0.28), inf.fH, 0.12);
          if (!vis(vadd(inf.muzzle, inf.fH, 0.3))) return;
          [0.18, 0, -0.18].forEach(function (u) {
            var e = vadd(vadd(vadd(o, inf.sH, s * wl), inf.fH, 0.25 * wl), inf.upH, u);
            var a = P(o[0], o[1], o[2]), b = P(e[0], e[1], e[2]);
            line(a, b, '#b9b2a8');
          });
        });
        ctx.globalAlpha = 1;
      }
      if (q.mouth > 0.3) {
        var mo = vis(inf.mouth);
        if (mo) {
          var mp = function (a, b) { var r = vadd(vadd(vadd(inf.mouth, inf.sH, a), inf.upH, b), inf.fH, 0.08); return P(r[0], r[1], r[2]); };
          var ow = 0.2, oh = 0.08 + 0.2 * q.mouth, rimPts = [], inPts = [], tongue = [];
          for (var k = 0; k < 16; k++) { var t = k / 16 * 6.2832; rimPts.push(mp(Math.cos(t) * ow, Math.sin(t) * oh)); inPts.push(mp(Math.cos(t) * ow * 0.78, Math.sin(t) * oh * 0.75)); }
          fillPoly(rimPts, '#1a0d0c'); fillPoly(inPts, '#5a1c22');
          for (k = 0; k < 10; k++) { var t2 = Math.PI + k / 9 * Math.PI; tongue.push(mp(Math.cos(t2) * ow * 0.55, -oh * 0.25 + Math.sin(t2) * oh * 0.55)); }
          fillPoly(tongue, '#d77a88');
          if (E > 1) { ctx.fillStyle = '#eee8dc'; [-1, 1].forEach(function (s) { var f = mp(s * ow * 0.55, oh * 0.6); ctx.fillRect(Math.round(f[0]), Math.round(f[1]), 1, 2); }); }   // petits crocs
        }
      }
    }

    /* Ombre portée sur la surface sous le chat */
    var shCv = layer(), shCtx = shCv.getContext('2d');
    function surfAt(x, y) {
      if (x >= 4 && x <= 16 && y >= -20 && y <= -10) return RACK_TOP;
      if (x >= -12.6 && x <= -9.6 && y >= 0.3 && y <= 11.3) return KB_TOP;
      if (x >= -20 && x <= -8 && y >= -6 && y <= 18) return DESK_TOP;
      return 0;
    }
    function drawCatShadow(cat) {
      var pts = cat.info.spine.concat([cat.info.head]);
      shCtx.clearRect(0, 0, W, H);
      var save = g; g = shCtx;
      var hsum = 0;
      var n = 0;
      pts.forEach(function (p) {
        var sz = surfAt(p[0], p[1]), hgt = Math.max(0, p[2] - sz - 1.0);
        if (hgt > 4.5) return;                         // trop haut : pas d'ombre projetée loin en dessous
        hsum += hgt; n++;
        flat(circle(p[0], p[1], Math.max(0.6, 1.45 - hgt * 0.1), 12), sz + 0.02, '#000');
      });
      if (!n) { g = save; return; }
      g = save;
      ctx.globalAlpha = Math.max(0.1, 0.32 - hsum / n * 0.05);
      ctx.drawImage(shCv, 0, 0);
      ctx.globalAlpha = 1;
    }

    /* "Z" qui s'envolent */
    function drawZzz(o, t, amt) {
      if (amt <= 0) return;
      for (var k = 0; k < 3; k++) {
        var life = (t / 1600 + k / 3) % 1, q = P(o[0] + life * 1.5, o[1] - life * 1.5, o[2] + 2.4 + life * 5.5);
        var c = (life > 0.5 ? 2 : 1) * Math.max(1, Math.round(K / 4)), x = Math.round(q[0]), y = Math.round(q[1]);
        ctx.globalAlpha = Math.min(1, Math.sin(life * Math.PI) * 1.3) * amt;
        ctx.fillStyle = '#cfd8ea';
        ctx.fillRect(x, y, 3 * c, c); ctx.fillRect(x + 2 * c, y + c, c, c); ctx.fillRect(x + c, y + 2 * c, c, c);
        ctx.fillRect(x, y + 3 * c, c, c); ctx.fillRect(x, y + 4 * c, 3 * c, c);
      }
      ctx.globalAlpha = 1;
    }

    /* ================= Poses du chat ================= */
    var BASE = { bodyZ: 2.6, pitch: 0, curl: 0, stretch: 1, headLift: 0.45, headPitch: 0, headYaw: 0,
      frontReach: 0, backReach: 0, frontLift: 0, backLift: 0, frontTuck: 0, backTuck: 0, air: 0, frontDrop: 1.6, backDrop: 1.6, pawL: 0, pawR: 0,
      tailUp: 1.1, tailCurl: 0.35, tailWrap: 0, sway: 1, swayF: 1, eyes: 1, mouth: 0, earsBack: 0, walk: 0, breath: 0, roll: 0 };
    function pose(o, from) { var r = {}, k; for (k in BASE) r[k] = (from || BASE)[k]; for (k in o) r[k] = o[k]; return r; }
    function mixP(a, b, t) { var r = {}; for (var k in BASE) r[k] = a[k] + (b[k] - a[k]) * t; return r; }

    var STAND = pose({});
    var WALK = pose({ walk: 1, headLift: 0.35 });
    var SLEEP = pose({ bodyZ: 0.95, curl: 1, headLift: -0.12, headPitch: -0.22, headYaw: 0.75, earsBack: 0.6, frontTuck: 1, backTuck: 1, tailUp: -0.1, tailCurl: 0, tailWrap: 1, sway: 0.25, swayF: 0.6, eyes: 0, breath: 1 });
    var AWAKE = pose({ curl: 0.8, headLift: 0.25, headPitch: 0.1, headYaw: 1.1, tailWrap: 0.9, sway: 0.5, eyes: 1 }, SLEEP);
    var YAWN = pose({ mouth: 1, eyes: 0, headPitch: 0.55, earsBack: 0.45 }, AWAKE);
    var LIE = pose({ bodyZ: 1.0, headLift: 0.45, frontTuck: 1, backTuck: 1, tailUp: -0.05, tailCurl: 0.05, tailWrap: 0.5, sway: 0.5, breath: 1 });
    var STRETCH = pose({ bodyZ: 1.8, pitch: -0.3, frontReach: 1.4, backReach: -0.3, headLift: 0.0, headPitch: 0.2, tailUp: 1.3, eyes: 0.3, mouth: 0.25 });
    /* Ramassé avant le saut : arrière-train bas, pattes repliées, queue basse */
    var CROUCH = pose({ bodyZ: 1.3, pitch: 0.05, headLift: 0.2, frontTuck: 0.45, backTuck: 0.75, tailUp: 0.05, tailCurl: 0.1, sway: 1.8, swayF: 2, earsBack: -0.1 });
    /* Saut : extension, regroupé, réception */
    var TAKEOFF = pose({ stretch: 1.28, air: 1, frontReach: 1.2, backReach: -1.6, frontDrop: 0.9, backDrop: 1.8, tailUp: 0.05, tailCurl: 0, headLift: 0.4, earsBack: 0.35, sway: 0.2 });
    var TUCK = pose({ stretch: 0.96, air: 1, frontReach: 0.7, backReach: 0.15, frontDrop: 0.85, backDrop: 0.8, tailUp: 0.35, tailCurl: 0.15, headLift: 0.35, earsBack: 0.25, sway: 0.2 });
    var REACH = pose({ stretch: 1.08, air: 1, frontReach: 0.8, backReach: -0.35, frontDrop: 1.75, backDrop: 1.0, tailUp: 0.6, headLift: 0.3, sway: 0.3 });
    var LANDING = pose({ bodyZ: 1.35, stretch: 0.92, frontReach: 0.25, backTuck: 0.4, frontTuck: 0.2, headLift: 0.15, tailUp: 0.4 });
    /* Sur le dos : tête au niveau du corps, oreilles couchées, pattes repliées en l'air */
    var BELLY = pose({ bodyZ: 1.0, air: 1, frontReach: 0.35, backReach: 0.25, frontDrop: 1.0, backDrop: 1.1, headLift: -0.85, headPitch: 0.3, earsBack: 1, tailUp: -0.05, tailCurl: 0, tailWrap: 0.3, sway: 1.6, swayF: 1.5 });
    var SIT = pose({ bodyZ: 1.6, pitch: 0.85, headLift: 0.15, frontReach: 0.3, backTuck: 1, tailUp: -0.1, tailCurl: 0, tailWrap: 0.7, sway: 0.4 });

    /* ================= Scénarios : bannière ≈ 23,5 s, avatar 8 s ================= */
    function ss(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
    function eio(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function eo(t) { return 1 - Math.pow(1 - t, 3); }
    function tri(t) { return Math.sin(Math.max(0, Math.min(1, t)) * Math.PI); }
    function angLerp(a, b, t) { var d = ((b - a) % 6.2832 + 9.4248) % 6.2832 - 3.1416; return a + d * t; }
    function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }

    var RC = [10, -15], RE = [10, -12.4], FL = [9.6, -3.2], FC = [6, 4], FD = [-3.8, 5.2];
    var DL = [-11.0, 3.4], KM = [-11.0, 6.0], RL = [8.8, -13.4];
    var H_DESK = Math.atan2(DL[1] - FD[1], DL[0] - FD[0]);
    var H_RACK = Math.atan2(RL[1] - KM[1], RL[0] - KM[0]);
    var PI2 = Math.PI / 2;

    function at(q, x, y, z, h, wp) { q.x = x; q.y = y; q.z = z; q.h = h; q.walkPh = wp || 0; return q; }

    /* Saut balistique de S à E : poussée, regroupé en l'air, pattes avant tendues à la réception */
    function leap(S, Sz, E, Ez, p, minA) {
      var dz = Ez - Sz, d = dist(S, E), a = Math.max((Math.abs(dz) + 2) / 4, d * 0.12, minA || 0);
      var z = Sz + dz * p + 4 * a * p * (1 - p), vz = dz + 4 * a * (1 - 2 * p);
      var q;
      if (p < 0.12) q = mixP(CROUCH, TAKEOFF, eo(p / 0.12));
      else if (p < 0.3) q = mixP(TAKEOFF, TUCK, eio((p - 0.12) / 0.18));
      else if (p < 0.6) q = pose({}, TUCK);
      else q = mixP(TUCK, REACH, eio((p - 0.6) / 0.4));
      q.pitch = Math.max(-0.75, Math.min(0.75, Math.atan2(vz, d))) * 0.9;
      return at(q, S[0] + (E[0] - S[0]) * p, S[1] + (E[1] - S[1]) * p, z, Math.atan2(E[1] - S[1], E[0] - S[0]));
    }
    /* Réception : écrasement rapide puis redressement */
    function land(p) { return p < 0.2 ? mixP(REACH, LANDING, eo(p / 0.2)) : mixP(LANDING, STAND, eio((p - 0.2) / 0.8)); }
    function wiggle(q, ms, amt) { q.x += -Math.sin(q.h) * Math.sin(ms * 0.03) * 0.08 * amt; q.y += Math.cos(q.h) * Math.sin(ms * 0.03) * 0.08 * amt; return q; }
    function bez(a, c, b, t) { var u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; }

    var OFF = { power: 0, screen: 'off' };
    function off(r) { r.power = 0; r.screen = 'off'; return r; }

    var PH_BANNER = [
      [3500, function (p, ms) {                                       // dort, le serveur redémarre
        var q = at(pose({ earsBack: 0.5 * tri((ms - 2300) / 300) }, SLEEP), RC[0], RC[1], RACK_TOP, PI2);
        return { q: q, power: ss(0, 2000, ms), screen: ms < 600 ? 'off' : ms < 1700 ? 'boot' : 'dash', glow: ss(1700, 2400, ms), zzz: Math.min(1, ms / 500) };
      }],
      [1000, function (p) {                                           // se réveille, lève la tête
        var q = mixP(SLEEP, AWAKE, eio(p));
        q.eyes = p < 0.35 ? 0 : (p > 0.72 && p < 0.8) ? 0 : ss(0.35, 0.5, p);
        return { q: at(q, RC[0], RC[1], RACK_TOP, PI2), zzz: Math.max(0, 1 - p * 3) };
      }],
      [1000, function (p) { return { q: at(mixP(AWAKE, YAWN, tri(p)), RC[0], RC[1], RACK_TOP, PI2) }; }],     // bâille
      [800, function (p) { return { q: at(mixP(AWAKE, STAND, eio(p)), RC[0], RC[1], RACK_TOP, PI2) }; }],      // se lève
      [1200, function (p) {                                           // s'étire
        var k = p < 0.35 ? eio(p / 0.35) : p < 0.6 ? 1 : 1 - eio((p - 0.6) / 0.4);
        return { q: at(mixP(STAND, STRETCH, k), RC[0], RC[1] + 0.4 * k, RACK_TOP, PI2) };
      }],
      [700, function (p) {                                            // marche jusqu'au bord
        var y = RC[1] + (RE[1] - RC[1]) * eio(p);
        return { q: at(pose({}, WALK), RC[0], y, RACK_TOP, PI2, (y - RC[1]) * 2.6) };
      }],
      [600, function (p, ms) {                                        // regarde en bas, se ramasse
        var q = mixP(STAND, CROUCH, eio(Math.min(1, p * 1.6)));
        q.headPitch = -0.5 * ss(0, 0.4, p); q.headLift = 0.2 + 0.2 * ss(0, 0.4, p);
        return { q: wiggle(at(q, RE[0], RE[1], RACK_TOP, PI2), ms, ss(0.45, 0.8, p)) };
      }],
      [420, function (p) { return { q: leap(RE, RACK_TOP, FL, 0, p) }; }],          // saute au sol
      [420, function (p) { return { q: at(land(p), FL[0], FL[1], 0, Math.atan2(FL[1] - RE[1], FL[0] - RE[0])) }; }],
      [1800, function (p) {                                           // traverse la pièce
        var t = eio(p), pos = bez(FL, FC, FD, t), nx = bez(FL, FC, FD, Math.min(1, t + 0.02)), pv = bez(FL, FC, FD, Math.max(0, t - 0.02));
        var h = Math.atan2(nx[1] - pv[1], nx[0] - pv[0]);
        h = angLerp(Math.atan2(FL[1] - RE[1], FL[0] - RE[0]), h, ss(0, 0.15, p));
        return { q: at(pose({}, WALK), pos[0], pos[1], 0, h, t * 18 * 2.6) };
      }],
      [600, function (p) {                                            // lève la tête vers le bureau
        var q = pose({ headPitch: 0.6 * ss(0, 0.5, p), headLift: 0.45 + 0.25 * ss(0, 0.5, p), sway: 1.6, swayF: 1.8 });
        return { q: at(q, FD[0], FD[1], 0, angLerp(Math.atan2(FD[1] - FC[1], FD[0] - FC[0]), H_DESK, eio(p))) };
      }],
      [550, function (p, ms) {                                        // se ramasse
        var q = mixP(STAND, CROUCH, eio(Math.min(1, p * 1.5)));
        q.headPitch = 0.6 - 0.15 * p; q.headLift = 0.45;
        return { q: wiggle(at(q, FD[0], FD[1], 0, H_DESK), ms, ss(0.4, 0.75, p)) };
      }],
      [470, function (p) { return { q: leap(FD, 0, DL, KB_TOP, p) }; }],            // saute sur le bureau
      [420, function (p) { return { q: at(land(p), DL[0], DL[1], KB_TOP, H_DESK) }; }],
      [500, function (p, ms) {                                        // se tourne sur le clavier
        return { q: at(pose({ walk: 0.6 * tri(p) }), DL[0], DL[1], KB_TOP, angLerp(H_DESK, PI2, eio(p)), ms * 0.014) };
      }],
      [500, function (p) {                                            // se couche sur le clavier
        var t = eio(p);
        return { q: at(mixP(STAND, LIE, t), DL[0], DL[1] + (KM[1] - DL[1]) * t, KB_TOP, PI2, p * 4), screen: 'typing', typed: p * 0.15 };
      }],
      [2400, function (p, ms) {                                       // se roule sur le dos, gigote, finit la roulade
        var q, roll;
        if (p < 0.25) { var k = eio(p / 0.25); q = mixP(LIE, BELLY, k); roll = Math.PI * k; }
        else if (p < 0.75) {
          q = pose({}, BELLY);
          roll = Math.PI + 0.35 * Math.sin(ms * 0.011);
          q.frontDrop = 1.05 + 0.4 * Math.sin(ms * 0.017); q.backDrop = 1.15 + 0.4 * Math.sin(ms * 0.017 + Math.PI);
          q.frontReach = 0.35 + 0.25 * Math.sin(ms * 0.013); q.headYaw = 0.3 * Math.sin(ms * 0.008);
        } else { var k2 = eio((p - 0.75) / 0.25); q = mixP(BELLY, LIE, k2); roll = Math.PI * (1 + k2); }
        q.roll = roll;
        return { q: at(q, KM[0], KM[1], KB_TOP, PI2), power: 1 - ss(0.5, 0.95, p), halting: p > 0.5,
                 screen: p < 0.55 ? 'typing' : p < 0.85 ? 'halt' : 'off', typed: 0.15 + 0.85 * Math.min(1, p / 0.55) };
      }],
      [600, function (p) { return off({ q: at(mixP(LIE, STAND, eio(p)), KM[0], KM[1], KB_TOP, PI2) }); }],   // se relève
      [1200, function (p) {                                           // s'assoit, fier de lui
        var q = mixP(STAND, SIT, eio(Math.min(1, p / 0.4)));
        if (p > 0.7 && p < 0.77) q.eyes = 0;
        return off({ q: at(q, KM[0], KM[1], KB_TOP, angLerp(PI2, Math.PI / 4, eio(Math.min(1, p / 0.4)))) });
      }],
      [700, function (p, ms) {                                        // se prépare à sauter
        var q = p < 0.4 ? mixP(SIT, STAND, eio(p / 0.4)) : mixP(STAND, CROUCH, eo((p - 0.4) / 0.6));
        q.headPitch = -0.1;
        return off({ q: wiggle(at(q, KM[0], KM[1], KB_TOP, angLerp(Math.PI / 4, H_RACK, eio(Math.min(1, p / 0.5)))), ms, ss(0.55, 0.9, p)) });
      }],
      [560, function (p) { return off({ q: leap(KM, KB_TOP, RL, RACK_TOP, p) }); }],                        // retour sur la baie
      [420, function (p) { return off({ q: at(land(p), RL[0], RL[1], RACK_TOP, H_RACK) }); }],
      [1200, function (p) {                                           // tourne en rond avant de se coucher
        var t = eio(p), th0 = Math.atan2(RL[1] - RC[1], RL[0] - RC[0]), th = th0 - t * (th0 + Math.PI), r = 2.0 - 1.3 * t;
        var h = angLerp(H_RACK, th - PI2, ss(0, 0.2, p));
        return off({ q: at(pose({}, WALK), RC[0] + r * Math.cos(th), RC[1] + r * Math.sin(th), RACK_TOP, h, t * 7 * 2.6) });
      }],
      [800, function (p) {                                            // se couche
        var t = eio(p);
        return off({ q: at(mixP(STAND, LIE, t), RC[0] - 0.7 * (1 - t), RC[1], RACK_TOP, PI2) });
      }],
      [1100, function (p) {                                           // s'enroule et s'endort
        var q = mixP(LIE, SLEEP, eio(p));
        q.eyes = 1 - ss(0.3, 0.8, p);
        var r = off({ q: at(q, RC[0], RC[1], RACK_TOP, PI2) }); r.zzz = ss(0.85, 1, p); return r;
      }]
    ];
    /* Avatar : dort, se réveille, lent clignement vers la caméra, bâille, se rendort (≈ 8 s) */
    var LOOK = pose({ curl: 0.75, headLift: 0.35, headPitch: 0.18, headYaw: 1.45, tailWrap: 0.9, sway: 0.6, eyes: 1 }, SLEEP);
    var YAWN2 = pose({ mouth: 1, eyes: 0, headPitch: 0.55, earsBack: 0.45 }, LOOK);
    function sp(q) { return at(q, RC[0], RC[1], RACK_TOP, PI2); }
    var PH_AVATAR = [
      [3000, function (p, ms) { return { q: sp(pose({ earsBack: 0.5 * tri((ms - 1800) / 280) }, SLEEP)), zzz: 1 }; }],
      [900, function (p) { var q = mixP(SLEEP, LOOK, eio(p)); q.eyes = ss(0.45, 0.75, p); return { q: sp(q), zzz: Math.max(0, 1 - p * 3) }; }],
      [1500, function (p, ms) {
        var q = pose({ headYaw: 1.45 + 0.12 * Math.sin(ms / 400) }, LOOK);
        if (p > 0.4 && p < 0.72) q.eyes = 0.3 + 0.7 * Math.abs((p - 0.56) / 0.16);   // lent clignement
        return { q: sp(q) };
      }],
      [900, function (p) { return { q: sp(mixP(LOOK, YAWN2, tri(p))) }; }],
      [600, function (p) { var q = pose({}, LOOK); if (p > 0.4 && p < 0.55) q.eyes = 0; return { q: sp(q) }; }],
      [1100, function (p) { var q = mixP(LOOK, SLEEP, eio(p)); q.eyes = 1 - ss(0.1, 0.55, p); return { q: sp(q), zzz: ss(0.8, 1, p) }; }]
    ];
    var PH = opt.scenario === 'avatar' ? PH_AVATAR : PH_BANNER;

    /* Heure du jour : réelle, ou simulée (opt.hour + accélération opt.timeScale) pour les exports */
    function timeOfDay(ms) {
      if (opt.hour !== undefined) return ((opt.hour + ms / 3600000 * (opt.timeScale || 1)) % 24 + 24) % 24;
      var d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    }

    /* ================= Jour et nuit (fond d'écran) ================= */
    function hexMix(a, b, t) { var A = hex2rgb(a), B = hex2rgb(b); return rgb2hex([0, 1, 2].map(function (i) { return A[i] + (B[i] - A[i]) * t; })); }
    var SKY_KEYS = [[0, '#0c1328', '#202f58'], [5.5, '#141c3a', '#34375f'], [6.6, '#3a4f86', '#f2a46a'], [8, '#5b8fd1', '#bfe0f2'],
                    [12, '#4f8fe0', '#a9d6f5'], [17, '#5c8ed0', '#c9dcef'], [19.2, '#4a4f8e', '#f09060'], [20.6, '#1b2147', '#4a3f6a'], [22, '#0c1328', '#202f58'], [24, '#0c1328', '#202f58']];
    function skyAt(h) {
      for (var i = 0; i < SKY_KEYS.length - 1; i++) {
        var a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
        if (h >= a[0] && h <= b[0]) { var t = (h - a[0]) / (b[0] - a[0]); return [hexMix(a[1], b[1], t), hexMix(a[2], b[2], t)]; }
      }
      return [SKY_KEYS[0][1], SKY_KEYS[0][2]];
    }
    function daylight(h) { return ss(6.2, 8.2, h) * (1 - ss(18.3, 20.6, h)); }
    function duskGlow(h) { return Math.max(tri((h - 5.9) / 2.4), tri((h - 18.2) / 2.6)); }
    /* Position du soleil : hauteur (rad) et dérive latérale de la tache de lumière */
    function sunAt(h) { var k = (h - 7) / 12; if (k <= 0 || k >= 1) return null; return { el: 0.3 + 0.55 * Math.sin(Math.PI * k), drift: Math.cos(Math.PI * k) * 0.55, k: k }; }

    /* ================= Météo ================= */
    var WX = { cloud: 0.1, rain: 0, snow: 0, storm: 0, fog: 0 }, WXT = { cloud: 0.1, rain: 0, snow: 0, storm: 0, fog: 0 };
    var WX_PRESETS = {
      clear: { cloud: 0.05, rain: 0, snow: 0, storm: 0, fog: 0 }, partly: { cloud: 0.4, rain: 0, snow: 0, storm: 0, fog: 0 },
      cloudy: { cloud: 0.9, rain: 0, snow: 0, storm: 0, fog: 0 }, fog: { cloud: 0.9, rain: 0, snow: 0, storm: 0, fog: 1 },
      drizzle: { cloud: 0.9, rain: 0.35, snow: 0, storm: 0, fog: 0 }, rain: { cloud: 0.95, rain: 0.75, snow: 0, storm: 0, fog: 0 },
      snow: { cloud: 0.9, rain: 0, snow: 0.8, storm: 0, fog: 0 }, storm: { cloud: 1, rain: 1, snow: 0, storm: 1, fog: 0 }
    };
    /* Code météo WMO (celui d'Open-Meteo) vers un état */
    function wxFromCode(c) {
      if (c === 0) return 'clear'; if (c <= 2) return 'partly'; if (c === 3) return 'cloudy'; if (c === 45 || c === 48) return 'fog';
      if (c >= 51 && c <= 57) return 'drizzle'; if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
      if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow'; if (c >= 95) return 'storm'; return 'partly';
    }
    function setWeather(w) {
      var pr = typeof w === 'number' ? WX_PRESETS[wxFromCode(w)] : WX_PRESETS[w] || WX_PRESETS.clear;
      for (var k in pr) WXT[k] = pr[k];
    }
    if (opt.weather) { setWeather(opt.weather); for (var k1 in WXT) WX[k1] = WXT[k1]; }
    var lastWxMs = 0, flash = 0, nextFlash = 4000, RAIN = [], DROPS = [];
    for (var ri = 0; ri < 70; ri++) RAIN.push([22.3 + rnd() * 11.4, rnd(), 0.8 + rnd() * 0.5]);
    for (ri = 0; ri < 26; ri++) DROPS.push([22.6 + rnd() * 10.8, 16.8 + rnd() * 13.5, rnd(), 0.3 + rnd()]);
    function updateWeather(ms) {
      var dt = Math.min(200, ms - lastWxMs); lastWxMs = ms;
      for (var k in WX) WX[k] += (WXT[k] - WX[k]) * Math.min(1, dt / 4000);   // transitions douces
      flash = Math.max(0, flash - dt / 220);
      if (WX.storm > 0.5 && ms > nextFlash) { flash = 1; nextFlash = ms + 5000 + rnd() * 9000; }
    }

    function drawSkyLive(h, t) {
      var X = -19.95, sky = skyAt(h), dl = daylight(h), n = 10, cl = WX.cloud;
      var gray = [hexMix('#151820', '#6b7280', dl), hexMix('#1c2029', '#8a909b', dl)];
      if (WX.storm > 0.3) gray = [hexMix(gray[0], '#2a2e38', 0.5), hexMix(gray[1], '#3a3f4a', 0.5)];
      for (var b = 0; b < n; b++) {
        var z1 = 30.8 - b * (14.6 / n), z0 = z1 - 14.6 / n, f = b / (n - 1);
        qX(X, 22.2, 33.8, z0, z1, hexMix(hexMix(sky[0], sky[1], f), hexMix(gray[0], gray[1], f), Math.min(1, cl * 0.85)));
      }
      if (dl < 0.6 && cl < 0.85) {                                             // étoiles et lune
        g.globalAlpha = (1 - dl / 0.6) * (1 - cl / 0.85);
        STARS.forEach(function (st2) { if (0.5 + 0.5 * Math.sin(t / 650 + st2[2] * 3) > 0.3) px(P(-19.93, st2[0], st2[1]), '#dfe6ff', Math.max(1, Math.round(K / 6))); });
        discX(X + 0.01, 31.2, 28.2, 1.05, '#e9e4cc'); discX(X + 0.02, 31.65, 28.45, 0.85, sky[0]);
        g.globalAlpha = 1;
      }
      var sun = cl < 0.7 ? sunAt(h) : null;
      if (sun) {                                                               // soleil qui traverse la fenêtre
        g.globalAlpha = 1 - cl / 0.7;
        var sy2 = 33 - sun.k * 10.6, sz2 = 17.5 + Math.sin(Math.PI * sun.k) * 11;
        discX(X + 0.01, sy2, sz2, 1.3, hexMix('#ffd27a', '#fff6d8', dl)); g.globalAlpha *= 0.25; discX(X + 0.01, sy2, sz2, 2.2, '#fff1c4'); g.globalAlpha = 1;
      }
      var nc = 3 + Math.round(cl * 5), ccol = hexMix(hexMix('#2a2f3c', '#f4f7fb', dl), hexMix('#1e222b', '#9aa0aa', dl), Math.max(WX.rain, WX.storm));
      if (dl > 0.1 || cl > 0.4) {                                              // nuages qui défilent (plus nombreux et gris si couvert)
        g.globalAlpha = Math.min(0.9, (0.25 + 0.6 * dl) * (0.5 + cl));
        for (var c = 0; c < nc; c++) {
          var cy = 34.5 - ((t / (90000 - cl * 40000) + c * 0.37) % 1) * 14, cz = 25 + (c % 4) * 1.4;
          [[0, 0, 1.0 + cl * 0.4], [0.9, 0.25, 0.8], [-0.9, 0.15, 0.75]].forEach(function (pp) { var yy = cy + pp[0]; if (yy > 22.6 && yy < 33.4) discX(X + 0.012, yy, cz + pp[1], pp[2], ccol); });
        }
        g.globalAlpha = 1;
      }
      if (flash > 0) { g.globalAlpha = flash * 0.8; qX(X + 0.012, 22.2, 33.8, 16.2, 30.8, '#e8eeff'); g.globalAlpha = 1; }
      BLDG.forEach(function (bd, j) {
        qX(X + 0.013, bd[0], bd[1], 16.2, bd[2], hexMix(j % 2 ? '#090d19' : '#0b1020', j % 2 ? '#56607a' : '#4b546c', dl));
        if (WX.snow > 0.3 || XM) qX(X + 0.014, bd[0], bd[1], bd[2] - 0.35, bd[2], '#c9d3e2');
      });
      if (dl < 0.7) CITY.forEach(function (w, i) { if (hash(i, Math.floor(t / 5000 + w[3] * 10)) < 0.1) return; g.globalAlpha = 1 - dl / 0.7; px(P(-19.93, w[0], w[1]), w[2], Math.max(1, Math.round(K / 6))); });
      g.globalAlpha = 1;
      /* Pluie et neige derrière la vitre, brume */
      var e = Math.max(1, Math.round(K / 6));
      if (WX.rain > 0.05) {
        g.globalAlpha = 0.5;
        var nr = Math.round(RAIN.length * WX.rain);
        for (var r = 0; r < nr; r++) {
          var rd = RAIN[r], zr = 30.8 - ((t / (420 / rd[2]) + rd[1]) % 1) * 14.6;
          line(P(-19.93, rd[0], zr), P(-19.93, rd[0] + 0.18, zr - 0.7), '#b4c6e6');
        }
        g.globalAlpha = 1;
      }
      if (WX.snow > 0.05) {
        g.fillStyle = '#eef3ff'; g.globalAlpha = 0.9;
        var ns = Math.round(RAIN.length * WX.snow);
        for (var sn = 0; sn < ns; sn++) {
          var sd = RAIN[sn], zs = 30.8 - ((t / (4200 / sd[2]) + sd[1]) % 1) * 14.6, ys = sd[0] + Math.sin(t / 700 + sn) * 0.35;
          if (ys > 22.3 && ys < 33.7) { var qs = P(-19.93, ys, zs); g.fillRect(Math.round(qs[0]), Math.round(qs[1]), e, e); }
        }
        g.globalAlpha = 1;
      }
      if (WX.fog > 0.05) { g.globalAlpha = 0.55 * WX.fog; qX(X + 0.02, 22.2, 33.8, 16.2, 30.8, hexMix('#3a3f4a', '#c9ced6', dl)); g.globalAlpha = 1; }
      qX(X + 0.03, 27.85, 28.15, 16.2, 30.8, '#4a4f5c'); qX(X + 0.03, 22.2, 33.8, 23.4, 23.7, '#4a4f5c');
      /* Gouttes sur la vitre qui glissent */
      if (WX.rain > 0.05) {
        var nd = Math.round(DROPS.length * WX.rain);
        for (var d = 0; d < nd; d++) {
          var dr = DROPS[d], zd = dr[1] - ((t / 9000 * dr[3] + dr[2]) % 1) * 3;
          if (zd < 16.4) continue;
          var qd = P(-19.92, dr[0], zd);
          g.globalAlpha = 0.7; g.fillStyle = '#c8d6ee'; g.fillRect(Math.round(qd[0]), Math.round(qd[1]), e, e + 1);
          g.globalAlpha = 0.35; g.fillRect(Math.round(qd[0]), Math.round(qd[1]) - 3 * e, e, 3 * e);
        }
        g.globalAlpha = 1;
      }
    }
    /* Tache de soleil au sol (projection de la fenêtre) */
    function sunPatch(h) {
      var sun = sunAt(h); if (!sun) return null;
      var tn = Math.tan(sun.el);
      function F(y, z) { var d = z / tn; return [-20 + d, y + d * sun.drift]; }
      return [F(22.2, 16.2), F(33.8, 16.2), F(33.8, 30.8), F(22.2, 30.8)];
    }
    function drawSunPatch(h, amt) {
      var pts = sunPatch(h); if (!pts || amt <= 0) return;
      g.globalCompositeOperation = 'lighter';
      fillPoly(pts.map(function (p) { return P(p[0], p[1], 0.02); }), 'rgba(255,214,150,' + (0.11 * amt).toFixed(3) + ')');
      var m0 = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2], m1 = [(pts[3][0] + pts[2][0]) / 2, (pts[3][1] + pts[2][1]) / 2];
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.35 * amt; line(P(m0[0], m0[1], 0.03), P(m1[0], m1[1], 0.03), '#3a2a20'); g.globalAlpha = 1;   // ombre du montant
    }
    /* Lumière d'ambiance : la pièce s'éclaire le jour, se réchauffe à l'aube et au crépuscule */
    function applyDaylight(h) {
      var dl = daylight(h) * (1 - 0.5 * WX.cloud), du = duskGlow(h) * (1 - 0.7 * WX.cloud);
      if (dl > 0.01) {
        g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(255,246,232,' + (0.55 * dl).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(70,72,78,' + (0.32 * dl).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
      }
      if (du > 0.01) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(255,140,70,' + (0.35 * du).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
      var wet = Math.max(WX.rain, WX.storm);
      if (wet > 0.05) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(50,62,85,' + (0.3 * wet).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
      g.globalCompositeOperation = 'source-over';
      if (flash > 0) { g.fillStyle = 'rgba(215,228,255,' + (0.28 * flash).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }   // éclair
    }

    /* ================= Souris : laser et caresses ================= */
    var PTR = { px: 0, py: 0, last: -1e9, inside: false, down: false, laserOn: false, touchLaser: false, speed: 0 }, INPUT = { laser: null, pet: false }, lastBox = null, clockMs = 0;
    function pointer(cx, cy) {
      var dt = Math.max(16, clockMs - PTR.last), v = Math.hypot(cx - PTR.px, cy - PTR.py) / dt * 1000;
      PTR.speed = PTR.speed * 0.6 + Math.min(4000, v) * 0.4;
      PTR.px = cx; PTR.py = cy; PTR.last = clockMs; PTR.inside = true;
    }
    function toggleLaser() { PTR.laserOn = !PTR.laserOn; }
    function pointerLeave() { PTR.inside = false; }
    function overCat(cx, cy) {
      if (!lastBox) return false;
      var lx = Math.floor(cx) - lastBox.x0, ly = Math.floor(cy) - lastBox.y0;
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var X = lx + dx, Y = ly + dy;
        if (X >= 0 && Y >= 0 && X < lastBox.w && Y < lastBox.h && MK[Y * lastBox.w + X]) return true;
      }
      return false;
    }
    function floorAt(cx, cy) { var u = (cx - OX) / K, w = (cy - OY) / K; return [w + u / 2, w - u / 2]; }
    /* Zones de sol libres (pas sous un meuble) */
    function walkable(x, y) {
      if (x < -7 || x > 36 || y < -11 || y > 30) return false;
      if (x < -7.5 && y > -7 && y < 19) return false;                 // bureau
      if (Math.hypot(x + 4.6, y - 14.2) < 4.2) return false;          // chaise
      if (x > 3.5 && x < 16.5 && y < -9.5) return false;              // baie
      if (x > 21 && y < -13.6) return false;                          // canapé
      if (x < -11 && (y < -11 || y > 29)) return false;               // arbre à chat, carton
      return true;
    }
    /* Le laser ne s'allume que si on le demande : double-clic (activer/désactiver), clic maintenu,
       ou au mouvement rapide loin de la chatonne. Sinon, le survol de la chatonne la caresse. */
    function nearCat(cx, cy, r) { return lastBox && Math.hypot(cx - (lastBox.x0 + lastBox.w / 2), cy - (lastBox.y0 + lastBox.h / 2)) < r + Math.max(lastBox.w, lastBox.h) / 2; }
    /* Surfaces en hauteur que le laser peut toucher (et où elle peut le suivre) */
    function inRect(x0, x1, y0, y1) { return function (x, y) { return x > x0 && x < x1 && y > y0 && y < y1; }; }
    var SURF = {
      rack:    { z: RACK_TOP, inside: inRect(4.8, 15.2, -19.2, -10.8) },
      desk:    { z: DESK_TOP, inside: inRect(-13.5, -8.7, -5, 17) },
      sofa:    { z: 5.2, inside: inRect(23.2, 35.8, -17.8, -14.6) },
      treeMid: { z: 9.8, inside: inRect(-16, -12, -16.5, -12.5) },
      treeTop: { z: 18.8, inside: function (x, y) { return Math.hypot(x + 17, y + 17) < 1.8; } },
      sill:    { z: 15.2, inside: inRect(-19.6, -17, 22.6, 34.4) },
      floor:   { z: 0, inside: walkable }
    };
    function surfZ(name, x, y) { return name === 'desk' && x > -12.6 && x < -9.6 && y > 0.3 && y < 11.3 ? KB_TOP : SURF[name].z; }
    /* Point visé : surface la plus proche de la caméra sous le curseur */
    function laserHit(cx, cy) {
      var u = (cx - OX) / K, w = (cy - OY) / K, best = null;
      for (var n in SURF) {
        if (!LARGE && n !== 'floor') continue;
        var z = SURF[n].z, x = w + z + u / 2, y = w + z - u / 2;
        if (SURF[n].inside(x, y) && (!best || x + y + z > best.x + best.y + best.z)) best = { x: x, y: y, z: surfZ(n, x, y), surf: n };
      }
      return best;
    }
    function readInput() {
      INPUT.laser = null; INPUT.pet = false;
      if (!PTR.inside || opt.interactive === false) return;
      var age = clockMs - PTR.last, mode = opt.laserMode || 'dblclick', want;
      if (PTR.touchLaser) want = true;                                             // appui long au doigt : laser tant que le doigt reste posé
      else if (mode === 'hold') want = PTR.down && age < 4000;
      else if (mode === 'always') want = age < 2500 && PTR.speed > 180 && !nearCat(PTR.px, PTR.py, 40);
      else want = PTR.laserOn && age < 4000;                                       // le point s'éteint si le curseur ne bouge plus
      if (want) { INPUT.laser = laserHit(PTR.px, PTR.py); return; }
      if (age < 1500 && overCat(PTR.px, PTR.py)) INPUT.pet = true;
    }
    function ellipse(cx, cy, rx, ry, col) {                    // ellipse pleine à l'écran, bords nets
      g.fillStyle = col;
      for (var py = Math.floor(cy - ry); py <= Math.ceil(cy + ry); py++) {
        var d = (py + 0.5 - cy) / ry; if (d <= -1 || d >= 1) continue;
        var hw = rx * Math.sqrt(1 - d * d), a = Math.round(cx - hw), b = Math.round(cx + hw);
        if (b > a) g.fillRect(a, py, b - a, 1);
      }
    }
    function drawBall() {
      var b = BALL, c = P(b.x, b.y, 0.45), sh = P(b.x, b.y, 0.02), e = Math.max(1, Math.round(K / 8));
      g.globalAlpha = 0.35; ellipse(sh[0], sh[1] + 1, 0.55 * K, 0.27 * K, '#000'); g.globalAlpha = 1;
      ellipse(c[0], c[1], 0.45 * K, 0.45 * K, '#c63b3b');
      ellipse(c[0] - e, c[1] - e, 0.18 * K, 0.18 * K, '#ef7a6a');
      var a = b.rot * 2; g.fillStyle = '#f2d36b'; g.fillRect(Math.round(c[0] + Math.cos(a) * 0.25 * K), Math.round(c[1] + Math.sin(a) * 0.25 * K), e, e);   // grelot qui tourne
    }
    function drawLaser() {
      var L = INPUT.laser; if (!L) return;
      var q = P(L.x, L.y, L.z + 0.05), fl = 0.85 + 0.15 * Math.sin(clockMs / 40);
      glow(L.x, L.y, L.z + 0.05, 7, 'rgba(255,40,40,' + (0.45 * fl).toFixed(3) + ')');
      g.fillStyle = '#ff2a2a'; g.fillRect(Math.round(q[0]) - 1, Math.round(q[1]) - 1, 3, 2);
      g.fillStyle = '#ffd0d0'; g.fillRect(Math.round(q[0]), Math.round(q[1]) - 1, 1, 1);
    }
    /* Petits cœurs quand on la caresse */
    var HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
    function drawHearts(head, ms) {
      var e = Math.max(1, Math.round(K / 8));
      for (var k = 0; k < 3; k++) {
        var life = (ms / 1400 + k / 3) % 1, q = P(head[0] + (k - 1) * 0.6, head[1] - (k - 1) * 0.6, head[2] + 1.6 + life * 3.5);
        g.globalAlpha = Math.sin(life * Math.PI); g.fillStyle = '#ff7aa8';
        for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) if (HEART[r][c] === 'X') g.fillRect(Math.round(q[0]) + (c - 2) * e, Math.round(q[1]) + r * e, e, e);
      }
      g.globalAlpha = 1;
    }
    /* Coordonnées écran -> pixels de la scène (canvas affiché en object-fit: cover) */
    function toScene(clientX, clientY) {
      var r = cv.getBoundingClientRect(), sc = Math.max(r.width / W, r.height / H);
      return [(clientX - r.left - (r.width - W * sc) / 2) / sc, (clientY - r.top - (r.height - H * sc) / 2) / sc];
    }
    /* Entrées : toute la fenêtre par défaut (fond d'écran), ou seulement l'élément passé dans opt.inputTarget.
       Au doigt : un tap la caresse, un appui long allume le laser qui suit le doigt. */
    if (opt.scenario === 'live' && typeof window !== 'undefined' && window.addEventListener && opt.interactive !== false) {
      var target = opt.inputTarget || window, lastTouch = -1e9, TOUCH = { timer: 0, x: 0, y: 0 };
      var fromMouse = function () { return Date.now() - lastTouch > 800; };    // ignore la souris simulée après un toucher
      target.addEventListener('mousemove', function (e) { if (fromMouse()) { var p = toScene(e.clientX, e.clientY); pointer(p[0], p[1]); } });
      (target === window ? document : target).addEventListener('mouseleave', pointerLeave);
      target.addEventListener('mousedown', function (e) { if (e.button === 0 && fromMouse()) PTR.down = true; });
      window.addEventListener('mouseup', function () { PTR.down = false; });
      target.addEventListener('dblclick', function () { if (fromMouse()) toggleLaser(); });
      target.addEventListener('touchstart', function (e) {
        lastTouch = Date.now();
        if (e.touches.length !== 1) return;
        var t = e.touches[0], p = toScene(t.clientX, t.clientY);
        TOUCH.x = t.clientX; TOUCH.y = t.clientY;
        pointer(p[0], p[1]);
        clearTimeout(TOUCH.timer);
        TOUCH.timer = setTimeout(function () { PTR.touchLaser = true; }, 450);
      }, { passive: true });
      target.addEventListener('touchmove', function (e) {
        lastTouch = Date.now();
        var t = e.touches[0];
        if (!PTR.touchLaser) {                                                  // le doigt bouge avant l'appui long : on laisse défiler la page
          if (Math.hypot(t.clientX - TOUCH.x, t.clientY - TOUCH.y) > 10) clearTimeout(TOUCH.timer);
          return;
        }
        e.preventDefault();
        var p = toScene(t.clientX, t.clientY); pointer(p[0], p[1]);
      }, { passive: false });
      var touchEnd = function () { lastTouch = Date.now(); clearTimeout(TOUCH.timer); PTR.touchLaser = false; };
      target.addEventListener('touchend', touchEnd);
      target.addEventListener('touchcancel', touchEnd);
    }

    /* ================= Vie autonome (fond d'écran) =================
       Au lieu d'un scénario fixe, la chatonne enchaîne des activités choisies au hasard selon l'heure.
       Chaque activité est une suite de petites tâches (marcher, sauter, se coucher...). */
    var EAT = pose({ headPitch: -0.95, headLift: -0.4, bodyZ: 2.25, frontReach: 0.3, tailUp: 0.7, sway: 0.6 });
    var GROOM = pose({ headPitch: -0.7, headYaw: 0.45, headLift: 0.0, eyes: 0.3 }, SIT);
    var WATCH = pose({ headPitch: 0.28, headLift: 0.3, sway: 1.4, swayF: 1.6 }, SIT);
    var SCRATCH = pose({ pitch: 0.95, bodyZ: 2.0, frontReach: 0.6, frontLift: 1.9, headPitch: 0.15, tailUp: 0.9, earsBack: 0.2 });
    var RUN = pose({ walk: 1, headLift: 0.25, bodyZ: 2.35, stretch: 1.12, tailUp: 0.4, tailCurl: 0.05, earsBack: 0.35 });

    var LIVE = null, BALL = { x: 10, y: 3, vx: 0, vy: 0, hit: false, rot: 0 };
    if (opt.scenario === 'live') LIVE = (function () {
      /* Spots en hauteur : centre, hauteur, point de décollage/atterrissage, point d'approche au sol, orientation de repos */
      var SP = {
        rack:    { c: [10, -15], z: RACK_TOP, edge: [10, -12.4], ap: [9.6, -4.2], h: PI2 },
        desk:    { c: KM, z: KB_TOP, edge: DL, ap: FD, h: Math.PI / 4 },
        sofa:    { c: [29.5, -16.2], z: 5.2, edge: [29.5, -14.8], ap: [29.5, -8.0], h: 0 },
        sill:    { c: [-18.4, 28.5], z: 15.2, edge: [-17.2, 28.5], ap: [-10.5, 27.5], h: Math.PI },
        treeMid: { c: [-14, -14.5], z: 9.8, edge: [-12.6, -13.1], ap: [-8.2, -8.5], h: Math.PI / 4 },
        treeTop: { c: [-17, -17], z: 18.8, edge: [-15.8, -15.8], h: Math.PI / 4 },
        box:     { c: [-13.5, 31.8], z: 0.35, edge: [-13.5, 31.8], ap: [-6.0, 31.0], h: Math.PI / 4 }
      };
      var FLOOR = { food: [[-6, -12.0], -PI2], water: [[-3.3, -12.8], -PI2], sun: [[-10, 27], 0.6], rug: [[7, 0], Math.PI / 4], scratch: [[-12.3, -12.7], -2.36] };
      var HUB = [3, 3];
      var seed = 98765;
      function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      function rr(a, b) { return a + (b - a) * rand(); }

      var Q = [], cur = null, curStart = 0, lastQ = null, pc = { x: SP.rack.c[0], y: SP.rack.c[1], z: RACK_TOP, h: PI2, at: 'rack' };
      var power = 1, powerState = 'on', offSince = 0, bootAt = -1, lastAct = '', scriptI = 0;
      function add(d, f, end, kind) { Q.push({ d: d, f: f, end: end, kind: kind || 'move', at: pc.at }); }
      function place(x, y, z, h, where) { pc = { x: x, y: y, z: z, h: h, at: where === undefined ? pc.at : where }; }

      /* ---- Tâches élémentaires ---- */
      function holdPose(P0, d, extra, zzz) {
        var x = pc.x, y = pc.y, z = pc.z, h = pc.h;
        add(d, function (p, ms) { var q = pose({}, P0); if (extra) extra(q, p, ms); return { q: at(q, x, y, z, h), zzz: zzz ? Math.min(1, p * d / 800, (1 - p) * d / 400) : 0 }; }, null, 'hold');
      }
      function morph(A, B, d, extra) {
        var x = pc.x, y = pc.y, z = pc.z, h = pc.h;
        add(d, function (p, ms) { var q = mixP(A, B, eio(p)); if (extra) extra(q, p, ms); return { q: at(q, x, y, z, h) }; }, null, 'morph');
      }
      function walkTo(tx, ty, speed, run) {
        var sx = pc.x, sy = pc.y, z = pc.z, d = Math.hypot(tx - sx, ty - sy);
        if (d < 0.05) return;
        var h0 = pc.h, h1 = Math.atan2(ty - sy, tx - sx), dur = Math.max(260, d / (speed || 7) * 1000), turnF = Math.min(0.35, 420 / dur);
        add(dur, function (p) {
          var t = run ? p : eio(p), x = sx + (tx - sx) * t, y = sy + (ty - sy) * t;
          return { q: at(pose({}, run ? RUN : WALK), x, y, z, angLerp(h0, h1, ss(0, turnF, p)), d * t * (run ? 1.6 : 2.6)) };
        }, null, 'walk');
        place(tx, ty, z, h1);
      }
      function turnTo(h1) {
        var h0 = pc.h, dd = Math.abs(((h1 - h0) % 6.2832 + 9.4248) % 6.2832 - 3.1416);
        if (dd < 0.2) { place(pc.x, pc.y, pc.z, h1); return; }
        var x = pc.x, y = pc.y, z = pc.z;
        add(300 + dd * 220, function (p, ms) { return { q: at(pose({ walk: 0.6 * tri(p) }), x, y, z, angLerp(h0, h1, eio(p)), ms * 0.014) }; }, null, 'turn');
        place(x, y, z, h1);
      }
      function crouch(lookPitch, d) {
        var x = pc.x, y = pc.y, z = pc.z, h = pc.h;
        add(d || 650, function (p, ms) {
          var q = mixP(STAND, CROUCH, eio(Math.min(1, p * 1.6)));
          q.headPitch = lookPitch * ss(0, 0.4, p); q.headLift = 0.3;
          return { q: wiggle(at(q, x, y, z, h), ms, ss(0.45, 0.8, p)) };
        });
      }
      function leapTo(tx, ty, tz, where, minA) {
        var S = [pc.x, pc.y], Sz = pc.z, E = [tx, ty], d = dist(S, E), dur = Math.max(380, Math.min(620, 360 + d * 11 + Math.abs(tz - Sz) * 6));
        add(dur, function (p) { return { q: leap(S, Sz, E, tz, p, minA) }; });
        var hd = Math.atan2(ty - S[1], tx - S[0]);
        add(440, function (p) { return { q: at(land(p), tx, ty, tz, hd) }; });
        place(tx, ty, tz, hd, where);
      }

      /* ---- Déplacements entre les spots ---- */
      /* Marche fluide : une seule trajectoire courbe (spline) à vitesse constante, accélère au départ et ralentit à l'arrivée.
         La tête anticipe les virages. */
      function walkPath(pts, speed, run) {
        var raw = [[pc.x, pc.y]].concat(pts).filter(function (p, k, a) { return k === 0 || dist(p, a[k - 1]) > 0.3; });
        if (raw.length < 2) return;
        var dense = [];
        for (var k = 0; k < raw.length - 1; k++) {                       // Catmull-Rom
          var p0 = raw[Math.max(0, k - 1)], p1 = raw[k], p2 = raw[k + 1], p3 = raw[Math.min(raw.length - 1, k + 2)];
          for (var t = 0; t < 1; t += 0.1) {
            var t2 = t * t, t3 = t2 * t;
            dense.push([0, 1].map(function (c) { return 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3); }));
          }
        }
        dense.push(raw[raw.length - 1]);
        var cum = [0];
        for (k = 1; k < dense.length; k++) cum.push(cum[k - 1] + dist(dense[k - 1], dense[k]));
        var Ltot = cum[cum.length - 1], v = speed || 7, acc = run ? 0.15 : 0.3, dur = (Ltot / v + acc) * 1000, z = pc.z, h0 = pc.h;
        function at2(sd) { var a = 0, b = cum.length - 1; while (b - a > 1) { var m = (a + b) >> 1; if (cum[m] < sd) a = m; else b = m; } var f = (sd - cum[a]) / Math.max(1e-6, cum[b] - cum[a]); return [dense[a][0] + (dense[b][0] - dense[a][0]) * f, dense[a][1] + (dense[b][1] - dense[a][1]) * f]; }
        function sAt(p) { var T = dur / 1000, ta = acc, tt = p * T, vm = Ltot / (T - ta); if (tt < ta) return 0.5 * vm / ta * tt * tt; if (tt > T - ta) { var r2 = T - tt; return Ltot - 0.5 * vm / ta * r2 * r2; } return 0.5 * vm * ta + vm * (tt - ta); }
        add(dur, function (p) {
          var sd = Math.max(0, Math.min(Ltot, sAt(p))), a = at2(sd), b = at2(Math.min(Ltot, sd + 0.6)), ah = at2(Math.min(Ltot, sd + 3.5));
          var hd = Math.atan2(b[1] - a[1], b[0] - a[0]), hh = Math.atan2(ah[1] - a[1], ah[0] - a[0]);
          if (sd > Ltot - 0.3) hd = Math.atan2(a[1] - at2(Math.max(0, sd - 0.6))[1], a[0] - at2(Math.max(0, sd - 0.6))[0]);
          var hcur = angLerp(h0, hd, ss(0, Math.min(0.25, 350 / dur), p));
          var q = pose({}, run ? RUN : WALK);
          q.headYaw = Math.max(-0.6, Math.min(0.6, angLerp(0, hh - hcur, 1) * 0.8));
          q.headLift += 0.05 * Math.sin(sd * 5.2);                         // petit balancement de tête
          return { q: at(q, a[0], a[1], z, hcur, sd * (run ? 1.6 : 2.6)) };
        }, null, 'walk');
        var e1 = dense[dense.length - 1], e0 = dense[Math.max(0, dense.length - 3)];
        place(e1[0], e1[1], z, Math.atan2(e1[1] - e0[1], e1[0] - e0[0]));
      }
      /* Au sol : contourne la chaise côté fenêtre (WEST) et passe par le centre (HUB) */
      var WEST = [6, 20];
      function floorRoute(tgt) {
        var a = [pc.x, pc.y], westA = a[1] > 17, westB = tgt[1] > 17, pts = [];
        if (westA !== westB) {
          if (westA) { pts.push(WEST); if (dist(WEST, tgt) > 10) pts.push(HUB); }
          else { if (dist(a, WEST) > 10 && dist(a, HUB) > 4) pts.push(HUB); pts.push(WEST); }
        } else if (!westA && dist(a, tgt) > 14 && dist(a, HUB) > 4 && dist(HUB, tgt) > 4) pts.push(HUB);
        pts.push(tgt);
        walkPath(pts);
      }
      function route(tgt) { floorRoute(tgt); }

      /* Sauts directs entre meubles : point d'appel, point de réception */
      var JUMPS = {
        'rack>desk': [[6.0, -11.8], DL], 'rack>treeMid': [[4.9, -15.5], [-12.6, -14.4]], 'rack>sofa': [[15.2, -15.6], [25.0, -16.2]],
        'desk>sill': [[-12.6, 16.6], [-18.0, 24.2]], 'desk>treeMid': [[-12.2, -4.6], [-13.6, -12.8]], 'treeMid>treeTop': [[-14.3, -14.8], [-17, -17]]
      };
      function jumpOf(a, b) {
        if (JUMPS[a + '>' + b]) return JUMPS[a + '>' + b];
        if (JUMPS[b + '>' + a]) { var j2 = JUMPS[b + '>' + a]; return [j2[1], j2[0]]; }
        return null;
      }
      var NODES = ['floor', 'rack', 'desk', 'sofa', 'sill', 'treeMid', 'treeTop', 'box'];
      function linkCost(a, b) {
        var j3 = jumpOf(a, b); if (j3) return 1 + dist(j3[0], j3[1]) / 25;
        if ((a === 'floor' && SP[b] && SP[b].ap) || (b === 'floor' && SP[a] && SP[a].ap)) return 2.4;
        return Infinity;
      }
      /* Plus court chemin (Dijkstra sur 8 nœuds) */
      function findPath(a, b) {
        var D = {}, prev = {}, done = {};
        NODES.forEach(function (n) { D[n] = Infinity; }); D[a] = 0;
        for (;;) {
          var u = null; NODES.forEach(function (n) { if (!done[n] && (u === null || D[n] < D[u])) u = n; });
          if (u === null || D[u] === Infinity || u === b) break;
          done[u] = true;
          NODES.forEach(function (n) { var c = D[u] + linkCost(u, n); if (c < D[n]) { D[n] = c; prev[n] = u; } });
        }
        var path = [b]; while (path[0] !== a && prev[path[0]]) path.unshift(prev[path[0]]);
        return path[0] === a ? path : [a, b];
      }
      function surfacePos(name) { return name === 'floor' ? 0 : name === 'desk' ? KB_TOP : SP[name].z; }
      function hop(a, b) {
        var j4 = jumpOf(a, b);
        if (j4) {                                                         // saut direct d'un meuble à l'autre
          if (dist([pc.x, pc.y], j4[0]) > 0.4) walkPath([j4[0]], 4);
          var dz = surfacePos(b) - pc.z;
          turnTo(Math.atan2(j4[1][1] - pc.y, j4[1][0] - pc.x));
          crouch(dz > 1 ? 0.55 : dz < -1 ? -0.45 : 0.1, 600 + Math.min(300, dist(j4[0], j4[1]) * 15));
          leapTo(j4[1][0], j4[1][1], surfacePos(b), b);
          return;
        }
        if (b === 'floor') {                                              // descendre au sol
          var s = SP[a];
          if (a === 'box') { turnTo(0); crouch(0.1, 500); leapTo(s.ap[0], s.ap[1], 0, 'floor', 3.2); return; }
          if (dist([pc.x, pc.y], s.edge) > 0.4) walkPath([s.edge], 4);
          turnTo(Math.atan2(s.ap[1] - pc.y, s.ap[0] - pc.x));
          crouch(-0.5); leapTo(s.ap[0], s.ap[1], 0, 'floor');
          return;
        }
        var t2 = SP[b];                                                   // monter depuis le sol
        floorRoute(t2.ap);
        var land = b === 'desk' ? DL : t2.edge;
        turnTo(Math.atan2(land[1] - pc.y, land[0] - pc.x));
        crouch(b === 'box' ? 0.2 : 0.6);
        leapTo(land[0], land[1], surfacePos(b), b, b === 'box' ? 3.4 : 0);
      }
      function goTo(name) {
        var dest = SP[name] ? name : 'floor';
        if (dest !== pc.at) {
          var path = findPath(pc.at, dest);
          for (var k = 0; k < path.length - 1; k++) hop(path[k], path[k + 1]);
        }
        if (SP[name]) { if (name !== 'desk' && dist([pc.x, pc.y], SP[name].c) > 0.5) walkPath([SP[name].c], 4); turnTo(SP[name].h); }
        else if (FLOOR[name]) { floorRoute(FLOOR[name][0]); turnTo(FLOOR[name][1]); }
      }
      function leaveSpot() { if (pc.at !== 'floor') goTo('floor'); }

      /* ---- Activités ---- */
      function blink(q, ms, base) { q.eyes = (ms % 3700) < 140 ? 0 : (base === undefined ? 1 : base); }
      function nap(where) {
        goTo(where);
        if ((where === 'sofa' || where === 'rack' || where === 'treeTop') && rand() < 0.65) knead();
        morph(STAND, LIE, 900);
        morph(LIE, SLEEP, 1400, function (q, p) { q.eyes = 1 - ss(0.3, 0.8, p); });
        holdPose(SLEEP, rr(18000, 45000), function (q, p, ms) { q.earsBack = 0.6 + 0.4 * tri((ms % 9000 - 6000) / 300); }, true);
        morph(SLEEP, AWAKE, 1000, function (q, p) { q.eyes = ss(0.4, 0.7, p); });
        if (rand() < 0.6) morph(AWAKE, YAWN, 1000, function (q, p) { var k = tri(p); for (var kk in q) q[kk] = AWAKE[kk] + (YAWN[kk] - AWAKE[kk]) * k; });
        morph(AWAKE, STAND, 800);
        if (rand() < 0.5) morph(STAND, STRETCH, 1500, function (q, p) { var k = p < 0.35 ? eio(p / 0.35) : p < 0.6 ? 1 : 1 - eio((p - 0.6) / 0.4); for (var kk in q) q[kk] = STAND[kk] + (STRETCH[kk] - STAND[kk]) * k; });
      }
      /* Pétrir (patounes alternées) avant de se coucher */
      function knead(d) {
        var KN = pose({ bodyZ: 2.1, headLift: 0.25, headPitch: -0.15, eyes: 0.45, tailUp: 0.6, sway: 0.5 });
        morph(STAND, KN, 450);
        holdPose(KN, d || rr(2200, 3500), function (q, p, ms) { var w = Math.sin(ms / 170); q.pawL = Math.max(0, w) * 0.55; q.pawR = Math.max(0, -w) * 0.55; q.bodyZ = 2.1 - 0.05 * Math.abs(w); }, false);
        morph(KN, STAND, 350);
      }
      /* Se lécher la patte puis se frotter la tête */
      function groomPaw() {
        var GP = pose({ pawR: 1.55, headPitch: -0.35, headYaw: -0.3, eyes: 0.35 }, SIT);
        morph(STAND, SIT, 650); morph(SIT, GP, 450);
        holdPose(GP, rr(2500, 3800), function (q, p, ms) { q.headPitch = -0.35 + 0.1 * Math.sin(ms / 140); q.pawR = 1.55 + 0.08 * Math.sin(ms / 140 + 1); });
        holdPose(GP, 1400, function (q, p, ms) { q.headYaw = -0.3 + 0.5 * Math.sin(ms / 300); q.headPitch = -0.15; q.pawR = 1.7; });
        morph(GP, SIT, 400); morph(SIT, STAND, 550);
      }
      /* Se rouler sur le dos au sol (de préférence au soleil) */
      function rollFloor(where) {
        goTo(where);
        morph(STAND, LIE, 700);
        var x = pc.x, y = pc.y, h = pc.h;
        add(3200, function (p, ms) {
          var q, roll;
          if (p < 0.22) { var k = eio(p / 0.22); q = mixP(LIE, BELLY, k); roll = Math.PI * k; }
          else if (p < 0.78) {
            q = pose({}, BELLY); roll = Math.PI + 0.4 * Math.sin(ms * 0.006);
            q.frontDrop = 1.0 + 0.35 * Math.sin(ms * 0.012); q.backDrop = 1.1 + 0.35 * Math.sin(ms * 0.012 + Math.PI); q.headYaw = 0.35 * Math.sin(ms * 0.004);
          } else { var k2 = eio((p - 0.78) / 0.22); q = mixP(BELLY, LIE, k2); roll = Math.PI * (1 - k2); }
          q.roll = roll;
          return { q: at(q, x, y, 0, h) };
        }, null, 'hold');
        morph(LIE, STAND, 700);
      }
      /* Balle : elle la traque, bondit, la tape et la regarde rouler. Chaque manche est planifiée au moment où elle commence
         (là où la balle s'est vraiment arrêtée). */
      function ballRound(n) {
        goTo('floor');
        var bx = BALL.x, by = BALL.y, ang = Math.atan2(by - pc.y, bx - pc.x), ax = bx - Math.cos(ang) * 3.2, ay = by - Math.sin(ang) * 3.2;
        if (walkable(ax, ay) && dist([pc.x, pc.y], [ax, ay]) > 0.5) floorRoute([ax, ay]);
        turnTo(Math.atan2(by - pc.y, bx - pc.x));
        crouch(-0.35, 700);
        ang = Math.atan2(by - pc.y, bx - pc.x);
        leapTo(bx - Math.cos(ang) * 1.3, by - Math.sin(ang) * 1.3, 0, 'floor', 0.9);
        var x = pc.x, y = pc.y, h = pc.h;
        add(450, function (p) {                                               // coup de patte
          var q = pose({ pawR: 1.2 * Math.sin(Math.min(1, p * 1.4) * Math.PI), headPitch: -0.45 }, CROUCH);
          if (p > 0.35 && !BALL.hit) { BALL.hit = true; var a = h + (Math.random() - 0.5) * 2.2; BALL.vx = Math.cos(a) * 10; BALL.vy = Math.sin(a) * 10; }
          return { q: at(q, x, y, 0, h) };
        }, function () { BALL.hit = false; }, 'hold');
        holdPose(pose({ headPitch: -0.2 }, CROUCH), 1500, function (q) { q.headYaw = Math.max(-0.9, Math.min(0.9, angLerp(0, Math.atan2(BALL.y - y, BALL.x - x) - h, 1))); });
        add(10, function () { return { q: at(pose({ headPitch: -0.2 }, CROUCH), x, y, 0, h) }; }, function () {
          var rest = Q; Q = [];
          if (n > 1) ballRound(n - 1); else sitLook();
          Q = Q.concat(rest);
        }, 'turn');
      }
      function playBall() { ballRound(2 + Math.floor(rand() * 2)); }

      function eat(which) {
        goTo(which);
        morph(STAND, EAT, 500);
        holdPose(EAT, which === 'food' ? rr(5000, 8000) : rr(3000, 5000), function (q, p, ms) { q.headLift = -0.4 + 0.06 * Math.sin(ms / 90); q.headPitch = -0.95 + 0.05 * Math.sin(ms / 90); });
        morph(EAT, STAND, 500);
        groom(rr(2500, 4000));
      }
      function groom(d) {
        morph(STAND, SIT, 700);
        morph(SIT, GROOM, 400);
        holdPose(GROOM, d || rr(3500, 6000), function (q, p, ms) { q.headPitch = -0.7 + 0.12 * Math.sin(ms / 160); q.headYaw = 0.45 * Math.sin(ms / 1400); });
        morph(GROOM, SIT, 400);
        morph(SIT, STAND, 600);
      }
      function watchWindow() {
        goTo('sill');
        morph(STAND, WATCH, 800);
        holdPose(WATCH, rr(9000, 18000), function (q, p, ms) { q.headYaw = 0.55 * Math.sin(ms / 1700) + 0.2 * Math.sin(ms / 430); blink(q, ms); q.earsBack = -0.15; });
        morph(WATCH, STAND, 700);
      }
      function sitLook(where) {
        if (where) goTo(where);
        morph(STAND, SIT, 700);
        holdPose(SIT, rr(4000, 9000), function (q, p, ms) { q.headYaw = 0.7 * Math.sin(ms / 2100); blink(q, ms); });
        morph(SIT, STAND, 600);
      }
      function scratch() {
        goTo('scratch');
        place(pc.x, pc.y, 0.8, pc.h);
        morph(STAND, SCRATCH, 500);
        holdPose(SCRATCH, rr(2500, 4000), function (q, p, ms) { q.frontLift = 1.7 + 0.35 * Math.sin(ms / 110); q.frontReach = 0.6 + 0.12 * Math.sin(ms / 110); });
        morph(SCRATCH, STAND, 500);
        place(pc.x, pc.y, 0, pc.h);
      }
      function zoomies() {
        leaveSpot();
        route([3, 0]);
        var pts = [[rr(-2, 12), rr(-8, 3)], [rr(0, 13), rr(-7, 3)], [rr(-2, 12), rr(-8, 3)], [7, 0]];
        pts.forEach(function (pt) { crouch(0, 350); walkTo(pt[0], pt[1], 20, true); });
        sitLook();
      }
      function boxTime() {
        goTo('box');
        morph(STAND, SIT, 600);
        holdPose(SIT, rr(5000, 9000), function (q, p, ms) { q.headYaw = 0.8 * Math.sin(ms / 1500); blink(q, ms); });
        morph(SIT, STAND, 600);
        if (rand() < 0.5) nap('box');
      }
      function keyboard() {
        goTo('desk');
        [14, 15, 16, 17, 18].forEach(function (i) { add(PH_BANNER[i][0], PH_BANNER[i][1], i === 16 ? function () { powerState = 'off'; } : null, 'kbd'); });
        place(KM[0], KM[1], KB_TOP, Math.PI / 4, 'desk');
      }

      /* ---- Poursuite du laser ---- */
      var LASER = null, lastLaserMs = -1e9, laserSeen = 0, chasing = false, curMs = 0;
      function chaseTask(surf) {
        var S = null, STALK = surf === 'floor' ? 5.0 : 3.2, ok = function (x, y) { return SURF[surf].inside(x, y); };
        return function (p, ms) {
          if (!S) S = { x: pc.x, y: pc.y, h: pc.h, ph: 0, mode: 'run', mt: 0, last: ms };
          var dt = Math.min(0.06, (ms - S.last) / 1000); S.last = ms;
          if (curMs - lastLaserMs > 2200 && S.mode !== 'pounce') { this.d = ms; chasing = false; }
          var L = LASER && LASER.surf === surf ? LASER : null, tx = L ? L.x : S.x, ty = L ? L.y : S.y, dx = tx - S.x, dy = ty - S.y, d = Math.hypot(dx, dy), q, z = 0;
          if (S.mode === 'pounce') {                                    // bond : les pattes avant retombent sur le point
            S.mt += dt; var k = Math.min(1, S.mt / S.dur);
            S.x = S.x0 + (S.x1 - S.x0) * k; S.y = S.y0 + (S.y1 - S.y0) * k; z = S.apex * 4 * k * (1 - k);
            q = k < 0.15 ? mixP(CROUCH, TAKEOFF, k / 0.15) : k < 0.55 ? mixP(TAKEOFF, TUCK, (k - 0.15) / 0.4) : mixP(TUCK, REACH, (k - 0.55) / 0.45);
            q.pitch = 0.55 * (0.5 - k);
            if (k >= 1) { S.mode = 'pin'; S.mt = 0; }
          } else if (S.mode === 'pin') {                                // retombée : tapote le point, tête baissée
            S.mt += dt;
            q = mixP(LANDING, CROUCH, Math.min(1, S.mt / 0.25)); q.headPitch = -0.7; q.frontLift = 0.5 * Math.abs(Math.sin(S.mt * 9));
            if (d > 2.2) { S.mode = d > STALK ? 'run' : 'stalk'; S.mt = 0; S.wait = 0.3 + rand() * 0.3; }
          } else if (d > STALK) {                                        // course, ralentit en approchant
            S.mode = 'run';
            var v = Math.max(5, Math.min(22, 2 + (d - STALK + 1) * 4)), hd = Math.atan2(dy, dx);
            S.h = angLerp(S.h, hd, Math.min(1, dt * 9));
            var nx = S.x + Math.cos(S.h) * v * dt, ny = S.y + Math.sin(S.h) * v * dt;
            if (ok(nx, ny)) { S.x = nx; S.y = ny; } else if (ok(nx, S.y)) S.x = nx; else if (ok(S.x, ny)) S.y = ny;
            S.ph += v * dt * (v > 10 ? 1.6 : 2.6);
            q = pose({}, v > 10 ? RUN : WALK);
          } else {                                                       // à portée : se ramasse, remue, puis bondit
            if (S.mode !== 'stalk') { S.mode = 'stalk'; S.mt = 0; S.wait = 0.45 + rand() * 0.4; }
            S.mt += dt; S.h = angLerp(S.h, Math.atan2(dy, dx), Math.min(1, dt * 8));
            q = mixP(STAND, CROUCH, Math.min(1, S.mt / 0.25)); q.headPitch = -0.35; q.earsBack = -0.1;
            if (S.mt > S.wait) {
              var dir = Math.atan2(dy, dx), len = Math.max(0.4, d - 1.4);                // le centre s'arrête 1,4 avant : pattes et tête sur le point
              S.h = dir; S.mode = 'pounce'; S.mt = 0; S.x0 = S.x; S.y0 = S.y;
              S.x1 = S.x + Math.cos(dir) * len; S.y1 = S.y + Math.sin(dir) * len;
              if (!ok(S.x1, S.y1)) { S.x1 = S.x; S.y1 = S.y; }
              S.dur = 0.28 + len * 0.045; S.apex = 0.9 + len * 0.18;
            }
          }
          if (surf !== 'floor' && !L && S.mode === 'run') q = pose({}, STAND);     // point sorti de la surface : elle attend
          var out = at(q, S.x, S.y, surfZ(surf, S.x, S.y) + z, S.h, S.ph);
          if (S.mode === 'stalk') wiggle(out, ms, Math.min(1, S.mt / 0.3));
          return { q: out };
        };
      }
      function canInterrupt() { return cur && (cur.kind === 'hold' || cur.kind === 'morph' || cur.kind === 'walk' || cur.kind === 'turn') && lastQ; }
      var chaseSurf = 'floor', surfSeen = 0;
      /* Va jusqu'à la surface visée (saute dessus ou redescend), puis poursuit le point dessus */
      function startChase(retarget) {
        var from = lastQ, at0 = retarget ? chaseSurf : cur.at, surf = LASER.surf;
        place(from.x, from.y, from.z, from.h, at0);
        Q = []; cur = null; chasing = true; chaseSurf = surf;
        add(retarget ? 250 : 380, function (p) { return { q: at(mixP(from, STAND, eio(p)), from.x, from.y, from.z, from.h) }; }, null, 'morph');
        if (pc.at !== surf) goTo(surf);
        add(1e9, chaseTask(surf), function () { pc.at = surf; }, 'chase');
        add(700, function (p) { return { q: at(mixP(STAND, SIT, eio(p)), pc.x, pc.y, pc.z, pc.h) }; }, null, 'morph');
        add(2500, function (p, ms) { var q = pose({ headYaw: 0.6 * Math.sin(ms / 900) }, SIT); return { q: at(q, pc.x, pc.y, pc.z, pc.h) }; }, null, 'hold');
        add(600, function (p) { return { q: at(mixP(SIT, STAND, eio(p)), pc.x, pc.y, pc.z, pc.h) }; }, null, 'morph');
      }

      /* ---- Choix de la prochaine activité selon l'heure ---- */
      function plan(hour, sunny) {
        var night = hour < 6.5 || hour >= 23, morning = hour >= 6.5 && hour < 10, day = hour >= 10 && hour < 17.5;
        var A = [
          ['napRack', night ? 4 : 2, function () { nap('rack'); }],
          ['napSofa', night ? 4 : 2.5, function () { nap('sofa'); }],
          ['napTree', 2, function () { nap('treeTop'); }],
          ['napSun', day && sunny && sunPatch(hour) ? 5 : 0, function () {
            var sp = sunPatch(hour), cx = 0, cy = 0; sp.forEach(function (p) { cx += p[0] / 4; cy += p[1] / 4; });
            FLOOR.sun[0] = [Math.max(-15, Math.min(12, cx)), Math.max(20.5, Math.min(34, cy))]; nap('sun');
          }],
          ['eat', morning ? 5 : 1.5, function () { eat('food'); }],
          ['drink', 1.5, function () { eat('water'); }],
          ['window', night ? 0.8 : 3.5, watchWindow],
          ['groom', 1.5, function () { goTo('rug'); if (rand() < 0.5) groomPaw(); else groom(); }],
          ['roll', day || (hour >= 17.5 && hour < 23) ? 1.4 : 0.3, function () { rollFloor(day && sunny && sunPatch(hour) ? 'sun' : 'rug'); }],
          ['ball', hour >= 17 && hour < 23 ? 2.4 : night ? 0.3 : 1.3, playBall],
          ['scratch', night ? 0.3 : 1.5, scratch],
          ['zoomies', hour >= 17.5 && hour < 23 ? 2.5 : 0.4, zoomies],
          ['box', 2, boxTime],
          ['sit', 1, function () { sitLook('rug'); }],
          ['keyboard', hour >= 17 && hour < 24 ? 0.6 : 0.15, keyboard]
        ];
        if (opt.activities) A.forEach(function (a) {                      // poids réglables : 0 = jamais, 2 = deux fois plus souvent
          if (opt.activities[a[0]] !== undefined) a[1] *= opt.activities[a[0]];
        });
        if (opt.script) {                                                 // ordre imposé (export vidéo)
          var nm = opt.script[scriptI++ % opt.script.length];
          for (var j = 0; j < A.length; j++) if (A[j][0] === nm) { lastAct = nm; A[j][2](); return; }
        }
        A = A.filter(function (a) { return a[1] > 0 && a[0] !== lastAct; });
        if (!A.length) { sitLook('rug'); return; }                       // toutes les activités désactivées
        var tot = A.reduce(function (s2, a) { return s2 + a[1]; }, 0), r = rand() * tot;
        for (var i = 0; i < A.length; i++) { r -= A[i][1]; if (r <= 0 || i === A.length - 1) { lastAct = A[i][0]; A[i][2](); return; } }
      }

      /* Départ : elle dort sur la baie */
      holdPose(SLEEP, 6000, null, true);
      morph(SLEEP, AWAKE, 1000, function (q, p) { q.eyes = ss(0.4, 0.7, p); });
      morph(AWAKE, STAND, 800);

      return {
        state: function (ms, hour, sunny, input) {
          var dtIn = Math.min(100, ms - curMs); curMs = ms;
          var bdt = dtIn / 1000, nbx = BALL.x + BALL.vx * bdt, nby = BALL.y + BALL.vy * bdt;      // balle : roule et ralentit
          if (!walkable(nbx, BALL.y) || nbx < -2 || nbx > 30) BALL.vx *= -0.6; else BALL.x = nbx;
          if (!walkable(BALL.x, nby) || nby < -9 || nby > 16) BALL.vy *= -0.6; else BALL.y = nby;
          var fr = Math.pow(0.18, bdt); BALL.vx *= fr; BALL.vy *= fr; BALL.rot += Math.hypot(BALL.vx, BALL.vy) * bdt;
          if (input && input.laser) { LASER = input.laser; lastLaserMs = ms; laserSeen += dtIn; } else laserSeen = 0;
          if (input && input.laser && !chasing && canInterrupt()) {
            var asleep = lastQ.curl > 0.5;
            if (!asleep || laserSeen > 1500) startChase(false);
          }
          /* Le point passe sur une autre surface : elle saute dessus (ou redescend) */
          if (chasing && cur && cur.kind === 'chase' && LASER && LASER.surf !== chaseSurf && ms - lastLaserMs < 300) {
            surfSeen += dtIn;
            if (surfSeen > 450) { surfSeen = 0; startChase(true); }
          } else surfSeen = 0;
          while (!cur || ms - curStart >= cur.d) {
            if (cur) { if (lastQ) place(lastQ.x, lastQ.y, lastQ.z, lastQ.h); if (cur.end) cur.end(); curStart += cur.d; }
            else curStart = ms;
            if (!Q.length) { var wasDesk = pc.at === 'desk'; plan(hour, sunny); if (powerState === 'off' && !wasDesk) { powerState = 'boot'; bootAt = ms + 4000; } }
            cur = Q.shift();
            if (ms - curStart > 60000) curStart = ms;                // après une pause (onglet caché) : on repart proprement
          }
          var r = cur.f(Math.min(1, (ms - curStart) / cur.d), ms - curStart);
          /* Caresses : seulement quand elle est posée (sieste, assise, couchée) */
          if (input && input.pet && (cur.kind === 'hold' || cur.kind === 'morph') && r.q.walk < 0.1) {
            r.purr = true;
            if (cur.kind === 'hold') cur.d += dtIn;                              // elle reste tant qu'on la caresse
            if (r.q.curl < 0.5) { r.q.eyes = 0.3; r.q.headPitch += 0.18; r.q.headYaw *= 0.5; r.q.earsBack = 0.15; }
          }
          lastQ = r.q;
          /* Alimentation de la baie et écran */
          if (r.power !== undefined) power = r.power;
          else if (powerState === 'off') power = 0;
          else if (powerState === 'boot') { power = ms < bootAt ? 0 : Math.min(1, (ms - bootAt) / 2500); if (power >= 1) powerState = 'on'; }
          else power = 1;
          if (r.screen === undefined) {
            var nightScreen = hour >= 1 && hour < 7;
            r.screen = power < 0.3 ? 'off' : (powerState === 'boot' && ms - bootAt < 1500) ? 'boot' : nightScreen ? 'off' : 'dash';
          }
          r.power = power;
          if (r.zzz === undefined) r.zzz = 0;
          r.t = ms;
          return r;
        }
      };
    })();
    var TOTAL = PH.reduce(function (s, p) { return s + p[0]; }, 0);

    function stateAt(ms) {
      var t = ((ms % TOTAL) + TOTAL) % TOTAL, i = 0;
      while (t >= PH[i][0]) { t -= PH[i][0]; i++; }
      var r = PH[i][1](t / PH[i][0], t);
      if (r.power === undefined) r.power = 1;
      if (r.screen === undefined) r.screen = 'dash';
      if (r.zzz === undefined) r.zzz = 0;
      r.t = ms;
      return r;
    }

    /* ================= Assemblage ================= */
    var bg = layer(), glass = layer(), vig = layer(), fg = layer();
    g = bg.getContext('2d'); drawRoom(); drawDesk(); drawRack(); drawPlant();
    if (HW) { pumpkin(PUMPKINS[3]); pumpkin(PUMPKINS[0]); pumpkin(PUMPKINS[2]); candle(); drawHalloweenStatic(); }
    if (XM) drawChristmasStatic();
    if (LARGE) { g = bg.getContext('2d'); drawCouch(); drawSill(); drawBoxBack(); }
    g = fg.getContext('2d'); drawChair();
    g = glass.getContext('2d'); drawGlass();
    g = vig.getContext('2d'); drawVignette();
    g = ctx;

    /* opt.catFps : la chatonne (le plus coûteux) est recalculée à ce rythme et réaffichée telle quelle entre deux calculs */
    var lastCat = null, lastCatMs = -1e9;
    function frame(ms) {
      var hour = timeOfDay(ms);
      clockMs = ms;
      if (LIVE) { updateWeather(ms); readInput(); }
      var sunny = WX.cloud < 0.5 && WX.rain < 0.05 && WX.snow < 0.05;
      var st = LIVE ? LIVE.state(ms, hour, sunny, INPUT) : stateAt(ms);
      var fresh = !opt.catFps || !lastCat || ms - lastCatMs >= 1000 / opt.catFps - 1 || ms < lastCatMs;
      var cat = fresh ? buildCat(st.q, ms) : lastCat;
      api.state = st;
      g = ctx;
      ctx.drawImage(bg, 0, 0);
      if (LIVE) { drawSkyLive(hour, ms); drawSunPatch(hour, daylight(hour) * Math.max(0, 1 - WX.cloud * 1.6)); } else drawSky(ms);
      drawLeds(st);
      ctx.drawImage(glass, 0, 0);
      if (HW) drawHalloweenDynamic(ms);
      if (XM) drawChristmasDynamic(ms);
      drawMonitor(st);
      var contacts = [];
      if (Math.abs(st.q.z - KB_TOP) < 0.1) {
        contacts = cat.info.paws.slice();
        if (st.q.bodyZ < 1.4) cat.info.spine.forEach(function (p) { contacts.push([p[0], p[1], 0, 0.55]); });
      }
      drawKeyboard(contacts);
      drawMugSteam(ms);
      var inBox = LARGE && st.q.x > BOX.x0 && st.q.x < BOX.x1 && st.q.y > BOX.y0 && st.q.y < BOX.y1;
      if (LARGE && !inBox) drawBoxFront();
      if (LIVE) { drawBall(); drawLaser(); }
      drawCatShadow(cat);
      if (fresh) { lastBox = renderCat(cat); lastCat = cat; lastCatMs = ms; }
      else if (lastBox) ctx.drawImage(catCv, 0, 0, lastBox.w, lastBox.h, lastBox.x0, lastBox.y0, lastBox.w, lastBox.h);
      drawFace(cat, lastBox);
      if (st.purr) drawHearts(cat.info.head, ms);
      if (inBox) drawBoxFront();
      drawZzz(cat.info.head, ms, st.zzz);
      ctx.drawImage(fg, 0, 0);
      if (LIVE) applyDaylight(hour);
      ctx.drawImage(vig, 0, 0);
    }

    /* ================= Lecture ================= */
    var running = false, paused = false, rafId = 0, loop = null, last = null;
    function start() {
      if (running) return; running = true;
      var visible = true, clock = 0, acc = 0, minDt = opt.fps ? 1000 / opt.fps : 0;
      if (typeof IntersectionObserver !== 'undefined') new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(cv);
      loop = function (now) {
        if (last === null) last = now;
        var dt = Math.min(100, now - last); last = now;
        if (visible && !document.hidden) { clock += dt; acc += dt; if (acc >= minDt) { acc = minDt ? acc % minDt : 0; frame(clock); } }
        rafId = requestAnimationFrame(loop);
      };
      if (!paused) rafId = requestAnimationFrame(loop);
    }
    /* Pause : l'image reste figée, plus aucun calcul ; la reprise continue là où elle s'était arrêtée */
    function pause() {
      paused = true;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }
    function resume() {
      if (!paused) return;
      paused = false;
      if (running && !rafId) { last = null; rafId = requestAnimationFrame(loop); }
    }

    var api = { frame: frame, duration: TOTAL, start: start, pause: pause, resume: resume, isPaused: function () { return paused; },
      canvas: cv, state: null, setWeather: setWeather, setStatus: setStatus, setScreenText: setScreenText, pointer: pointer, pointerLeave: pointerLeave,
      toggleLaser: toggleLaser, set: function (k, v) { opt[k] = v; } };
    if (opt.autoplay !== false) {
      var reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) frame(opt.stillAt); else start();
    }
    return api;
  }

  root.CatScene = { create: createScene, presets: PRESETS, style: CAT_STYLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CatScene;
})(typeof window !== 'undefined' ? window : globalThis);
