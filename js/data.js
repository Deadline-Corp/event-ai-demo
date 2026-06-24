/* ============================================================
   EVENT AI — demo data v3 (reactive, bilingual, scripted)
   Числа подобраны так, чтобы смета сходилась; банкет масштабируется по гостям.
   ============================================================ */
const IMGMAP = {
  'hall': 'hall', 'host-m': 'host-m', 'show': 'show', 'artist': 'artist',
  'photo': 'photo', 'decor': 'decor', 'tech': 'tech',
  'loft': 'loft', 'catering': 'catering', 'host-f': 'host-f',
};
const IMG = (seed) => `assets/img/${IMGMAP[seed] || 'hall'}.jpg`;

/* per-vendor mini-gallery (reuse generated images) */
const GAL = {
  hall: ['hall', 'decor', 'show'], 'host-m': ['host-m', 'artist', 'show'], show: ['show', 'artist', 'decor'],
  artist: ['artist', 'show', 'tech'], photo: ['photo', 'decor', 'hall'], decor: ['decor', 'hall', 'show'],
  tech: ['tech', 'show', 'artist'], loft: ['loft', 'catering', 'tech'], catering: ['catering', 'loft', 'decor'], 'host-f': ['host-f', 'loft', 'tech'],
};
const galleryFor = (seed) => (GAL[seed] || [seed]).map((s) => IMG(s));

/* review pool (rotated per vendor) */
const REVIEWS = [
  { n: 'Динара А.', r: 5, t: 'Всё прошло идеально, гости в восторге. Рекомендую!' },
  { n: 'Ержан К.', r: 5, t: 'Профессионалы. Приехали вовремя, отработали на высоте.' },
  { n: 'Айгерим С.', r: 4, t: 'Очень понравилось, небольшие правки по таймингу — но в целомтоп.' },
  { n: 'Нурлан Т.', r: 5, t: 'Сделали наш той незабываемым. Спасибо команде EVENT AI!' },
  { n: 'Мадина Ж.', r: 5, t: 'Лучшие в Алматы. Уже советую друзьям.' },
];
const reviewsFor = (i) => [REVIEWS[i % REVIEWS.length], REVIEWS[(i + 2) % REVIEWS.length]];

/* alternatives per category (for «Заменить») */
const ALTS = {
  'Площадка': [{ title: 'Ресторан «Алтын Орда»', rating: '4.7', note: 'до 220 гостей · +8% к бюджету' }, { title: 'Лофт «Барный №5»', rating: '4.6', note: 'до 120 гостей · −15% к бюджету' }],
  'Ресторан': [{ title: 'Ресторан «Достар»', rating: '4.7', note: 'до 90 гостей · −10%' }, { title: 'Veranda Grill', rating: '4.8', note: 'летняя терраса · +5%' }],
  'Ведущий': [{ title: 'Айбек Нұрлан', rating: '4.7', note: 'каз/рус · моложе аудитория' }, { title: 'Тамада Серик', rating: '4.8', note: 'нац. той · 8 часов' }],
  'Артист': [{ title: 'Группа «Алматы»', rating: '4.8', note: 'кавер-бэнд · 2 сета' }, { title: 'DJ Renat', rating: '4.7', note: 'танцпол · −40%' }],
  'Шоу-программа': [{ title: 'Шоу-балет «Tomiris»', rating: '4.8', note: '4 выхода · нац.' }, { title: 'Cirque show', rating: '4.7', note: 'воздушка · +20%' }],
  'Фото / видео': [{ title: 'KZ Visuals', rating: '4.9', note: '3 камеры · дрон' }, { title: 'Studio Foto', rating: '4.7', note: 'фото · −30%' }],
  'Декор': [{ title: 'Flora Decor', rating: '4.8', note: 'живые цветы · +12%' }, { title: 'Minimal Decor', rating: '4.6', note: 'европ. стиль · −18%' }],
  'Техника': [{ title: 'Pro Sound KZ', rating: '4.8', note: 'концертный звук · +15%' }, { title: 'Event Tech', rating: '4.6', note: 'база · −20%' }],
  'Кейтеринг': [{ title: 'Azu Catering', rating: '4.8', note: 'банкет · халяль' }, { title: 'Light Bites', rating: '4.6', note: 'фуршет · −15%' }],
};
const altsFor = (cat) => ALTS[cat] || [];

