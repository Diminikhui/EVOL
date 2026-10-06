import { el } from './dom.js';
import { formatPrice } from './store.js';
import { request } from './backend.js';
import { formatPhone } from './rules.js';

const $ = (selector) => document.querySelector(selector);
const LABELS = { accepted: 'Новые', packing: 'Собираются', delivering: 'В пути', delivered: 'Доставлены', cancelled: 'Отменены' };
const TIME = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

let me = null;
let orders = [];
let tab = 'accepted';
let timer;

const show = (node, visible) => { node.hidden = !visible; };
const message = (node, text) => { node.textContent = text ?? ''; show(node, Boolean(text)); };

// Что может сделать роль с заказом в данном статусе.
function actionsFor(order) {
  const actions = [];
  const { role } = me;
  if (['staff', 'admin'].includes(role) && order.status === 'accepted') actions.push({ label: 'Начать сборку', status: 'packing', primary: true });
  if (['staff', 'admin'].includes(role) && order.status === 'packing') actions.push({ label: 'Передать курьеру', status: 'delivering', primary: true });
  if (['courier', 'admin'].includes(role) && order.status === 'delivering') actions.push({ label: 'Доставлен', status: 'delivered', primary: true });
  if (['staff', 'admin'].includes(role) && ['accepted', 'packing', 'delivering'].includes(order.status)) actions.push({ label: 'Отменить', status: 'cancelled', danger: true });
  return actions;
}

async function change(order, status) {
  if (status === 'cancelled' && !confirm(`Отменить заказ №${order.id}? Товары вернутся на склад.`)) return;
  try { await request(`api/orders/${order.id}/status`, { method: 'POST', body: { status } }); await load(); }
  catch (error) { message($('#list-error'), error.message); }
}

function ticket(order) {
  const row = (label, value) => (value ? el('p', { className: 'ticket__row' }, el('b', { textContent: label }), value) : null);
  const phone = order.phone ? el('a', { href: `tel:+${order.phone}`, textContent: formatPhone(order.phone) }) : null;
  return el('article', { className: 'ticket' },
    el('div', { className: 'ticket__head' },
      el('span', { textContent: `Заказ №${order.id}` }), el('small', { textContent: TIME.format(new Date(order.date)) })),
    row('Покупатель', order.customer?.name),
    row('Телефон', phone),
    row('Адрес', order.address),
    row('Комментарий', order.comment),
    row('Оплата', order.payment),
    el('ul', { className: 'ticket__lines' }, ...order.lines.map((l) => el('li', { textContent: `${l.title} × ${l.qty}` }))),
    el('div', { className: 'ticket__total' }, el('span', { textContent: 'К оплате' }), el('span', { textContent: formatPrice(order.total) })),
    el('div', { className: 'ticket__actions' }, ...actionsFor(order).map((a) =>
      el('button', { type: 'button', className: `btn btn--sm${a.primary ? '' : ' btn--outline'}${a.danger ? ' btn--danger' : ''}`,
        textContent: a.label, onclick: () => change(order, a.status) }))));
}

function tabsFor() {
  return me.role === 'courier' ? ['delivering', 'delivered'] : ['accepted', 'packing', 'delivering', 'delivered', 'cancelled'];
}

function render() {
  const tabs = tabsFor();
  if (!tabs.includes(tab)) tab = tabs[0];
  $('#tabs').replaceChildren(...tabs.map((key) => {
    const count = orders.filter((o) => o.status === key).length;
    return el('button', { type: 'button', className: 'chip', ariaPressed: String(key === tab), onclick: () => { tab = key; render(); } },
      LABELS[key], count && key !== 'delivered' && key !== 'cancelled' ? el('span', { className: 'chip__count', textContent: count }) : null);
  }));
  const visible = orders.filter((o) => o.status === tab);
  $('#orders-board').replaceChildren(...(visible.length
    ? visible.map(ticket)
    : [el('p', { className: 'empty-hint', textContent: 'Здесь пока пусто' })]));
  $('#updated').textContent = `обновлено ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

async function load() {
  try {
    orders = await request('api/orders');
    message($('#list-error'), '');
    render();
  } catch (error) {
    if (error.status === 401) showLogin(); else message($('#list-error'), error.message);
  }
}

function showLogin() {
  clearInterval(timer);
  show($('#login-form'), true); show($('#board'), false); show($('#staff-user'), false);
}

async function start() {
  try {
    me = await request('api/me');
    if (me.role === 'customer') throw Object.assign(new Error('Нет доступа'), { status: 403 });
    $('#staff-login').textContent = me.login;
    show($('#staff-user'), true); show($('#to-admin'), me.role === 'admin');
    show($('#login-form'), false); show($('#board'), true);
    $('#board-title').textContent = me.role === 'courier' ? 'Доставка' : 'Заказы';
    await load();
    clearInterval(timer);
    timer = setInterval(load, 8000);
  } catch (error) {
    if (error.status === 404) {
      $('#staff').replaceChildren(el('p', { className: 'form-error', textContent: 'Сервер не запущен. Запустите «npm start» и откройте сайт через него.' }));
    } else showLogin();
  }
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await request('api/login', { method: 'POST', body: Object.fromEntries(new FormData(event.target)) });
    event.target.reset(); message($('#login-error'), '');
    start();
  } catch (error) { message($('#login-error'), error.message); }
});

$('#logout').addEventListener('click', async () => { await request('api/logout', { method: 'POST' }); showLogin(); });

start();
