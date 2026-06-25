/* ============================================================
   EVENT AI — prototype controller (vanilla)
   ============================================================ */
'use strict';

/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fmt = (n) => num(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const num = (s) => Number(String(s).replace(/[^\d]/g, ''));
const icon = (id, cls = 'ic') => `<svg class="${cls}"><use href="#${id}"/></svg>`;

/* ---------- brandmark: golden-spiral of dots ---------- */
/* brand assets — client's real EVENT AI logo (theme-aware) */
function markSrc() { return (document.documentElement.dataset.theme === 'light' ? 'assets/mark-light.png' : 'assets/mark-dark.png') + '?v=11'; }
function logoSrc() { return (document.documentElement.dataset.theme === 'light' ? 'assets/logo-light.png' : 'assets/logo-dark.png') + '?v=11'; }
/* renders the client's brand MARK — a generative golden-angle dotted spiral (swirl of dots) */
function buildSpiral(el, opts = {}) {
  if (!el) return;
  const anim = opts.anim || false;
  el.style.color = markColor(opts.color || 'currentColor');
  const N = 92, GA = 2.39996323, scale = 4.95, maxR = 47, cx = 50, cy = 50;
  let dots = '';
  for (let i = 1; i <= N; i++) {
    const r = scale * Math.sqrt(i);
    if (r > maxR) break;
    const a = i * GA;
    const x = (cx + r * Math.cos(a)).toFixed(2);
    const y = (cy + r * Math.sin(a)).toFixed(2);
    const dr = (1.35 + 1.55 * (1 - i / N)).toFixed(2);
    dots += `<circle cx="${x}" cy="${y}" r="${dr}"/>`;
  }
  el.innerHTML = `<svg class="bm-svg${anim ? ' bm-anim' : ''}" viewBox="0 0 100 100" fill="currentColor" preserveAspectRatio="xMidYMid meet" aria-label="EVENT AI">${dots}</svg>`;
}

/* spiral animation + few runtime styles */
(() => {
  const s = document.createElement('style');
  s.textContent = `
    .spiral-anim circle{transform-box:fill-box;transform-origin:center;animation:dotIn .6s var(--ease) both;animation-delay:var(--d)}
    @keyframes dotIn{from{opacity:0;transform:scale(0)}to{opacity:inherit;transform:scale(1)}}
    .brandmark svg{animation:none}
    .splash .mark svg{animation:spinSlow 24s linear infinite}
    @keyframes spinSlow{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(s);
})();

/* ---------- state ---------- */
const S = {
  scenario: null,         // SCENARIOS[key]
  answers: {},            // intake answers
  cart: [],               // vendor refs
  tier: 'PREMIUM',
  styleVariant: 'Микс',
  view: null,
  stack: [],
  removed: new Set(),
};

/* ---------- DOM refs ---------- */
const views = $('#views');
const appbar = $('#appbar');
const appbarTitle = $('#appbarTitle');
const backBtn = $('#backBtn');
const actionbar = $('#actionbar');
const islandText = $('#islandText');

/* ---------- clock ---------- */
function tick() {
  const d = new Date();
  $('#sbTime').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
setInterval(tick, 15000); tick();

/* ---------- ripple on buttons ---------- */
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.btn, .pay, .addbtn');
  if (!b) return;
  const r = b.getBoundingClientRect();
  const sp = document.createElement('span');
  sp.className = 'ripple';
  const size = Math.max(r.width, r.height);
  sp.style.width = sp.style.height = size + 'px';
  sp.style.left = (e.clientX - r.left - size / 2) + 'px';
  sp.style.top = (e.clientY - r.top - size / 2) + 'px';
  b.appendChild(sp);
  setTimeout(() => sp.remove(), 600);
});

/* ---------- toast ---------- */
let toastEl;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; $('#screen').appendChild(toastEl); }
  toastEl.innerHTML = icon('i-check') + `<span>${msg}</span>`;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}
function toastUndo(msg, fn) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; $('#screen').appendChild(toastEl); }
  toastEl.innerHTML = icon('i-check') + `<span>${msg}</span><button class="toast-undo">Отменить</button>`;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl.querySelector('.toast-undo').addEventListener('click', () => { toastEl.classList.remove('show'); fn(); });
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 4200);
}

/* ---------- count-up ---------- */
function countUp(el, target, dur = 900) {
  const end = num(target); const start = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(end * e)) + ' ₸';
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- reactive scenario builder ---------- */
function buildScenario(key, answers) {
  const base = SCENARIOS[key] || SCENARIOS.wedding;
  const guests = GUESTS[answers.guests] || base.defaultGuests;
  const budget = BUDGETS[answers.budget] || base.defaultBudget;
  const style = answers.style || 'Микс';
  const cap = Math.ceil(guests * 1.35 / 10) * 10;
  const styleCats = new Set(['Ведущий', 'Шоу-программа', 'Декор']);
  const vendors = base.vendorKeys.map((k) => {
    const v = JSON.parse(JSON.stringify(V[k]));
    if (v.perGuest) {
      v.price = guests * v.perGuest;
      v.from = `${fmt(v.perGuest)} ₸ / гость`;
      v.meta = `${base.city} · до ${cap} гостей`;
      v.estDesc = `${guests} гостей × ${fmt(v.perGuest)} ₸`;
    }
    const tok = v.reason.includes('{match}') ? (styleCats.has(v.cat) ? style : base.date) : '';
    v.matchToken = tok || `${guests} гостей`;
    v.reasonFull = v.reason.replace('{match}', tok).replace(/\{cap\}/g, guests);
    return v;
  });
  const lines = vendors.map((v) => ({ name: v.estName || v.title, desc: v.estDesc || v.meta, val: v.price }));
  const total = lines.reduce((s, l) => s + num(l.val), 0);
  const advance = Math.round(total * 0.3 / 1000) * 1000;
  const packages = {};
  ['STANDARD', 'COMFORT', 'PREMIUM'].forEach((t) => {
    packages[t] = { price: Math.round(total * PKG_MULT[t] / 10000) * 10000, note: base.packages[t].note, tag: base.packages[t].tag };
  });
  return {
    ...base, guests, guestsLabel: `≈ ${guests} гостей`, budget, budgetLabel: answers.budget || '', cap,
    styleVariant: style, vendors, packages, fits: total <= budget * 1.04,
    estimate: { lines, total, advance, remainder: total - advance, advancePct: '30%' },
  };
}

/* ---------- progress bar ---------- */
const FLOW = ['results', 'cart', 'packages', 'project', 'booking'];
function progressHTML(view) {
  const idx = FLOW.indexOf(view);
  if (idx < 0) return '';
  return `<div class="progress">${FLOW.map((_, i) =>
    `<i class="${i < idx ? 'done' : i === idx ? 'active' : ''}"></i>`).join('')}</div>`;
}

/* ---------- chrome (appbar / island / actionbar) ---------- */
function setChrome({ title, back = true, island, action }) {
  appbar.hidden = false;
  appbarTitle.textContent = title || 'EVENT AI';
  backBtn.style.visibility = back ? 'visible' : 'hidden';
  islandText.textContent = island || 'EVENT AI';
  if (action) { actionbar.hidden = false; actionbar.innerHTML = action; }
  else { actionbar.hidden = true; actionbar.innerHTML = ''; }
}

/* ---------- navigation / transitions ---------- */
function mountView(html, onMount, chrome) {
  const olds = [...views.querySelectorAll('.view')];
  const el = document.createElement('div');
  el.className = 'view view-enter';
  el.innerHTML = (chrome ? progressHTML(chrome._name) : '') + html;
  views.appendChild(el);
  olds.forEach((old) => { old.classList.add('view-exit'); setTimeout(() => old.remove(), 340); });
  requestAnimationFrame(() => { el.scrollTop = 0; });
  if (onMount) onMount(el);
  return el;
}

const VIEWS = {};
function navigate(name, opts = {}) {
  if (!opts.back && S.view && S.view !== name) S.stack.push(S.view);
  S.view = name;
  document.body.dataset.stage = name;
  document.body.dataset.nav = opts.back ? 'back' : 'fwd';
  const v = VIEWS[name]();
  v.chrome._name = name;
  if (name === 'splash' || name === 'chat') { /* minimal chrome handled inside */ }
  setChrome(v.chrome);
  if (name === 'splash') { appbar.hidden = true; actionbar.hidden = true; }
  mountView(v.html, v.onMount, v.chrome);
}
function goBack() {
  const prev = S.stack.pop();
  if (prev) navigate(prev, { back: true });
}
backBtn.addEventListener('click', goBack);

/* ============================================================
   VIEW: SPLASH
   ============================================================ */
VIEWS.splash = () => ({
  chrome: { title: 'EVENT AI', back: false, island: 'EVENT AI' },
  html: `<div class="view splash splash-inner" style="position:static;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0">
      <div class="brandmark mark" id="splashMark"></div>
      <div class="name">EVENT AI</div>
      <div class="sub">Личный AI event-менеджер</div>
      <div class="loadbar"><i></i></div>
    </div>`,
  onMount: () => {
    buildSpiral($('#splashMark'), { color: '#fff', anim: true });
    setTimeout(() => navigate('roleSelect'), 2100);
  },
});

/* ============================================================
   VIEW: ROLE SELECT (Заказчик / Партнёр)
   ============================================================ */
VIEWS.roleSelect = () => ({
  chrome: { title: 'EVENT AI', back: false, island: 'Кто вы?' },
  html: `
    <div class="role-wrap">
      <div class="eyebrow">${icon('i-spark')} Добро пожаловать в EVENT AI</div>
      <div class="h-lead">Кем вы являетесь?</div>
      <div class="h-sub">Выберите роль — приложение подстроится под вас</div>
      <button class="role-card" data-role="client" style="animation-delay:.05s">
        <div class="role-ic">${icon('i-users')}</div>
        <div class="role-b">
          <div class="role-t">Заказчик мероприятия</div>
          <div class="role-d">Организую событие. AI подберёт подрядчиков, соберёт смету, сценарий и тайминг, поможет забронировать.</div>
        </div>
        <span class="role-go">${icon('i-arrow')}</span>
      </button>
      <button class="role-card alt" data-role="partner" style="animation-delay:.14s">
        <div class="role-ic">${icon('i-store')}</div>
        <div class="role-b">
          <div class="role-t">Проект / партнёр платформы</div>
          <div class="role-d">Ресторан, ведущий, артист, техника, декор… Принимайте заявки, ведите календарь и бронирования.</div>
        </div>
        <span class="role-go">${icon('i-arrow')}</span>
      </button>
      <button class="role-admin" data-role="admin">${icon('i-shield')} <span>Панель администратора платформы</span> <svg class="ic"><use href="#i-arrow"/></svg></button>
      <div class="role-note">${icon('i-shield')} Демо · свободный режим, без регистрации</div>
      <div class="role-prod"><span class="role-prod-tag">В полной версии</span>выбор и переключение роли будут в личном кабинете пользователя. Здесь оба входа показаны рядом — для демонстрации.</div>
    </div>`,
  onMount: (el) => {
    const go = { client: 'chat', partner: 'partner', admin: 'admin' };
    el.querySelectorAll('[data-role]').forEach((c) => c.addEventListener('click', () => navigate(go[c.dataset.role] || 'chat')));
  },
});

/* ============================================================
   VIEW: PARTNER cabinet (light, 2nd visual system)
   ============================================================ */
VIEWS.partner = () => {
  const reqs = [
    { n: 'Свадьба · 180 гостей', d: '15 августа', b: '900 000 ₸' },
    { n: 'Юбилей · 60 гостей', d: '20 сентября', b: '450 000 ₸' },
    { n: 'Корпоратив · 80 гостей', d: '12 декабря', b: '600 000 ₸' },
  ];
  return {
    chrome: { title: 'Кабинет партнёра', island: 'Сторона партнёра' },
    html: `<div class="partner-view">
      <div class="biz-top">
        <div class="biz-id"><div class="biz-av">${icon('i-mic2')}</div>
          <div>
            <div class="biz-name">${SUPPLIER.title}</div>
            <div class="biz-role">${SUPPLIER.role}</div>
            <div class="biz-meta-row">
              <span class="biz-rating">${icon('i-star')} 4.9 · 142 отзыва</span>
              <span class="biz-verified">✓ проверен</span>
            </div>
          </div>
        </div>
        <span class="biz-status">● опубликован</span>
      </div>

      <div class="biz-kpi">
        <div class="biz-stat"><div class="bv">1 248</div><div class="bk">просмотров профиля</div><div class="bd">↑ 18% за месяц</div></div>
        <div class="biz-stat"><div class="bv">12</div><div class="bk">входящих заявок</div><div class="bd">↑ 4 новых</div></div>
        <div class="biz-stat"><div class="bv">9</div><div class="bk">броней за месяц</div><div class="bd">↑ 2</div></div>
        <div class="biz-stat"><div class="bv">3.15 млн&nbsp;₸</div><div class="bk">доход за месяц</div><div class="bd flat">после комиссии</div></div>
      </div>

      <div class="biz-h">${icon('i-store')} Как вас видят клиенты</div>
      <div class="biz-listing">
        <div class="lst-img">${icon('i-mic2')}</div>
        <div class="lst-b">
          <div class="lst-t">${SUPPLIER.title}</div>
          <div class="lst-m"><span>${icon('i-star')} 4.9</span><span>Ведущий</span><span>${icon('i-map')} Алматы</span></div>
          <div class="lst-p">от 250 000 ₸ / мероприятие</div>
          <span class="lst-tag">● показывается в AI-подборках</span>
        </div>
      </div>

      <div class="biz-h">${icon('i-calendar')} Календарь занятости</div>
      ${miniCalendar({ title: SUPPLIER.title }, 3)}

      <div class="biz-h">Новые заявки <span class="biz-badge">2 новые</span></div>
      <div class="biz-reqs">${reqs.map((r, ri) => `<div class="biz-req" data-r="${ri}">
          <div class="biz-req-l"><div class="biz-req-n">${r.n}</div><div class="biz-req-d">${icon('i-calendar')} ${r.d} · бюджет ${r.b}</div></div>
          <div class="biz-req-act"><button class="rq-ok" data-r="${ri}">Принять</button><button class="rq-no" data-r="${ri}">✕</button></div>
        </div>`).join('')}</div>

      <div class="biz-h">${icon('i-wallet')} Доходы и выплаты</div>
      <div class="biz-fin">
        <div class="biz-fin-row"><span>Оборот за месяц</span><b>3 387 000 ₸</b></div>
        <div class="biz-fin-row"><span>Комиссия EVENT AI</span><b class="pct">− 7%</b></div>
        <div class="biz-fin-row"><span>К выплате после событий</span><b>3 150 000 ₸</b></div>
        <div class="biz-fin-row"><span>Ближайшая выплата</span><b>18 августа</b></div>
      </div>

      <div class="biz-h">${icon('i-bolt')} Продвижение</div>
      <button class="biz-promo" id="bizPromo">
        <div class="pr-ic">${icon('i-bolt')}</div>
        <div class="pr-b"><div class="pr-t">Поднять профиль в подборках</div><div class="pr-d">Premium-размещение — до 3× больше заявок. Подписка от 15 000 ₸ / мес.</div></div>
        <span class="pr-go">Подключить</span>
      </button>

      <p class="biz-note">Это <b>кабинет партнёра</b> — вторая сторона EVENT AI. Клиент и партнёр работают в одной платформе: заявки, календарь, брони и выплаты связаны. Это и есть <b>двусторонний маркетплейс</b> — и источник дохода: комиссия 7% + платное продвижение.</p>
    </div>`,
    onMount: (el) => {
      el.querySelectorAll('.rq-ok').forEach((b) => b.addEventListener('click', () => {
        const row = b.closest('.biz-req'); row.classList.add('accepted');
        row.querySelector('.biz-req-act').innerHTML = '<span class="rq-done">✓ принято</span>';
        toast('Заявка принята · дата закреплена');
      }));
      el.querySelectorAll('.rq-no').forEach((b) => b.addEventListener('click', () => { b.closest('.biz-req').style.display = 'none'; }));
      $('#bizPromo', el)?.addEventListener('click', () => toast('Demo · здесь подключается Premium-продвижение'));
    },
  };
};

/* ============================================================
   VIEW: MAP (vendor network across Almaty)
   ============================================================ */
VIEWS.map = () => {
  const cats = [
    { k: 'Площадки', c: '#2C7BFF' }, { k: 'Ведущие', c: '#34D399' }, { k: 'Артисты', c: '#F5B544' },
    { k: 'Декор', c: '#F472B6' }, { k: 'Фото / видео', c: '#22D3EE' }, { k: 'Техника', c: '#A78BFA' },
  ];
  const pts = [
    [43.2567, 76.9286, 0], [43.2389, 76.8897, 1], [43.2220, 76.8712, 2], [43.2641, 76.9450, 3],
    [43.2480, 76.9120, 4], [43.2305, 76.8550, 5], [43.2712, 76.9180, 0], [43.2190, 76.9320, 1],
    [43.2520, 76.8830, 2], [43.2350, 76.9560, 3], [43.2270, 76.9050, 4], [43.2600, 76.8650, 5],
    [43.2430, 76.9400, 0], [43.2150, 76.8980, 1], [43.2690, 76.9350, 2], [43.2330, 76.8740, 0],
    [43.2585, 76.9020, 5], [43.2255, 76.9210, 3],
  ];
  return {
    chrome: {
      title: 'Карта подрядчиков', island: 'Сеть · Алматы', back: false,
      action: `<button class="btn btn-primary" id="mapStart">${icon('i-spark')} Запустить демо</button>`,
    },
    html: `<div class="map-view">
      <div class="map-head"><div class="map-h-t">Сеть подрядчиков · Алматы</div><div class="map-h-s">Вся индустрия мероприятий — в одной платформе</div></div>
      <div class="map-stats">
        <div class="ms"><b>1 240</b><span>подрядчиков</span></div>
        <div class="ms"><b>11</b><span>категорий</span></div>
        <div class="ms"><b>8</b><span>районов</span></div>
      </div>
      <div class="map-canvas"><div id="leafMap"></div></div>
      <div class="map-legend">${cats.map((c) => `<span class="lg"><i style="background:${c.c}"></i>${c.k}</span>`).join('')}</div>
      <p class="map-note">Реальная карта Алматы. В продукте — живые подрядчики с фильтром по категории, бюджету и свободной дате.</p>
    </div>`,
    onMount: () => {
      $('#mapStart')?.addEventListener('click', () => navigate('roleSelect'));
      if (typeof L === 'undefined') return;
      const map = L.map('leafMap', { center: [43.2405, 76.9100], zoom: 12, zoomControl: false, scrollWheelZoom: false, attributionControl: true });
      map.attributionControl.setPrefix(false);
      L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Esri · HERE · Garmin' }).addTo(map);
      pts.forEach(([la, lo, ci]) => {
        const ic = L.divIcon({ className: 'map-pin', html: `<span class="mp-dot" style="--pc:${cats[ci].c}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
        L.marker([la, lo], { icon: ic, keyboard: false }).addTo(map);
      });
      setTimeout(() => map.invalidateSize(), 250);
    },
  };
};