/* chip label -> number */
const GUESTS = { 'до 50': 40, '≈ 80': 80, '≈ 150': 150, '200+': 220 };
const BUDGETS = { 'до 2 млн ₸': 2000000, '3–5 млн ₸': 5000000, '5–8 млн ₸': 8000000, '8 млн+ ₸': 12000000 };

/* business / traction strip (illustrative) */
const METRICS = [
  { k: 'GMV за 90 дней', v: 184000000, suf: ' ₸' },
  { k: 'Собрано мероприятий', v: 1240, suf: '' },
  { k: 'Средний чек', v: 3900000, suf: ' ₸' },
  { k: 'Комиссия платформы', v: 7, suf: '%' },
];

/* supplier-side teaser */
const SUPPLIER = {
  title: 'Ержан Тлеуов', role: 'Ведущий · Алматы',
  rows: [
    { k: 'Входящих заявок', v: '12', hot: true },
    { k: 'Загрузка календаря', v: '78%' },
    { k: 'Подтверждено на месяц', v: '9 событий' },
    { k: 'Выплата', v: 'после события' },
  ],
};

/* ---------- vendor pools per scenario ---------- */
const V = {
  hall: { cat: 'Площадка', catKz: 'Алаң', icon: 'i-map', title: 'Банкетный зал «Жібек Жолы»', rating: '4.9', perGuest: 12000, seed: 'hall',
    estName: 'Банкет — зал «Жібек Жолы»',
    reason: 'Свободен на {match}, вмещает {cap} гостей, премиальный зал с национальной зоной.',
    considered: 9, rejected: '4 заняты на дату · 2 вне бюджета', confidence: 96 },
  loft: { cat: 'Площадка', icon: 'i-map', title: 'Лофт «Депо 4.20»', rating: '4.8', perGuest: 7000, seed: 'loft',
    estName: 'Площадка — лофт «Депо 4.20»',
    reason: 'Свободен на {match}, современный лофт под деловой формат на {cap} гостей.',
    considered: 7, rejected: '3 заняты · 1 мала вместимость', confidence: 93 },
  rest_birthday: { cat: 'Ресторан', icon: 'i-map', title: 'Ресторан «Terrassa»', rating: '4.9', perGuest: 9000, seed: 'hall',
    estName: 'Ресторан «Terrassa» (зал + кухня)',
    reason: 'Свободен на {match}, уютный зал с террасой на {cap} гостей, своя кухня.',
    considered: 6, rejected: '2 заняты · 1 без отдельного зала', confidence: 95 },

  host_m: { cat: 'Ведущий', icon: 'i-users', title: 'Ержан Тлеуов', meta: 'Каз / рус · 6 часов', rating: '4.9', price: 450000, from: 'от 350 000 ₸', seed: 'host-m',
    estName: 'Ведущий (каз/рус, 6 ч)', estDesc: 'Ержан Тлеуов',
    reason: 'Двуязычное ведение, опыт с беташаром, стиль под формат «{match}».',
    considered: 8, rejected: '5 заняты · 2 один язык', confidence: 94 },
  host_f: { cat: 'Ведущий', icon: 'i-users', title: 'Алина Ким', meta: 'Рус · деловой', rating: '4.8', price: 280000, from: 'от 250 000 ₸', seed: 'host-f',
    estName: 'Ведущий (деловой)', estDesc: 'Алина Ким',
    reason: 'Опыт корпоративов и конференций, чёткий тайм-менеджмент.',
    considered: 6, rejected: '3 заняты · 1 без делового опыта', confidence: 92 },

  show: { cat: 'Шоу-программа', icon: 'i-spark', title: 'Шоу-балет «Aru»', meta: '3 выхода · нац. + современный', rating: '4.8', price: 320000, from: 'от 280 000 ₸', seed: 'show',
    estName: 'Шоу-балет «Aru»', estDesc: '3 выхода',
    reason: 'Костюмированные номера в национальном стиле — попадает в концепцию «{match}».',
    considered: 5, rejected: '2 заняты · 1 вне стиля', confidence: 90 },
  artist: { cat: 'Артист', icon: 'i-bolt', title: 'Дос Дюйсен', meta: 'Эстрада · 1 выход', rating: '4.9', price: 700000, from: 'от 600 000 ₸', seed: 'artist',
    estName: 'Артист — Дос Дюйсен', estDesc: '1 выход',
    reason: 'Свободен на {match}, узнаваемый артист — усилит вечер.',
    considered: 7, rejected: '4 заняты · 2 вне бюджета', confidence: 91 },

  photo: { cat: 'Фото / видео', icon: 'i-pres', title: 'Qadam Films', meta: 'Клип в день съёмки · 2 камеры', rating: '5.0', price: 550000, from: 'от 450 000 ₸', seed: 'photo',
    estName: 'Фото + видео', estDesc: 'Qadam Films · клип в день съёмки',
    reason: 'Готовый клип к концу вечера — сильное впечатление для гостей.',
    considered: 6, rejected: '3 заняты · 1 без видео', confidence: 95 },
  photo_corp: { cat: 'Фото / видео', icon: 'i-pres', title: 'Qadam Films', meta: 'Репортаж · короткий ролик', rating: '5.0', price: 200000, from: 'от 180 000 ₸', seed: 'photo',
    estName: 'Фото + ролик', estDesc: 'Qadam Films',
    reason: 'Репортажная съёмка и короткий итоговый ролик мероприятия.',
    considered: 5, rejected: '2 заняты · 1 без ролика', confidence: 94 },

  decor: { cat: 'Декор', icon: 'i-star', title: 'Aizhan Decor', meta: 'Оформление + фотозона', rating: '4.9', price: 850000, from: 'от 700 000 ₸', seed: 'decor',
    estName: 'Декор + фотозона', estDesc: 'Aizhan Decor',
    reason: 'Стиль «{match}», фотозона и президиум — в рамках бюджета.',
    considered: 6, rejected: '3 заняты · 1 вне стиля', confidence: 93 },
  tech: { cat: 'Техника', icon: 'i-bolt', title: 'Свет и Звук', meta: 'Звук · свет · LED-экран', rating: '4.8', price: 380000, from: 'от 320 000 ₸', seed: 'tech',
    estName: 'Техника: звук, свет, LED', estDesc: 'Свет и Звук',
    reason: 'LED-экран под клип и оформление сцены, полный звук на {cap} гостей.',
    considered: 4, rejected: '2 заняты', confidence: 90 },
  tech_corp: { cat: 'Техника', icon: 'i-bolt', title: 'Свет и Звук', meta: 'Звук · свет · проектор', rating: '4.8', price: 250000, from: 'от 220 000 ₸', seed: 'tech',
    estName: 'Техника: звук, свет, проектор', estDesc: 'Свет и Звук',
    reason: 'Проектор и микрофоны под презентации и награждение.',
    considered: 4, rejected: '2 заняты', confidence: 91 },
  catering: { cat: 'Кейтеринг', icon: 'i-star', title: 'Fourchette', meta: 'Фуршет · халяль-опции', rating: '4.9', perGuest: 5000, seed: 'catering',
    estName: 'Кейтеринг (фуршет)',
    reason: 'Фуршет на {cap} персон, халяль-опции, в рамках бюджета.',
    considered: 5, rejected: '2 заняты · 1 без халяль', confidence: 93 },
};

