/* ============================================================
   Слоты медиа для кейса «Цифровая экосистема контента».

   Пока файла нет — на странице стоит ровная серая плоскость нужных
   пропорций с одной строкой подписи из `note`. Как только файл положен
   в папку, достаточно вписать путь в `src` (и `poster` для видео) —
   страница сама покажет его вместо заглушки.

   Поля:
     type   'image' | 'video'
     ratio  пропорции слота: 'desktop' 16/10, 'phone' 9/19.5,
            'square' 1/1, 'photo' 4/5
     src    для image — путь к .webp или .avif
            для video — { mp4: '...', webm: '...' }
     fallback  для image — путь к .jpg/.png на случай, если формат не
            поддерживается
     poster для video — кадр-постер; он же показывается при
            prefers-reduced-motion
     alt    альтернативный текст
     note   что снять в этот слот (видно на заглушке)
   ============================================================ */

/* showPlaceholders — режим подготовки материала. В рабочем виде false:
   слот без файла не рисуется и не занимает места, а секция
   перестраивается без него. true возвращает серые плоскости с подписями
   из `note`, чтобы было видно, что именно осталось снять.

   forceShowToggle — временно показать переключатель «3D / Схема»
   на заглушках, пока файлов в слотах hyg-3d и hyg-map ещё нет. */
window.CASE_MEDIA_FLAGS = { showPlaceholders: false, forceShowToggle: false };

window.CASE_MEDIA = {

  /* ---------- Telegram-бот согласования ---------- */
  'bot-card': {
    type: 'image', ratio: 'phone', src: null, fallback: null,
    alt: 'Карточка материала в боте согласования',
    note: 'Скриншот бота: карточка материала с кнопками решений'
  },
  'bot-list': {
    type: 'image', ratio: 'phone', src: null, fallback: null,
    alt: 'Список материалов, отсортированный по приоритету статуса',
    note: 'Скриншот бота: список материалов по приоритету статуса'
  },
  'bot-edit': {
    type: 'video', ratio: 'phone', src: null, poster: null,
    alt: 'Правка к материалу и новая версия с историей правки',
    note: 'Видео бота: согласующий оставляет правку, автор присылает новую версию'
  },
  'bot-doctor': {
    type: 'image', ratio: 'phone', src: null, fallback: null,
    alt: 'Вопрос бота о предварительном согласовании с врачом',
    note: 'Скриншот бота: вопрос о согласовании с врачом и кнопки подтверждения'
  },
  'bot-albums': {
    type: 'image', ratio: 'phone', src: null, fallback: null,
    alt: 'Материал, загруженный альбомом из нескольких файлов',
    note: 'Скриншот бота: материал, пришедший согласующим Telegram-альбомом'
  },
  'bot-collab': {
    type: 'image', ratio: 'phone', src: null, fallback: null,
    alt: 'Сценарий съёмки с блогером',
    note: 'Скриншот бота: сценарий коллаборации — дата, врач, согласование'
  },

  /* ---------- Telegram Mini App ---------- */
  'app-plan': {
    type: 'image', ratio: 'phone', src: null, fallback: null,
    alt: 'Контент-план в Mini App',
    note: 'Скриншот Mini App: контент-план с тегами платформы, формата и рубрики'
  },
  'app-tasks': {
    type: 'image', ratio: 'phone', src: null, fallback: null,
    alt: 'Доска задач в Mini App',
    note: 'Скриншот Mini App: доска задач по съёмкам, монтажу и производству'
  },
  'app-schedule': {
    type: 'image', ratio: 'phone', src: null, fallback: null,
    alt: 'График работы в Mini App',
    note: 'Скриншот Mini App: график с днями в клинике и удалённой работой'
  },

  /* ---------- Figma-плагины ---------- */
  'plugin-run': {
    type: 'video', ratio: 'desktop', src: null, poster: null,
    alt: 'Плагин собирает карусель из размеченного текста',
    note: 'Видео: текст в разметке превращается в готовую карусель на макетах'
  },
  'plugin-panel': {
    type: 'image', ratio: 'desktop', src: null, fallback: null,
    alt: 'Панель плагина в Figma',
    note: 'Скриншот: панель плагина в Figma'
  },

  /* ---------- ИИ-продакшн ---------- */
  'ai-1': {
    type: 'image', ratio: 'square', src: null, fallback: null,
    alt: 'Визуал до доработки', note: 'Исходная генерация'
  },
  'ai-2': {
    type: 'image', ratio: 'square', src: null, fallback: null,
    alt: 'Визуал после доработки', note: 'Он же после доработки под стандарт'
  },
  'ai-3': {
    type: 'image', ratio: 'square', src: null, fallback: null,
    alt: 'Визуал до доработки', note: 'Исходная генерация'
  },
  'ai-4': {
    type: 'image', ratio: 'square', src: null, fallback: null,
    alt: 'Визуал после доработки', note: 'Он же после доработки под стандарт'
  },

  /* ---------- контент и продакшн ---------- */
  'shot-1': { type: 'image', ratio: 'photo', src: null, fallback: null,
    alt: 'Кадр съёмки клиники', note: 'Кадр съёмки' },
  'shot-2': { type: 'image', ratio: 'photo', src: null, fallback: null,
    alt: 'Портрет врача', note: 'Портрет врача' },
  'shot-3': { type: 'image', ratio: 'photo', src: null, fallback: null,
    alt: 'Клинический процесс', note: 'Клинический процесс' },
  'shot-4': { type: 'image', ratio: 'photo', src: null, fallback: null,
    alt: 'Деталь интерьера', note: 'Деталь интерьера' },

  /* ---------- приложение для гигиениста ---------- */
  'hyg-3d': {
    type: 'image', ratio: 'desktop', src: null, fallback: null,
    alt: 'Трёхмерная карта межзубных ёршиков',
    note: 'Скриншот приложения: трёхмерная карта межзубных ёршиков'
  },
  'hyg-map': {
    type: 'image', ratio: 'desktop', src: null, fallback: null,
    alt: 'Схематическая карта межзубных промежутков',
    note: 'Скриншот приложения: схематическая карта для быстрого ввода'
  },
  'hyg-patient': {
    type: 'image', ratio: 'phone', src: null, fallback: null,
    alt: 'Онлайн-карта пациента',
    note: 'Скриншот: онлайн-карта пациента на телефоне'
  }
};