/* ============================================================
   VIEW: ADMIN (3rd side — platform control teaser)
   ============================================================ */
VIEWS.admin = () => {
  const queue = [
    { n: 'Ресторан «Алтын Орда»', c: 'Площадка · до 250 гостей' },
    { n: 'Ведущий — Арман Бейсенов', c: 'Ведущий · каз/рус' },
    { n: 'Декор-студия «Флёр»', c: 'Оформление и флористика' },
  ];
  return {
    chrome: { title: 'Админ-панель', island: 'Платформа · контроль' },
    html: `<div class="admin-view">
      <div class="adm-top">
        <div class="adm-id"><div class="adm-av">${icon('i-shield')}</div><div><div class="adm-name">EVENT AI · Платформа</div><div class="adm-role">Администратор · модерация и аналитика</div></div></div>
        <span class="adm-live"><span class="island-dot"></span>онлайн</span>
      </div>
      <div class="adm-kpi">
        <div class="adm-stat"><div class="av">184 млн&nbsp;₸</div><div class="ak">Оборот платформы / год</div></div>
        <div class="adm-stat"><div class="av">1 240</div><div class="ak">Активных подрядчиков</div></div>
        <div class="adm-stat"><div class="av">320</div><div class="ak">Броней за месяц</div></div>
        <div class="adm-stat hot"><div class="av">12,9 млн&nbsp;₸</div><div class="ak">Выручка платформы (7%)</div></div>
      </div>
      <div class="adm-h">${icon('i-shield')} Модерация карточек <span class="adm-badge">2 новые</span></div>
      <div class="adm-queue">${queue.map((q, i) => `<div class="adm-row" data-i="${i}">
          <div class="adm-row-l"><div class="adm-row-n">${q.n}</div><div class="adm-row-c">${q.c}</div></div>
          <div class="adm-row-act"><button class="adm-ok" data-i="${i}">Одобрить</button><button class="adm-no" data-i="${i}">✕</button></div>
        </div>`).join('')}</div>
      <div class="adm-h">${icon('i-spark')} Контроль качества</div>
      <div class="adm-fin">
        <div class="adm-fin-row"><span>Споры в работе</span><b>2</b></div>
        <div class="adm-fin-row"><span>Жалобы за месяц</span><b>4</b></div>
        <div class="adm-fin-row"><span>Средний рейтинг подрядчиков</span><b>4.8 ★</b></div>
        <div class="adm-fin-row"><span>Категорий услуг</span><b>11</b></div>
      </div>
      <p class="adm-note">Это <b>третья сторона платформы</b> — модерация карточек до публикации, аналитика оборота и выручки, контроль качества и споров. В демо — иллюстративно.</p>
    </div>`,
    onMount: (el) => {
      el.querySelectorAll('.adm-ok').forEach((b) => b.addEventListener('click', () => {
        const r = b.closest('.adm-row'); r.classList.add('done');
        r.querySelector('.adm-row-act').innerHTML = '<span class="adm-done">✓ опубликовано</span>';
        toast('Карточка одобрена и опубликована');
      }));
      el.querySelectorAll('.adm-no').forEach((b) => b.addEventListener('click', () => { b.closest('.adm-row').style.display = 'none'; toast('Карточка отклонена'); }));
    },
  };
};

