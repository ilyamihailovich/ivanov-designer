/* ============================================================
   Сцена «Экосистема в работе» — одна большая 3D-сцена страницы.

   Three.js подключён локальным модулем из vendor/: на сайте он уже лежит
   там и используется шаром кейсов, поэтому страница работает без CDN
   и без сборщика, а версия зафиксирована.

   Что происходит: секция закрепляется, три плиты-слоя расходятся,
   по связям идёт светящийся материал — путь одного рилса, — подписи
   шагов меняются синхронно с ним. Подписи узлов и слоёв — обычный HTML
   поверх canvas, позиционируется по проекции мировых координат, поэтому
   текст остаётся чётким.

   Сцена инициализируется, только когда секция подходит к экрану,
   и рендер останавливается, когда она уходит.
   ============================================================ */

import * as THREE from './vendor/three.module.js';

const pin    = document.getElementById('ecoPin');
const wrap   = document.getElementById('ecoWrap');
const canvas = document.getElementById('ecoCanvas');
const labels = document.getElementById('ecoLabels');
const dotsEl = document.getElementById('ecoDots');
const stepEl = document.getElementById('ecoStep');
const outEl  = document.getElementById('ecoOut');
const headEl = document.getElementById('ecoHead');
const tipEl  = document.getElementById('ecoTip');

if (pin && wrap && canvas) start();

