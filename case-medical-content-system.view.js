/* ============================================================
   Поведение страницы кейса.

   Движение собственное: вход блоков — CSS-переходы по классу .in от
   IntersectionObserver, прокручиваемые сцены — один обработчик scroll
   с троттлингом через requestAnimationFrame. Внешняя библиотека не нужна
   ни для чего из этого. Анимируются только transform и opacity; размеры,
   top и left не анимируются нигде.
   prefers-reduced-motion и ?reduced=1 выключают движение целиком,
   оставляя рабочими переключатели, слайдеры и карту.
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches ||
                /(^|[?&])reduced=1(&|$)/.test(location.search);
  if (REDUCED) document.documentElement.classList.add('reduced');

  var MEDIA = window.CASE_MEDIA || {};
  var BG    = window.CASE_BG || {};
  var FLAGS = window.CASE_MEDIA_FLAGS || {};
  var SHOW  = !!FLAGS.showPlaceholders;
  var RATIO = { desktop: 1, phone: 1, square: 1, photo: 1 };
  var isPhone = function () { return innerWidth < 861; };

  var canAnimate = !REDUCED;

  /* Один обработчик прокрутки на всю страницу. */
  var scrollJobs = [], ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      for (var i = 0; i < scrollJobs.length; i++) scrollJobs[i]();
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  /* Доля прокрутки элемента: 0 — только показался, 1 — уходит. */
  function span(el, startVh, endVh) {
    var r = el.getBoundingClientRect(), vh = innerHeight || 1;
    var a = vh * startVh, b = -r.height + vh * endVh;
    var k = (a - r.top) / (a - b);
    return k < 0 ? 0 : (k > 1 ? 1 : k);
  }

  /* Появление по классу .in с задержкой друг за другом. */
  function reveal(items, step, opts) {
    var arr = [].slice.call(items);
    if (!arr.length) return;
    if (REDUCED || !('IntersectionObserver' in window)) {
      arr.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = arr.indexOf(e.target);
        e.target.style.transitionDelay = (i * (step || 70)) + 'ms';
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, opts || { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    arr.forEach(function (e) { io.observe(e); });
  }

  /* Медленная сеть или режим экономии — только постеры. */
  var conn = navigator.connection || {};
  var LIGHT = !!conn.saveData ||
              /^(slow-2g|2g|3g)$/.test(conn.effectiveType || '') || REDUCED;

  /* ---------------- слоты ---------------- */

  function hasFile(id) {
    var m = MEDIA[id];
    return !!(m && m.src && (m.type !== 'video' || m.src.mp4 || m.src.webm));
  }

  function build(id) {
    var m = MEDIA[id], file = hasFile(id);
    if (!file && !SHOW) return null;
    var box = document.createElement('div');
    box.className = 'screen ' + (m && RATIO[m.ratio] ? m.ratio : 'desktop');
    if (!file) {
      var s = document.createElement('span');
      s.className = 'slot';
      s.textContent = (m && m.note) || 'Место под съёмку';
      box.appendChild(s);
      return box;
    }
    if (m.type === 'video') {
      if (LIGHT && m.poster) {
        box.appendChild(img(m.poster, m.alt));
        return box;
      }
      box.appendChild(video(m.src, m.poster, m.alt));
      return box;
    }
    var pic = document.createElement('picture');
    if (m.fallback) {
      var src = document.createElement('source');
      src.srcset = m.src;
      src.type = /\.avif$/i.test(m.src) ? 'image/avif' : 'image/webp';
      pic.appendChild(src);
    }
    pic.appendChild(img(m.fallback || m.src, m.alt));
    box.appendChild(pic);
    return box;
  }

  function img(src, alt) {
    var i = document.createElement('img');
    i.src = src; i.alt = alt || ''; i.loading = 'lazy'; i.decoding = 'async';
    return i;
  }

  /* Видео играет только в зоне видимости, звука нет вовсе. */
  function video(src, poster, alt) {
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    if (poster) v.poster = poster;
    if (alt) v.setAttribute('aria-label', alt);
    if (src.webm) v.appendChild(source(src.webm, 'video/webm'));
    if (src.mp4)  v.appendChild(source(src.mp4, 'video/mp4'));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) v.play().catch(function () {});
          else v.pause();
        });
      }, { threshold: 0.15 }).observe(v);
    }
    return v;
  }
  function source(src, type) {
    var s = document.createElement('source');
    s.src = src; s.type = type;
    return s;
  }

  /* Фоновое видео: на медленной сети и в reduced-motion — постер. */
  function bg(key, alt) {
    var b = BG[key];
    if (!b) return null;
    if (LIGHT) return b.poster ? img(b.poster, alt || '') : null;
    return video(b.src, b.poster, alt || '');
  }

  /* ---------------- перестройка без пустых слотов ---------------- */

  function kids(el) {
    var n = 0;
    [].forEach.call(el.children, function (c) {
      if (c.nodeType === 1 && !c.hasAttribute('hidden')) n++;
    });
    return n;
  }
  function solo(grid) {
    var cl = null, cr = null;
    [].forEach.call(grid.children, function (c) {
      if (c.classList && c.classList.contains('cl')) cl = c;
      if (c.classList && c.classList.contains('cr')) cr = c;
    });
    if (cl && !cr) cl.classList.add('full');
    if (cr && !cl) cr.classList.add('full');
  }
  function drop(el) {
    var grid = el.closest('.grid'), col = el.parentNode;
    el.remove();
    while (col && col !== grid && col.classList &&
           (col.classList.contains('cl') || col.classList.contains('cr')) &&
           !kids(col)) {
      var up = col.parentNode; col.remove(); col = up;
    }
    if (grid) { if (!kids(grid)) grid.remove(); else solo(grid); }
  }

  /* data-slots="a|b" — взять первый слот, у которого есть файл */
  [].forEach.call(document.querySelectorAll('[data-slots]'), function (host) {
    var made = 0;
    host.getAttribute('data-slots').split(',').forEach(function (group) {
      var ids = group.trim().split('|');
      for (var i = 0; i < ids.length; i++) {
        if (!hasFile(ids[i].trim()) && i < ids.length - 1) continue;
        var el = build(ids[i].trim());
        if (el) { host.appendChild(el); made++; }
        break;
      }
    });
    if (!made) host.classList.add('empty');
  });

  /* ================= 1. первый экран: стеклянные плиты ================= */

  var plates = document.getElementById('plates');
  if (plates) {
    var ps = [].slice.call(plates.querySelectorAll('.plate'));
    var mid = (ps.length - 1) / 2;
    ps.forEach(function (p, i) {
      p.style.height = 'clamp(132px, ' + (p.dataset.h * 0.165) + 'vw, ' +
                       (p.dataset.h * 2.2) + 'px)';
      p.style.setProperty('--ry', (-(i - mid) * 6).toFixed(1) + 'deg');
      p.style.setProperty('--pz', (-Math.abs(i - mid) * 22).toFixed(0) + 'px');
      /* каждая плита показывает свой участок видео, чтобы свечение
         не повторялось один в один */
      p.style.setProperty('--op', (14 + i * 14) + '%');
      if (p.dataset.v === '1' && !isPhone()) {
        var v = bg('plates', '');
        if (v) {
          var fill = p.querySelector('.fill');
          fill.insertBefore(v, fill.firstChild);
          /* режим color берёт у градиента тон, у видео — свет:
             белая колонна в кадре окрашивается в акцент */
          fill.querySelector('.glow').style.opacity = '.85';
          fill.querySelector('.glow').style.mixBlendMode = 'color';
        }
      }
    });
    /* лента на телефоне всегда начинается с первой плиты: Safari
       восстанавливает горизонтальную прокрутку snap-контейнера */
    if (isPhone()) {
      plates.scrollLeft = 0;
      requestAnimationFrame(function () { plates.scrollLeft = 0; });
    }

    /* плиты поднимаются снизу друг за другом */
    if (REDUCED) ps.forEach(function (p) { p.classList.add('in'); });
    else setTimeout(function () {
      ps.forEach(function (p, i) {
        p.style.transitionDelay = (i * 80) + 'ms';
        p.classList.add('in');
      });
      setTimeout(function () {
        ps.forEach(function (p) { p.style.transitionDelay = ''; });
      }, 1400);
    }, 120);

    /* при прокрутке слегка расходятся и наклоняются к зрителю */
    if (canAnimate) {
      scrollJobs.push(function () {
        if (isPhone()) return;
        var k = span(plates, 0.9, 0.1);
        ps.forEach(function (p, i) {
          var d = i - mid;
          p.style.setProperty('--ry', (-d * (4.4 + k * 5.2)).toFixed(1) + 'deg');
          p.style.setProperty('--sy', (-k * Math.abs(d) * 8).toFixed(1) + 'px');
        });
      });
    }
  }

  /* ================= 3. задача: радиальная графика ================= */

  var radial = document.getElementById('radialSvg');
  if (radial) {
    var NS = 'http://www.w3.org/2000/svg';
    var VB = { w: 400, h: 330 };
    var cx = 200, cy = 262, r0 = 92, r1 = 158;
    var strokes = [], conn2 = [];

    /* полукруг из тонких радиальных штрихов */
    for (var a = 182; a <= 358; a += 3.6) {
      var rad = a * Math.PI / 180;
      var major = Math.abs(a % 18) < 2;
      var len = major ? r1 : r1 - 30;
      var l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', (cx + Math.cos(rad) * r0).toFixed(1));
      l.setAttribute('y1', (cy + Math.sin(rad) * r0).toFixed(1));
      l.setAttribute('x2', (cx + Math.cos(rad) * len).toFixed(1));
      l.setAttribute('y2', (cy + Math.sin(rad) * len).toFixed(1));
      l.setAttribute('stroke', 'rgba(14,42,70,' + (major ? '.34' : '.18') + ')');
      l.setAttribute('stroke-width', major ? '1.3' : '1');
      l.setAttribute('stroke-linecap', 'round');
      radial.appendChild(l);
      strokes.push(l);
    }

    /* тонкие линии от утверждений к точкам на дуге */
    var claims = document.getElementById('claims');
    var lis = claims ? [].slice.call(claims.children) : [];
    lis.forEach(function () {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'rgba(14,42,70,.24)');
      p.setAttribute('stroke-width', '1');
      radial.insertBefore(p, radial.firstChild);
      conn2.push(p);
    });

    function drawConnectors() {
      if (!lis.length || innerWidth < 1024) return;
      var rr = radial.getBoundingClientRect();
      var kx = VB.w / rr.width, ky = VB.h / rr.height;
      lis.forEach(function (li, i) {
        var lr = li.getBoundingClientRect();
        var sx = (lr.right - rr.left) * kx + 16;
        var sy = (lr.top + lr.height / 2 - rr.top) * ky;
        /* каждая линия приходит в свою точку дуги */
        var ang = (196 + i * 22) * Math.PI / 180;
        var tx = cx + Math.cos(ang) * (r0 - 3);
        var ty = cy + Math.sin(ang) * (r0 - 3);
        var d = 'M' + sx.toFixed(1) + ' ' + sy.toFixed(1) +
                ' C' + (sx + 60).toFixed(1) + ' ' + sy.toFixed(1) + ' ' +
                (tx - 46).toFixed(1) + ' ' + ty.toFixed(1) + ' ' +
                tx.toFixed(1) + ' ' + ty.toFixed(1);
        conn2[i].setAttribute('d', d);
        var L = conn2[i].getTotalLength();
        conn2[i].style.strokeDasharray = L;
        if (!conn2[i].dataset.shown) conn2[i].style.strokeDashoffset = L;
      });
    }

    strokes.forEach(function (l, i) {
      l.style.transitionDelay =
        (Math.abs(i - strokes.length / 2) * 7).toFixed(0) + 'ms';
    });

    function showRadial() {
      radial.parentNode.classList.add('in');
      conn2.forEach(function (p, i) {
        p.dataset.shown = '1';
        p.style.transitionDelay = (i * 90) + 'ms';
        p.style.strokeDashoffset = '0';
      });
    }

    drawConnectors();
    addEventListener('resize', drawConnectors);

    if (canAnimate && 'IntersectionObserver' in window) {
      var ioRad = new IntersectionObserver(function (es, ob) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          drawConnectors();
          showRadial();
          ob.disconnect();
        });
      }, { threshold: 0.2 });
      ioRad.observe(radial);
    } else {
      showRadial();
    }
  }

  /* ================= 4. карта экосистемы ================= */

  var canvas = document.getElementById('canvas');
  if (canvas) initMap();

  function initMap() {
    var NS = 'http://www.w3.org/2000/svg';
    var links = document.getElementById('links');
    var core  = document.getElementById('core');
    var pulse = document.getElementById('pulse');
    var cap   = document.getElementById('stepcap');
    var list  = document.getElementById('stepList');

    var NODES = [
      { id: 'shoot', t: 'Съёмка и монтаж', i: 'i-cam',
        d: [13, 26], m: [26, 7] },
      { id: 'figma', t: 'Figma-плагины', i: 'i-puzzle',
        d: [10, 64], m: [72, 17] },
      { id: 'ai', t: 'ИИ-продакшн', i: 'i-spark',
        d: [26, 90], m: [27, 28] },
      { id: 'bot', t: 'Telegram-бот', i: 'i-chat',
        d: [62, 14], m: [74, 68] },
      { id: 'app', t: 'Mini App', i: 'i-cal',
        d: [89, 48], m: [27, 77] },
      { id: 'pub', t: 'Публикация', i: 'i-send',
        d: [73, 88], m: [68, 92] }
    ];

    var el = {};
    NODES.forEach(function (n) {
      var b = document.createElement('span');
      b.className = 'node';
      b.dataset.id = n.id;
      b.innerHTML = '<svg aria-hidden="true"><use href="#' + n.i + '"/></svg>';
      b.appendChild(document.createTextNode(n.t));
      canvas.appendChild(b);
      el[n.id] = b;
    });

    var cv = bg('core', '');
    if (cv) core.insertBefore(cv, core.firstChild);

    var STEPS = [
      { t: 'Материал загружен в бот',                         seg: ['shoot', 'core', 'bot'] },
      { t: 'Бот спрашивает, согласован ли материал с врачом', seg: ['bot'] },
      { t: 'Согласующие получают уведомление',                seg: ['bot'] },
      { t: 'Правка оставлена прямо к материалу',              seg: ['loop1'] },
      { t: 'Новая версия с историей правки',                  seg: ['loop2'] },
      { t: 'Финальное решение основного согласующего',        seg: ['bot', 'core'] },
      { t: 'Статус появляется в календаре Mini App',          seg: ['core', 'app'] },
      { t: 'Публикация по плану',                             seg: ['app', 'core', 'pub'] }
    ];

    var W = 0, H = 0, pos = {}, paths = [];

    function layout() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      var phone = isPhone();
      pos = { core: [W / 2, H / 2] };
      NODES.forEach(function (n) {
        var c = phone ? n.m : n.d;
        pos[n.id] = [W * c[0] / 100, H * c[1] / 100];
      });
      NODES.forEach(function (n) {
        var b = el[n.id];
        b.style.left = pos[n.id][0] + 'px';
        b.style.top  = pos[n.id][1] + 'px';
      });
      /* не дать плашке вылезти за край на узком экране */
      NODES.forEach(function (n) {
        var b = el[n.id], br = b.getBoundingClientRect();
        var off = 0;
        if (br.left < r.left + 4) off = r.left + 4 - br.left;
        if (br.right > r.right - 4) off = r.right - 4 - br.right;
        if (off) {
          pos[n.id][0] += off;
          b.style.left = pos[n.id][0] + 'px';
        }
      });

      links.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      links.innerHTML = '';
      NODES.forEach(function (n) { line(pos[n.id], pos.core); });
      line(pos.bot, pos.app);

      buildRoute();
    }

    function line(a, b) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M' + a[0] + ' ' + a[1] + ' L' + b[0] + ' ' + b[1]);
      links.appendChild(p);
      return p;
    }

    /* маршрут рилса: восемь отрезков, каждый из которых касается базы */
    function buildRoute() {
      paths = [];
      STEPS.forEach(function (s) {
        var p = document.createElementNS(NS, 'path');
        var d;
        if (s.seg[0] === 'loop1' || s.seg[0] === 'loop2') {
          var c = pos.bot, R = Math.min(W, H) * 0.075;
          var sweep = s.seg[0] === 'loop1' ? 1 : 1;
          var y0 = s.seg[0] === 'loop1' ? c[1] - R : c[1] + R;
          var y1 = s.seg[0] === 'loop1' ? c[1] + R : c[1] - R;
          d = 'M' + c[0] + ' ' + y0 + ' A' + R + ' ' + R + ' 0 0 ' + sweep +
              ' ' + c[0] + ' ' + y1;
        } else if (s.seg.length === 1) {
          var q = pos[s.seg[0]];
          d = 'M' + q[0] + ' ' + q[1] + ' L' + q[0] + ' ' + q[1];
        } else {
          d = 'M' + pos[s.seg[0]][0] + ' ' + pos[s.seg[0]][1];
          for (var i = 1; i < s.seg.length; i++) {
            d += ' L' + pos[s.seg[i]][0] + ' ' + pos[s.seg[i]][1];
          }
        }
        p.setAttribute('d', d);
        paths.push(p);
      });
    }

    var cur = -1;
    function at(k) {
      var f = Math.min(0.9999, Math.max(0, k)) * STEPS.length;
      var i = Math.floor(f), t = f - i;
      var p = paths[i];
      if (!p) return;
      var L = p.getTotalLength();
      var pt = L ? p.getPointAtLength(L * t) : p.getPointAtLength(0);
      pulse.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' +
                              pt.y.toFixed(1) + 'px) translate(-50%,-50%)';
      pulse.style.opacity = '1';
      if (i !== cur) {
        cur = i;
        cap.textContent = STEPS[i].t;
        cap.classList.add('on');
        var active = STEPS[i].seg.filter(function (s) {
          return s !== 'core' && s.indexOf('loop') !== 0;
        }).pop() || 'bot';
        NODES.forEach(function (n) {
          el[n.id].classList.toggle('on', n.id === active);
        });
        core.style.transform = 'translate(-50%,-50%) scale(1.06)';
        setTimeout(function () {
          core.style.transform = 'translate(-50%,-50%) scale(1)';
        }, 320);
      }
    }

    layout();
    addEventListener('resize', layout);

    /* фон карты */
    var mb = document.getElementById('mapBg');
    if (mb) { var mv = bg('map', ''); if (mv) mb.appendChild(mv); }

    if (REDUCED) {
      /* статичная карта: все связи видны, импульс стоит, шаги списком */
      pulse.style.opacity = '0';
      cap.textContent = '';
      NODES.forEach(function (n) { el[n.id].classList.add('on'); });
      if (list) list.style.display = 'block';
      return;
    }
    if (list) list.style.display = 'none';

    if (canAnimate) {
      scrollJobs.push(function () {
        var k = span(canvas, 0.62, 0.38);
        if (k <= 0) {
          pulse.style.opacity = '0';
          cap.classList.remove('on');
          cur = -1;
          NODES.forEach(function (n) { el[n.id].classList.remove('on'); });
          return;
        }
        at(k);
      });
      onScroll();
    } else {
      at(0.99);
    }
  }

  /* ================= 5. бенто: парящие фрагменты ================= */

  [].forEach.call(document.querySelectorAll('.cell[data-frags]'), function (cell) {
    var ids = cell.dataset.frags.split(',').map(function (s) { return s.trim(); });
    var art = cell.querySelector('.art');
    var made = 0;
    ids.forEach(function (id, i) {
      if (!hasFile(id)) return;
      var f = document.createElement('span');
      f.className = 'frag' + (i ? ' far' : '');
      f.style.cssText = i
        ? 'left:48%;top:10%;width:44%;aspect-ratio:9/16;transform:rotate(4deg)'
        : 'left:8%;top:14%;width:46%;aspect-ratio:9/16;transform:rotate(-5deg)';
      var el = build(id);
      if (el) {
        var inner = el.firstChild;
        f.appendChild(inner || el);
        art.appendChild(f);
        made++;
      }
    });
    if (made) {
      var blob = art.querySelector('.blob');
      if (blob) blob.style.opacity = '.3';
      if (!REDUCED && matchMedia('(hover:hover) and (min-width:861px)').matches) {
        parallax(cell, art.querySelectorAll('.frag'), 9);
      }
    }
  });

  /* ================= 6. бот: плавающие карточки ================= */

  var orbit = document.getElementById('orbit');
  if (orbit) {
    var floats = [].slice.call(orbit.querySelectorAll('.float'));
    var oc = orbit.querySelector('.center');
    /* без центрального экрана карточкам не вокруг чего летать */
    if (oc && !kids(oc)) orbit.classList.add('flat');
    function placeFloats() {
      var wide = !isPhone() && !orbit.classList.contains('flat');
      floats.forEach(function (f) {
        if (!wide) { f.style.left = f.style.top = ''; return; }
        f.style.left = (50 + (+f.dataset.x)) + '%';
        f.style.top  = (50 + (+f.dataset.y)) + '%';
        /* карточка приходит со своей стороны */
        f.style.setProperty('--exs', ((+f.dataset.x) > 0 ? 40 : -40) + 'px');
        f.style.transform =
          'translate(-50%,-50%) translate(var(--ex,0px), var(--ey2,0px))';
        f.dataset.base = f.style.transform;
      });
    }
    placeFloats();
    addEventListener('resize', placeFloats);
    reveal(floats, 80);
    if (canAnimate && matchMedia('(hover:hover) and (min-width:1024px)').matches) {
      parallax(orbit, floats, 8);
    }
  }

  /* ================= 7. Mini App: веер экранов ================= */

  var fan = document.getElementById('appFan');
  var seg = document.getElementById('appSeg');
  if (fan && seg) {
    var btns = [].slice.call(seg.querySelectorAll('button'));
    var cards = [];
    btns.forEach(function (b) {
      var sc = build(b.dataset.slot);
      if (!sc) return;
      var c = document.createElement('div');
      c.className = 'card3d';
      c.appendChild(sc);
      fan.appendChild(c);
      cards.push({ btn: b, el: c });
    });
    if (!cards.length) {
      /* ни одного файла — веер и переключатель не нужны */
      var col = document.getElementById('appCol');
      if (col) { var g = col.closest('.grid'); col.remove(); if (g) solo(g); }
    } else {
      if (cards.length < 2) seg.hidden = true;
      var show = function (k) {
        cards.forEach(function (c, i) {
          var d = i - k;
          var front = d === 0;
          c.el.style.transform =
            'translateX(' + (d * 17) + '%) translateZ(' + (front ? 0 : -190) +
            'px) rotateY(' + (d * -15) + 'deg) scale(' + (front ? 1 : 0.9) + ')';
          c.el.style.filter = front ? 'none' : 'blur(4px)';
          c.el.style.opacity = front ? '1' : '.72';
          c.el.style.zIndex = front ? 3 : 2 - Math.abs(d);
          c.btn.setAttribute('aria-selected', String(front));
        });
      };
      show(0);
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        cards.forEach(function (c, i) { if (c.btn === b) show(i); });
      });
    }
  }

  /* ================= 9. инструменты: ряд карточек ================= */

  var rail = document.getElementById('rail');
  if (rail) {
    var rs = [].slice.call(rail.querySelectorAll('.rcard'));
    rs.forEach(function (c) {
      var p = build(c.dataset.slot);
      if (p) {
        var prev = c.querySelector('.prev');
        prev.appendChild(p.firstChild || p);
      }
    });
    var ri = 0, timer = null;
    function setActive(i) {
      ri = i;
      rs.forEach(function (c, k) { c.classList.toggle('on', k === i); });
    }
    setActive(0);
    if (matchMedia('(hover:hover) and (min-width:861px)').matches) {
      rs.forEach(function (c, i) {
        c.addEventListener('mouseenter', function () { setActive(i); });
      });
    }
    /* автосмена раз в 4 секунды, пока секция в зоне видимости */
    if (!REDUCED && 'IntersectionObserver' in window && !isPhone()) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !timer) {
            timer = setInterval(function () { setActive((ri + 1) % rs.length); }, 4000);
          } else if (!e.isIntersecting && timer) {
            clearInterval(timer); timer = null;
          }
        });
      }, { threshold: 0.3 }).observe(rail);
    }
  }

  /* ---------------- слайдеры «до и после» ---------------- */

  [].forEach.call(document.querySelectorAll('.cmp'), function (cmp) {
    var ea = build(cmp.dataset.a), eb = build(cmp.dataset.b);
    if (!ea || !eb) { drop(cmp); return; }
    var a = document.createElement('div'); a.className = 'a';
    var b = document.createElement('div'); b.className = 'b';
    a.appendChild(ea); b.appendChild(eb);
    var bar = document.createElement('span'); bar.className = 'bar';
    cmp.insertBefore(b, cmp.firstChild);
    cmp.insertBefore(a, cmp.firstChild);
    cmp.appendChild(bar);
    cmp.style.setProperty('--x', '50%');
    var down = false;
    function at2(e) {
      var r = cmp.getBoundingClientRect();
      var v = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      cmp.style.setProperty('--x', (v * 100).toFixed(2) + '%');
    }
    cmp.addEventListener('pointerdown', function (e) {
      down = true; cmp.setPointerCapture(e.pointerId); at2(e);
    });
    cmp.addEventListener('pointermove', function (e) { if (down) at2(e); });
    cmp.addEventListener('pointerup', function () { down = false; });
    cmp.addEventListener('pointercancel', function () { down = false; });
    cmp.addEventListener('touchmove', function (e) {
      if (down && e.cancelable) e.preventDefault();
    }, { passive: false });
  });

  /* ================= 11. дуга карточек модулей ================= */

  var arc = document.getElementById('arc');
  if (arc) {
    var acs = [].slice.call(arc.querySelectorAll('.acard'));
    var ac = arc.querySelector('.center');
    if (ac && !kids(ac)) arc.classList.add('flat');
    function placeArc() {
      var wide = innerWidth >= 1024 && !arc.classList.contains('flat');
      acs.forEach(function (c) {
        if (!wide) { c.style.transform = ''; c.classList.remove('far'); return; }
        var a = (+c.dataset.a) * Math.PI / 180;
        var R = Math.min(arc.offsetWidth, 980) * 0.47;
        c.style.left = '50%';
        c.style.top = '50%';
        c.style.transform = 'translate(-50%,-50%) translate(' +
          (Math.sin(a) * R).toFixed(0) + 'px,' +
          (-Math.cos(a) * R * 0.52 + R * 0.3).toFixed(0) + 'px) rotate(' +
          ((+c.dataset.a) * 0.12).toFixed(1) + 'deg) ' +
          'translateY(var(--ey2,0px))';
        c.dataset.base = c.style.transform;
        c.classList.toggle('far', Math.abs(+c.dataset.a) > 60);
      });
    }
    placeArc();
    addEventListener('resize', placeArc);
    reveal(acs, 70);
    if (canAnimate && matchMedia('(hover:hover) and (min-width:1024px)').matches) {
      parallax(arc, acs, 7);
    }
  }

  /* ================= 12. финал: видео под баннером ================= */

  var banner = document.getElementById('banner');
  if (banner) {
    var bv = bg('banner', '');
    if (bv) {
      if (bv.tagName === 'IMG') bv.className = 'bgv';
      banner.insertBefore(bv, banner.firstChild);
    }
  }

  /* ---------------- счётчики ---------------- */

  var nums = [].slice.call(document.querySelectorAll('[data-count]'));
  function run(el) {
    var to = parseFloat(el.getAttribute('data-count')) || 0;
    var sfx = el.getAttribute('data-suffix') || '';
    if (REDUCED) { el.textContent = to + sfx; return; }
    var t0 = 0, dur = 900, done = false;
    /* страховка: если кадры не идут (вкладка в фоне), цифра всё равно встанет */
    setTimeout(function () { if (!done) el.textContent = to + sfx; }, dur + 400);
    (function step(now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + sfx;
      if (k < 1) requestAnimationFrame(step); else done = true;
    })(performance.now());
  }
  if (!('IntersectionObserver' in window)) nums.forEach(run);
  else {
    var ioN = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        ioN.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { ioN.observe(n); });
  }

  /* ---------------- появление блоков ---------------- */

  var rv = [].slice.call(document.querySelectorAll('.rv'));
  if (REDUCED || !('IntersectionObserver' in window)) {
    rv.forEach(function (e) { e.classList.add('in'); });
  } else {
    var ioR = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); ioR.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    rv.forEach(function (e) { ioR.observe(e); });
  }

  /* ---------------- параллакс за курсором ---------------- */

  function parallax(host, items, max) {
    var arr = [].slice.call(items), raf = 0, tx = 0, ty = 0, x = 0, y = 0;
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    host.addEventListener('pointerleave', function () {
      tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    function tick() {
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      arr.forEach(function (it, i) {
        var k = (i % 2 ? 1 : -0.65) * max;
        it.style.setProperty('--px', (x * k).toFixed(1) + 'px');
        it.style.setProperty('--pyy', (y * k).toFixed(1) + 'px');
        var base = it.dataset.base || '';
        if (!it.dataset.base) {
          base = it.style.transform || '';
          it.dataset.base = base;
        }
        it.style.transform = base + ' translate(' + (x * k).toFixed(1) + 'px,' +
                             (y * k).toFixed(1) + 'px)';
      });
      raf = (Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002)
        ? requestAnimationFrame(tick) : 0;
    }
  }

  /* ---------------- шапка ---------------- */

  var topEl = document.getElementById('top');
  if (topEl) {
    var stick = function () { topEl.classList.toggle('stuck', scrollY > 8); };
    stick();
    addEventListener('scroll', stick, { passive: true });
  }

  /* ---------------- соседние кейсы ---------------- */

  var nav = document.getElementById('cnav');
  function buildNav() {
    var all = window.CASES_DATA || [];
    if (!nav || !all.length) return;
    var me = -1;
    for (var i = 0; i < all.length; i++) {
      if (all[i].url === 'case-medical-content-system.html') { me = i; break; }
    }
    if (me < 0) return;
    function link(c, label, idx) {
      var a = document.createElement('a');
      a.href = c.url ? c.url : ('index.html#case-' + idx);
      a.innerHTML = '<small></small><strong></strong>';
      a.querySelector('small').textContent = label;
      a.querySelector('strong').textContent = c.t;
      return a;
    }
    var pi = (me - 1 + all.length) % all.length, ni = (me + 1) % all.length;
    nav.appendChild(link(all[pi], 'Предыдущий кейс', pi));
    nav.appendChild(link(all[ni], 'Следующий кейс', ni));
  }
  var sc2 = document.createElement('script');
  sc2.src = 'cases.js';
  sc2.onload = buildNav;
  document.body.appendChild(sc2);
})();