/* ============================================================
   VIEW: CHAT (intake)
   ============================================================ */
VIEWS.chat = () => ({
  chrome: { title: 'AI-ассистент', back: false, island: 'AI-ассистент' },
  html: `<div class="chat" id="chat"></div>
    <form class="composer" id="composer" autocomplete="off">
      <button type="button" class="comp-mic" id="compMic" aria-label="Голос">${icon('i-mic')}</button>
      <input class="comp-input" id="compInput" placeholder="Опишите событие словами…" />
      <button type="submit" class="comp-send" id="compSend" aria-label="Отправить">${icon('i-arrow')}</button>
    </form>`,
  onMount: (el) => { wireComposer($('#chat', el)); runIntake($('#chat', el)); },
});

const T = () => I18N[S.lang || 'ru'];

async function aiLine(box, text, opts = {}) {
  const msg = document.createElement('div'); msg.className = 'msg ai';
  msg.innerHTML = `<div class="av"><div class="brandmark mark"></div></div><div class="bubble"></div>`;
  box.appendChild(msg);
  buildSpiral(msg.querySelector('.mark'), { color: 'var(--accent-2)' });
  const bubble = msg.querySelector('.bubble');
  if (opts.instant) { bubble.textContent = text; scrollChat(box); await sleep(110); return; }
  bubble.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>`;
  scrollChat(box); await sleep(340);
  bubble.innerHTML = `<span class="txt"></span><span class="cursor"></span>`;
  const txt = bubble.querySelector('.txt');
  for (const ch of text) { txt.textContent += ch; scrollChat(box); await sleep(/[.,—!?:]/.test(ch) ? 110 : 8 + Math.random() * 13); }
  bubble.querySelector('.cursor')?.remove(); await sleep(110);
}
async function addAIMessage(box, lines) { for (const l of lines) await aiLine(box, l); }
function addUserMessage(box, text) {
  const msg = document.createElement('div'); msg.className = 'msg user';
  msg.innerHTML = `<div class="av"></div><div class="bubble">${text}</div>`;
  box.appendChild(msg); scrollChat(box);
}
let _scrollRAF = false;
function scrollChat(box) {
  if (_scrollRAF) return; _scrollRAF = true;
  requestAnimationFrame(() => { _scrollRAF = false; box.scrollTo({ top: box.scrollHeight + 400, behavior: 'smooth' }); });
}

function applyAnswer(key, label) {
  S.answers[key] = label;
  if (key === 'type') { const ts = INTAKE.find((s) => s.key === 'type'); const o = ts && ts.options.find((x) => x.label === label); if (o && o.scenario) S.scenario = SCENARIOS[o.scenario]; }
  if (key === 'style') S.styleVariant = label === 'Национальный' ? 'Нац.' : label === 'Европейский' ? 'Европа' : label === 'Luxury' ? 'Luxury' : 'Микс';
}
function askStep(box, step) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div'); wrap.className = 'chat-chips chips';
    let settled = false;
    const done = (label) => { if (settled) return; settled = true; addUserMessage(box, label); wrap.remove(); S._active = null; resolve(label); };
    step.options.forEach((o, i) => { const c = document.createElement('button'); c.className = 'chip'; c.style.animationDelay = (i * 45) + 'ms'; c.textContent = o.label; c.addEventListener('click', () => done(o.label)); wrap.appendChild(c); });
    box.appendChild(wrap); scrollChat(box);
    S._active = { key: step.key, done };
  });
}
function runNLU(text) {
  const out = {};
  for (const key of ['type', 'guests', 'budget', 'style']) {
    for (const m of NLU[key]) if (m.re.test(text)) { out[key] = m.label; break; }
  }
  return out;
}
function wireComposer(box) {
  const view = box.parentElement || document;
  const form = view.querySelector('#composer'), input = view.querySelector('#compInput'), mic = view.querySelector('#compMic');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text) return;
    input.value = ''; addUserMessage(box, text);
    const m = runNLU(text); const keys = Object.keys(m);
    keys.forEach((k) => applyAnswer(k, m[k]));
    if (keys.length) {
      const names = { type: 'тип', guests: 'гостей', budget: 'бюджет', style: 'стиль' };
      await aiLine(box, `Понял — ${keys.map((k) => names[k]).join(', ')} учёл. Уточняю остальное.`);
      if (S._active && m[S._active.key]) S._active.done(m[S._active.key]);
    } else {
      await aiLine(box, 'Понял — отметьте парой кнопок ниже, так точнее.');
    }
  });
  mic.addEventListener('click', () => {
    if (mic.classList.contains('rec')) return;
    mic.classList.add('rec');
    setTimeout(() => { mic.classList.remove('rec'); input.value = 'свадьба на 150 гостей, бюджет 6 млн, национальный стиль'; input.focus(); }, 850);
  });
}
function renderBrief(box) {
  const sc = S.scenario || SCENARIOS.wedding;
  const card = document.createElement('div'); card.className = 'brief-card';
  card.innerHTML = `<h4>Бриф события</h4>
    <div class="brief-row"><span class="k">${icon('i-spark')} Тип</span><span class="v">${S.answers.type || sc.typeLabel}</span></div>
    <div class="brief-row"><span class="k">${icon('i-users')} Гости</span><span class="v">${S.answers.guests || '—'}</span></div>
    <div class="brief-row"><span class="k">${icon('i-wallet')} Бюджет</span><span class="v">${S.answers.budget || '—'}</span></div>
    <div class="brief-row"><span class="k">${icon('i-star')} Стиль</span><span class="v">${S.answers.style || 'Микс'}</span></div>
    <div class="brief-row"><span class="k">${icon('i-calendar')} Город · дата</span><span class="v">${sc.city} · ${sc.date}</span></div>`;
  box.appendChild(card); scrollChat(box);
}
function showPusk() {
  const cmp = $('#composer'); if (cmp) cmp.classList.add('done');
  setChrome({ title: 'AI-ассистент', back: false, island: 'Готов к подбору',
    action: `<div class="pusk"><button class="btn btn-primary" id="puskBtn">${icon('i-bolt')} ${T().pusk}</button></div>` });
  $('#puskBtn').addEventListener('click', startMatching);
}
async function runIntake(box) {
  if (!S.intakeDone) S.answers = {};
  if (S.intakeDone && S.answers.type) {
    await aiLine(box, 'С возвращением. Бриф сохранён — поправьте ответом или нажмите ПУСК.', { instant: true });
    renderBrief(box); showPusk(); return;
  }
  await aiLine(box, INTAKE[0].ai[0], { instant: true });
  await aiLine(box, INTAKE[0].ai[1]);
  for (let i = 1; i < INTAKE.length; i++) {
    const step = INTAKE[i];
    if (S.answers[step.key]) continue;
    await aiLine(box, step.q);
    const label = await askStep(box, step);
    applyAnswer(step.key, label);
  }
  if (!S.scenario) S.scenario = SCENARIOS.wedding;
  S.intakeDone = true;
  renderBrief(box);
  await aiLine(box, 'Готово. Нажмите ПУСК — соберу подборку, смету и сценарий.');
  showPusk();
}

/* ============================================================
   LOADING overlay → results
   ============================================================ */
async function startMatching() {
  S.scenario = buildScenario(S.scenario.key, S.answers);
  actionbar.hidden = true;
  islandText.textContent = 'Подбираю…';
  const ov = document.createElement('div');
  ov.className = 'loading';
  ov.innerHTML = `
    <div class="orb"><div class="ring"></div><div class="ring"></div><div class="brandmark mark"></div></div>
    <div class="title">AI собирает мероприятие</div>
    <div class="pct" id="pct">0%</div>
    <div class="steps" id="steps">${LOADING_STEPS.map((t, i) =>
      `<div class="step" data-i="${i}"><span class="dot">${icon('i-check')}</span><span>${t}</span></div>`).join('')}</div>
    <div class="ai-scan" id="aiScan">
      <div class="scan-row"><span class="sk">Просканировано подрядчиков</span><span class="sv" id="scanTotal">0</span></div>
      <div class="scan-row"><span class="sk">Отклонено — заняты на дату</span><span class="sv warn" id="scanDate">0</span></div>
      <div class="scan-row"><span class="sk">Отклонено — вне бюджета</span><span class="sv warn" id="scanBudget">0</span></div>
      <div class="scan-row"><span class="sk">Отобрано в подборку</span><span class="sv ok" id="scanPick">0</span></div>
    </div>`;
  $('#screen').appendChild(ov);
  buildSpiral(ov.querySelector('.mark'), { color: '#fff' });
  S.scenario.vendors.forEach((v) => { const im = new Image(); im.src = IMG(v.seed); });
  const pct = $('#pct', ov);
  const steps = [...ov.querySelectorAll('.step')];
  const band = 100 / steps.length;
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    st.classList.add('active');
    islandText.textContent = `Шаг ${i + 1}/${steps.length}`;
    if (i === 0) { countTo($('#scanTotal', ov), 1240, 700); countTo($('#scanDate', ov), 47, 700); }
    else if (i === 1) countTo($('#scanBudget', ov), 23, 600);
    else if (i === 2) countTo($('#scanPick', ov), S.scenario.vendors.length, 600);
    const sp = document.createElement('span'); sp.className = 'spin-mini'; st.appendChild(sp);
    const dur = 540 + Math.random() * 220, t0 = performance.now();
    await new Promise((res) => {
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        pct.textContent = Math.round((i + p) * band) + '%';
        if (p < 1) requestAnimationFrame(tick); else res();
      })(t0);
    });
    sp.remove(); st.classList.remove('active'); st.classList.add('done');
  }
  pct.textContent = '100%';
  await sleep(340);
  ov.style.animation = 'viewOut .35s var(--ease) both';
  await sleep(330); ov.remove();
  S.cart = S.scenario.vendors.map((_, i) => i);
  S.removed = new Set();
  navigate('results');
}

/* ============================================================
   VIEW: RESULTS (подборка)
   ============================================================ */
VIEWS.results = () => {
  const sc = S.scenario;
  S.favorites = S.favorites || new Set();
  const vcard = (v, i) => {
    const added = !S.removed.has(i);
    const fav = S.favorites.has(i);
    const rh = v.reasonFull.replace(v.matchToken, `<b>${v.matchToken}</b>`);
    return `<div class="vcard" data-i="${i}" style="animation-delay:${i * 60}ms">
        <div class="media"><img src="${IMG(v.seed)}" alt="${v.title}" loading="lazy"/>
          <span class="badge"><span class="dot"></span>свободно ${sc.date}</span>
          <button class="fav ${fav ? 'on' : ''}" data-fav="${i}" aria-label="В избранное">${icon('i-heart')}</button>
          <span class="more-chip">Подробнее ${icon('i-arrow')}</span>
        </div>
        <div class="vbody">
          <div class="vtitle">${v.title}</div>
          <div class="vmeta">${v.meta} · ${icon('i-star')} ${v.rating}</div>
          <div class="reason">
            <div class="reason-ic">${icon('i-spark')}</div>
            <div class="reason-b"><span class="why">Почему AI выбрал</span><p>${rh}</p>
              <div class="considered">сравнил <b>${v.considered}</b> · отклонил ${v.rejected} · совпадение <b>${v.confidence}%</b></div>
            </div>
          </div>
          <div class="vfoot">
            <div class="price">${fmt(v.price)} ₸<span class="from">${v.from}</span></div>
            <button class="addbtn ${added ? 'added' : ''}" data-i="${i}">
              ${added ? icon('i-check') + 'В корзине' : icon('i-plus') + 'В корзину'}
            </button>
          </div>
        </div>
      </div>`;
  };
  const blockOf = (cat) => {
    const c = (cat || '').toLowerCase();
    if (/ресторан|площад|зал|лофт|концерт|спорт|студи|конференц|кейтеринг|фуд|банкет/.test(c)) return 'venue';
    if (/ведущ|тамада|модератор|announcer|акын|спикер|молла|имам/.test(c)) return 'host';
    if (/балет/.test(c)) return 'ballet';
    if (/live|band|dj|музык|домбр/.test(c)) return 'band';
    if (/шоу/.test(c)) return 'show';
    if (/артист|звезд/.test(c)) return 'artist';
    if (/фото|видео|медиа/.test(c)) return 'photo';
    if (/декор|оформл|флорист|костюм/.test(c)) return 'decor';
    return 'tech';
  };
  const BLOCKS = [
    { k: 'venue', label: 'Рестораны / площадки', icon: 'i-map' },
    { k: 'host', label: 'Ведущие', icon: 'i-users' },
    { k: 'artist', label: 'Артисты / звёзды', icon: 'i-bolt' },
    { k: 'ballet', label: 'Show-ballet', icon: 'i-spark' },
    { k: 'band', label: 'Live band / DJ', icon: 'i-music' },
    { k: 'show', label: 'Шоу-программа', icon: 'i-spark' },
    { k: 'photo', label: 'Фото / видео', icon: 'i-pres' },
    { k: 'decor', label: 'Оформление', icon: 'i-star' },
    { k: 'tech', label: 'Техника', icon: 'i-bolt' },
  ];
  const byBlock = {};
  sc.vendors.forEach((v, i) => { const b = blockOf(v.cat); (byBlock[b] = byBlock[b] || []).push(i); });
  const vendorBlocks = BLOCKS.map((B, bi) => {
    const idxs = byBlock[B.k] || [];
    const has = idxs.length > 0;
    const count = has ? `${idxs.length} ${idxs.length === 1 ? 'вариант' : 'варианта'}` : 'по запросу';
    const body = has ? idxs.map((i) => vcard(sc.vendors[i], i)).join('')
      : `<div class="block-empty">${icon('i-spark')} AI подберёт под ваш формат при необходимости</div>`;
    return `<div class="cat-block ${has ? 'open' : ''}" style="animation-delay:${bi * 40}ms">
        <button class="cat-block-head" type="button"><span class="cbh-l">${icon(B.icon)} ${B.label}</span><span class="cbh-r"><span class="cbh-count ${has ? 'hot' : ''}">${count}</span><svg class="ic cbh-chev"><use href="#i-arrow"/></svg></span></button>
        <div class="cat-block-body">${body}</div>
      </div>`;
  }).join('');
  const scnPreview = (sc.scenario || []).map((b) => b.title).join(' · ');
  const docBlocks = `
      <div class="cat-block"><button class="cat-block-head" type="button"><span class="cbh-l">${icon('i-doc')} Сценарий</span><span class="cbh-r"><span class="cbh-count hot">готов</span><svg class="ic cbh-chev"><use href="#i-arrow"/></svg></span></button><div class="cat-block-body"><div class="block-note">${scnPreview || 'AI сформирует сценарий под формат'} — полностью на шаге «Проект».</div></div></div>
      <div class="cat-block"><button class="cat-block-head" type="button"><span class="cbh-l">${icon('i-sheet')} Смета</span><span class="cbh-r"><span class="cbh-count hot">${fmt(sc.estimate.total)} ₸</span><svg class="ic cbh-chev"><use href="#i-arrow"/></svg></span></button><div class="cat-block-body"><div class="block-note">Предварительная смета <b>${fmt(sc.estimate.total)} ₸</b> — детально на шаге «Проект».</div></div></div>`;
  return {
    chrome: {
      title: 'Персональная подборка', island: 'Подборка готова',
      action: `<button class="btn btn-primary" id="toCart">${icon('i-cart')} Собрать проект<span class="sub" id="cartCount"></span></button>`,
    },
    html: `
      <div class="ai-banner">
        <div class="av"><div class="brandmark mark" id="bnMark"></div></div>
        <p>Под ваш бриф (<b>${sc.guestsLabel}</b>, бюджет <b>${S.answers.budget || '—'}</b>) AI собрал подборку по направлениям, всё свободно на <b>${sc.date}</b>. ${sc.fits ? `Итог <b>${fmt(sc.estimate.total)} ₸</b> — в бюджете.` : `Полный набор <b>${fmt(sc.estimate.total)} ₸</b> — чуть выше бюджета, уберите 1–2 позиции.`}</p>
      </div>
      <div class="ai-savings">${icon('i-bolt')}<div class="sv-b"><span class="sv-t">AI подобрал на ~18% выгоднее рынка</span><span class="sv-d">Экономия ≈ <b>${fmt(Math.round(num(sc.estimate.total) * 0.18))} ₸</b> против ручной сборки по средним ценам</span></div></div>
      <div class="blocks-hint">${icon('i-spark')} Каждый блок открывается отдельно — нажмите, чтобы развернуть</div>
      ${vendorBlocks}${docBlocks}`,
    onMount: (el) => {
      buildSpiral($('#bnMark', el), { color: 'var(--accent-2)' });
      el.querySelectorAll('.cat-block-head').forEach((h) => h.addEventListener('click', () => h.closest('.cat-block').classList.toggle('open')));
      el.querySelectorAll('.vcard .media img').forEach((im) => {
        const done = () => { im.classList.add('loaded'); im.closest('.media').classList.add('imgloaded'); };
        if (im.complete && im.naturalWidth) done(); else { im.addEventListener('load', done); im.addEventListener('error', done); }
      });
      updateCartCount();
      el.querySelectorAll('.addbtn').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = +b.dataset.i;
        if (S.removed.has(i)) { S.removed.delete(i); b.classList.add('added'); b.innerHTML = icon('i-check') + 'В корзине'; }
        else { S.removed.add(i); b.classList.remove('added'); b.innerHTML = icon('i-plus') + 'В корзину'; }
        updateCartCount();
      }));
      el.querySelectorAll('.fav').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = +b.dataset.fav;
        if (S.favorites.has(i)) { S.favorites.delete(i); b.classList.remove('on'); }
        else { S.favorites.add(i); b.classList.add('on'); burst(b); }
      }));
      el.querySelectorAll('.vcard').forEach(c => c.addEventListener('click', (e) => {
        if (e.target.closest('.addbtn') || e.target.closest('.fav')) return;
        openVendor(+c.dataset.i);
      }));
      $('#toCart').addEventListener('click', () => navigate('cart'));
    },
  };
};
function burst(el) {
  const r = el.getBoundingClientRect(), sr = $('#screen').getBoundingClientRect();
  const cx = r.left - sr.left + r.width / 2, cy = r.top - sr.top + r.height / 2;
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('span'); p.className = 'fav-particle';
    const a = (i / 6) * Math.PI * 2, dx = Math.cos(a) * 22, dy = Math.sin(a) * 22;
    p.style.left = cx + 'px'; p.style.top = cy + 'px';
    p.style.setProperty('--dx', dx + 'px'); p.style.setProperty('--dy', dy + 'px');
    $('#screen').appendChild(p); setTimeout(() => p.remove(), 600);
  }
}

/* ---------- vendor detail sheet ---------- */
function miniCalendar(v, i) {
  const dstr = (S.scenario && S.scenario.date) || '15 августа';
  const parts = dstr.split(' ');
  const day = parseInt(parts[0], 10) || 15;
  const month = parts[1] || 'август';
  let cells = '';
  const pad = (i + 2) % 7;
  for (let p = 0; p < pad; p++) cells += `<i class="cal-pad"></i>`;
  for (let d = 1; d <= 30; d++) {
    const busy = ((d * 7 + i * 3) % 5 === 0) && d !== day;
    const sel = d === day;
    cells += `<i class="${sel ? 'cal-sel' : busy ? 'cal-busy' : 'cal-free'}">${d}</i>`;
  }
  return `<div class="cal">
    <div class="cal-grid"><i class="cal-wd">пн</i><i class="cal-wd">вт</i><i class="cal-wd">ср</i><i class="cal-wd">чт</i><i class="cal-wd">пт</i><i class="cal-wd">сб</i><i class="cal-wd">вс</i>${cells}</div>
    <div class="cal-legend"><span><i class="lg free"></i> свободно</span><span><i class="lg busy"></i> занято</span><span><i class="lg sel"></i> ${month}, ваша дата</span></div></div>`;
}
function openVendor(i) {
  const v = S.scenario.vendors[i]; if (!v) return;
  const gal = galleryFor(v.seed), revs = reviewsFor(i), alts = altsFor(v.cat);
  const added = !S.removed.has(i); S.favorites = S.favorites || new Set();
  const fav = S.favorites.has(i);
  const ov = document.createElement('div'); ov.className = 'sheet-ov vsheet';
  ov.innerHTML = `<div class="sheet sheet-tall">
      <div class="sheet-grab"></div>
      <div class="vd-scroll">
        <div class="vd-gallery">${gal.map((g) => `<div class="vd-slide"><img src="${g}" alt=""/></div>`).join('')}</div>
        <div class="vd-dots">${gal.map((_, gi) => `<i class="${gi === 0 ? 'on' : ''}"></i>`).join('')}</div>
        <div class="vd-head">
          <div><div class="vd-cat">${icon(v.icon)} ${v.cat}</div><div class="vd-title">${v.title}</div><div class="vd-meta">${v.meta}</div></div>
          <div class="vd-rate">${icon('i-star')} ${v.rating}</div>
        </div>
        <div class="vd-socials"><span class="soc">Instagram</span><span class="soc">YouTube</span><span class="soc">WhatsApp</span><span class="soc">${icon('i-map')} карта</span></div>
        <div class="reason" style="margin-top:4px"><div class="reason-ic">${icon('i-spark')}</div><div class="reason-b"><span class="why">Почему AI выбрал</span><p>${v.reasonFull.replace(v.matchToken, `<b>${v.matchToken}</b>`)}</p></div></div>
        <div class="vd-sec-h">Свободные даты</div>
        ${miniCalendar(v, i)}
        <div class="vd-sec-h">Отзывы</div>
        <div class="vd-reviews">${revs.map((r) => `<div class="vd-rev"><div class="vd-rev-top"><b>${r.n}</b><span class="vd-stars">${'★'.repeat(r.r)}</span></div><p>${r.t}</p></div>`).join('')}</div>
        ${alts.length ? `<div class="vd-sec-h">${icon('i-spark')} AI: другие варианты в категории</div>
        <div class="vd-alts">${alts.map((a, ai) => `<button class="vd-alt" data-alt="${ai}"><div class="vd-alt-l"><div class="vd-alt-t">${a.title}</div><div class="vd-alt-n">${a.note}</div></div><span class="vd-alt-r">${icon('i-star')} ${a.rating}</span><span class="vd-alt-swap">Заменить</span></button>`).join('')}</div>` : ''}
      </div>
      <div class="vd-actions">
        <button class="vd-fav ${fav ? 'on' : ''}" aria-label="В избранное">${icon('i-heart')}</button>
        <button class="btn btn-primary vd-add">${added ? icon('i-check') + ' В корзине' : icon('i-plus') + ' Добавить в проект'}</button>
      </div>
    </div>`;
  $('#screen').appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 340); };
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  const g = ov.querySelector('.vd-gallery'), dots = [...ov.querySelectorAll('.vd-dots i')];
  g.addEventListener('scroll', () => { const idx = Math.round(g.scrollLeft / g.clientWidth); dots.forEach((d, di) => d.classList.toggle('on', di === idx)); });
  ov.querySelectorAll('.soc').forEach((s) => s.addEventListener('click', () => toast('Откроется профиль подрядчика')));
  ov.querySelectorAll('.vd-alt').forEach((b) => b.addEventListener('click', () => { toast('AI заменил вариант — смета пересчитана'); close(); }));
  ov.querySelector('.vd-fav').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (S.favorites.has(i)) { S.favorites.delete(i); b.classList.remove('on'); }
    else { S.favorites.add(i); b.classList.add('on'); burst(b); }
  });
  ov.querySelector('.vd-add').addEventListener('click', () => { S.removed.delete(i); updateCartCount(); toast('Добавлено в проект'); close(); });
}
function activeCart() { return S.scenario.vendors.map((v, i) => i).filter(i => !S.removed.has(i)); }
function cartTotal() { return activeCart().reduce((s, i) => s + num(S.scenario.vendors[i].price), 0); }
function updateCartCount() {
  const c = $('#cartCount'); if (c) c.textContent = `· ${activeCart().length} · ${fmt(cartTotal())} ₸`;
}

/* ============================================================
   VIEW: CART (корзина + AI-проверка)
   ============================================================ */
VIEWS.cart = () => {
  const sc = S.scenario;
  if (activeCart().length === 0) {
    return {
      chrome: { title: 'Корзина', island: 'Корзина пуста' },
      html: `<div class="empty">
          <div class="empty-ic"><div class="brandmark mark" id="ecMark"></div></div>
          <div class="empty-t">Корзина пуста</div>
          <p class="empty-s">Вернуть набор, который AI собрал под «${sc.concept}»?</p>
          <button class="btn btn-primary" id="ecRestore">${icon('i-spark')} Вернуть подбор AI</button>
        </div>`,
      onMount: (el) => {
        buildSpiral($('#ecMark', el), { color: 'var(--accent-2)' });
        $('#ecRestore').addEventListener('click', () => { S.removed = new Set(); navigate('cart', { back: true }); });
      },
    };
  }
  const total = cartTotal();
  const over = total > sc.budget * 1.04;
  const items = activeCart().map((i) => {
    const v = sc.vendors[i];
    return `<div class="cart-item">
        <div class="thumb"><img src="${IMG(v.seed)}" alt=""/></div>
        <div class="ci-body"><div class="ci-cat">${v.cat}</div><div class="ci-title">${v.title}</div><div class="ci-price">${fmt(v.price)} ₸</div></div>
        <button class="rm" data-i="${i}" aria-label="Убрать">${icon('i-close')}</button>
      </div>`;
  }).join('');
  return {
    chrome: {
      title: 'Корзина', island: `Корзина · ${fmt(total)} ₸`,
      action: `<button class="btn btn-primary" id="toPkg">${icon('i-spark')} Упаковать проект</button>`,
    },
    html: `
      <div class="ai-banner" style="margin-bottom:14px">
        <div class="av"><div class="brandmark mark" id="cbMark"></div></div>
        <p>Проверил совместимость <b>${activeCart().length}</b> позиций — все <b>свободны на ${sc.date}</b>, конфликтов по дате нет.</p>
      </div>
      ${items}
      <div class="section-gap"></div>
      <div class="checkrow ok">${icon('i-check')}<span><b>Совместимо по дате</b> — конфликтов нет</span></div>
      <div class="checkrow ${over ? 'tip' : 'ok'}">${icon('i-shield')}<span>${over ? `<b>Чуть выше бюджета</b> ${S.answers.budget || ''} — уберите позицию, чтобы вписаться` : `<b>В рамках бюджета</b> ${S.answers.budget || ''}`}</span></div>
      <div class="checkrow tip">${icon('i-spark')}<span><b>Совет AI:</b> добавьте пригласительные — поднимет явку гостей</span></div>
      <div class="totalbar">
        <div class="lbl">Итого по проекту<b>${activeCart().length} подрядчиков</b></div>
        <div class="sum" id="cartSum">0 ₸</div>
      </div>`,
    onMount: (el) => {
      buildSpiral($('#cbMark', el), { color: 'var(--accent-2)' });
      countUp($('#cartSum', el), cartTotal(), 850);
      el.querySelectorAll('.rm').forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.i; S.removed.add(i);
        toastUndo('Убрано из проекта', () => { S.removed.delete(i); navigate('cart', { back: true }); });
        navigate('cart', { back: true });
      }));
      $('#toPkg').addEventListener('click', () => navigate('packages'));
    },
  };
};

/* ============================================================
   VIEW: PACKAGES
   ============================================================ */
VIEWS.packages = () => {
  const sc = S.scenario;
  const inc = {
    STANDARD: ['Смета и бланк заказа', 'Сценарий + тайминг', 'Презентация PDF'],
    COMFORT: ['Всё из Standard', 'Расширенный декор и шоу', 'Видео-highlights'],
    PREMIUM: ['Всё из Comfort', 'Артист и LED-экран', 'Same-day-edit ролик'],
  };
  const order = ['STANDARD', 'COMFORT', 'PREMIUM'];
  const cards = order.map((k, idx) => {
    const p = sc.packages[k];
    const sel = S.tier === k;
    return `<div class="pkg ${sel ? 'sel' : ''}" data-k="${k}" style="animation-delay:${idx * 80}ms">
        <div class="pkg-radio"></div>
        <div class="pkg-top"><span class="pkg-name">${k}</span>${p.tag ? `<span class="pkg-tag">${p.tag}</span>` : ''}</div>
        <div class="pkg-price">${fmt(p.price)} <span class="cur">₸</span></div>
        <div class="pkg-note">${p.note}</div>
        <ul class="pkg-inc">${inc[k].map(t => `<li>${icon('i-check')} ${t}</li>`).join('')}</ul>
      </div>`;
  }).join('');
  const variants = ['Нац.', 'Микс', 'Европа', 'Luxury'];
  return {
    chrome: {
      title: 'Пакеты', island: 'Выбор пакета',
      action: `<button class="btn btn-primary" id="genBtn">${icon('i-spark')} Сгенерировать документы</button>`,
    },
    html: `
      <div class="eyebrow">${icon('i-spark')} AI-упаковка</div>
      <div class="h-lead">Выберите уровень мероприятия</div>
      <div class="h-sub">Стиль оформления:</div>
      <div class="style-seg">${variants.map(v => `<button class="seg ${S.styleVariant === v ? 'sel' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
      ${cards}`,
    onMount: (el) => {
      el.querySelectorAll('.pkg').forEach(p => p.addEventListener('click', () => {
        S.tier = p.dataset.k;
        el.querySelectorAll('.pkg').forEach(x => x.classList.toggle('sel', x === p));
      }));
      el.querySelectorAll('.seg').forEach(s => s.addEventListener('click', () => {
        S.styleVariant = s.dataset.v;
        el.querySelectorAll('.seg').forEach(x => x.classList.toggle('sel', x === s));
      }));
      $('#genBtn').addEventListener('click', () => navigate('project'));
    },
  };
};

/* ============================================================
   VIEW: PROJECT (artifact — live assembly + tabs)
   ============================================================ */
VIEWS.project = () => {
  const sc = S.scenario;
  return {
    chrome: {
      title: 'Готовый проект', island: 'Проект собран',
      action: `<button class="btn btn-primary" id="toDocs">${icon('i-doc')} К документам</button>`,
    },
    html: `
      <div class="eyebrow">${icon('i-spark')} ${S.tier} · ${S.styleVariant}</div>
      <div class="h-lead">${sc.concept}</div>
      <div class="h-sub">${sc.conceptSub} · <b>${sc.date}</b></div>
      <div class="tabs" id="tabs">
        <button class="tab sel" data-t="est">Смета</button>
        <button class="tab" data-t="time">Тайминг</button>
        <button class="tab" data-t="scn">Сценарий</button>
        <button class="tab" data-t="pres">Презентация</button>
      </div>
      <div id="pane"></div>`,
    onMount: (el) => {
      const pane = $('#pane', el);
      const render = (t) => {
        pane.innerHTML = paneHTML(t, sc);
        pane.firstElementChild?.classList.add('tabpane');
        if (t === 'est') animateEstimate(pane);
        if (t === 'pres') buildSpiral($('#presMark', pane), { color: '#fff' });
      };
      el.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
        el.querySelectorAll('.tab').forEach(x => x.classList.toggle('sel', x === b));
        render(b.dataset.t);
      }));
      render('est');
      $('#toDocs').addEventListener('click', () => navigate('documents'));
    },
  };
};

