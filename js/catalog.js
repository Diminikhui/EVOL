import { el } from './dom.js';
import './notify.js';
import { cart, favorites, loadProducts, formatPrice, priceCart, FREE_DELIVERY_FROM } from './store.js';

const grid = document.querySelector('#grid');
const chips = document.querySelector('#chips');
const cartBox = document.querySelector('#cart');

let products = [];
let category = 'Все';
let query = '';
const FAVORITES = '♥ Избранное';

const counterEl = (qty, onChange) => {
  const output = el('output', { textContent: qty });
  const step = (delta) => () => onChange(delta, output);
  return el('div', { className: 'counter' },
    el('button', { type: 'button', ariaLabel: 'Меньше', textContent: '−', onclick: step(-1) }),
    output,
    el('button', { type: 'button', ariaLabel: 'Больше', textContent: '+', onclick: step(1) }));
};

function renderChips() {
  const names = ['Все', FAVORITES, ...new Set(products.map((p) => p.category))];
  chips.replaceChildren(...names.map((name) =>
    el('button', {
      type: 'button', className: 'chip', textContent: name,
      ariaPressed: String(name === category),
      onclick: () => { category = name; renderChips(); renderGrid(); },
    })));
}

function heart(p) {
  const active = favorites.has(p.id);
  return el('button', {
    type: 'button', className: `heart${active ? ' heart--on' : ''}`, textContent: active ? '♥' : '♡',
    ariaLabel: active ? 'Убрать из избранного' : 'В избранное', ariaPressed: String(active),
    onclick: () => { favorites.toggle(p.id); renderGrid(); },
  });
}

function renderProduct(p) {
  const qty = cart.get()[p.id] ?? 0;
  const control = qty
    ? el('div', { className: 'stepper' },
        el('button', { type: 'button', ariaLabel: 'Убрать', textContent: '−', onclick: () => update(p.id, -1) }),
        el('span', { textContent: qty }),
        el('button', { type: 'button', ariaLabel: 'Добавить', textContent: '+', onclick: () => update(p.id, 1) }))
    : el('button', { type: 'button', className: 'add', ariaLabel: `Добавить в корзину: ${p.title}`, textContent: '+', onclick: () => update(p.id, 1) });
  const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

  return el('article', { className: 'product' },
    el('div', { className: 'product__photo' },
      el('a', { className: 'product__link', href: `product.html?id=${p.id}`, ariaLabel: p.title },
        el('img', { className: 'product__img', src: `img/${p.image}`, alt: '' })),
      discount ? el('span', { className: 'badge', textContent: `−${discount}%` }) : null,
      heart(p),
      control),
    el('div', { className: `product__price${discount ? ' product__price--sale' : ''}` },
      formatPrice(p.price),
      discount ? el('span', { className: 'product__old', textContent: formatPrice(p.oldPrice) }) : null),
    el('h2', { className: 'product__title' }, el('a', { href: `product.html?id=${p.id}`, textContent: `${p.title} ` }), el('small', { textContent: `${p.weight} кг` })),
    el('p', { className: 'product__summary', textContent: p.summary }));
}

function update(id, delta) {
  cart.change(id, delta);
  renderGrid();
  renderCart();
}

function renderGrid() {
  const needle = query.trim().toLowerCase();
  const visible = products.filter((p) =>
    (category === 'Все' || (category === FAVORITES ? favorites.has(p.id) : p.category === category)) &&
    (!needle || [p.title, p.summary, p.description, p.category].some((s) => s?.toLowerCase().includes(needle))));
  grid.replaceChildren(...(visible.length
    ? visible.map(renderProduct)
    : [el('p', { className: 'empty-hint', textContent: category === FAVORITES && !needle ? 'В избранном пока пусто' : 'Ничего не найдено' })]));
}

function renderCart() {
  const { lines, subtotal, delivery, total } = priceCart(cart.get(), products);
  const empty = lines.length === 0;

  const items = el('ul', { className: 'cart__items' }, ...lines.map(({ product, qty }) =>
    el('li', { className: 'cart__item' },
      el('img', { src: `img/${product.image}`, alt: '' }),
      el('span', { textContent: product.title }),
      counterEl(qty, (delta) => update(product.id, delta)),
      el('span', { className: 'price', textContent: formatPrice(product.price * qty) }))));

  const note = delivery
    ? `Доставка ${formatPrice(delivery)}. Бесплатно от ${formatPrice(FREE_DELIVERY_FROM)}`
    : subtotal ? 'Доставка бесплатно' : '';

  cartBox.replaceChildren(
    el('h2', { className: 'cart__title', textContent: 'Ваш заказ' }),
    empty ? el('div', { className: 'cart__empty', textContent: 'Корзина пуста' }) : items,
    el('div', { className: 'cart__total' },
      el('span', { textContent: 'Итого:' }), el('span', { textContent: formatPrice(total) })),
    ...(note ? [el('p', { className: 'cart__note', textContent: note })] : []),
    ...(empty ? [] : [el('button', { type: 'button', className: 'btn', textContent: 'Заказать', onclick: checkout })]));
}

const checkout = () => { location.href = 'checkout.html'; };

document.querySelector('#search').addEventListener('input', (event) => {
  query = event.target.value;
  renderGrid();
});

try {
  products = await loadProducts();
  renderChips(); renderGrid(); renderCart();
} catch (error) {
  grid.replaceChildren(el('p', { className: 'form-error', textContent: 'Не удалось загрузить каталог' }));
  console.error(error);
}