/* deep-clone a vendor pool entry */
const vc = (key) => JSON.parse(JSON.stringify(V[key]));

const SCENARIOS = {
  wedding: {
    key: 'wedding', typeLabel: 'Свадьба / Той',
    concept: 'Той под ключ', conceptKz: 'Кілтпен той',
    conceptSub: 'Алматы · национальный + европейский микс',
    city: 'Алматы', cityKz: 'Алматы', date: '15 августа',
    defaultGuests: 180, defaultBudget: 8000000, national: true,
    vendorKeys: ['hall', 'host_m', 'show', 'artist', 'photo', 'decor', 'tech'],
    packages: {
      STANDARD: { note: 'База: зал, ведущий, фото, звук' },
      COMFORT: { note: '+ шоу-балет, декор, видео' },
      PREMIUM: { note: 'Всё включено + артист и LED', tag: 'Рекомендуем' },
    },
    timeline: [
      { t: '17:00', title: 'Сбор гостей', desc: 'Встреча, напитки, фоновая музыка', dur: '30 мин' },
      { t: '17:30', title: 'Беташар', desc: 'Национальный обряд, ведущий каз.', dur: '20 мин' },
      { t: '17:50', title: 'Первый выход молодожёнов', desc: 'Под живой аккомпанемент', dur: '10 мин' },
      { t: '18:00', title: 'Официальная часть · бата', desc: 'Благословение старших, тосты', dur: '40 мин' },
      { t: '18:40', title: 'Ужин · музыкальный блок', desc: 'Подача горячего, программа', dur: '60 мин' },
      { t: '19:40', title: 'Шоу-балет «Aru»', desc: '1-й выход — национальный номер', dur: '15 мин' },
      { t: '19:55', title: 'Конкурсы и тосты', desc: 'Интерактив с гостями', dur: '30 мин' },
      { t: '20:25', title: 'Выступление артиста', desc: 'Дос Дюйсен', dur: '30 мин' },
      { t: '20:55', title: 'Шашу · танцевальный блок', desc: 'Осыпание сладостями, общий танцпол', dur: '40 мин' },
      { t: '21:35', title: 'Торт и финал', desc: 'Вынос торта, клип на LED-экране', dur: '25 мин' },
    ],
    scenario: [
      { n: '01', title: 'Национальный блок', items: ['Беташар с традиционным сопровождением', 'Слова благословения (бата)', 'Выход молодожёнов'] },
      { n: '02', title: 'Официальный блок', items: ['Поздравления родителей и почётных гостей', 'Первый танец', 'Тосты и вручение подарков'] },
      { n: '03', title: 'Развлекательный блок', items: ['Шоу-балет «Aru» — 3 выхода', 'Интерактивные конкурсы', 'Выступление артиста Дос Дюйсен'] },
      { n: '04', title: 'Финал', items: ['Обряд шашу', 'Танцевальный блок', 'Вынос торта и показ клипа на LED-экране'] },
    ],
  },

  corporate: {
    key: 'corporate', typeLabel: 'Корпоратив',
    concept: 'Корпоративный вечер', conceptKz: 'Корпоративтік кеш',
    conceptSub: 'Алматы · деловой формат',
    city: 'Алматы', date: '12 декабря',
    defaultGuests: 80, defaultBudget: 2000000, national: false,
    vendorKeys: ['loft', 'catering', 'host_f', 'tech_corp', 'photo_corp'],
    packages: {
      STANDARD: { note: 'Площадка, ведущий, техника' },
      COMFORT: { note: '+ кейтеринг и фотоотчёт', tag: 'Рекомендуем' },
      PREMIUM: { note: '+ шоу-номер и подарки' },
    },
    timeline: [
      { t: '18:30', title: 'Сбор гостей', desc: 'Регистрация, приветственная зона', dur: '30 мин' },
      { t: '19:00', title: 'Открытие вечера', desc: 'Приветствие руководства', dur: '20 мин' },
      { t: '19:20', title: 'Итоги года', desc: 'Презентация на проекторе', dur: '30 мин' },
      { t: '19:50', title: 'Фуршет', desc: 'Свободное общение, музыка', dur: '50 мин' },
      { t: '20:40', title: 'Награждение', desc: 'Номинации, вручение', dur: '30 мин' },
      { t: '21:10', title: 'Развлекательный блок', desc: 'Интерактив, музыка', dur: '40 мин' },
      { t: '21:50', title: 'Финал', desc: 'Общее фото, завершение', dur: '20 мин' },
    ],
    scenario: [
      { n: '01', title: 'Деловой блок', items: ['Приветствие руководства', 'Презентация итогов года', 'Планы на следующий год'] },
      { n: '02', title: 'Фуршет и общение', items: ['Фуршетная подача', 'Фоновая музыкальная программа', 'Свободное общение'] },
      { n: '03', title: 'Награждение', items: ['Номинации сотрудников', 'Вручение наград', 'Командное фото'] },
      { n: '04', title: 'Финал', items: ['Развлекательный интерактив', 'Общее фото', 'Завершение вечера'] },
    ],
  },

  birthday: {
    key: 'birthday', typeLabel: 'Юбилей / День рождения',
    concept: 'Торжество под ключ', conceptKz: 'Кілтпен мереке',
    conceptSub: 'Алматы · тёплый семейный формат',
    city: 'Алматы', date: '20 сентября',
    defaultGuests: 60, defaultBudget: 5000000, national: false,
    vendorKeys: ['rest_birthday', 'host_m', 'artist', 'photo', 'decor'],
    packages: {
      STANDARD: { note: 'Ресторан, ведущий, фото' },
      COMFORT: { note: '+ декор и артист', tag: 'Рекомендуем' },
      PREMIUM: { note: 'Всё включено + расширенное шоу' },
    },
    timeline: [
      { t: '18:00', title: 'Сбор гостей', desc: 'Встреча, напитки, фоновая музыка', dur: '30 мин' },
      { t: '18:30', title: 'Торжественное открытие', desc: 'Приветствие виновника торжества', dur: '20 мин' },
      { t: '18:50', title: 'Поздравления', desc: 'Слова близких, тосты', dur: '40 мин' },
      { t: '19:30', title: 'Ужин · музыкальный блок', desc: 'Подача горячего, программа', dur: '50 мин' },
      { t: '20:20', title: 'Выступление артиста', desc: 'Дос Дюйсен', dur: '30 мин' },
      { t: '20:50', title: 'Конкурсы и танцы', desc: 'Интерактив, общий танцпол', dur: '40 мин' },
      { t: '21:30', title: 'Торт и финал', desc: 'Вынос торта, общее фото', dur: '20 мин' },
    ],
    scenario: [
      { n: '01', title: 'Торжественный блок', items: ['Приветствие виновника торжества', 'Поздравления близких', 'Праздничные тосты'] },
      { n: '02', title: 'Застольный блок', items: ['Ужин с подачей', 'Фоновая музыкальная программа', 'Тёплые истории гостей'] },
      { n: '03', title: 'Развлекательный блок', items: ['Выступление артиста Дос Дюйсен', 'Интерактивные конкурсы', 'Танцевальный блок'] },
      { n: '04', title: 'Финал', items: ['Вынос праздничного торта', 'Общее фото', 'Завершение вечера'] },
    ],
  },
};