function paneHTML(t, sc) {
  if (t === 'est') {
    const e = sc.estimate;
    return `<div>
      <div class="estimate">
        ${e.lines.map((l, i) => `<div class="est-row" style="animation-delay:${i * 70}ms">
          <div><div class="ename">${l.name}</div><div class="edesc">${l.desc}</div></div>
          <div class="eval">${fmt(l.val)} ₸</div></div>`).join('')}
        <div class="est-total"><div class="ename">Итого по смете</div><div class="eval" id="estTotal">0 ₸</div></div>
      </div>
      <div class="est-mini">
        <div class="m"><div class="ml">Аванс ${e.advancePct}</div><div class="mv">${fmt(e.advance)} ₸</div></div>
        <div class="m"><div class="ml">Остаток</div><div class="mv">${fmt(e.remainder)} ₸</div></div>
      </div></div>`;
  }
  if (t === 'time') {
    const tl = `<div class="timeline">${sc.timeline.map((it, i) => `
      <div class="tl-item" style="animation-delay:${i * 55}ms">
        <div class="tl-time">${it.t}</div>
        <div class="tl-node"><div class="tl-title">${it.title}</div><div class="tl-desc">${it.desc}</div><div class="tl-dur">${icon('i-clock')} ${it.dur}</div></div>
      </div>`).join('')}</div>`;
    const lu = (Array.isArray(sc.lineup) && sc.lineup.length) ? `
      <div class="lineup-h">${icon('i-music')} Программа выступлений · lineup</div>
      <div class="lineup">${sc.lineup.map((a, i) => `
        <div class="lu-row" style="animation-delay:${i * 60}ms">
          <div class="lu-slot">${a.slot || ''}</div>
          <div class="lu-b"><div class="lu-name">${a.name || ''}</div><div class="lu-dur">${icon('i-clock')} ${a.dur || ''}</div></div>
          <div class="lu-fee">${a.fee || ''}</div>
        </div>`).join('')}</div>` : '';
    return `<div>${tl}${lu}</div>`;
  }
  if (t === 'scn') {
    return `<div>${sc.scenario.map((b, i) => `
      <div class="scn-block" style="animation-delay:${i * 70}ms">
        <h5><span class="n">${b.n}</span> ${b.title}</h5>
        <ul>${b.items.map(x => `<li>${x}</li>`).join('')}</ul>
      </div>`).join('')}</div>`;
  }
  // pres
  const e = sc.estimate;
  return `<div>
    <div class="pres-cover">
      <div class="brandmark pc-mark" id="presMark"></div>
      <div class="pc-meta">
        <div class="pc-kicker">EVENT AI · ${S.tier}</div>
        <h3>${sc.concept}</h3>
        <div class="pc-sub">${sc.city} · ${sc.date} · ${sc.guestsLabel || sc.guests}</div>
      </div>
    </div>
    <div class="pres-list">
      ${sc.vendors.filter((_, i) => !S.removed.has(i)).map(v => `<div class="pl"><span class="pk">${icon(v.icon)} ${v.cat}</span><span class="pv">${v.title}</span></div>`).join('')}
      <div class="pl"><span class="pk">${icon('i-wallet')} Общая стоимость</span><span class="pv">${fmt(e.total)} ₸</span></div>
    </div></div>`;
}
function animateEstimate(pane) {
  const rows = [...pane.querySelectorAll('.est-row .eval')];
  rows.forEach((el, i) => { const target = el.textContent; el.textContent = '0 ₸'; setTimeout(() => countUp(el, target, 640), 100 + i * 65); });
  const t = $('#estTotal', pane);
  if (t) setTimeout(() => countUp(t, S.scenario.estimate.total, 1000), 120 + rows.length * 65);
}

