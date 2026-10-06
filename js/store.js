// Хранилище на localStorage: корзина, заказы, профиль, избранное, адреса.
import { statusOf } from './status.js';
import {
  FREE_DELIVERY_FROM, DELIVERY_COST, BONUS_RATE, BONUS_MAX_SHARE, formatRub, priceOrder, checkPromo,
} from './rules.js';

export { FREE_DELIVERY_FROM, DELIVERY_COST, BONUS_RATE, BONUS_MAX_SHARE };
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватный режим */ }
};


export const cart = {
  get: () => read('evol:cart', {}),            // { [productId]: qty }
  set: (items) => write('evol:cart', items),
  add(id, qty) {
    const items = this.get();
    items[id] = (items[id] ?? 0) + qty;
    this.set(items);
  },
  change(id, delta) {
    const items = this.get();
    const next = (items[id] ?? 0) + delta;
    if (next > 0) items[id] = next; else delete items[id];
    this.set(items);
  },
  clear: () => write('evol:cart', {}),
};

export const orders = {
  get: () => read('evol:orders', []),
  add(order) { write('evol:orders', [order, ...this.get()]); },
  find: (id) => orders.get().find((o) => o.id === Number(id)),
  update(id, patch) {
    write('evol:orders', this.get().map((o) => (o.id === Number(id) ? { ...o, ...patch } : o)));
  },
};

export const profile = {
  get: () => read('evol:profile', {}),
  merge(data) { write('evol:profile', { ...this.get(), ...data }); },
};

export const favorites = {
  get: () => read('evol:favorites', []),
  has(id) { return this.get().includes(id); },
  toggle(id) {
    const list = this.get();
    write('evol:favorites', list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    return this.has(id);
  },
};

const addressKey = (a) => [a.city, a.street, a.flat].map((x) => (x ?? '').trim().toLowerCase()).join('|');

export const addressLabel = (a) => [a.street, a.flat && `кв. ${a.flat}`].filter(Boolean).join(', ');

export const addresses = {
  get: () => read('evol:addresses', []),
  defaultId: () => read('evol:addressDefault', null),
  add(address) {                       // дубликаты не создаём
    const list = this.get();
    const existing = list.find((a) => addressKey(a) === addressKey(address));
    if (existing) return existing.id;
    const saved = { id: Date.now(), ...address };
    write('evol:addresses', [...list, saved]);
    if (list.length === 0) this.setDefault(saved.id);
    return saved.id;
  },
  remove(id) {
    const rest = this.get().filter((a) => a.id !== id);
    write('evol:addresses', rest);
    if (this.defaultId() === id) write('evol:addressDefault', rest[0]?.id ?? null);
  },
  setDefault: (id) => write('evol:addressDefault', id),
};

export const notifyPrefs = {
  enabled: () => read('evol:notify', false),
  set: (value) => write('evol:notify', value),
  seen: () => read('evol:notified', {}),
  setSeen: (value) => write('evol:notified', value),
};

// ---------- Промокоды и бонусы ----------
export async function loadPromos() {
  const response = await fetch('data/promos.json');
  return response.ok ? response.json() : [];
}

export function findPromo(code, promos, subtotal) {
  const used = orders.get().filter((o) => !o.cancelled && o.promo).map((o) => o.promo);
  return checkPromo(code, promos, subtotal, used);
}

// Бонусы начисляются за доставленные заказы и списываются при оформлении.
export function bonusBalance() {
  return orders.get().reduce((sum, o) => {
    if (o.cancelled) return sum;
    const earned = statusOf(o).done ? (o.bonusEarned ?? 0) : 0;
    return sum + earned - (o.bonusSpent ?? 0);
  }, 0);
}

// Товары берём с сервера; если его нет (статический хостинг), читаем data/products.json.
export async function loadProducts() {
  for (const url of ['api/products', 'data/products.json']) {
    try {
      const response = await fetch(url);
      if (response.ok && (response.headers.get('content-type') ?? '').includes('json')) return await response.json();
    } catch { /* пробуем следующий источник */ }
  }
  throw new Error('Не удалось загрузить товары');
}

// Фото из админки лежат в uploads/, встроенные картинки — в img/.
export const imageUrl = (name) => (name ? (name.startsWith('uploads/') ? name : `img/${name}`) : 'img/paint.jpg');

// null — остаток неизвестен (статический режим), иначе число штук.
export const stockOf = (product) => (Number.isInteger(product.stock) ? product.stock : null);
export const inStock = (product) => stockOf(product) === null || stockOf(product) > 0;

export const formatPrice = formatRub;

// options: { promo, bonuses } — применяемый промокод и сколько бонусов списать.
export function priceCart(items, products, options) {
  const lines = Object.entries(items)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === Number(id)), qty }))
    .filter((line) => line.product);
  return { lines, ...priceOrder(lines, options) };
}