/* package price multipliers (relative to full estimate) */
const PKG_MULT = { STANDARD: 0.74, COMFORT: 0.88, PREMIUM: 1.0 };

/* ---------- intake (пошаговый AI-фильтр по ТЗ#1, ~12 вопросов) ---------- */
const INTAKE = [
  { ai: ['Здравствуйте! Я — EVENT AI.', 'Задам несколько коротких вопросов — и соберу мероприятие под ключ. По одному за раз.'] },
  { q: 'В какой стране мероприятие?', key: 'country', options: [
      { label: 'Казахстан' }, { label: 'Другая страна' } ] },
  { q: 'В каком городе?', key: 'city', options: [
      { label: 'Алматы' }, { label: 'Астана' }, { label: 'Шымкент' }, { label: 'Другой' } ] },
  { q: 'Что организуем?', key: 'type', options: [
      { label: 'Свадьба', scenario: 'wedding' },
      { label: 'Узату (проводы невесты)', scenario: 'wedding' },
      { label: 'Корпоратив', scenario: 'corporate' },
      { label: 'Юбилей', scenario: 'birthday' },
      { label: 'День рождения', scenario: 'birthday' },
      { label: 'Сюндет той', scenario: 'birthday' },
      { label: 'Никах', scenario: 'wedding' },
      { label: 'Конференция', scenario: 'corporate' },
  ] },
  { q: 'Когда планируете?', key: 'date', options: [
      { label: 'Через месяц' }, { label: 'Через 2–3 месяца' }, { label: 'Через полгода' }, { label: 'Дата уже выбрана' } ] },
  { q: 'Сколько гостей ожидаете?', key: 'guests', options: [
      { label: 'до 50' }, { label: '≈ 80' }, { label: '≈ 150' }, { label: '200+' } ] },
  { q: 'Какой бюджет закладываете?', key: 'budget', options: [
      { label: 'до 2 млн ₸' }, { label: '3–5 млн ₸' }, { label: '5–8 млн ₸' }, { label: '8 млн+ ₸' } ] },
  { q: 'Площадка уже выбрана?', key: 'venue', options: [
      { label: 'Нужен подбор' }, { label: 'Уже выбрана' } ] },
  { q: 'Какие услуги нужны?', key: 'services', options: [
      { label: 'Всё под ключ' }, { label: 'Выберу точечно' } ] },
  { q: 'Нужен сценарий мероприятия?', key: 'needScenario', options: [
      { label: 'Да, нужен' }, { label: 'Не нужен' } ] },
  { q: 'Подготовить смету?', key: 'needSmeta', options: [
      { label: 'Да, смету' }, { label: 'Не нужно' } ] },
  { q: 'Нужны пригласительные?', key: 'needInvites', options: [
      { label: 'Да, бесплатно' }, { label: 'Не нужны' } ] },
  { q: 'Помочь с бронированием?', key: 'needBooking', options: [
      { label: 'Да, помогите' }, { label: 'Забронирую сам' } ] },
];

