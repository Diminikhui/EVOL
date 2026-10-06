import './notify.js';
import { el } from './dom.js';
import {
  cart, orders, profile, addresses, addressLabel, loadProducts, loadPromos,
  findPromo, bonusBalance, formatPrice, priceCart, imageUrl,
} from './store.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#order-form');
const error = $('#error');
const main = $('#checkout');
const ADDRESS_FIELDS = ['city', 'street', 'flat', 'floor', 'intercom'];

let products = [];
let promos = [];
let promo = null;
let useBonuses = false;
let selected = 'new';          // id сохранённого адреса или 'new'
const balance = bonusBalance();

const pricing = () => priceCart(cart.get(), products, { promo, bonuses: useBonuses ? balance : 0 });

const addressLine = (d) => [
  d.city, d.street,
  d.flat && `кв. ${d.flat}`,
  d.floor && `этаж ${d.floor}`,
  d.intercom && `домофон ${d.intercom}`,
].filter(Boolean).join(', ');

// ---------- Состав и итоги ----------
function renderTotals() {
  const p = pricing();
  $('#summary').replaceChildren(...p.lines.map(({ product, qty }) =>
    el('li', { className: 'summary__item' },
      el('img', { src: imageUrl(product.image), alt: '' }),
      el('span', { textContent: `${product.title} × ${qty}` }),
      el('span', { className: 'price', textContent: formatPrice(product.price * qty) }))));

  const rows = [['Товары', formatPrice(p.subtotal)]];
  if (p.discount) rows.push([`Скидка (${promo.code})`, `−${formatPrice(p.discount)}`]);
  rows.push(['Доставка', p.delivery ? formatPrice(p.delivery) : 'бесплатно']);
  if (p.bonusSpent) rows.push(['Бонусы', `−${formatPrice(p.bonusSpent)}`]);
  rows.push(['Итого', formatPrice(p.total), 'totals__sum']);
  if (p.bonusEarned) rows.push(['Начислим бонусов', `+${p.bonusEarned}`, 'totals__note']);
  $('#totals').replaceChildren(...rows.flatMap(([label, value, cls = '']) =>
    [el('dt', { className: cls, textContent: label }), el('dd', { className: cls, textContent: value })]));

  const box = $('#bonus-box');
  box.hidden = balance <= 0;
  $('#bonus-text').textContent = `Списать бонусы: у вас ${balance}, можно до ${Math.min(balance, p.maxBonuses)}`;
}

$('#bonus-toggle').addEventListener('change', (event) => { useBonuses = event.target.checked; renderTotals(); });

$('#promo-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const code = $('#promo-input').value;
  const msg = $('#promo-msg');
  if (!code.trim()) { promo = null; msg.textContent = ''; renderTotals(); return; }
  const result = findPromo(code, promos, pricing().subtotal);
  promo = result.promo ?? null;
  msg.textContent = result.error ?? `Применён: ${promo.title}`;
  msg.className = `promo__msg ${result.error ? 'promo__msg--bad' : 'promo__msg--ok'}`;
  renderTotals();
});

// ---------- Адрес ----------
function selectAddress(id) {
  selected = id;
  const saved = addresses.get().find((a) => a.id === id);
  for (const name of ADDRESS_FIELDS) form.elements[name].value = saved?.[name] ?? '';
  if (saved?.comment && !form.elements.comment.value) form.elements.comment.value = saved.comment;
  $('#addr-fields').hidden = Boolean(saved);
  $('#save-box').hidden = Boolean(saved);
  renderAddressList();
}

function renderAddressList() {
  const list = addresses.get();
  $('#addr-list').replaceChildren(...(list.length ? [
    ...list.map((a) => el('label', { className: `addr${selected === a.id ? ' addr--on' : ''}` },
      el('input', { type: 'radio', name: 'addr', checked: selected === a.id, onchange: () => selectAddress(a.id) }),
      el('span', {}, el('b', { textContent: addressLabel(a) }), el('small', { textContent: a.city })))),
    el('label', { className: `addr${selected === 'new' ? ' addr--on' : ''}` },
      el('input', { type: 'radio', name: 'addr', checked: selected === 'new', onchange: () => selectAddress('new') }),
      el('span', {}, el('b', { textContent: '+ Новый адрес' }))),
  ] : []));
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (!data.street.trim() || !data.city.trim()) {
    error.textContent = 'Укажите город и улицу';
    error.hidden = false;
    return;
  }

  if (selected === 'new' && $('#save-address').checked) {
    selected = addresses.add({ city: data.city, street: data.street, flat: data.flat, floor: data.floor, intercom: data.intercom });
  }
  profile.merge({ phone: data.phone });

  const p = pricing();
  const id = Date.now();
  orders.add({
    id,
    date: new Date().toISOString(),
    total: p.total,
    subtotal: p.subtotal,
    discount: p.discount,
    promo: promo?.code ?? null,
    delivery: p.delivery,
    bonusSpent: p.bonusSpent,
    bonusEarned: p.bonusEarned,
    address: addressLine(data),
    phone: data.phone,
    payment: data.payment,
    comment: data.comment,
    lines: p.lines.map(({ product, qty }) => ({
      id: product.id, title: product.title, image: product.image, qty, price: product.price })),
  });
  cart.clear();
  location.href = `track.html?id=${id}`;
});

// ---------- Старт ----------
try {
  [products, promos] = await Promise.all([loadProducts(), loadPromos()]);
  if (!pricing().lines.length) {
    main.replaceChildren(
      el('p', { className: 'empty-hint', textContent: 'Корзина пуста' }),
      el('a', { className: 'btn', href: 'catalog.html', textContent: 'В каталог' }));
  } else {
    form.elements.phone.value = profile.get().phone ?? '';
    renderTotals();
    const saved = addresses.get();
    const start = saved.find((a) => a.id === addresses.defaultId()) ?? saved[0];
    selectAddress(start ? start.id : 'new');
  }
} catch (e) {
  main.replaceChildren(el('p', { className: 'form-error', textContent: 'Не удалось загрузить заказ' }));
  console.error(e);
}
