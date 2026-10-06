// Хранилище на localStorage: корзина, заказы, профиль.
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватный режим */ }
};

export const FREE_DELIVERY_FROM = 5000;
export const DELIVERY_COST = 500;

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
};

export const profile = {
  get: () => read('evol:profile', {}),
  merge(data) { write('evol:profile', { ...this.get(), ...data }); },
};

export async function loadProducts() {
  const response = await fetch('data/products.json');
  if (!response.ok) throw new Error(`products.json: ${response.status}`);
  return response.json();
}

export const formatPrice = (n) => `${n.toLocaleString('ru-RU')} ₽`;

export function priceCart(items, products) {
  const lines = Object.entries(items)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === Number(id)), qty }))
    .filter((line) => line.product);
  const subtotal = lines.reduce((sum, { product, qty }) => sum + product.price * qty, 0);
  const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_COST;
  return { lines, subtotal, delivery, total: subtotal + delivery };
}