/* free-text -> chip matcher (NLU illusion) */
const NLU = {
  type: [
    { re: /(свадьб|той|узату|кесер|никах|сүндет)/i, label: 'Свадьба / Той' },
    { re: /(корпоратив|компан|сотрудник|тимбилд|форум|конференц)/i, label: 'Корпоратив' },
    { re: /(юбилей|годовщин)/i, label: 'Юбилей' },
    { re: /(день рожд|др\b|birthday|именин)/i, label: 'День рождения' },
  ],
  guests: [
    { re: /\b(2[0-9]{2}|[3-9][0-9]{2}|[1-9][0-9]{3})\b/, label: '200+' },
    { re: /\b(1[0-9]{2})\b/, label: '≈ 150' },
    { re: /\b([6-9][0-9])\b/, label: '≈ 80' },
    { re: /\b([1-5][0-9]?)\b/, label: 'до 50' },
  ],
  budget: [
    { re: /\b(8|9|10|11|12)\s*млн|восем.*млн|девят.*млн|десят.*млн/i, label: '8 млн+ ₸' },
    { re: /\b([5-7])\s*млн|пят.*млн|шест.*млн|сем.*млн/i, label: '5–8 млн ₸' },
    { re: /\b([3-4])\s*млн|тр[иё].*млн|четыр.*млн/i, label: '3–5 млн ₸' },
    { re: /(до\s*2|\b[12])\s*млн|один.*млн|полтор.*млн|два\s*млн|две\s*млн/i, label: 'до 2 млн ₸' },
  ],
  style: [
    { re: /(национал|каз|той|нац)/i, label: 'Национальный' },
    { re: /(европ|классик|минимал)/i, label: 'Европейский' },
    { re: /(luxury|люкс|премиум|дорог)/i, label: 'Luxury' },
    { re: /(микс|совмещ|смеш)/i, label: 'Микс' },
  ],
};

const LOADING_STEPS = [
  'Проверка свободных дат',
  'Сравнение с бюджетом',
  'Подбор по городу и категориям',
  'Формирование рекомендаций',
];

/* RU/KZ micro-strings for the language toggle */
const I18N = {
  ru: { pusk: 'ПУСК', greetingShort: 'Опишите событие — или ответьте парой кнопок.', guestsWord: 'гостей' },
  kz: { pusk: 'БАСТАУ', greetingShort: 'Іс-шараны сипаттаңыз — немесе батырмамен жауап беріңіз.', guestsWord: 'қонақ' },
};
