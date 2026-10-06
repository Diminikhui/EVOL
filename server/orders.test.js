import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.js';
import { createApp } from './index.js';
import { createSessions, createLoginLimiter } from './auth.js';

process.env.ADMIN_PASSWORD = 'admin-pass-123';
let server, base, db;
const PROMOS = [
  { code: 'WELCOME10', type: 'percent', value: 10, once: true },
  { code: 'KRASKA500', type: 'fixed', value: 500, minSubtotal: 3000 },
];

before(async () => {
  db = openDb(':memory:');
  server = createApp({ db, sessions: createSessions('s'), limiter: createLoginLimiter({ max: 1000 }), promos: PROMOS });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

// Каждый участник — отдельный «браузер» со своей cookie.
const client = () => {
  let cookie = '';
  const call = async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(base + path, {
      method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  return { call };
};

const address = { city: 'Москва', street: 'ул. Ленина, 5', flat: '12' };
const orderBody = (items, extra = {}) => ({ items, address, phone: '+7 900 123-45-67', payment: 'Наличными', ...extra });
const stockOf = (id) => db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock;
const price = (id) => db.prepare('SELECT price FROM products WHERE id = ?').get(id).price;

let admin, staff, courier, anna, boris;

test('регистрация и вход покупателя по телефону', async () => {
  anna = client();
  assert.equal((await anna.call('/api/register', { method: 'POST', body: { name: 'Анна', phone: '123', password: 'longenough1' } })).status, 400);
  assert.equal((await anna.call('/api/register', { method: 'POST', body: { name: 'Анна', phone: '+7 900 111-22-33', password: 'short' } })).status, 400);
  const ok = await anna.call('/api/register', { method: 'POST', body: { name: 'Анна', phone: '+7 900 111-22-33', password: 'longenough1' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.role, 'customer');
  assert.equal((await anna.call('/api/me')).data.bonus, 0);

  const again = client();
  assert.equal((await again.call('/api/register', { method: 'POST', body: { name: 'Двойник', phone: '8 (900) 111-22-33', password: 'longenough1' } })).status, 409);
  const login = await again.call('/api/login', { method: 'POST', body: { login: '8 900 111 22 33', password: 'longenough1' } });
  assert.equal(login.status, 200);
  assert.equal(login.data.name, 'Анна');

  boris = client();
  await boris.call('/api/register', { method: 'POST', body: { name: 'Борис', phone: '+7 900 444-55-66', password: 'longenough2' } });
});

test('сотрудников создаёт только админ', async () => {
  assert.equal((await anna.call('/api/staff', { method: 'POST', body: { login: 'hacker', password: 'longenough1', role: 'admin' } })).status, 403);
  admin = client();
  await admin.call('/api/login', { method: 'POST', body: { login: 'admin', password: 'admin-pass-123' } });
  assert.equal((await admin.call('/api/staff', { method: 'POST', body: { login: 'sklad', password: 'sklad-pass-1', role: 'staff' } })).status, 201);
  assert.equal((await admin.call('/api/staff', { method: 'POST', body: { login: 'kurier', password: 'kurier-pass-1', role: 'courier' } })).status, 201);
  assert.equal((await admin.call('/api/staff', { method: 'POST', body: { login: 'sklad', password: 'sklad-pass-1', role: 'staff' } })).status, 409);
  staff = client(); courier = client();
  assert.equal((await staff.call('/api/login', { method: 'POST', body: { login: 'sklad', password: 'sklad-pass-1' } })).status, 200);
  assert.equal((await courier.call('/api/login', { method: 'POST', body: { login: 'kurier', password: 'kurier-pass-1' } })).status, 200);
});

test('заказ: цены считает сервер, остаток списывается', async () => {
  const before1 = stockOf(1);
  // клиент пытается подсунуть свою цену — она игнорируется
  const res = await anna.call('/api/orders', { method: 'POST', body: orderBody([{ id: 1, qty: 2, price: 1 }, { id: 3, qty: 1 }]) });
  assert.equal(res.status, 201);
  const expected = price(1) * 2 + price(3);
  assert.equal(res.data.subtotal, expected);
  assert.equal(res.data.delivery, expected >= 5000 ? 0 : 500);
  assert.equal(res.data.total, expected + res.data.delivery);
  assert.equal(res.data.status, 'accepted');
  assert.equal(res.data.address, 'Москва, ул. Ленина, 5, кв. 12');
  assert.equal(stockOf(1), before1 - 2);
});

test('заказ без входа, без телефона или с чужой ролью отклоняется', async () => {
  assert.equal((await client().call('/api/orders', { method: 'POST', body: orderBody([{ id: 1, qty: 1 }]) })).status, 401);
  assert.equal((await anna.call('/api/orders', { method: 'POST', body: orderBody([{ id: 1, qty: 1 }], { phone: 'abc' }) })).status, 400);
  assert.equal((await anna.call('/api/orders', { method: 'POST', body: orderBody([{ id: 1, qty: 1 }], { payment: 'Биткоин' }) })).status, 400);
  assert.equal((await anna.call('/api/orders', { method: 'POST', body: orderBody([{ id: 1, qty: 0 }]) })).status, 400);
  assert.equal((await anna.call('/api/orders', { method: 'POST', body: orderBody([{ id: 999, qty: 1 }]) })).status, 409);
  assert.equal((await staff.call('/api/orders', { method: 'POST', body: orderBody([{ id: 1, qty: 1 }]) })).status, 403);
});

test('нехватка остатка отменяет весь заказ целиком', async () => {
  db.prepare('UPDATE products SET stock = 2 WHERE id = 4').run();
  const s1 = stockOf(5);
  const res = await anna.call('/api/orders', { method: 'POST', body: orderBody([{ id: 5, qty: 1 }, { id: 4, qty: 3 }]) });
  assert.equal(res.status, 409);
  assert.match(res.data.error, /осталось 2/);
  assert.equal(stockOf(5), s1, 'остаток первого товара не должен измениться');
  assert.equal(stockOf(4), 2);
});

test('промокоды: сумма, минимум и одноразовость', async () => {
  const welcome = await boris.call('/api/orders', { method: 'POST', body: orderBody([{ id: 1, qty: 1 }], { promo: 'welcome10' }) });
  assert.equal(welcome.status, 201);
  assert.equal(welcome.data.discount, Math.round(price(1) * 0.1));
  assert.equal((await boris.call('/api/orders', { method: 'POST', body: orderBody([{ id: 1, qty: 1 }], { promo: 'WELCOME10' }) })).status, 400);
  assert.equal((await boris.call('/api/orders', { method: 'POST', body: orderBody([{ id: 1, qty: 1 }], { promo: 'KRASKA500' }) })).status, 400, 'не хватает суммы');
  assert.equal((await boris.call('/api/orders', { method: 'POST', body: orderBody([{ id: 1, qty: 1 }], { promo: 'НЕТ' }) })).status, 400);
});

test('чужие заказы не видны, список только свой', async () => {
  const mine = (await anna.call('/api/orders')).data;
  assert.ok(mine.length >= 1);
  const borisOrder = (await boris.call('/api/orders')).data[0];
  assert.equal((await anna.call(`/api/orders/${borisOrder.id}`)).status, 404);
  assert.equal((await anna.call(`/api/orders/${borisOrder.id}/status`, { method: 'POST', body: { status: 'cancelled' } })).status, 404);
  assert.equal((await boris.call(`/api/orders/${borisOrder.id}`)).status, 200);
  assert.equal((await client().call('/api/orders')).status, 401);
});

test('статусы: кто и что может менять', async () => {
  const order = (await anna.call('/api/orders')).data[0];
  const set = (who, status) => who.call(`/api/orders/${order.id}/status`, { method: 'POST', body: { status } });

  assert.equal((await set(anna, 'packing')).status, 403, 'покупатель не двигает статус');
  assert.equal((await set(courier, 'packing')).status, 403, 'курьер не собирает');
  assert.equal((await set(staff, 'delivering')).status, 409, 'нельзя перескочить этап');
  assert.equal((await set(staff, 'packing')).data.status, 'packing');
  assert.equal((await set(staff, 'delivered')).status, 403, 'доставляет только курьер');
  assert.equal((await set(staff, 'delivering')).data.status, 'delivering');

  assert.equal((await courier.call('/api/orders')).data.some((o) => o.id === order.id), true, 'курьер видит заказ в пути');
  assert.equal((await anna.call(`/api/orders/${order.id}/status`, { method: 'POST', body: { status: 'cancelled' } })).status, 409, 'в пути покупатель уже не отменяет');
  assert.equal((await set(courier, 'delivered')).data.status, 'delivered');
  assert.equal((await set(courier, 'delivered')).status, 409);
  assert.equal((await set(admin, 'cancelled')).status, 409, 'доставленный не отменить');
});

test('бонусы начисляются после доставки и списываются при оформлении', async () => {
  const delivered = (await anna.call('/api/orders')).data.find((o) => o.status === 'delivered');
  const balance = (await anna.call('/api/me')).data.bonus;
  assert.equal(balance, delivered.bonusEarned);
  assert.ok(balance > 0);

  const res = await anna.call('/api/orders', { method: 'POST', body: orderBody([{ id: 3, qty: 1 }], { useBonuses: true }) });
  assert.equal(res.status, 201);
  assert.equal(res.data.bonusSpent, Math.min(balance, Math.floor(price(3) * 0.3)));
  assert.equal((await anna.call('/api/me')).data.bonus, balance - res.data.bonusSpent);
});

test('отмена возвращает товар на склад и бонусы', async () => {
  const before3 = stockOf(3);
  const order = (await anna.call('/api/orders', { method: 'POST', body: orderBody([{ id: 3, qty: 2 }], { useBonuses: true }) })).data;
  assert.equal(stockOf(3), before3 - 2);
  const balanceBefore = (await anna.call('/api/me')).data.bonus;
  const cancelled = await anna.call(`/api/orders/${order.id}/status`, { method: 'POST', body: { status: 'cancelled' } });
  assert.equal(cancelled.data.status, 'cancelled');
  assert.equal(stockOf(3), before3);
  assert.equal((await anna.call('/api/me')).data.bonus, balanceBefore + order.bonusSpent);
  assert.equal((await anna.call(`/api/orders/${order.id}/status`, { method: 'POST', body: { status: 'cancelled' } })).status, 409, 'повторная отмена');
});

test('сотрудник видит заказы с данными покупателя, курьер только свои', async () => {
  const all = (await staff.call('/api/orders')).data;
  assert.ok(all.length >= 3);
  assert.ok(all.every((o) => o.customer?.name));
  const fresh = (await staff.call('/api/orders?status=accepted')).data;
  assert.ok(fresh.every((o) => o.status === 'accepted'));
  const forCourier = (await courier.call('/api/orders')).data;
  assert.ok(forCourier.every((o) => ['delivering', 'delivered'].includes(o.status)));
  assert.equal((await anna.call('/api/orders')).data.every((o) => o.customer === undefined), true, 'покупатель не видит служебных полей');
});

test('админа-самого-себя и сотрудников с заказами удалить нельзя', async () => {
  const me = (await admin.call('/api/me')).data;
  assert.equal((await admin.call(`/api/staff/${me.id}`, { method: 'DELETE' })).status, 400);
  const list = (await admin.call('/api/staff')).data;
  const courierUser = list.find((u) => u.login === 'kurier');
  assert.equal((await admin.call(`/api/staff/${courierUser.id}`, { method: 'DELETE' })).status, 409, 'за курьером числится доставка');
  const tmp = (await admin.call('/api/staff', { method: 'POST', body: { login: 'temp', password: 'temp-pass-123', role: 'staff' } })).data;
  assert.equal((await admin.call(`/api/staff/${tmp.id}`, { method: 'DELETE' })).status, 200);
});