function start() {

  /* ---------- данные сцены ---------- */

  const LAYERS = [
    { i: 0, t: 'Производство' },
    { i: 1, t: 'Согласование и планирование' },
    { i: 2, t: 'Инфраструктура' }
  ];

  /* Узлы расставлены так, чтобы связи не пересекались: производство
     над ботом, Mini App справа от бота, публикация справа от Mini App,
     сервер и база — ровно под ботом и Mini App. */
  const NODES = [
    { id: 'shoot', l: 0, x: -3.3, z: -1.4, below: true, t: 'Съёмка и монтаж',
      tip: 'Съёмка, монтаж и тексты' },
    { id: 'figma', l: 0, x: -2.1, z:  0.55, t: 'Figma-плагины',
      tip: 'Карусели и сторис собираются плагинами' },
    { id: 'ai',    l: 0, x: -0.9, z:  1.95, t: 'ИИ-продакшн',
      tip: 'Генерация визуала под стандарт бренда' },

    { id: 'bot',   l: 1, x: -2.1, z: -0.7, below: true, t: 'Telegram-бот',
      tip: 'Решения, правки и статусы' },
    { id: 'app',   l: 1, x:  1.1, z:  0.8, t: 'Mini App',
      tip: 'Контент-план, задачи и график' },
    { id: 'pub',   l: 1, x:  3.6, z:  1.9, t: 'Публикация',
      tip: 'Выход материала по плану' },

    { id: 'srv',   l: 2, x: -2.1, z: -0.7, below: true, t: 'Сервер',
      tip: 'VPS, службы бота и приложения' },
    { id: 'db',    l: 2, x:  1.1, z:  0.8, t: 'Общая база данных',
      tip: 'Одна база под обоими продуктами' }
  ];

  /* Только вертикальные и почти вертикальные связи между слоями
     и одна горизонтальная линия на среднем слое: бот → Mini App →
     публикация. */
  const LINKS = [
    ['shoot', 'bot'], ['figma', 'bot'], ['ai', 'bot'],
    ['bot', 'app'], ['app', 'pub'],
    ['bot', 'srv'], ['app', 'db']
  ];

  const STEPS = [
    { t: 'Материал загружен в бот',                        on: 'bot'  },
    { t: 'Бот спрашивает, согласован ли материал с врачом', on: 'bot'  },
    { t: 'Согласующие получают уведомление',               on: 'bot'  },
    { t: 'Правка оставлена прямо к материалу',             on: 'bot'  },
    { t: 'Новая версия с историей правки',                 on: 'bot'  },
    { t: 'Финальное решение основного согласующего',       on: 'bot'  },
    { t: 'Статус появляется в календаре Mini App',         on: 'app'  },
    { t: 'Публикация по плану',                            on: 'pub'  }
  ];

  const ACCENT = 0x5a6b85;
  const byId = {};
  NODES.forEach(n => { byId[n.id] = n; });

  /* ---------- размеры под устройство ---------- */

  let phone = innerWidth < 760;
  /* На телефоне кадр портретный: по вертикали поле зрения то же, а по
     горизонтали его в два раза меньше. Поэтому камера дальше, плиты уже
     и разнесены сильнее — система целиком влезает в ширину экрана. */
  const look = () => phone
    ? { plateW: 7.4, plateD: 6.6, sepMax: 3.8, sx: 0.70, sz: 1.55,
        r: 26, el: 0.78, nodeR: 0.16 }
    : { plateW: 9.8, plateD: 5.4, sepMax: 3.0, sx: 1,    sz: 1,
        r: 20.5, el: 0.60, nodeR: 0.13 };
  let L = look();

  /* ---------- рендерер ---------- */

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  /* Фон рисует сама сцена: матовому стеклу нужно что-то преломлять,
     на прозрачном холсте плиты становятся почти невидимыми. Это тот же
     мягкий градиент, что был подложкой секции. */
  scene.background = (() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 512);
    const blob = (x, y, r, col) => {
      const rad = g.createRadialGradient(x, y, 0, x, y, r);
      rad.addColorStop(0, col); rad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rad; g.fillRect(0, 0, 512, 512);
    };
    blob(140, 150, 280, 'rgba(146,168,202,.30)');
    blob(400, 380, 260, 'rgba(168,184,208,.24)');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  /* наклон за курсором живёт на отдельной группе, чтобы не трогать
     раскладку сцены */
  const tilt = new THREE.Group();
  scene.add(tilt);
  const world = new THREE.Group();
  tilt.add(world);

  /* ---------- окружение: мягкая студия ---------- */

  function studio() {
    const s = new THREE.Scene();
    const box = new THREE.BoxGeometry();
    const room = new THREE.Mesh(box,
      new THREE.MeshBasicMaterial({ color: 0xf3f5f9, side: THREE.BackSide }));
    room.scale.set(26, 14, 26);
    s.add(room);
    const lamp = (w, h, d, x, y, z, c) => {
      const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: c }));
      m.scale.set(w, h, d); m.position.set(x, y, z); s.add(m);
    };
    lamp(8, 0.2, 8, -3, 6.4, -2, 0xffffff);   /* ключевой сверху слева */
    lamp(5, 4,   0.2, -8,  2,  4, 0xf0f3f8);
    lamp(5, 4,   0.2,  8,  1, -4, 0xe8edf5);
    return s;
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromScene(studio(), 0.04).texture;
  scene.environment = env;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-5, 8, 4);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  /* ---------- плиты ---------- */

  function roundedPlate(w, d, r, th) {
    const s = new THREE.Shape();
    const x = w / 2, y = d / 2;
    s.moveTo(-x + r, -y);
    s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r);
    s.lineTo(x, y - r);  s.quadraticCurveTo(x, y, x - r, y);
    s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r);
    s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: th, bevelEnabled: true, bevelThickness: 0.025,
      bevelSize: 0.03, bevelSegments: 3, curveSegments: 10
    });
    g.rotateX(-Math.PI / 2);
    g.center();
    return g;
  }

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xe7edf6, transmission: 0.92, roughness: 0.22, thickness: 0.4,
    ior: 1.33, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4,
    transparent: true, envMapIntensity: 1.15
  });

  /* Контактная тень — мягкое пятно под плитой. Карта теней на телефоне
     обходится дороже, а читается хуже: плите нужен именно контакт. */
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const rad = g.createRadialGradient(128, 128, 10, 128, 128, 126);
    rad.addColorStop(0, 'rgba(16,24,40,.34)');
    rad.addColorStop(.55, 'rgba(16,24,40,.13)');
    rad.addColorStop(1, 'rgba(16,24,40,0)');
    g.fillStyle = rad; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  let plates = [], shadows = [];

  function buildPlates() {
    plates.forEach(p => { world.remove(p); p.geometry.dispose(); });
    shadows.forEach(s => { world.remove(s); s.geometry.dispose(); });
    plates = []; shadows = [];
    LAYERS.forEach(() => {
      const m = new THREE.Mesh(roundedPlate(L.plateW, L.plateD, 0.42, 0.2), glass);
      world.add(m); plates.push(m);
      const sh = new THREE.Mesh(
        new THREE.PlaneGeometry(L.plateW * 1.5, L.plateD * 1.7),
        new THREE.MeshBasicMaterial({
          map: shadowTex, transparent: true, depthWrite: false
        })
      );
      sh.rotation.x = -Math.PI / 2;
      world.add(sh); shadows.push(sh);
    });
  }
  buildPlates();

  /* ---------- узлы ---------- */

  const nodeMat = () => new THREE.MeshStandardMaterial({
    color: ACCENT, roughness: 0.52, metalness: 0.05,
    emissive: ACCENT, emissiveIntensity: 0
  });

  const nodeMesh = {}, nodeHalo = {};
  NODES.forEach(n => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(L.nodeR, L.nodeR, 0.3, 24), nodeMat());
    world.add(m); nodeMesh[n.id] = m;
    const h = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.15),
      new THREE.MeshBasicMaterial({
        map: shadowTex, color: ACCENT, transparent: true,
        opacity: 0.3, depthWrite: false
      })
    );
    h.rotation.x = -Math.PI / 2;
    world.add(h); nodeHalo[n.id] = h;
  });

  /* ---------- связи ---------- */

  const linkMesh = [];
  LINKS.forEach(p => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 1, 10),
      new THREE.MeshStandardMaterial({
        color: 0x8b98ad, roughness: 0.45, metalness: 0.1,
        transparent: true, opacity: 0, depthTest: false, depthWrite: false
      })
    );
    m.renderOrder = 2;
    world.add(m);
    linkMesh.push({ a: p[0], b: p[1], m });
  });

  /* ---------- материал, который идёт по связям ---------- */

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 18),
    new THREE.MeshStandardMaterial({
      color: 0x8fa3c4, emissive: ACCENT, emissiveIntensity: 1.6,
      roughness: 0.3
    })
  );
  ball.material.depthTest = false;
  ball.material.transparent = true;
  ball.renderOrder = 3;
  ball.visible = false;
  world.add(ball);

  /* ---------- подписи HTML поверх canvas ---------- */

  const capEl = {}, labEl = {};
  LAYERS.forEach(l => {
    const d = document.createElement('span');
    d.className = 'sc-cap';
    d.textContent = l.t;
    labels.appendChild(d);
    capEl[l.i] = d;
  });
  NODES.forEach(n => {
    const d = document.createElement('span');
    d.className = 'sc-node';
    d.dataset.id = n.id;
    d.innerHTML = '<em></em>';
    d.appendChild(document.createTextNode(n.t));
    labels.appendChild(d);
    labEl[n.id] = d;
  });

  /* индикатор прогресса сценария — восемь точек */
  const dots = STEPS.map(() => {
    const i = document.createElement('i');
    dotsEl.appendChild(i);
    return i;
  });

  /* ---------- геометрия: где какой узел ---------- */

  let sep = 0.2;
  const yOf  = l => (1 - l) * sep;
  const posOf = n => new THREE.Vector3(n.x * L.sx, yOf(n.l) + 0.24, n.z * L.sz);

  function place() {
    plates.forEach((p, i) => {
      p.position.y = yOf(i);
      p.scale.x = L.sx;
      shadows[i].position.set(0, yOf(i) - 0.16, 0.5);
      shadows[i].scale.x = L.sx;
      shadows[i].material.opacity = 0.55;
    });
    NODES.forEach(n => {
      const p = posOf(n);
      nodeMesh[n.id].position.copy(p);
      nodeHalo[n.id].position.set(p.x, yOf(n.l) + 0.11, p.z);
    });
    linkMesh.forEach(l => {
      const a = posOf(byId[l.a]), b = posOf(byId[l.b]);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      const len = dir.length();
      l.m.position.copy(mid);
      l.m.scale.y = len;
      l.m.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    });
  }

  /* ---------- путь материала ---------- */

  /* 1 съёмка → бот, 2-3 ожидание у бота, 4-5 петля правки,
     6 решение, 7 бот → Mini App, 8 Mini App → публикация */
  function ballAt(step, k) {
    const bot = posOf(byId.bot);
    if (step === 0) return posOf(byId.shoot).lerp(bot, ease(k));
    if (step === 1 || step === 2 || step === 5) {
      const p = bot.clone();
      p.y += 0.1 + Math.sin(k * Math.PI * 2) * 0.06;
      return p;
    }
    if (step === 3 || step === 4) {
      const a = (k + (step === 4 ? 1 : 0)) * Math.PI * 2;
      return new THREE.Vector3(
        bot.x + Math.cos(a) * 0.62,
        bot.y + 0.1,
        bot.z + Math.sin(a) * 0.62
      );
    }
    if (step === 6) return bot.lerp(posOf(byId.app), ease(k));
    return posOf(byId.app).lerp(posOf(byId.pub), ease(k));
  }

  const ease  = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const inv   = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

  /* ---------- состояние ---------- */

  let p = 0;                 /* прокрутка внутри секции, 0..1 */
  let step = -1;
  let hover = null;
  let dbPulse = 0;
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  let w = 0, h = 0;

  function resize() {
    const r = pin.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    phone = innerWidth < 760;
    L = look();
    buildPlates();
    NODES.forEach(n => {
      const m = nodeMesh[n.id];
      m.geometry.dispose();
      m.geometry = new THREE.CylinderGeometry(L.nodeR, L.nodeR, 0.3, 24);
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame() {
    /* плиты расходятся на 15–35 % */
    const open = inv(p, 0.15, 0.35);
    sep = 0.2 + (L.sepMax - 0.2) * ease(open);

    /* камера: лёгкий облёт на разлёте, отъезд в конце */
    const az  = phone ? -0.08 + 0.2 * ease(open)
                      : -0.17 + 0.42 * ease(open);
    const rad = L.r * (1 + 0.14 * inv(p, 0.9, 1));
    const el  = L.el - 0.08 * ease(open);
    camera.position.set(
      Math.sin(az) * Math.cos(el) * rad,
      Math.sin(el) * rad,
      Math.cos(az) * Math.cos(el) * rad
    );
    camera.lookAt(0, phone ? -0.1 : -0.45, 0);

    place();

    /* связи проявляются к концу разлёта, к финалу видны все */
    const lo = 0.1 + 0.52 * inv(p, 0.22, 0.42);
    linkMesh.forEach(l => {
      let o = lo;
      if (hover) o = (l.a === hover || l.b === hover) ? 0.95 : lo * 0.35;
      l.m.material.opacity = o;
      l.m.material.color.set(
        hover && (l.a === hover || l.b === hover) ? ACCENT : 0x8b98ad);
    });

    /* сценарий: 35–90 % — восемь шагов */
    const run = inv(p, 0.35, 0.9);
    const live = p > 0.345 && p < 0.93;
    ball.visible = live;
    let now = -1;
    if (live) {
      const f = Math.min(0.999, run) * STEPS.length;
      now = Math.floor(f);
      ball.position.copy(ballAt(now, f - now));
    }
    if (now !== step) {
      step = now;
      dots.forEach((d, i) => d.classList.toggle('on', i <= step && step >= 0));
      stepEl.textContent = step >= 0 ? STEPS[step].t : '';
      stepEl.classList.toggle('on', step >= 0);
      if (step >= 0) dbPulse = 1;      /* статус пишется в общую базу */
    }
    if (dbPulse > 0) dbPulse = Math.max(0, dbPulse - 0.02);

    /* подсветка: активный узел шага или узел под курсором */
    const lit = hover || (step >= 0 ? STEPS[step].on : null);
    NODES.forEach(n => {
      const m = nodeMesh[n.id];
      const on = lit === n.id ||
        (n.id === 'db' && dbPulse > 0) ||
        (hover && LINKS.some(l =>
          (l[0] === hover && l[1] === n.id) || (l[1] === hover && l[0] === n.id)));
      const want = on ? (n.id === 'db' && !hover && lit !== 'db' ? dbPulse * 1.1 : 0.9) : 0;
      m.material.emissiveIntensity += (want - m.material.emissiveIntensity) * 0.18;
      nodeHalo[n.id].material.opacity = 0.22 + m.material.emissiveIntensity * 0.4;
      const el2 = labEl[n.id];
      el2.classList.toggle('on', !!on);
      el2.classList.toggle('dim', !!lit && !on);
    });

    /* отклик на курсор — не больше 4° */
    mx += (tmx - mx) * 0.06;
    my += (tmy - my) * 0.06;
    tilt.rotation.y = mx * 0.07;
    tilt.rotation.x = my * 0.045;

    /* заголовок, вывод */
    headEl.style.opacity = (1 - inv(p, 0.08, 0.2)).toFixed(3);
    outEl.classList.toggle('on', p > 0.9);

    renderer.render(scene, camera);
    placeLabels();
  }

  const v = new THREE.Vector3();
  function project(pos) {
    v.copy(pos);
    world.localToWorld(v);
    tilt.localToWorld(v);
    v.project(camera);
    return v.z > 1 ? null
      : [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
  }
  function placeLabels() {
    /* Подписи проявляются вместе с разлётом: пока плиты сложены,
       узлы стоят друг на друге и подписи налезали бы друг на друга. */
    labels.style.opacity = inv(p, 0.18, 0.38).toFixed(3);
    /* подпись слоя стоит у левого края своей плиты и едет вместе с ней;
       на телефоне край плиты уходит за экран, поэтому подпись прижата
       к полю, но остаётся на высоте своего слоя */
    LAYERS.forEach(l => {
      /* На телефоне подписей слишком много для 375 px, поэтому подпись
         слоя висит у левого поля в просвете над своей плитой: она едет
         вместе с ней и ни на что не налезает. */
      const q = project(phone
        ? new THREE.Vector3(-L.plateW / 2 * L.sx, yOf(l.i) + sep * 0.45, 0)
        : new THREE.Vector3(-L.plateW / 2 * L.sx, yOf(l.i) + 0.12,
                            L.plateD * 0.3));
      const el = capEl[l.i];
      if (!q) { el.style.opacity = '0'; return; }
      el.style.transform = 'translate(0,-50%) translate(' +
        (phone ? 16 : q[0] + 10).toFixed(1) + 'px,' +
        (q[1] + (phone ? 0 : -10)).toFixed(1) + 'px)';
      el.style.removeProperty('opacity');
    });
    /* подпись узла уходит влево от точки, когда узел стоит в правой части
       кадра: иначе длинные названия вылезали бы за край */
    NODES.forEach(n => {
      const el = labEl[n.id];
      const q = project(posOf(n).setY(posOf(n).y + 0.3));
      if (!q) { el.style.opacity = '0'; return; }
      const flip = q[0] > w * 0.56;
      el.classList.toggle('rtl', flip);
      el.style.transform =
        (flip ? 'translate(-100%,-50%) ' : 'translate(0,-50%) ') +
        'translate(' + (q[0] + (flip ? 5 : -5)).toFixed(1) + 'px,' +
        (q[1] + (phone ? (n.below ? 30 : -26) : -22)).toFixed(1) + 'px)';
      el.style.removeProperty('opacity');
    });
  }

  /* ---------- прокрутка ---------- */

  let tick = false;
  function onScroll() {
    if (tick) return;
    tick = true;
    requestAnimationFrame(() => {
      tick = false;
      const r = wrap.getBoundingClientRect();
      const span = Math.max(1, r.height - h);
      p = clamp(-r.top / span, 0, 1);
    });
  }

  /* ---------- курсор и наведение ---------- */

  if (!phone) {
    pin.addEventListener('pointermove', e => {
      const r = pin.getBoundingClientRect();
      tmx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      tmy = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    pin.addEventListener('pointerleave', () => { tmx = 0; tmy = 0; hover = null; });
    labels.addEventListener('pointerover', e => {
      const t = e.target.closest('.sc-node');
      if (!t) return;
      hover = t.dataset.id;
      tipEl.textContent = byId[hover].tip;
      tipEl.classList.add('on');
    });
    labels.addEventListener('pointerout', e => {
      if (e.target.closest('.sc-node')) {
        hover = null;
        tipEl.classList.remove('on');
      }
    });
    labels.addEventListener('pointermove', e => {
      const r = pin.getBoundingClientRect();
      tipEl.style.transform = 'translate(' +
        (e.clientX - r.left + 14) + 'px,' + (e.clientY - r.top + 14) + 'px)';
    });
  }

  /* ---------- жизненный цикл ---------- */

  let running = false, raf = 0;
  function loop() { if (!running) return; frame(); raf = requestAnimationFrame(loop); }

  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting && !running) {
        running = true; resize(); onScroll(); loop();
      } else if (!e.isIntersecting && running) {
        running = false; cancelAnimationFrame(raf);
      }
    });
  }, { rootMargin: '200px 0px' });
  io.observe(wrap);

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { if (running) { resize(); onScroll(); } });

  document.documentElement.classList.add('eco-live');

  /* координаты углов плит для статичной подложки */
  window.__ecoGeom = () => {
    const out = [];
    const x = L.plateW / 2 * L.sx, z = L.plateD / 2;
    plates.forEach((pl, i) => {
      const q = [[-x, -z], [x, -z], [x, z], [-x, z]].map(c => {
        v.set(c[0], yOf(i) + 0.1, c[1]);
        world.localToWorld(v); tilt.localToWorld(v); v.project(camera);
        return [ +((v.x * 0.5 + 0.5) * w).toFixed(1),
                 +((-v.y * 0.5 + 0.5) * h).toFixed(1) ];
      });
      out.push(q);
    });
    return out;
  };

  /* кадр для статичной подложки: window.__ecoShot(0.97) */
  window.__ecoShot = at => {
    if (!running) { running = true; resize(); }
    p = at == null ? 0.97 : at;
    step = -1;
    for (let i = 0; i < 90; i++) frame();
    return renderer.domElement.toDataURL('image/png');
  };
}
