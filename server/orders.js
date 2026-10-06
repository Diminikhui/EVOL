// Заказы: создание (цены считает сервер), статусы, права, бонусы.
import { HttpError } from './http-error.js';
import { priceOrder, checkPromo, normalizePhone } from '../js/rules.js';

export const FLOW = ['accepted', 'packing', 'delivering', 'delivered'];
const PAYMENTS = ['Картой курьеру', 'Наличными'];

// Кто какой переход делает (вперёд на один шаг).
const ADVANCE_ROLES = { packing: ['staff', 'admin'], delivering: ['staff', 'admin'], delivered: ['courier', 'admin'] };
const CANCEL_STATUSES = { customer: ['accepted', 'packing'], staff: ['accepted', 'packing', 'delivering'], admin: ['accepted', 'packing', 'delivering'] };

export function orderFromRow(db, row, { forStaff = false } = {}) {
  const lines = db.prepare('SELECT product_id AS id, title, image, price, qty FROM order_items WHERE order_id = ?').all(row.id);
  const order = {
    id: row.id, date: row.created_at, status: row.status, total: row.total, subtotal: row.subtotal,
    discount: row.discount, promo: row.promo ?? null, delivery: row.delivery, bonusSpent: row.bonus_spent,
    bonusEarned: row.bonus_earned, address: row.address, phone: row.phone, payment: row.payment,
    comment: row.comment, cancelled: row.status === 'cancelled', lines,
  };
  if (forStaff) {
    const customer = db.prepare('SELECT name, phone FROM users WHERE id = ?').get(row.user_id);
    order.customer = { name: customer?.name ?? '', phone: customer?.phone ?? '' };
    order.courierId = row.courier_id ?? null;
  }
  return order;
}

// Бонусы начисляются за доставленные заказы и списываются при оформлении.
export function bonusBalance(db, userId) {
  const { earned } = db.prepare("SELECT COALESCE(SUM(bonus_earned), 0) AS earned FROM orders WHERE user_id = ? AND status = 'delivered'").get(userId);
  const { spent } = db.prepare("SELECT COALESCE(SUM(bonus_spent), 0) AS spent FROM orders WHERE user_id = ? AND status != 'cancelled'").get(userId);
  return earned - spent;
}

const text = (value, max, name, required = false) => {
  const s = String(value ?? '').trim();
  if (required && !s) throw new HttpError(400, `Укажите: ${name}`);
  if (s.length > max) throw new HttpError(400, `Слишком длинное поле: ${name}`);
  return s;
};

function parseItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, 'Корзина пуста');
  if (raw.length > 50) throw new HttpError(400, 'Слишком много позиций');
  const merged = new Map();
  for (const item of raw) {
    const id = Number(item?.id);
    const qty = Number(item?.qty);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 99) throw new HttpError(400, 'Неверное количество товара');
    merged.set(id, (merged.get(id) ?? 0) + qty);
  }
  return [...merged].map(([id, qty]) => ({ id, qty }));
}

function addressLine(a = {}) {
  const city = text(a.city, 80, 'город', true);
  const street = text(a.street, 160, 'улицу и дом', true);
  const flat = text(a.flat, 20, 'квартиру');
  const floor = text(a.floor, 10, 'этаж');
  const intercom = text(a.intercom, 20, 'домофон');
  return [city, street, flat && `кв. ${flat}`, floor && `этаж ${floor}`, intercom && `домофон ${intercom}`].filter(Boolean).join(', ');
}

