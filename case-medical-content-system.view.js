/* ============================================================
   Поведение страницы кейса.

   Без внешних библиотек. Появление блоков — CSS-переходы по классу
   .in от IntersectionObserver, с двумя страховками: элементы, уже
   видимые при загрузке, показываются сразу, а через секунду после
   загрузки показывается всё оставшееся — пустых мест не остаётся
   ни при каких условиях.
   Прокручиваемая сцена одна (карта), её ведёт общий обработчик scroll.
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches ||
                /(^|[?&])reduced=1(&|$)/.test(location.search);
  if (REDUCED) document.documentElement.classList.add('reduced');

  var BG = window.CASE_BG || {};
  var conn = navigator.connection || {};
  var LIGHT = !!conn.saveData ||
              /^(slow-2g|2g|3g)$/.test(conn.effectiveType || '') || REDUCED;
  var isPhone = function () { return innerWidth < 768; };

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

  /* ---------------- видео ----------------
     Показывается чётко: без размытия, без наложений и без снижения
     непрозрачности. Играет только в зоне видимости. */
  function mountVideo(host, key) {
    var b = BG[key];
    if (!b) return null;
    if (LIGHT) {
      if (!b.poster) return null;
      var im = document.createElement('img');
      im.src = b.poster; im.alt = ''; im.decoding = 'async';
      host.insertBefore(im, host.firstChild);
      return im;
    }
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true;
    v.preload = 'metadata';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    if (b.poster) v.poster = b.poster;
    if (b.src.webm) v.appendChild(src(b.src.webm, 'video/webm'));
    if (b.src.mp4)  v.appendChild(src(b.src.mp4, 'video/mp4'));
    host.insertBefore(v, host.firstChild);

    function kick() {
      /* если метаданные так и не пришли, просим загрузку явно */
      if (v.readyState === 0) { try { v.load(); } catch (e) {} }
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) kick(); else v.pause();
        });
      }, { threshold: 0.05, rootMargin: '120px 0px' }).observe(host);
    } else kick();
    /* подстраховка: некоторые браузеры не начинают загрузку
       до первого взаимодействия со страницей */
    setTimeout(function () {
      var r = host.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) kick();
    }, 1200);
    return v;
  }
  function src(u, t) {
    var s = document.createElement('source');
    s.src = u; s.type = t;
    return s;
  }

  [].forEach.call(document.querySelectorAll('[data-bg]'), function (el) {
    mountVideo(el, el.dataset.bg);
  });

  /* ---------------- появление ---------------- */
  var revealed = [];
  function show(el) {
    if (el.classList.contains('in')) return;
    el.classList.add('in');
  }
  function armReveal(items, step) {
    var arr = [].slice.call(items);
    if (!arr.length) return;
    revealed = revealed.concat(arr);
    if (REDUCED || !('IntersectionObserver' in window)) {
      arr.forEach(show);
      return;
    }
    /* то, что уже на экране при загрузке, показываем сразу */
    arr.forEach(function (e) {
      var r = e.getBoundingClientRect();
      if (r.top < innerHeight * 0.95) show(e);
    });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = arr.indexOf(e.target);
        if (step) e.target.style.transitionDelay = (i % 6) * step + 'ms';
        show(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    arr.forEach(function (e) { io.observe(e); });
  }
  armReveal(document.querySelectorAll('.rv'));

  /* ---------------- первый экран ---------------- */
  var fan = document.getElementById('fan');
  if (fan) {
    var cards = [].slice.call(fan.querySelectorAll('.vcard'));
    function sizeFan() {
      cards.forEach(function (c) {
        c.style.height = isPhone() ? '' : c.dataset.h + 'px';
        c.style.setProperty('--ry', isPhone() ? '0deg' : c.dataset.ry + 'deg');
      });
      if (isPhone()) fan.scrollLeft = 0;
    }
    sizeFan();
    addEventListener('resize', sizeFan);
    armReveal(cards, 80);
  }

  /* ---------------- связи «утверждение → ответ» ---------------- */
  var relate = document.getElementById('relate');
  if (relate) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.getElementById('relLinks');
    var claims = [].slice.call(document.querySelectorAll('#claims > li'));
    var answers = [].slice.call(document.querySelectorAll('#answers > .answer'));
    function drawRelate() {
      if (innerWidth < 1024) { svg.innerHTML = ''; return; }
      var r = relate.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
      svg.innerHTML = '';
      var pairs = [[0, 0], [1, 0], [2, 2], [3, 1]];
      pairs.forEach(function (p) {
        var a = claims[p[0]], b = answers[p[1]];
        if (!a || !b) return;
        var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        var x1 = ra.right - r.left, y1 = ra.top + ra.height / 2 - r.top;
        var x2 = rb.left - r.left,  y2 = rb.top + rb.height / 2 - r.top;
        var mx = (x1 + x2) / 2;
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 +
                               ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2);
        svg.appendChild(path);
      });
    }
    drawRelate();
    addEventListener('resize', drawRelate);
    setTimeout(drawRelate, 400);
  }

  /* ---------------- карта экосистемы ---------------- */
  var canvas = document.getElementById('canvas');
  if (canvas) initMap();

  function initMap() {
    var NS = 'http://www.w3.org/2000/svg';
    var wires = document.getElementById('wires');
    var core  = document.getElementById('core');
    var spark = document.getElementById('spark');
    var cap   = document.getElementById('stepcap');
    var list  = document.getElementById('stepList');

    mountVideo(core, 'core');

    /* шесть узлов на одной окружности через равные 60°,
       по часовой стрелке в порядке маршрута */
    var NODES = [
      { id: 'shoot', t: 'Съёмка и монтаж', i: 'i-cam',    a: -90 },
      { id: 'bot',   t: 'Telegram-бот',    i: 'i-chat',   a: -30 },
      { id: 'app',   t: 'Mini App',        i: 'i-cal',    a:  30 },
      { id: 'pub',   t: 'Публикация',      i: 'i-send',   a:  90 },
      { id: 'ai',    t: 'ИИ-продакшн',     i: 'i-spark',  a: 150 },
      { id: 'figma', t: 'Figma-плагины',   i: 'i-puzzle', a: 210 }
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

    var STEPS = [
      { t: 'Материал загружен в бот',                         seg: ['shoot', 'core', 'bot'] },
      { t: 'Бот спрашивает, согласован ли материал с врачом', seg: ['bot'] },
      { t: 'Согласующие получают уведомление',                seg: ['bot'] },
      { t: 'Правка оставлена прямо к материалу',              seg: ['loopA'] },
      { t: 'Новая версия с историей правки',                  seg: ['loopB'] },
      { t: 'Финальное решение основного согласующего',        seg: ['bot', 'core'] },
      { t: 'Статус появляется в календаре Mini App',          seg: ['core', 'app'] },
      { t: 'Публикация по плану',                             seg: ['app', 'core', 'pub'] }
    ];

    var W = 0, H = 0, pos = {}, paths = [];

    function layout() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      /* на десктопе узлы стоят на одной окружности; на телефоне кадр
         вытянут по вертикали, поэтому окружность становится эллипсом —
         иначе плашки налезают на центр */
      var rx, ry;
      if (isPhone()) { rx = W * 0.34; ry = H * 0.36; }
      else { rx = ry = Math.min(W * 0.37, H * 0.40); }
      pos = { core: [W / 2, H / 2] };
      NODES.forEach(function (n) {
        var rad = n.a * Math.PI / 180;
        pos[n.id] = [W / 2 + Math.cos(rad) * rx, H / 2 + Math.sin(rad) * ry];
      });
      NODES.forEach(function (n) {
        var b = el[n.id];
        b.style.left = pos[n.id][0] + 'px';
        b.style.top  = pos[n.id][1] + 'px';
      });
      /* плашка не должна вылезать за край карты */
      NODES.forEach(function (n) {
        var b = el[n.id], br = b.getBoundingClientRect(), off = 0;
        if (br.left < r.left) off = r.left - br.left + 2;
        if (br.right > r.right) off = r.right - br.right - 2;
        if (off) { pos[n.id][0] += off; b.style.left = pos[n.id][0] + 'px'; }
      });

      wires.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      wires.innerHTML = '';
      NODES.forEach(function (n) { wire(pos[n.id], pos.core); });
      wire(pos.bot, pos.app);
      buildRoute();
    }
    function wire(a, b) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M' + a[0] + ' ' + a[1] + ' L' + b[0] + ' ' + b[1]);
      wires.appendChild(p);
    }
    function buildRoute() {
      paths = STEPS.map(function (s) {
        var p = document.createElementNS(NS, 'path'), d;
        if (s.seg[0] === 'loopA' || s.seg[0] === 'loopB') {
          var c = pos.bot, R = Math.min(W, H) * 0.06;
          var y0 = s.seg[0] === 'loopA' ? c[1] - R : c[1] + R;
          var y1 = s.seg[0] === 'loopA' ? c[1] + R : c[1] - R;
          d = 'M' + c[0] + ' ' + y0 + ' A' + R + ' ' + R + ' 0 0 1 ' +
              c[0] + ' ' + y1;
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
        return p;
      });
    }

    var cur = -1;
    function at(k) {
      var f = Math.min(0.9999, Math.max(0, k)) * STEPS.length;
      var i = Math.floor(f), t = f - i, p = paths[i];
      if (!p) return;
      var L = p.getTotalLength();
      var pt = p.getPointAtLength(L ? L * t : 0);
      spark.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' +
                              pt.y.toFixed(1) + 'px) translate(-50%,-50%)';
      spark.style.opacity = '1';
      if (i !== cur) {
        cur = i;
        cap.textContent = STEPS[i].t;
        var active = STEPS[i].seg.filter(function (s) {
          return s !== 'core' && s.indexOf('loop') !== 0;
        }).pop() || 'bot';
        NODES.forEach(function (n) {
          el[n.id].classList.toggle('on', n.id === active);
        });
      }
    }

    layout();
    addEventListener('resize', layout);

    if (REDUCED) {
      spark.style.opacity = '0';
      cap.textContent = '';
      NODES.forEach(function (n) { el[n.id].classList.add('on'); });
      if (list) list.style.display = 'block';
      return;
    }

    jobs.push(function () {
      var r = canvas.getBoundingClientRect(), vh = innerHeight || 1;
      var a = vh * 0.68, b = -r.height + vh * 0.32;
      var k = (a - r.top) / (a - b);
      if (k <= 0) {
        spark.style.opacity = '0';
        cap.innerHTML = '&nbsp;';
        cur = -1;
        NODES.forEach(function (n) { el[n.id].classList.remove('on'); });
        return;
      }
      at(k > 1 ? 1 : k);
    });
    onScroll();
  }

  /* ---------------- инструменты: ряд карточек ---------------- */
  var rail = document.getElementById('rail');
  if (rail) {
    var rs = [].slice.call(rail.querySelectorAll('.rcard'));
    var ri = 0, timer = null;
    function setActive(i) {
      ri = i;
      rs.forEach(function (c, k) { c.classList.toggle('on', k === i); });
    }
    if (matchMedia('(hover:hover) and (min-width:768px)').matches) {
      rs.forEach(function (c, i) {
        c.addEventListener('mouseenter', function () { setActive(i); });
      });
    }
    if (!REDUCED && !isPhone() && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !timer) {
            timer = setInterval(function () {
              setActive((ri + 1) % rs.length);
            }, 4000);
          } else if (!e.isIntersecting && timer) {
            clearInterval(timer); timer = null;
          }
        });
      }, { threshold: 0.3 }).observe(rail);
    }
  }

  /* ---------------- счётчики ---------------- */
  var nums = [].slice.call(document.querySelectorAll('[data-count]'));
  function run(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    var to = parseFloat(el.getAttribute('data-count')) || 0;
    var sfx = el.getAttribute('data-suffix') || '';
    if (REDUCED) { el.textContent = to + sfx; return; }
    var t0 = 0, dur = 900, ok = false;
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

  /* ---------------- страховка: через секунду показываем всё ----------------
     Если IntersectionObserver не сработал, на странице не должно
     остаться пустых мест. */
  addEventListener('load', function () {
    setTimeout(function () {
      revealed.forEach(function (e) {
        if (!e.classList.contains('in')) {
          e.style.transition = 'none';
          e.classList.add('in');
        }
      });
      nums.forEach(run);
    }, 1000);
  });

  /* ---------------- шапка ---------------- */
  var topEl = document.getElementById('top');
  if (topEl) {
    var stick = function () { topEl.classList.toggle('stuck', scrollY > 8); };
    stick();
    addEventListener('scroll', stick, { passive: true });
  }

  /* ---------------- соседние кейсы ---------------- */
  var grid = document.getElementById('cnavGrid');
  function buildNav() {
    var all = window.CASES_DATA || [];
    if (!grid || !all.length) return;
    var me = -1;
    for (var i = 0; i < all.length; i++) {
      if (all[i].url === 'case-medical-content-system.html') { me = i; break; }
    }
    if (me < 0) return;
    function link(c, label, idx, cls) {
      var a = document.createElement('a');
      a.className = cls;
      a.href = c.url ? c.url : ('index.html#case-' + idx);
      a.innerHTML = '<span class="small"></span><strong></strong>';
      a.querySelector('.small').textContent = label;
      a.querySelector('strong').textContent = c.t;
      return a;
    }
    var pi = (me - 1 + all.length) % all.length, ni = (me + 1) % all.length;
    grid.appendChild(link(all[pi], 'Предыдущий кейс', pi, 'cl'));
    grid.appendChild(link(all[ni], 'Следующий кейс', ni, 'cr'));
  }
  var sc = document.createElement('script');
  sc.src = 'cases.js';
  sc.onload = buildNav;
  document.body.appendChild(sc);
})();
