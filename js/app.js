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
function buildSpiral(el, { color = '#fff', anim = false } = {}) {
  if (!el) return;
  const N = 84, GA = Math.PI * (3 - Math.sqrt(5)), maxR = 45;
  let dots = '';
  for (let i = 1; i <= N; i++) {
    const r = maxR * Math.sqrt(i / N);
    const a = i * GA;
    const x = 50 + r * Math.cos(a), y = 50 + r * Math.sin(a);
    const dr = 0.9 + 2.4 * (i / N);
    const op = 0.45 + 0.55 * (i / N);
    const d = anim ? ` style="--d:${i * 7}ms"` : '';
    dots += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${dr.toFixed(2)}" fill="${color}" opacity="${op.toFixed(2)}"${d}/>`;
  }
  el.innerHTML = `<svg viewBox="0 0 100 100" class="${anim ? 'spiral-anim' : ''}">${dots}</svg>`;
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
  const old = views.querySelector('.view');
  const el = document.createElement('div');
  el.className = 'view view-enter';
  el.innerHTML = (chrome ? progressHTML(chrome._name) : '') + html;
  views.appendChild(el);
  if (old) { old.classList.add('view-exit'); setTimeout(() => old.remove(), 340); }
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
  html: `<div class="view splash-inner" style="position:static;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0">
      <div class="brandmark mark" id="splashMark"></div>
      <div class="name">EVENT AI</div>
      <div class="sub">Личный AI event-менеджер</div>
      <div class="loadbar"><i></i></div>
    </div>`,
  onMount: () => {
    buildSpiral($('#splashMark'), { color: '#fff', anim: true });
    setTimeout(() => navigate('chat'), 2100);
  },
});

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
  if (key === 'type') { const o = INTAKE[1].options.find((x) => x.label === label); if (o && o.scenario) S.scenario = SCENARIOS[o.scenario]; }
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
      `<div class="step" data-i="${i}"><span class="dot">${icon('i-check')}</span><span>${t}</span></div>`).join('')}</div>`;
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
  const cards = sc.vendors.map((v, i) => {
    const added = !S.removed.has(i);
    const rh = v.reasonFull.replace(v.matchToken, `<b>${v.matchToken}</b>`);
    return `<div class="cat-label">${icon(v.icon)} ${v.cat}</div>
      <div class="vcard" style="animation-delay:${i * 70}ms">
        <div class="media"><img src="${IMG(v.seed)}" alt="${v.title}" loading="lazy"/>
          <span class="badge"><span class="dot"></span>свободно ${sc.date}</span>
          <span class="rate">${icon('i-star')} ${v.rating}</span>
        </div>
        <div class="vbody">
          <div class="vtitle">${v.title}</div>
          <div class="vmeta">${v.meta}</div>
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
  }).join('');
  return {
    chrome: {
      title: 'Персональная подборка', island: 'Подборка готова',
      action: `<button class="btn btn-primary" id="toCart">${icon('i-cart')} Собрать проект<span class="sub" id="cartCount"></span></button>`,
    },
    html: `
      <div class="ai-banner">
        <div class="av"><div class="brandmark mark" id="bnMark"></div></div>
        <p>Под ваш бриф (<b>${sc.guestsLabel}</b>, бюджет <b>${S.answers.budget || '—'}</b>) подобрал <b>${sc.vendors.length} вариантов</b>, свободных на <b>${sc.date}</b>. ${sc.fits ? `Итог <b>${fmt(sc.estimate.total)} ₸</b> — укладывается в бюджет.` : `Полный набор — <b>${fmt(sc.estimate.total)} ₸</b>, чуть выше бюджета: уберите 1–2 позиции, и AI пересчитает.`}</p>
      </div>
      ${cards}`,
    onMount: (el) => {
      buildSpiral($('#bnMark', el), { color: 'var(--accent-2)' });
      el.querySelectorAll('.vcard .media img').forEach((im) => {
        const done = () => { im.classList.add('loaded'); im.closest('.media').classList.add('imgloaded'); };
        if (im.complete && im.naturalWidth) done(); else { im.addEventListener('load', done); im.addEventListener('error', done); }
      });
      updateCartCount();
      el.querySelectorAll('.addbtn').forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        if (S.removed.has(i)) { S.removed.delete(i); b.classList.add('added'); b.innerHTML = icon('i-check') + 'В корзине'; }
        else { S.removed.add(i); b.classList.remove('added'); b.innerHTML = icon('i-plus') + 'В корзину'; }
        updateCartCount();
      }));
      $('#toCart').addEventListener('click', () => navigate('cart'));
    },
  };
};
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
    return `<div class="timeline">${sc.timeline.map((it, i) => `
      <div class="tl-item" style="animation-delay:${i * 55}ms">
        <div class="tl-time">${it.t}</div>
        <div class="tl-node"><div class="tl-title">${it.title}</div><div class="tl-desc">${it.desc}</div><div class="tl-dur">${icon('i-clock')} ${it.dur}</div></div>
      </div>`).join('')}</div>`;
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
      <button class="supplier-link" id="supBtn">${icon('i-store')} Сторона подрядчика — что видит он →</button>
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
    document.querySelectorAll('.success .metric .mv').forEach((el) => {
      const end = +el.dataset.count, suf = el.dataset.suf || '', t0 = performance.now();
      (function f(now) { const p = Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(Math.round(end * e)) + suf; if (p < 1) requestAnimationFrame(f); })(t0);
    });
  }, 60);
}
function openSupplier() {
  const ov = document.createElement('div'); ov.className = 'sheet-ov';
  ov.innerHTML = `<div class="sheet">
      <div class="sheet-grab"></div>
      <div class="sheet-h"><div><div class="sheet-t">${SUPPLIER.title}</div><div class="sheet-r">${SUPPLIER.role}</div></div><span class="sheet-badge">Бизнес-аккаунт</span></div>
      <div class="sup-rows">${SUPPLIER.rows.map((r) => `<div class="sup-row"><span>${r.k}</span><b class="${r.hot ? 'hot' : ''}">${r.v}</b></div>`).join('')}</div>
      <p class="sheet-note">Так подрядчик видит входящие заявки, загрузку календаря и выплаты. Клиент и подрядчик — в одной системе: это и есть двусторонний маркетплейс.</p>
      <button class="btn btn-ghost" id="sheetClose">Закрыть</button>
    </div>`;
  $('#screen').appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 320); };
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.querySelector('#sheetClose').addEventListener('click', close);
}