/* ============================================================
   VIEW: DOCUMENTS
   ============================================================ */
VIEWS.documents = () => {
  const sc = S.scenario;
  const docs = [
    { ic: 'i-pres', title: 'Презентация мероприятия', sub: 'PDF · обложка + состав' },
    { ic: 'i-sheet', title: 'Смета', sub: `Excel · ${fmt(sc.estimate.total)} ₸` },
    { ic: 'i-doc', title: 'Сценарий и бланк заказа', sub: 'Word · тайминг + структура' },
  ];
  return {
    chrome: {
      title: 'Документы', island: 'Документы готовы',
      action: `<button class="btn btn-primary" id="toBook">${icon('i-calendar')} Забронировать дату</button>`,
    },
    html: `
      <div class="ai-banner" style="margin-bottom:16px">
        <div class="av"><div class="brandmark mark" id="dbMark"></div></div>
        <p>Готово. Сформировал <b>3 документа</b> по проекту — можно скачать или отправить клиенту.</p>
      </div>
      ${docs.map((d, i) => `<div class="doc-card" style="animation-delay:${i * 80}ms">
        <div class="doc-ic">${icon(d.ic)}</div>
        <div class="dc-body"><div class="dc-title">${d.title}</div><div class="dc-sub">${d.sub}</div></div>
        <button class="dl" data-name="${d.title}">${icon('i-download')}</button>
      </div>`).join('')}
      <div class="section-gap"></div>
      <div class="share-row">
        <button class="sbtn" id="shWa">${icon('i-arrow')} В WhatsApp</button>
        <button class="sbtn" id="shMail">${icon('i-doc')} На email</button>
      </div>`,
    onMount: (el) => {
      buildSpiral($('#dbMark', el), { color: 'var(--accent-2)' });
      el.querySelectorAll('.dl').forEach(b => b.addEventListener('click', () => toast(`«${b.dataset.name}» — скачано`)));
      $('#shWa', el).addEventListener('click', () => toast('Ссылка отправлена в WhatsApp'));
      $('#shMail', el).addEventListener('click', () => toast('Документы отправлены на email'));
      $('#toBook').addEventListener('click', () => navigate('booking'));
    },
  };
};

