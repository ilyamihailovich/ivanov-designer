/* ===========================================================
   Кейс «Контент-система для премиальной клиники».
   Подключается только на этой странице. Без внешних библиотек.
   Анимируются transform, opacity, filter и stroke-dashoffset.
   =========================================================== */
(function () {
  'use strict';

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches ||
                /(^|[?&])reduced=1(&|$)/.test(location.search);
  if (REDUCED) document.documentElement.classList.add('cm-reduced');

  var BG = window.CASE_BG || {};
  var MEDIA = window.CASE_MEDIA || {};
  var FLAGS = window.CASE_MEDIA_FLAGS || {};
  var SHOW = !!FLAGS.showPlaceholders;
  var conn = navigator.connection || {};
  /* постер вместо видео только там, где это оговорено: экономия трафика,
     заведомо медленная сеть и «меньше движения» */
  var LIGHT = !!conn.saveData ||
              /^(slow-2g|2g)$/.test(conn.effectiveType || '') || REDUCED;
  var phone = function () { return innerWidth < 640; };
  var hoverable = matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ---------------- общий обработчик прокрутки ---------------- */
  var jobs = [], ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      for (var i = 0; i < jobs.length; i++) jobs[i]();
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  /* доля прокрутки элемента: 0 — показался снизу, 1 — ушёл вверх */
  function progress(el, a, b) {
    var r = el.getBoundingClientRect(), vh = innerHeight || 1;
    var top = vh * a, bot = -r.height + vh * b;
    var k = (top - r.top) / (top - bot);
    return k < 0 ? 0 : (k > 1 ? 1 : k);
  }

  /* ---------------- появление ---------------- */
  var watched = [];
  function reveal(items, step) {
    var arr = [].slice.call(items);
    if (!arr.length) return;
    watched = watched.concat(arr);
    if (REDUCED || !('IntersectionObserver' in window)) {
      arr.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    /* уже на экране при загрузке — показываем сразу, без анимации */
    arr.forEach(function (e) {
      if (e.getBoundingClientRect().top < innerHeight * 0.92) {
        e.style.transition = 'none';
        e.classList.add('in');
        requestAnimationFrame(function () { e.style.transition = ''; });
      }
    });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = arr.indexOf(e.target);
        if (step) e.target.style.transitionDelay = (i % 8) * step + 'ms';
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    arr.forEach(function (e) { io.observe(e); });
  }

  /* страховка: через 800 мс после загрузки ничего не висит прозрачным */
  addEventListener('load', function () {
    setTimeout(function () {
      watched.forEach(function (e) {
        if (!e.classList.contains('in')) {
          e.style.transition = 'none';
          e.classList.add('in');
        }
      });
    }, 800);
  });

  /* ---------------- видео: только плиты и финальный баннер ---------------- */
  function mountVideo(host, key) {
    var b = BG[key];
    if (!b) return;
    if (LIGHT) {
      if (!b.poster) return;
      var im = document.createElement('img');
      im.src = b.poster; im.alt = ''; im.decoding = 'async';
      host.insertBefore(im, host.firstChild);
      return;
    }
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'metadata';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    if (b.poster) v.poster = b.poster;
    if (b.src.webm) v.appendChild(src(b.src.webm, 'video/webm'));
    if (b.src.mp4) v.appendChild(src(b.src.mp4, 'video/mp4'));
    host.insertBefore(v, host.firstChild);
    function kick() {
      if (v.readyState === 0) { try { v.load(); } catch (e) {} }
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) kick(); else v.pause(); });
      }, { threshold: 0.05, rootMargin: '150px 0px' }).observe(host);
    } else kick();
    setTimeout(function () {
      var r = host.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) kick();
    }, 1200);
  }
  function src(u, t) {
    var s = document.createElement('source');
    s.src = u; s.type = t;
    return s;
  }
  [].forEach.call(document.querySelectorAll('[data-bg]'), function (el) {
    mountVideo(el, el.dataset.bg);
  });

  /* ---------------- медиа-слоты ----------------
     Есть файл — показываем его вместо собранной композиции.
     Нет файла — остаётся композиция из чипов, серых заглушек нет. */
  function hasFile(id) {
    var m = MEDIA[id];
    return !!(m && m.src && (m.type !== 'video' || m.src.mp4 || m.src.webm));
  }
  [].forEach.call(document.querySelectorAll('[data-slot]'), function (host) {
    var ids = host.dataset.slot.split('|');
    var use = null;
    for (var i = 0; i < ids.length; i++) {
      if (hasFile(ids[i].trim())) { use = ids[i].trim(); break; }
    }
    if (!use) {
      if (SHOW) host.setAttribute('data-empty', ids[0]);
      return;
    }
    var m = MEDIA[use];
    host.innerHTML = '';
    if (m.type === 'video' && !LIGHT) {
      host.appendChild((function () {
        var v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true;
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        if (m.poster) v.poster = m.poster;
        if (m.src.webm) v.appendChild(src(m.src.webm, 'video/webm'));
        if (m.src.mp4) v.appendChild(src(m.src.mp4, 'video/mp4'));
        v.play().catch(function () {});
        return v;
      })());
    } else {
      var im = document.createElement('img');
      im.src = (m.type === 'video' ? m.poster : (m.fallback || m.src));
      im.alt = m.alt || ''; im.loading = 'lazy'; im.decoding = 'async';
      host.appendChild(im);
    }
  });

  /* ================= 1. первый экран: дуга плит ================= */
  var arc = document.getElementById('cmArc');
  if (arc) {
    var plates = [].slice.call(arc.querySelectorAll('.plate'));
    function sizeArc() {
      var small = phone();
      var vis = small ? [1, 2, 3] : [0, 1, 2, 3, 4];
      plates.forEach(function (p, i) {
        var show = vis.indexOf(i) > -1;
        p.style.display = show ? '' : 'none';
        if (!show) return;
        var w = +p.dataset.w, h = +p.dataset.h;
        if (small) {
          /* три плиты с перекрытием обязаны влезть в ширину экрана */
          var avail = arc.clientWidth || (innerWidth - 40);
          /* три плиты с перекрытием 24 и без зазора должны влезть
             в ширину контейнера с запасом 12 */
          var k = Math.min(0.68, (avail + 48 - 12) / 660);
          w = Math.round(w * k); h = Math.round(h * k);
        }
        p.style.width = w + 'px';
        p.style.height = h + 'px';
        p.style.setProperty('--ry', (small ? (+p.dataset.ry) * 0.7 : +p.dataset.ry) + 'deg');
        p.style.setProperty('--dy', (small ? (+p.dataset.dy) * 0.5 : +p.dataset.dy) + 'px');
        p.style.setProperty('--dy0', (small ? (+p.dataset.dy) * 0.5 : +p.dataset.dy) + 'px');
      });
      if (small) {
        arc.style.height = '240px';
        arc.style.gap = '0px';
        plates.forEach(function (p, i) {
          p.style.marginInline = (i === 2) ? '-24px' : '0';
          p.style.zIndex = (i === 2) ? 3 : 1;
        });
      } else {
        arc.style.height = '';
        arc.style.gap = '';
        plates.forEach(function (p) { p.style.marginInline = ''; p.style.zIndex = ''; });
      }
    }
    sizeArc();
    addEventListener('resize', sizeArc);
    /* от центра к краям */
    var order = [2, 1, 3, 0, 4].map(function (i) { return plates[i]; });
    reveal(order, 70);
    if (!REDUCED) {
      jobs.push(function () {
        if (phone()) return;
        var k = progress(arc, 0.95, 0.2);
        plates.forEach(function (p) {
          var base = +p.dataset.ry;
          p.style.setProperty('--ry', (base * (1 + k * 0.3)).toFixed(1) + 'deg');
        });
      });
    }
  }

  /* ================= 3. задача ================= */
  var semiSvg = document.getElementById('semiSvg');
  if (semiSvg) {
    var NS = 'http://www.w3.org/2000/svg';
    for (var a = -90; a <= 90; a += 2.5) {
      var rad = a * Math.PI / 180;
      var l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', (160 + Math.cos(rad) * 104).toFixed(1));
      l.setAttribute('y1', (160 + Math.sin(rad) * 104).toFixed(1));
      l.setAttribute('x2', (160 + Math.cos(rad) * 156).toFixed(1));
      l.setAttribute('y2', (160 + Math.sin(rad) * 156).toFixed(1));
      semiSvg.appendChild(l);
    }
  }
  var taskGrid = document.getElementById('taskGrid');
  if (taskGrid) {
    var NS2 = 'http://www.w3.org/2000/svg';
    var tLinks = document.getElementById('taskLinks');
    var claims = [].slice.call(document.querySelectorAll('#claims > *'));
    var answers = [].slice.call(document.querySelectorAll('#answers > *'));
    var semi = document.getElementById('semi');
    function drawTask() {
      if (innerWidth < 1024) { tLinks.innerHTML = ''; return; }
      var r = taskGrid.getBoundingClientRect(), sr = semi.getBoundingClientRect();
      tLinks.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
      tLinks.innerHTML = '';
      var cx = sr.left + sr.width / 2 - r.left, cy = sr.top + sr.height / 2 - r.top;
      var R = Math.min(sr.width, sr.height) / 2 - 4;
      function seg(x1, y1, x2, y2) {
        var p = document.createElementNS(NS2, 'path');
        p.setAttribute('d', 'M' + x1 + ' ' + y1 + ' H' + x2);
        tLinks.appendChild(p);
        var d = document.createElementNS(NS2, 'circle');
        d.setAttribute('cx', x2); d.setAttribute('cy', y2); d.setAttribute('r', 2.5);
        tLinks.appendChild(d);
        var L = p.getTotalLength();
        p.style.strokeDasharray = L;
        p.style.strokeDashoffset = REDUCED ? 0 : L;
        p.style.transition = 'stroke-dashoffset .8s var(--eo)';
        return p;
      }
      var paths = [];
      claims.forEach(function (c) {
        var cr = c.getBoundingClientRect();
        var y = cr.top + cr.height / 2 - r.top;
        var dx = Math.sqrt(Math.max(0, R * R - Math.pow(y - cy, 2)));
        paths.push(seg(cr.right - r.left + 8, y, cx - dx, y));
      });
      answers.forEach(function (c) {
        var cr = c.getBoundingClientRect();
        var y = cr.top + cr.height / 2 - r.top;
        var dx = Math.sqrt(Math.max(0, R * R - Math.pow(y - cy, 2)));
        paths.push(seg(cx + dx, y, cr.left - r.left - 8, y));
      });
      if (!REDUCED && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es, ob) {
          es.forEach(function (e) {
            if (!e.isIntersecting) return;
            paths.forEach(function (p, i) {
              p.style.transitionDelay = (i * 70) + 'ms';
              p.style.strokeDashoffset = '0';
            });
            ob.disconnect();
          });
        }, { threshold: 0.25 });
        io.observe(taskGrid);
      } else {
        paths.forEach(function (p) { p.style.strokeDashoffset = '0'; });
      }
    }
    drawTask();
    addEventListener('resize', drawTask);
    setTimeout(drawTask, 500);
  }

  /* ================= 4. экосистема ================= */
  var flow = document.getElementById('flow');
  if (flow) initFlow();
  function initFlow() {
    var NS3 = 'http://www.w3.org/2000/svg';
    var links = document.getElementById('flowLinks');
    var hub = document.getElementById('hub');
    var deck = document.getElementById('deck');
    var spark = document.getElementById('flowSpark');
    var status = document.getElementById('deckStatus');
    var steps = [].slice.call(document.querySelectorAll('#ecoSteps .step'));
    var ins = [].slice.call(document.querySelectorAll('#flowIns .chip'));
    var paths = [];

    var STATES = [
      { t: 'Не рассмотрено', c: '#A1A1A6' },
      { t: 'Внесена правка', c: '#FF9F0A' },
      { t: 'Согласовано', c: '#34C759' }
    ];

    function layout() {
      var r = flow.getBoundingClientRect();
      links.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
      links.innerHTML = '';
      paths = [];
      var hr = hub.getBoundingClientRect();
      var hx = hr.left + hr.width / 2 - r.left, hy = hr.top + hr.height / 2 - r.top;
      var vertical = phone();
      ins.forEach(function (c) {
        var cr = c.getBoundingClientRect();
        var x = vertical ? cr.left + cr.width / 2 - r.left : cr.right - r.left + 8;
        var y = vertical ? cr.bottom - r.top + 4 : cr.top + cr.height / 2 - r.top;
        paths.push(line(x, y, hx, hy));
      });
      var dr = deck.getBoundingClientRect();
      var dx = vertical ? dr.left + dr.width / 2 - r.left : dr.left - r.left - 8;
      var dy = vertical ? dr.top - r.top - 4 : dr.top + dr.height / 2 - r.top;
      paths.push(line(hx, hy, dx, dy));
    }
    function line(x1, y1, x2, y2) {
      var p = document.createElementNS(NS3, 'path');
      p.setAttribute('class', 'dash');
      p.setAttribute('d', 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2);
      links.appendChild(p);
      [[x1, y1], [x2, y2]].forEach(function (pt) {
        var c = document.createElementNS(NS3, 'circle');
        c.setAttribute('cx', pt[0]); c.setAttribute('cy', pt[1]);
        c.setAttribute('r', 2.5);
        links.appendChild(c);
      });
      return p;
    }

    layout();
    addEventListener('resize', layout);
    setTimeout(layout, 400);

    function setState(i) {
      var s = STATES[i];
      if (!status) return;
      status.innerHTML = '<i style="background:' + s.c + '"></i>' + s.t;
    }

    if (REDUCED) {
      setState(2);
      steps.forEach(function (s) { s.classList.add('on'); });
      spark.style.opacity = '0';
      return;
    }

    var cur = -1;
    jobs.push(function () {
      var k = progress(flow, 0.78, 0.3);
      if (k <= 0 || k >= 1) { spark.style.opacity = '0'; }
      if (k <= 0) {
        cur = -1; setState(0);
        steps.forEach(function (s) { s.classList.remove('on'); });
        return;
      }
      /* точка идёт по линиям: сначала три входа, затем выход */
      var n = paths.length;
      var f = Math.min(0.9999, k) * n;
      var i = Math.floor(f), t = f - i;
      var p = paths[i];
      if (p) {
        var L = p.getTotalLength();
        var pt = p.getPointAtLength(L * t);
        spark.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' +
                                pt.y.toFixed(1) + 'px) translate(-50%,-50%)';
        spark.style.opacity = '1';
      }
      /* восемь шагов и три состояния статуса по той же прокрутке */
      var si = Math.min(steps.length - 1, Math.floor(k * steps.length));
      if (si !== cur) {
        cur = si;
        steps.forEach(function (s, j) { s.classList.toggle('on', j === si); });
        setState(si < 3 ? 0 : (si < 6 ? 1 : 2));
      }
    });
    onScroll();
  }

  /* ================= 5. бенто: параллакс за курсором ================= */
  if (hoverable && !REDUCED) {
    [].forEach.call(document.querySelectorAll('.cell'), function (cell) {
      var f = cell.querySelector('.float');
      if (!f) return;
      cell.addEventListener('pointermove', function (e) {
        var r = cell.getBoundingClientRect();
        var x = ((e.clientX - r.left) / r.width - 0.5) * 16;
        var y = ((e.clientY - r.top) / r.height - 0.5) * 16;
        f.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      cell.addEventListener('pointerleave', function () { f.style.transform = ''; });
    });
  }

  /* ================= 6. бот: плавающие карточки ================= */
  var orbit = document.getElementById('orbit');
  if (orbit) {
    var cards = [].slice.call(orbit.querySelectorAll('.float-card'));
    function placeCards() {
      if (phone()) {
        cards.forEach(function (c) {
          c.style.left = c.style.right = c.style.top = '';
          c.style.removeProperty('--fx');
        });
        return;
      }
      var w = orbit.offsetWidth, ph = 300;
      var side = Math.max(16, (w - ph) / 2 - 260);
      cards.forEach(function (c) {
        var right = +c.dataset.x > 0;
        var jitter = (+c.dataset.top % 7) * 6;
        if (right) { c.style.right = (side + jitter) + 'px'; c.style.left = 'auto'; }
        else { c.style.left = (side + jitter) + 'px'; c.style.right = 'auto'; }
        c.style.top = c.dataset.top + '%';
        c.style.setProperty('--fx', (right ? '40px' : '-40px'));
      });
    }
    placeCards();
    addEventListener('resize', placeCards);
    reveal(cards, 90);
  }

  /* ================= 7. Mini App: изометрический веер ================= */
  var iso = document.getElementById('appIso');
  var seg = document.getElementById('appSeg');
  if (iso && seg) {
    var screens = [].slice.call(iso.querySelectorAll('.screen'));
    var btns = [].slice.call(seg.querySelectorAll('button'));
    function show(k) {
      screens.forEach(function (s, i) {
        var d = i - k;
        var front = d === 0;
        var tx = d * 62, ty = d * 34, tz = front ? 0 : -140 - Math.abs(d) * 40;
        s.style.transform = 'rotateX(50deg) rotateZ(-30deg) translate3d(' +
          tx + 'px,' + ty + 'px,' + tz + 'px)';
        s.style.filter = front ? 'none' : 'blur(4px)';
        s.style.opacity = front ? '1' : '.7';
        s.style.zIndex = front ? 4 : 3 - Math.abs(d);
      });
      btns.forEach(function (b, i) {
        b.setAttribute('aria-selected', String(i === k));
      });
    }
    show(0);
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) show(btns.indexOf(b));
    });
  }

  /* ================= 9. инструменты: ряд карточек ================= */
  var rail = document.getElementById('rail');
  if (rail) {
    var rcards = [].slice.call(rail.querySelectorAll('.rcard'));
    var ri = 0, timer = null, touched = false;
    function setActive(i) {
      ri = i;
      rcards.forEach(function (c, k) { c.classList.toggle('on', k === i); });
    }
    rcards.forEach(function (c, i) {
      if (hoverable) c.addEventListener('mouseenter', function () { touched = true; setActive(i); });
      c.addEventListener('click', function () { touched = true; setActive(i); });
    });
    if (!REDUCED && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !timer) {
            timer = setInterval(function () {
              if (touched) return;
              setActive((ri + 1) % rcards.length);
            }, 4000);
          } else if (!e.isIntersecting && timer) {
            clearInterval(timer); timer = null;
          }
        });
      }, { threshold: 0.3 }).observe(rail);
    }
  }

  /* ================= 11. приложение врача: веер модулей ================= */
  var fanrow = document.getElementById('fanrow');
  if (fanrow) {
    var mods = [].slice.call(fanrow.querySelectorAll('.modcard'));
    function placeMods() {
      if (innerWidth < 640) {
        mods.forEach(function (m) {
          m.style.left = m.style.top = m.style.transform = '';
          m.style.removeProperty('--dim');
          m.classList.remove('far');
        });
        return;
      }
      var w = fanrow.offsetWidth, h = fanrow.offsetHeight;
      /* веер вокруг экрана: центральная карточка сверху, крайние ниже,
         меньше, бледнее и размыты — как в референсе A */
      var place = {
        '-2': [0.06, 0.70], '-1': [0.13, 0.34],
        '0':  [0.50, 0.02],
        '1':  [0.87, 0.34], '2':  [0.94, 0.70]
      };
      var half = mods[0].offsetWidth / 2 || 105;
      mods.forEach(function (m) {
        var a = m.dataset.a, k = place[a];
        var d = Math.abs(+a);
        var sc = 1 - d * 0.07;
        /* карточка не должна уезжать за край ряда */
        var x = Math.min(w - half * 2 - 4, Math.max(4, w * k[0] - half));
        m.style.left = x + 'px';
        m.style.top = (h * k[1]) + 'px';
        m.style.transform = 'scale(' + sc + ') rotate(' + (+a * 2) + 'deg)';
        m.classList.toggle('far', d === 2);
        m.style.setProperty('--dim', d === 2 ? '.72' : (d === 1 ? '.92' : '1'));
      });
    }
    placeMods();
    addEventListener('resize', placeMods);
    reveal(mods, 80);
  }

  /* ---------------- счётчики ---------------- */
  var nums = [].slice.call(document.querySelectorAll('[data-count]'));
  function run(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    var to = parseFloat(el.getAttribute('data-count')) || 0;
    var sfx = el.getAttribute('data-suffix') || '';
    if (REDUCED) { el.textContent = to + sfx; return; }
    var t0 = 0, dur = 800, ok = false;
    setTimeout(function () { if (!ok) el.textContent = to + sfx; }, dur + 400);
    (function step(now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + sfx;
      if (k < 1) requestAnimationFrame(step); else ok = true;
    })(performance.now());
  }
  if (!('IntersectionObserver' in window)) nums.forEach(run);
  else {
    var ioN = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); ioN.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    nums.forEach(function (n) { ioN.observe(n); });
  }
  addEventListener('load', function () { setTimeout(function () { nums.forEach(run); }, 1200); });

  reveal(document.querySelectorAll('.rv'));

  /* ---------------- шапка ---------------- */
  var topEl = document.getElementById('cmTop');
  if (topEl) {
    var stick = function () { topEl.classList.toggle('stuck', scrollY > 8); };
    stick();
    addEventListener('scroll', stick, { passive: true });
  }

  /* ---------------- навигация между кейсами ---------------- */
  var navGrid = document.getElementById('cmNav');
  function buildNav() {
    var all = window.CASES_DATA || [];
    if (!navGrid || !all.length) return;
    var me = -1;
    for (var i = 0; i < all.length; i++) {
      if (all[i].url === 'case-medical-content-system.html') { me = i; break; }
    }
    if (me < 0) return;
    function link(c, label, idx, cls) {
      var a = document.createElement('a');
      a.className = cls;
      a.href = c.url ? c.url : ('index.html#case-' + idx);
      a.innerHTML = '<span class="label"></span><strong></strong>';
      a.querySelector('.label').textContent = label;
      a.querySelector('strong').textContent = c.t;
      return a;
    }
    var pi = (me - 1 + all.length) % all.length, ni = (me + 1) % all.length;
    navGrid.appendChild(link(all[pi], 'Предыдущий кейс', pi, 'c1-5'));
    navGrid.appendChild(link(all[ni], 'Следующий кейс', ni, 'c7-12'));
  }
  var sc = document.createElement('script');
  sc.src = 'cases.js';
  sc.onload = buildNav;
  document.body.appendChild(sc);
})();
