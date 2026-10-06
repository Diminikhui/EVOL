import { el } from './dom.js';
import * as notify from './notify.js';
import {
  cart, orders, profile, favorites, addresses, addressLabel, bonusBalance,
  loadProducts, formatPrice, BONUS_RATE, BONUS_MAX_SHARE,
} from './store.js';
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

function renderBonuses() {
  document.querySelector('#bonus-balance').textContent = `${bonusBalance()} бонусов`;
  document.querySelector('#bonus-hint').textContent =
    `1 бонус = 1 ₽. Начисляем ${BONUS_RATE * 100}% за доставленный заказ, оплатить бонусами можно до ${BONUS_MAX_SHARE * 100}% заказа.`;
}

function renderAddresses() {
  const list = addresses.get();
  const defaultId = addresses.defaultId();
  document.querySelector('#addresses').replaceChildren(
    list.length
      ? el('ul', { className: 'orders' }, ...list.map((a) => el('li', { className: 'order' },
          el('h3', { className: 'order__title', textContent: addressLabel(a) }),
          el('p', { className: 'order__sub', textContent: [a.city, a.floor && `этаж ${a.floor}`, a.intercom && `домофон ${a.intercom}`].filter(Boolean).join(' · ') }),
          el('div', { className: 'addr-actions' },
            a.id === defaultId
              ? el('span', { className: 'addr-default', textContent: '✓ Основной' })
              : el('button', { type: 'button', className: 'btn btn--outline btn--sm', textContent: 'Сделать основным',
                  onclick: () => { addresses.setDefault(a.id); renderAddresses(); } }),
            el('button', { type: 'button', className: 'btn btn--outline btn--sm btn--danger', textContent: 'Удалить',
              onclick: () => { addresses.remove(a.id); renderAddresses(); } })))))
      : el('p', { className: 'empty-hint', textContent: 'Сохранённых адресов пока нет' }));
}

async function renderFavorites() {
  const ids = favorites.get();
  const box = document.querySelector('#favorites');
  if (!ids.length) { box.replaceChildren(el('p', { className: 'empty-hint', textContent: 'Нажмите ♡ на товаре, чтобы сохранить его здесь' })); return; }
  const products = (await loadProducts()).filter((p) => ids.includes(p.id));
  box.replaceChildren(el('ul', { className: 'fav-list' }, ...products.map((p) =>
    el('li', {}, el('a', { className: 'fav', href: `product.html?id=${p.id}` },
      el('img', { src: `img/${p.image}`, alt: '' }),
      el('span', {}, el('b', { textContent: p.title }), el('small', { textContent: formatPrice(p.price) })))))));
}

function setupNotifications() {
  const toggle = document.querySelector('#notify-toggle');
  const hint = document.querySelector('#notify-hint');
  if (!notify.supported) {
    toggle.disabled = true;
    hint.textContent = 'Ваш браузер не поддерживает уведомления';
    return;
  }
  toggle.checked = notify.isEnabled();
  hint.textContent = Notification.permission === 'denied'
    ? 'Уведомления запрещены в настройках браузера'
    : 'Уведомления приходят, пока сайт открыт в браузере';
  toggle.addEventListener('change', async () => {
    if (toggle.checked) {
      const result = await notify.enable();
      toggle.checked = result === 'granted';
      if (result === 'denied') hint.textContent = 'Уведомления запрещены в настройках браузера';
    } else {
      notify.disable();
    }
  });
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
renderBonuses();
renderAddresses();
renderFavorites();
setupNotifications();
setInterval(() => { render(); renderBonuses(); }, 5000);