/* ============================================================
   VIEW: INVITATIONS (free gift — generator)
   ============================================================ */
VIEWS.invitations = () => {
  const sc = S.scenario || SCENARIOS.wedding;
  S.invStyle = S.invStyle || (sc.national ? 'national' : 'classic');
  const k = sc.key || 'wedding';
  const venueRaw = (sc.vendors && (sc.vendors.find((v) => /площад|ресторан|зал|концерт|спорт|студи|лофт/i.test(v.cat || '')) || {}).title) || '';
  const venue = (venueRaw && !/[әғқңөұүһі]/i.test(venueRaw)) ? venueRaw : 'Банкетный зал «Алтын Сарай»';
  let kicker = 'Приглашение', names = 'Дорогие гости', line = 'приглашаем вас на', event = '', closing = 'Будем рады видеть вас';
  if (/corporate|forum|conference|state/.test(k)) {
    names = 'Уважаемые коллеги'; line = 'приглашаем вас на'; event = sc.concept || 'торжественный вечер'; closing = 'Будем рады видеть вас';
  } else if (/jubilee|birthday/.test(k)) {
    names = 'Дорогие гости'; line = 'приглашаем вас разделить с нами'; event = 'наш праздник'; closing = 'Ждём вас в этот тёплый день';
  } else {
    kicker = 'Свадебное приглашение'; names = 'Алия & Тимур'; line = 'приглашают вас на свой праздник'; event = ''; closing = 'Будем счастливы видеть вас рядом';
  }
  const styles = [{ k: 'classic', label: 'Классика' }, { k: 'national', label: 'Этно' }, { k: 'minimal', label: 'Минимал' }, { k: 'luxury', label: 'Luxury' }];
  return {
    chrome: {
      title: 'Пригласительные', island: 'Подарок от EVENT AI',
      action: `<button class="btn btn-primary" id="invDone">${icon('i-check')} Сохранить и продолжить</button>`,
    },
    html: `
      <div class="ai-banner" style="margin-bottom:14px"><div class="av"><div class="brandmark mark" id="invMark"></div></div>
        <p><b>Бесплатно в подарок</b> от EVENT AI — пригласительное для гостей. Выберите стиль; дату, место и повод AI подставил из вашего проекта.</p></div>
      <div class="inv-styles">${styles.map((s) => `<button class="inv-seg ${S.invStyle === s.k ? 'sel' : ''}" data-k="${s.k}">${s.label}</button>`).join('')}</div>
      <div class="inv-stage">
        <div class="invite" id="invCard" data-style="${S.invStyle}">
          <span class="inv-orn inv-orn-1"></span><span class="inv-orn inv-orn-2"></span>
          <div class="inv-kicker">${kicker}</div>
          <div class="inv-names">${names}</div>
          <div class="inv-line">${line}</div>
          ${event ? `<div class="inv-event">${event}</div>` : ''}
          <span class="inv-div"></span>
          <div class="inv-meta"><span>${icon('i-calendar')} ${sc.date}</span><span class="dotsep"></span><span>${icon('i-map')} ${sc.city}</span></div>
          <div class="inv-venue">${venue}</div>
          <div class="inv-closing">${closing}</div>
          <div class="inv-foot"><span class="inv-mk brandmark" id="invMk2"></span> Создано в EVENT AI</div>
        </div>
      </div>
      <div class="inv-hint">${icon('i-spark')} Меняйте стиль — карточка перерисовывается мгновенно</div>
      <div class="share-row"><button class="sbtn" id="invDl">${icon('i-download')} Скачать PNG</button><button class="sbtn" id="invShare">${icon('i-share')} Отправить гостям</button></div>`,
    onMount: (el) => {
      buildSpiral($('#invMark', el), { color: 'var(--accent-2)' });
      buildSpiral($('#invMk2', el), { color: 'currentColor' });
      el.querySelectorAll('.inv-seg').forEach((s) => s.addEventListener('click', () => {
        S.invStyle = s.dataset.k;
        el.querySelectorAll('.inv-seg').forEach((x) => x.classList.toggle('sel', x === s));
        const card = $('#invCard', el); card.dataset.style = s.dataset.k;
        card.style.animation = 'none'; void card.offsetWidth; card.style.animation = 'inviteIn .5s var(--ease) both';
      }));
      $('#invDl', el).addEventListener('click', () => toast('Пригласительное сохранено в PNG'));
      $('#invShare', el).addEventListener('click', () => toast('Ссылка на пригласительное скопирована'));
      $('#invDone').addEventListener('click', () => { toast('Пригласительные готовы 🎁'); goBack(); });
    },
  };
};

/* ============================================================
   VIEW: BOOKING → success
   ============================================================ */
