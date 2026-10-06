import { el } from './dom.js';
import { orders, formatPrice } from './store.js';
import { STEPS, statusOf, formatEta } from './status.js';

const root = document.querySelector('#track');
const id = new URLSearchParams(location.search).get('id');
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const formatDate = (iso) => dateFormat.format(new Date(iso)).replace(',', ' в').replace(' г.', '');

function cancel(order) {
  if (!confirm('Отменить заказ?')) return;
  orders.update(order.id, { cancelled: true });
  render();
}

function renderTimeline(status) {
  return el('ol', { className: 'timeline' }, ...STEPS.map((step, i) => {
    const state = i < status.index ? 'done' : i === status.index ? 'current' : 'pending';
    return el('li', { className: `timeline__step timeline__step--${state}`, ariaCurrent: state === 'current' ? 'step' : null },
      el('span', { className: 'timeline__dot' }),
      el('div', {},
        el('div', { className: 'timeline__label', textContent: step.label }),
        state === 'current' ? el('div', { className: 'timeline__hint', textContent: step.hint }) : null));
  }));
}

function row(label, value) {
  return value ? el('p', { className: 'track__row' }, el('b', { textContent: label }), value) : null;
}

function render() {
  const order = orders.find(id);
  if (!order) {
    root.replaceChildren(
      el('p', { className: 'empty-hint', textContent: 'Заказ не найден' }),
      el('a', { className: 'btn', href: 'account.html', textContent: 'В кабинет' }));
    return;
  }
  const status = statusOf(order);
  document.title = `Заказ №${order.id % 100000} — EVOL`;

  root.replaceChildren(
    el('a', { className: 'item__back', href: 'account.html', textContent: '← В кабинет' }),
    el('section', { className: 'panel' },
      el('p', { className: 'track__number', textContent: `Заказ №${order.id % 100000} · ${formatDate(order.date)}` }),
      el('h1', { className: `track__status track__status--${status.key}`, textContent: status.label }),
      el('p', { className: 'track__eta', textContent: status.cancelled ? 'Заказ отменён'
        : status.done ? 'Заказ доставлен' : `Доставим через ${formatEta(status.etaMs)}` }),
      status.cancelled ? null : renderTimeline(status),
      status.canCancel ? el('button', { type: 'button', className: 'btn btn--outline', textContent: 'Отменить заказ', onclick: () => cancel(order) }) : null),
    el('section', { className: 'panel' },
      el('h2', { className: 'panel__title', textContent: 'Детали' }),
      row('Адрес', order.address || '—'),
      row('Телефон', order.phone),
      row('Оплата', order.payment),
      row('Комментарий', order.comment),
      el('ul', { className: 'summary' }, ...order.lines.map((l) =>
        el('li', { className: 'summary__item' },
          el('img', { src: `img/${l.image || 'paint.jpg'}`, alt: '' }),
          el('span', { textContent: `${l.title} × ${l.qty}` }),
          el('span', { className: 'price', textContent: formatPrice(l.price * l.qty) })))),
      el('p', { className: 'track__total' }, el('span', { textContent: 'Итого' }), el('span', { textContent: formatPrice(order.total) }))));
}

render();
setInterval(render, 5000);