export function createOrder(db, user, body, promos) {
  const items = parseItems(body.items);
  const address = addressLine(body.address);
  const phone = normalizePhone(body.phone);
  if (!phone) throw new HttpError(400, 'Укажите телефон для связи');
  const payment = PAYMENTS.includes(body.payment) ? body.payment : null;
  if (!payment) throw new HttpError(400, 'Выберите способ оплаты');
  const comment = text(body.comment, 300, 'комментарий');

  db.exec('BEGIN IMMEDIATE');
  try {
    const lines = items.map(({ id, qty }) => {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(id);
      if (!product) throw new HttpError(409, 'Один из товаров больше недоступен. Обновите корзину');
      if (product.stock < qty) {
        throw new HttpError(409, product.stock > 0 ? `«${product.title}»: на складе осталось ${product.stock}` : `«${product.title}» закончился`);
      }
      return { product, qty };
    });

    const subtotal = lines.reduce((sum, { product, qty }) => sum + product.price * qty, 0);
    let promo = null;
    if (body.promo) {
      const used = db.prepare("SELECT promo FROM orders WHERE user_id = ? AND promo IS NOT NULL AND status != 'cancelled'").all(user.id).map((r) => r.promo);
      const result = checkPromo(body.promo, promos, subtotal, used);
      if (result.error) throw new HttpError(400, result.error);
      promo = result.promo;
    }
    const balance = bonusBalance(db, user.id);
    const price = priceOrder(lines, { promo, bonuses: body.useBonuses ? balance : 0 });

    const now = new Date().toISOString();
    const { lastInsertRowid: id } = db.prepare(`INSERT INTO orders
      (user_id, status, created_at, updated_at, address, phone, payment, comment, subtotal, discount, promo, delivery, bonus_spent, bonus_earned, total)
      VALUES (?, 'accepted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(user.id, now, now, address, phone, payment, comment, price.subtotal, price.discount, promo?.code ?? null,
        price.delivery, price.bonusSpent, price.bonusEarned, price.total);

    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, title, image, price, qty) VALUES (?, ?, ?, ?, ?, ?)');
    const takeStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const { product, qty } of lines) {
      insertItem.run(id, product.id, product.title, product.image, product.price, qty);
      takeStock.run(qty, product.id);
    }
    db.exec('COMMIT');
    return orderFromRow(db, db.prepare('SELECT * FROM orders WHERE id = ?').get(id));
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function listOrders(db, user, { status } = {}) {
  let rows;
  if (user.role === 'customer') {
    rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 200').all(user.id);
  } else if (user.role === 'courier') {
    rows = db.prepare("SELECT * FROM orders WHERE status = 'delivering' OR (status = 'delivered' AND courier_id = ?) ORDER BY id DESC LIMIT 200").all(user.id);
  } else if (status) {
    rows = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 200').all(status);
  } else {
    rows = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();
  }
  return rows.map((row) => orderFromRow(db, row, { forStaff: user.role !== 'customer' }));
}

export function getOrder(db, user, id) {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  // Чужой заказ не раскрываем: для покупателя он выглядит как несуществующий.
  if (!row || (user.role === 'customer' && row.user_id !== user.id)) throw new HttpError(404, 'Заказ не найден');
  if (user.role === 'courier' && !(row.status === 'delivering' || row.courier_id === user.id)) throw new HttpError(404, 'Заказ не найден');
  return orderFromRow(db, row, { forStaff: user.role !== 'customer' });
}

export function changeStatus(db, user, id, next) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!row || (user.role === 'customer' && row.user_id !== user.id)) throw new HttpError(404, 'Заказ не найден');

    if (next === 'cancelled') {
      if (!CANCEL_STATUSES[user.role]?.includes(row.status)) throw new HttpError(409, 'Этот заказ уже нельзя отменить');
      const restore = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
      for (const item of db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(id)) restore.run(item.qty, item.product_id);
    } else {
      const roles = ADVANCE_ROLES[next];
      if (!roles) throw new HttpError(400, 'Неизвестный статус');
      if (!roles.includes(user.role)) throw new HttpError(403, 'Недостаточно прав для этого действия');
      if (FLOW.indexOf(next) !== FLOW.indexOf(row.status) + 1) throw new HttpError(409, 'Нельзя перейти к этому статусу');
    }
    const courier = next === 'delivered' && user.role === 'courier' ? user.id : row.courier_id;
    db.prepare('UPDATE orders SET status = ?, updated_at = ?, courier_id = ? WHERE id = ?').run(next, new Date().toISOString(), courier, id);
    db.exec('COMMIT');
    return orderFromRow(db, db.prepare('SELECT * FROM orders WHERE id = ?').get(id), { forStaff: user.role !== 'customer' });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