VIEWS.booking = () => {
  const sc = S.scenario;
  return {
    chrome: { title: 'Бронирование', island: 'Бронирование' },
    html: `
      <div class="bk-hero">
        <div class="eyebrow" style="justify-content:center">${icon('i-calendar')} Фиксация даты ${sc.date}</div>
        <div class="bk-amount">50 000 ₸</div>
        <div class="bk-cap">Символический депозит закрепляет дату и переводит проект в статус «забронировано»</div>
        <div class="bk-link">Это <b>часть аванса</b> ${fmt(sc.estimate.advance)} ₸ · остаток после подтверждения подрядчиками</div>
      </div>
      <div class="pay-grid">
        <button class="pay kaspi"><span class="logo">K</span> Kaspi</button>
        <button class="pay card"><span class="logo">${icon('i-wallet')}</span> Карта</button>
        <button class="pay applepay"><span class="logo"></span> Apple Pay</button>
        <button class="pay qr"><span class="logo">QR</span> QR / перевод</button>
      </div>
      <div class="checkrow ok">${icon('i-shield')}<span>Оплата защищена · возврат при отмене подрядчиком</span></div>`,
    onMount: (el) => {
      const amt = $('.bk-amount', el); if (amt) setTimeout(() => countUp(amt, '50 000', 800), 200);
      el.querySelectorAll('.pay').forEach(b => b.addEventListener('click', confirmBooking));
    },
  };
};

function confirmBooking() {
  const sc = S.scenario;
  const id = `EV-${sc.key.slice(0, 2).toUpperCase()}-${1000 + Math.floor(num(sc.estimate.total) / 10000) % 9000}`;
  S.stack.push('booking'); S.view = 'success'; document.body.dataset.stage = 'success';
  setChrome({ title: 'Готово', back: true, island: 'Дата закреплена' });
  mountView(`
    <div class="success">
      <div class="badge-ok"><div class="ring"></div><div class="core">${icon('i-check')}</div></div>
      <h2>Дата закреплена</h2>
      <p>${sc.date}, ${sc.city}. Проект «${sc.concept}» — статус «предварительно забронировано».</p>
      <div class="receipt">
        <div class="rcpt-head"><span>Квитанция брони</span><span class="rcpt-id">№ ${id}</span></div>
        <div class="rr"><span>Подрядчиков</span><span class="rv">${activeCart().length}</span></div>
        <div class="rr"><span>Пакет</span><span class="rv">${S.tier} · ${S.styleVariant}</span></div>
        <div class="rr"><span>Смета</span><span class="rv">${fmt(sc.estimate.total)} ₸</span></div>
        <div class="rr"><span>Депозит</span><span class="rv">50 000 ₸</span></div>
        <div class="rr tot"><span>Статус</span><span class="rv okk">● забронировано</span></div>
      </div>
      <div class="bk-status">
        <div class="traction-h">${icon('i-clock')} Статус брони <span>в реальном времени</span></div>
        <div class="status-pipe">
          ${[['Встреча с клиентом назначена', 'done'], ['Встреча проведена', 'active'], ['Получен аванс', ''], ['Оплачена комиссия платформы 7%', ''], ['Баланс заполнен', ''], ['Проект подтвердил готовность к мероприятию', '']].map(([t, s], i) => `<div class="sp-step ${s}" style="--i:${i}"><span class="sp-dot">${icon('i-check')}</span><span class="sp-t">${t}</span></div>`).join('')}
        </div>
      </div>
      <button class="inv-cta" id="invBtn"><span class="inv-cta-ic">${icon('i-gift')}</span><span class="inv-cta-b">Создать пригласительные<small>бесплатно в подарок от EVENT AI</small></span>${icon('i-arrow')}</button>
      <button class="supplier-link" id="supBtn">${icon('i-store')} Сторона партнёра — что видит он →</button>
      <div class="traction">
        <div class="traction-h">${icon('i-spark')} Трекшн платформы <span>иллюстративно</span></div>
        <div class="metrics">${METRICS.map((m) => `<div class="metric"><div class="mv" data-count="${m.v}" data-suf="${m.suf}">0</div><div class="mk">${m.k}</div></div>`).join('')}</div>
      </div>
      <div class="vision">
        <p>EVENT AI — операционная система ивент-рынка Казахстана.</p>
        <a class="btn btn-primary" id="contactBtn" href="https://wa.me/77058864715?text=${encodeURIComponent('Здравствуйте! Видел демо EVENT AI — хочу обсудить.')}" target="_blank" rel="noopener">Связаться с DEADLINE ${icon('i-arrow')}</a>
      </div>
    </div>`, null, { _name: 'success' });
  setChrome({
    title: 'Готово', back: true, island: 'Дата закреплена',
    action: `<button class="btn btn-ghost" id="again">${icon('i-bolt')} Собрать ещё одно событие</button>`,
  });
  setTimeout(() => {
    $('#again')?.addEventListener('click', resetDemo);
    $('#supBtn')?.addEventListener('click', openSupplier);
    $('#invBtn')?.addEventListener('click', () => navigate('invitations'));
    const mFmt = (n, suf) => suf === '%' ? n + suf : n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace('.', ',') + ' млн' + suf : fmt(n) + suf;
    document.querySelectorAll('.success .metric .mv').forEach((el) => {
      const end = +el.dataset.count, suf = el.dataset.suf || '', t0 = performance.now();
      (function f(now) { const p = Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - p, 3); el.textContent = mFmt(Math.round(end * e), suf); if (p < 1) requestAnimationFrame(f); })(t0);
    });
  }, 60);
}
function openSupplier() {
  const reqs = [
    { n: 'Свадьба · 180 гостей', d: '15 августа', s: 'новая' },
    { n: 'Юбилей · 60 гостей', d: '20 сентября', s: 'новая' },
    { n: 'Корпоратив · 80 гостей', d: '12 декабря', s: 'просмотр' },
  ];
  const ov = document.createElement('div'); ov.className = 'sheet-ov';
  ov.innerHTML = `<div class="sheet sheet-tall light">
      <div class="sheet-grab"></div>
      <div class="vd-scroll">
        <div class="biz-top">
          <div class="biz-id"><div class="biz-av">${icon('i-users')}</div><div><div class="biz-name">${SUPPLIER.title}</div><div class="biz-role">${SUPPLIER.role}</div></div></div>
          <span class="biz-status">● опубликован</span>
        </div>
        <div class="biz-stats">
          <div class="biz-stat"><div class="bv">12</div><div class="bk">заявок</div></div>
          <div class="biz-stat"><div class="bv">1 248</div><div class="bk">просмотров</div></div>
          <div class="biz-stat"><div class="bv">78%</div><div class="bk">загрузка</div></div>
        </div>
        <div class="biz-h">Календарь занятости</div>
        ${miniCalendar({ title: SUPPLIER.title }, 3)}
        <div class="biz-h">Новые заявки <span class="biz-badge">2 новые</span></div>
        <div class="biz-reqs">${reqs.map((r, ri) => `<div class="biz-req" data-r="${ri}">
            <div class="biz-req-l"><div class="biz-req-n">${r.n}</div><div class="biz-req-d">${icon('i-calendar')} ${r.d}</div></div>
            <div class="biz-req-act"><button class="rq-ok" data-r="${ri}">Принять</button><button class="rq-no" data-r="${ri}">✕</button></div>
          </div>`).join('')}</div>
        <div class="biz-h">Финансы</div>
        <div class="biz-fin">
          <div class="biz-fin-row"><span>Подтверждённые брони</span><b>9 событий</b></div>
          <div class="biz-fin-row"><span>К выплате после события</span><b>3 150 000 ₸</b></div>
          <div class="biz-fin-row"><span>Комиссия платформы</span><b>7%</b></div>
        </div>
        <p class="biz-note">Это <b>светлый кабинет подрядчика</b> — вторая визуальная система EVENT AI. Клиент и подрядчик работают в одной платформе: это и есть двусторонний маркетплейс.</p>
      </div>
      <div class="vd-actions"><button class="btn btn-primary" id="sheetClose">Понятно</button></div>
    </div>`;
  $('#screen').appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 320); };
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.querySelectorAll('.rq-ok').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const row = b.closest('.biz-req'); row.classList.add('accepted'); row.querySelector('.biz-req-act').innerHTML = '<span class="rq-done">✓ принято</span>'; toast('Заявка принята · дата закреплена'); }));
  ov.querySelectorAll('.rq-no').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); b.closest('.biz-req').style.display = 'none'; }));
  ov.querySelector('#sheetClose').addEventListener('click', close);
}

/* ============================================================
   reset
   ============================================================ */
function resetDemo() {
  S.scenario = null; S.answers = {}; S.cart = []; S.tier = 'PREMIUM';
  S.styleVariant = 'Микс'; S.stack = []; S.removed = new Set(); S.intakeDone = false; S.favorites = new Set();
  showWelcome();
}

/* ---------- welcome / demo gate ---------- */
const stage = $('.stage');
function countTo(el, end, dur = 950) {
  const t0 = performance.now();
  (function f(now) {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(end * e));
    if (p < 1) requestAnimationFrame(f);
  })(t0);
}
function showWelcome() {
  const w = $('#welcome'); if (!w) { navigate('splash'); return; }
  document.body.dataset.stage = 'welcome';
  w.classList.remove('is-gone'); w.style.display = 'flex';
  const col = w.querySelector('.wl-col'); col.style.display = 'none'; void col.offsetWidth; col.style.display = '';
  buildSpiral($('#wlMark'), { color: 'var(--accent-2)' });
  const rows = [...w.querySelectorAll('.lrow')];
  rows.forEach((r, i) => { r.style.setProperty('--r', i); r.classList.remove('on'); setTimeout(() => r.classList.add('on'), 820 + i * 150); });
  const cv = w.querySelector('.val[data-count]');
  if (cv) { cv.textContent = '0'; setTimeout(() => countTo(cv, +cv.dataset.count, 1000), 820); }
}
function enterApp(target) {
  if (typeof target !== 'string') target = 'splash';
  const w = $('#welcome'); if (!w) return;
  w.querySelectorAll('.lrow').forEach(r => r.classList.add('on'));
  w.classList.add('is-gone');
  document.body.dataset.stage = 'app';
  if (stage) stage.classList.add('canvas-in');
  let done = false;
  const finish = () => { if (done) return; done = true; w.style.display = 'none'; if (stage) stage.classList.remove('canvas-in'); navigate(target); };
  w.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 740);
}
$('#enterBtn')?.addEventListener('click', enterApp);
$('#mapBtn')?.addEventListener('click', () => enterApp('map'));

/* ---------- theme (light / dark) ---------- */
function markColor(c) { return (c === '#fff' && document.documentElement.dataset.theme === 'light') ? '#2b3650' : c; }
function applyTheme(t) {
  document.documentElement.dataset.theme = (t === 'light') ? 'light' : 'dark';
  try { localStorage.setItem('ea-theme', document.documentElement.dataset.theme); } catch (e) {}
  buildSpiral($('#wlMark'), { color: 'var(--accent-2)' });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#EEF2F9' : '#04060B');
}
function initTheme() {
  let t = 'dark';
  try { t = localStorage.getItem('ea-theme') || 'dark'; } catch (e) {}
  document.documentElement.dataset.theme = (t === 'light') ? 'light' : 'dark';
}
$('#themeBtn')?.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
});

