// Хранилище на localStorage: корзина, заказы, профиль, избранное, адреса.
import { statusOf } from './status.js';
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватный режим */ }
};

export const FREE_DELIVERY_FROM = 5000;
export const DELIVERY_COST = 500;
export const BONUS_RATE = 0.05;        // начисляем 5% от оплаченной суммы
export const BONUS_MAX_SHARE = 0.3;     // бонусами можно оплатить до 30% заказа

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
  const promo = promos.find((p) => p.code === code.trim().toUpperCase());
  if (!promo) return { error: 'Такого промокода нет' };
  if (promo.minSubtotal && subtotal < promo.minSubtotal) {
    return { error: `Промокод действует от ${formatPrice(promo.minSubtotal)}` };
  }
  const used = orders.get().some((o) => !o.cancelled && o.promo === promo.code);
  if (promo.once && used) return { error: 'Этот промокод вы уже использовали' };
  return { promo };
}

// Бонусы начисляются за доставленные заказы и списываются при оформлении.
export function bonusBalance() {
  return orders.get().reduce((sum, o) => {
    if (o.cancelled) return sum;
    const earned = statusOf(o).done ? (o.bonusEarned ?? 0) : 0;
    return sum + earned - (o.bonusSpent ?? 0);
  }, 0);
}

export async function loadProducts() {
  const response = await fetch('data/products.json');
  if (!response.ok) throw new Error(`products.json: ${response.status}`);
  return response.json();
}

export const formatPrice = (n) => `${n.toLocaleString('ru-RU')} ₽`;

// options: { promo, bonuses } — применяемый промокод и сколько бонусов списать.
export function priceCart(items, products, { promo = null, bonuses = 0 } = {}) {
  const lines = Object.entries(items)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === Number(id)), qty }))
    .filter((line) => line.product);
  const subtotal = lines.reduce((sum, { product, qty }) => sum + product.price * qty, 0);

  let discount = 0;
  if (promo?.type === 'percent') discount = Math.round((subtotal * promo.value) / 100);
  if (promo?.type === 'fixed') discount = Math.min(promo.value, subtotal);
  const discounted = subtotal - discount;

  const freeDelivery = subtotal >= FREE_DELIVERY_FROM || promo?.type === 'delivery';
  const delivery = subtotal === 0 || freeDelivery ? 0 : DELIVERY_COST;

  const maxBonuses = Math.floor(discounted * BONUS_MAX_SHARE);
  const bonusSpent = Math.max(0, Math.min(bonuses, maxBonuses));
  const total = discounted + delivery - bonusSpent;
  const bonusEarned = Math.floor((discounted - bonusSpent) * BONUS_RATE);

  return { lines, subtotal, discount, delivery, bonusSpent, maxBonuses, total, bonusEarned };
}
