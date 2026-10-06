import { el } from './dom.js';
import { cart, loadProducts, formatPrice } from './store.js';

const root = document.querySelector('#item');
const id = Number(new URLSearchParams(location.search).get('id'));

function render(p) {
  document.title = `${p.title} — EVOL`;
  const qty = cart.get()[p.id] ?? 0;
  const change = (delta) => () => { cart.change(p.id, delta); render(p); };
  const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

  const action = qty
    ? el('div', { className: 'stepper' },
        el('button', { type: 'button', ariaLabel: 'Убрать', textContent: '−', onclick: change(-1) }),
        el('span', { textContent: `${qty} в корзине` }),
        el('button', { type: 'button', ariaLabel: 'Добавить', textContent: '+', onclick: change(1) }))
    : el('button', { type: 'button', className: 'btn', textContent: 'В корзину', onclick: change(1) });

  root.replaceChildren(
    el('a', { className: 'item__back', href: 'catalog.html', textContent: '← В каталог' }),
    el('div', { className: 'item__photo' }, el('img', { src: `img/${p.image}`, alt: p.title })),
    el('span', { className: 'item__chip', textContent: p.category }),
    el('h1', { className: 'item__title', textContent: p.title }),
    el('p', { className: 'item__meta', textContent: `${p.summary} · ${p.weight} кг` }),
    el('p', { className: 'item__text', textContent: p.description ?? '' }),
    el('div', { className: 'item__bar' },
      el('div', { className: `price${discount ? ' product__price--sale' : ''}` },
        formatPrice(p.price),
        discount ? el('span', { className: 'product__old', textContent: ` ${formatPrice(p.oldPrice)}` }) : null),
      action));
}

try {
  const product = (await loadProducts()).find((p) => p.id === id);
  if (product) render(product);
  else root.replaceChildren(
    el('p', { className: 'empty-hint', textContent: 'Товар не найден' }),
    el('a', { className: 'btn', href: 'catalog.html', textContent: 'В каталог' }));
} catch (error) {
  root.replaceChildren(el('p', { className: 'form-error', textContent: 'Не удалось загрузить товар' }));
  console.error(error);
}