/* ============================================================
   reset
   ============================================================ */
function resetDemo() {
  S.scenario = null; S.answers = {}; S.cart = []; S.tier = 'PREMIUM';
  S.styleVariant = 'Микс'; S.stack = []; S.removed = new Set(); S.intakeDone = false;
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
  w.classList.remove('is-gone'); w.style.display = 'grid';
  const col = w.querySelector('.wl-col'); col.style.display = 'none'; void col.offsetWidth; col.style.display = '';
  buildSpiral($('#welcomeMark'), { color: '#fff', anim: true });
  const rows = [...w.querySelectorAll('.lrow')];
  rows.forEach((r, i) => { r.style.setProperty('--r', i); r.classList.remove('on'); setTimeout(() => r.classList.add('on'), 820 + i * 150); });
  const cv = w.querySelector('.val[data-count]');
  if (cv) { cv.textContent = '0'; setTimeout(() => countTo(cv, +cv.dataset.count, 1000), 820); }
}
function enterApp() {
  const w = $('#welcome'); if (!w) return;
  w.querySelectorAll('.lrow').forEach(r => r.classList.add('on'));
  w.classList.add('is-gone');
  document.body.dataset.stage = 'app';
  if (stage) stage.classList.add('canvas-in');
  let done = false;
  const finish = () => { if (done) return; done = true; w.style.display = 'none'; if (stage) stage.classList.remove('canvas-in'); navigate('splash'); };
  w.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 740);
}
$('#enterBtn')?.addEventListener('click', enterApp);

/* ---------- language toggle ---------- */
const LANG_CTA = { ru: 'Запустить демо', kz: 'Демоны бастау' };
function setLang(l) {
  S.lang = l;
  document.querySelectorAll('#wlLang button').forEach((b) => b.classList.toggle('on', b.dataset.l === l));
  const cta = document.querySelector('[data-i18n="cta"]');
  if (cta) cta.innerHTML = `${LANG_CTA[l]} <svg class="ic"><use href="#i-arrow"/></svg>`;
}
$('#wlLang')?.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setLang(b.dataset.l); });

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
function stopAuto() { autoOn = false; document.body.classList.remove('autoplay'); $('#autoHint')?.remove(); }
async function autoPlay() {
  if (autoOn) return; autoOn = true;
  S.intakeDone = false; S.answers = {}; S.scenario = null; S.stack = []; S.removed = new Set();
  document.body.classList.add('autoplay');
  const hint = document.createElement('div'); hint.id = 'autoHint'; hint.className = 'auto-hint';
  hint.innerHTML = `<span class="dot"></span> АВТО-ДЕМО · коснитесь экрана, чтобы взять управление`;
  $('#screen').appendChild(hint);
  enterApp();
  for (let q = 0; q < 4 && autoOn; q++) await autoTap('.chat-chips .chip', 820);
  await autoTap('#puskBtn', 650);
  if (await waitFor('.vcard') && autoOn) await sleep(1500);
  await autoTap('#toCart', 700);
  await autoTap('#toPkg', 850);
  const pk = autoOn && await waitFor('.pkg[data-k="PREMIUM"]'); if (pk && autoOn) { await sleep(600); pulseAt(pk); pk.click(); }
  await autoTap('#genBtn', 700);
  if (await waitFor('.est-row') && autoOn) await sleep(1700);
  const tabs = [...document.querySelectorAll('.tab')];
  for (let i = 1; i < tabs.length && autoOn; i++) { await sleep(950); pulseAt(tabs[i]); tabs[i].click(); }
  await sleep(800); await autoTap('#toDocs', 600);
  await autoTap('#toBook', 800);
  const pay = autoOn && await waitFor('.pay'); if (pay && autoOn) { await sleep(700); pulseAt(pay); pay.click(); }
  if (await waitFor('.success') && autoOn) await sleep(2800);
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
showWelcome();
