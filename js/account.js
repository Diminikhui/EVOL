import { el } from './dom.js';
import { cart, orders, profile, formatPrice } from './store.js';

const MAX_THUMBS = 3;
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const formatDate = (iso) => dateFormat.format(new Date(iso)).replace(',', ' в').replace(' г.', '');

document.querySelector('#name').textContent = profile.get().name || 'Имя Фамилия';

const list = orders.get();
document.querySelector('#status').textContent =
  list.length ? `Заказ №${list[0].id % 100000}: ${list[0].status}` : 'Активных заказов нет';

const thumb = (line) => el('div', { className: 'thumb', title: line.title },
  el('img', { src: `img/${line.image || 'paint.jpg'}`, alt: line.title }),
  line.qty > 1 ? el('span', { className: 'thumb__qty', textContent: `×${line.qty}` }) : null);

const repeat = (order) => () => {
  order.lines.forEach((l) => cart.add(l.id, l.qty));
  location.href = 'catalog.html';
};

function renderOrder(o) {
  const hidden = o.lines.length - MAX_THUMBS;
  return el('li', { className: 'order' },
    el('h3', { className: 'order__title', textContent: formatDate(o.date) }),
    el('p', { className: 'order__sub' },
      o.address ? `${o.address} · ` : '', el('b', { textContent: o.status === 'Принят' ? 'Принят' : o.status })),
    el('div', { className: 'order__body' },
      el('div', { className: 'order__thumbs' },
        ...o.lines.slice(0, MAX_THUMBS).map(thumb),
        hidden > 0 ? el('span', { className: 'thumbs__more', textContent: `+${hidden}` }) : null),
      el('div', { className: 'order__side' },
        el('span', { className: 'order__total', textContent: formatPrice(o.total) }),
        el('button', { type: 'button', className: 'btn btn--outline btn--sm', textContent: 'Повторить', onclick: repeat(o) }))));
}

document.querySelector('#orders').replaceChildren(
  list.length
    ? el('ul', { className: 'orders' }, ...list.map(renderOrder))
    : el('p', { className: 'empty-hint', textContent: 'Пока нет заказов' }));