/* ---------- language (RU / KZ / EN) ---------- */
const WELCOME_I18N = {
  ru: { badge: 'ДЕМО-ВЕРСИЯ · ПРОТОТИП', titleA: 'Ваш личный', titleB: '<span class="accent">AI</span> event-менеджер',
    sub: 'Опишите событие — искусственный интеллект соберёт его под ключ: подбор, смета, сценарий и бронь. Это демо — пройдите весь путь сами, без регистрации.',
    m1: 'подрядчики Алматы', m2: 'категории', m3: 'AI-сценарии', m3v: 'готовы', m4: 'система', m4v: 'онлайн',
    cta: 'Запустить демо <svg class="ic"><use href="#i-arrow"/></svg>', ctaSub: 'свободный режим · без регистрации',
    auto: 'Авто-демо · показ без рук', meta: 'EVENT AI · Алматы · KZ / RU / EN · DEADLINE' },
  kz: { badge: 'ДЕМО-НҰСҚА · ПРОТОТИП', titleA: 'Сіздің жеке', titleB: '<span class="accent">AI</span> іс-шара менеджеріңіз',
    sub: 'Іс-шараңызды сипаттаңыз — жасанды интеллект оны кілтпен жинайды: таңдау, смета, сценарий және брондау. Бұл демо — бәрін өзіңіз өтіңіз, тіркеусіз.',
    m1: 'Алматы мердігерлері', m2: 'санаттар', m3: 'AI-сценарийлер', m3v: 'дайын', m4: 'жүйе', m4v: 'онлайн',
    cta: 'Демоны бастау <svg class="ic"><use href="#i-arrow"/></svg>', ctaSub: 'еркін режим · тіркеусіз',
    auto: 'Авто-демо · қолсыз көрсету', meta: 'EVENT AI · Алматы · KZ / RU / EN · DEADLINE' },
  en: { badge: 'DEMO VERSION · PROTOTYPE', titleA: 'Your personal', titleB: '<span class="accent">AI</span> event manager',
    sub: 'Describe your event — AI assembles it end-to-end: vendors, estimate, script and booking. This is a demo — walk the whole flow yourself, no sign-up.',
    m1: 'Almaty vendors', m2: 'categories', m3: 'AI scripts', m3v: 'ready', m4: 'system', m4v: 'online',
    cta: 'Launch demo <svg class="ic"><use href="#i-arrow"/></svg>', ctaSub: 'free mode · no sign-up',
    auto: 'Auto-demo · hands-free tour', meta: 'EVENT AI · Almaty · KZ / RU / EN · DEADLINE' },
};
if (typeof I18N !== 'undefined' && !I18N.en) I18N.en = { pusk: 'START', greetingShort: 'Describe your event — or tap a few buttons.', guestsWord: 'guests' };
function setLang(l) {
  S.lang = l;
  const cur = $('#wlLangCur'); if (cur) cur.textContent = ({ ru: 'RU', kz: 'KZ', en: 'EN' })[l] || 'RU';
  document.querySelectorAll('#wlLangMenu button').forEach((b) => b.classList.toggle('on', b.dataset.l === l));
  const dict = WELCOME_I18N[l] || WELCOME_I18N.ru;
  document.querySelectorAll('#welcome [data-i18n]').forEach((el) => {
    const k = el.dataset.i18n; if (dict[k] != null) el.innerHTML = dict[k];
  });
  const note = $('#wlLangNote');
  if (note) {
    note.hidden = (l === 'ru');
    note.textContent = l === 'kz' ? 'Демо өту — орыс тілінде. Толық KZ / EN локализациясы — дайын қосымшада.'
      : l === 'en' ? 'The demo walkthrough is in Russian. Full KZ / EN localization ships in the production app.' : '';
  }
}
(function wireLang() {
  const wrap = $('#wlLang'), btn = $('#wlLangBtn');
  if (!wrap || !btn) return;
  btn.addEventListener('click', (e) => { e.stopPropagation(); const open = wrap.classList.toggle('open'); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); });
  $('#wlLangMenu')?.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; setLang(b.dataset.l); wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
})();

/* ---------- auto-demo (hands-free tour) ---------- */
let autoOn = false;
function waitFor(sel, t = 9000) {
  return new Promise((res) => {
    const t0 = performance.now();
    (function p() { const e = document.querySelector(sel); if (e) return res(e); if (performance.now() - t0 > t) return res(null); requestAnimationFrame(p); })();
  });
}
function pulseAt(el) {
  if (!el) return;
  const r = el.getBoundingClientRect(), sr = $('#screen').getBoundingClientRect();
  const d = document.createElement('div'); d.className = 'tap-pulse';
  d.style.left = (r.left - sr.left + r.width / 2) + 'px';
  d.style.top = (r.top - sr.top + r.height / 2) + 'px';
  $('#screen').appendChild(d); setTimeout(() => d.remove(), 650);
}
async function autoTap(sel, delay = 700) {
  if (!autoOn) return null;
  const e = await waitFor(sel); if (!e || !autoOn) return null;
  await sleep(delay); if (!autoOn) return null;
  pulseAt(e); await sleep(140); e.click(); return e;
}
function stopAuto() { autoOn = false; document.body.classList.remove('autoplay'); $('#autoHint')?.remove(); $('#autoCap')?.remove(); }
async function autoPlay() {
  if (autoOn) return; autoOn = true;
  S.intakeDone = false; S.answers = {}; S.scenario = null; S.stack = []; S.removed = new Set();
  document.body.classList.add('autoplay');
  const hint = document.createElement('div'); hint.id = 'autoHint'; hint.className = 'auto-hint';
  hint.innerHTML = `<span class="dot"></span> АВТО-ДЕМО · коснитесь экрана, чтобы взять управление`;
  $('#screen').appendChild(hint);
  const capEl = document.createElement('div'); capEl.id = 'autoCap'; capEl.className = 'auto-cap';
  $('#screen').appendChild(capEl);
  const cap = (n, t) => { if (!autoOn) return; capEl.innerHTML = `<span class="ac-n">${n}</span><span class="ac-t">${t}</span>`; capEl.classList.remove('show'); void capEl.offsetWidth; capEl.classList.add('show'); };
  enterApp();
  cap('01', 'Клиент описывает мероприятие в чате с AI');
  await autoTap('.role-card[data-role="client"]', 1000);
  cap('01', 'AI задаёт по одному вопросу и сужает рынок под бриф');
  for (let q = 0; q < 14 && autoOn; q++) { if (document.querySelector('#puskBtn')) break; await autoTap('.chat-chips .chip', 520); }
  cap('02', 'AI сравнивает 1 240 подрядчиков и собирает подборку');
  await autoTap('#puskBtn', 650);
  if (await waitFor('.vcard') && autoOn) { cap('03', 'Готово за секунды: подрядчики, смета, сценарий, тайминг'); await sleep(1700); }
  await autoTap('#toCart', 700);
  await autoTap('#toPkg', 850);
  cap('04', 'Клиент выбирает уровень мероприятия');
  const pk = autoOn && await waitFor('.pkg[data-k="PREMIUM"]'); if (pk && autoOn) { await sleep(600); pulseAt(pk); pk.click(); }
  await autoTap('#genBtn', 700);
  if (await waitFor('.est-row') && autoOn) { cap('05', 'AI формирует смету, сценарий и тайминг под формат'); await sleep(1700); }
  const tabs = [...document.querySelectorAll('.tab')];
  for (let i = 1; i < tabs.length && autoOn; i++) { await sleep(950); pulseAt(tabs[i]); tabs[i].click(); }
  await sleep(800); await autoTap('#toDocs', 600);
  cap('06', 'Бронирование в один тап · депозит 50 000 ₸');
  await autoTap('#toBook', 800);
  const pay = autoOn && await waitFor('.pay'); if (pay && autoOn) { await sleep(700); pulseAt(pay); pay.click(); }
  if (await waitFor('.success') && autoOn) { cap('06', 'Дата закреплена. Комиссия платформы — 7%'); await sleep(2200); }
  await autoTap('#invBtn', 700);
  if (await waitFor('.invite') && autoOn) {
    cap('★', 'Бонус: пригласительные — в подарок от EVENT AI');
    await sleep(1300);
    const seg = document.querySelectorAll('.inv-seg');
    if (seg[2] && autoOn) { pulseAt(seg[2]); seg[2].click(); await sleep(1300); }
  }
  if (autoOn) { stopAuto(); showWelcome(); }
}
$('#autoBtn')?.addEventListener('click', autoPlay);
document.addEventListener('pointerdown', () => { if (autoOn) stopAuto(); }, true);

/* ---------- micro-interactions: spotlight + magnetic + desktop tilt ---------- */
const phoneEl = $('#phone');
let _magBtn = null, _rafQ = false, _ptr = { x: 0, y: 0 };
let tTX = 0, tTY = 0, tX = 0, tY = 0, tiltRunning = false;
const canTilt = () => matchMedia('(pointer:fine) and (min-width:1020px)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches;
function tiltStep() {
  tX += (tTX - tX) * 0.09; tY += (tTY - tY) * 0.09;
  if (phoneEl) phoneEl.style.transform = `rotateX(${tY.toFixed(2)}deg) rotateY(${tX.toFixed(2)}deg)`;
  if (Math.abs(tTX - tX) > 0.02 || Math.abs(tTY - tY) > 0.02) requestAnimationFrame(tiltStep);
  else tiltRunning = false;
}
document.addEventListener('pointermove', (e) => {
  _ptr.x = e.clientX; _ptr.y = e.clientY;
  if (canTilt()) {
    tTX = ((_ptr.x / innerWidth) - 0.5) * 4.4; tTY = -((_ptr.y / innerHeight) - 0.5) * 4.4;
    if (!tiltRunning) { tiltRunning = true; requestAnimationFrame(tiltStep); }
  }
  if (_rafQ) return; _rafQ = true;
  requestAnimationFrame(() => {
    _rafQ = false;
    const card = document.elementFromPoint(_ptr.x, _ptr.y)?.closest?.('.vcard');
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((_ptr.x - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((_ptr.y - r.top) / r.height * 100) + '%');
    }
    if (!matchMedia('(pointer:fine)').matches) return;
    const btn = document.elementFromPoint(_ptr.x, _ptr.y)?.closest?.('.btn-primary');
    if (btn) {
      _magBtn = btn;
      const r = btn.getBoundingClientRect();
      const dx = (_ptr.x - (r.left + r.width / 2)) / r.width * 12;
      const dy = (_ptr.y - (r.top + r.height / 2)) / r.height * 12;
      btn.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
    } else if (_magBtn) { _magBtn.style.transform = ''; _magBtn = null; }
  });
});

/* ---------- boot ---------- */
initTheme();
showWelcome();
