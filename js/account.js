import { el } from './dom.js';
import { cart, orders, profile, formatPrice } from './store.js';
import { statusOf } from './status.js';

const MAX_THUMBS = 3;
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const formatDate = (iso) => dateFormat.format(new Date(iso)).replace(',', ' в').replace(' г.', '');

document.querySelector('#name').textContent = profile.get().name || 'Имя Фамилия';

const thumb = (line) => el('div', { className: 'thumb', title: line.title },
  el('img', { src: `img/${line.image || 'paint.jpg'}`, alt: line.title }),
  line.qty > 1 ? el('span', { className: 'thumb__qty', textContent: `×${line.qty}` }) : null);

const repeat = (order) => () => {
  order.lines.forEach((l) => cart.add(l.id, l.qty));
  location.href = 'catalog.html';
};

function renderOrder(o) {
  const status = statusOf(o);
  const hidden = o.lines.length - MAX_THUMBS;
  const trackHref = `track.html?id=${o.id}`;
  return el('li', { className: 'order' },
    el('h3', { className: 'order__title' }, el('a', { href: trackHref, textContent: formatDate(o.date) })),
    el('p', { className: 'order__sub' },
      o.address ? `${o.address} · ` : '', el('b', { className: `status--${status.key}`, textContent: status.label })),
    el('div', { className: 'order__body' },
      el('div', { className: 'order__thumbs' },
        ...o.lines.slice(0, MAX_THUMBS).map(thumb),
        hidden > 0 ? el('span', { className: 'thumbs__more', textContent: `+${hidden}` }) : null),
      el('div', { className: 'order__side' },
        el('span', { className: 'order__total', textContent: formatPrice(o.total) }),
        status.active
          ? el('a', { className: 'btn btn--sm', href: trackHref, textContent: 'Отследить' })
          : el('button', { type: 'button', className: 'btn btn--outline btn--sm', textContent: 'Повторить', onclick: repeat(o) }))));
}

function render() {
  const list = orders.get();
  const current = list.find((o) => statusOf(o).active);
  const statusBox = document.querySelector('#status');
  if (current) {
    statusBox.replaceChildren(el('a', { href: `track.html?id=${current.id}`,
      textContent: `Заказ №${current.id % 100000}: ${statusOf(current).label} · Отследить →` }));
  } else {
    statusBox.textContent = 'Активных заказов нет';
  }

  document.querySelector('#orders').replaceChildren(
    list.length
      ? el('ul', { className: 'orders' }, ...list.map(renderOrder))
      : el('p', { className: 'empty-hint', textContent: 'Пока нет заказов' }));
}

render();
setInterval(render, 5000);
