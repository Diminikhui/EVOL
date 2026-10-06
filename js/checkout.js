import { el } from './dom.js';
import { cart, orders, profile, loadProducts, formatPrice, priceCart } from './store.js';

const form = document.querySelector('#order-form');
const error = document.querySelector('#error');
const main = document.querySelector('#checkout');

// Подставляем сохранённый адрес и телефон.
const saved = profile.get();
for (const [name, value] of Object.entries(saved)) {
  if (form.elements[name] && typeof value === 'string') form.elements[name].value = value;
}

const addressLine = (d) => [
  d.city, d.street,
  d.flat && `кв. ${d.flat}`,
  d.floor && `этаж ${d.floor}`,
  d.intercom && `домофон ${d.intercom}`,
].filter(Boolean).join(', ');

let pricing;

function renderSummary() {
  document.querySelector('#summary').replaceChildren(...pricing.lines.map(({ product, qty }) =>
    el('li', { className: 'summary__item' },
      el('img', { src: `img/${product.image}`, alt: '' }),
      el('span', { textContent: `${product.title} × ${qty}` }),
      el('span', { className: 'price', textContent: formatPrice(product.price * qty) }))));

  const row = (label, value, cls = '') => [el('dt', { textContent: label }), el('dd', { className: cls, textContent: value })];
  document.querySelector('#totals').replaceChildren(
    ...row('Товары', formatPrice(pricing.subtotal)),
    ...row('Доставка', pricing.delivery ? formatPrice(pricing.delivery) : 'бесплатно'),
    ...row('Итого', formatPrice(pricing.total), 'totals__sum'));
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (!data.street.trim() || !data.city.trim()) {
    error.textContent = 'Укажите город и улицу';
    error.hidden = false;
    return;
  }

  profile.merge({ city: data.city, street: data.street, flat: data.flat, floor: data.floor,
    intercom: data.intercom, phone: data.phone, comment: '' });

  orders.add({
    id: Date.now(),
    date: new Date().toISOString(),
    total: pricing.total,
    delivery: pricing.delivery,
    status: 'Принят',
    address: addressLine(data),
    phone: data.phone,
    payment: data.payment,
    comment: data.comment,
    lines: pricing.lines.map(({ product, qty }) => ({
      id: product.id, title: product.title, image: product.image, qty, price: product.price })),
  });
  cart.clear();
  location.href = 'account.html';
});

try {
  pricing = priceCart(cart.get(), await loadProducts());
  if (!pricing.lines.length) {
    main.replaceChildren(
      el('p', { className: 'empty-hint', textContent: 'Корзина пуста' }),
      el('a', { className: 'btn', href: 'catalog.html', textContent: 'В каталог' }));
  } else {
    renderSummary();
  }
} catch (e) {
  main.replaceChildren(el('p', { className: 'form-error', textContent: 'Не удалось загрузить заказ' }));
  console.error(e);
}
