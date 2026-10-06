import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.js';
import { createApp } from './index.js';
import { createSessions, createLoginLimiter } from './auth.js';
import { rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let server, base, cookie;
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

before(async () => {
  process.env.ADMIN_PASSWORD = 'test-pass-123';
  server = createApp({ db: openDb(':memory:'), sessions: createSessions('secret'), limiter: createLoginLimiter({ max: 5 }) });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const json = (path, { method = 'GET', body, headers = {} } = {}) => fetch(base + path, {
  method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
  body: body ? JSON.stringify(body) : undefined,
});

test('каталог публичный и содержит товары из начальных данных', async () => {
  const res = await json('/api/products');
  const list = await res.json();
  assert.equal(res.status, 200);
  assert.equal(list.length, 6);
  assert.equal(list[1].oldPrice, 1900);
});

test('без входа нельзя менять товары и смотреть неактивные', async () => {
  assert.equal((await json('/api/products', { method: 'POST', body: { title: 'x', price: 1 } })).status, 401);
  assert.equal((await json('/api/products?all=1')).status, 401);
  assert.equal((await json('/api/products/1', { method: 'DELETE' })).status, 401);
  assert.equal((await fetch(base + '/api/upload', { method: 'POST', body: PNG })).status, 401);
});

test('неверный пароль отклоняется, верный выдаёт сессию', async () => {
  assert.equal((await json('/api/login', { method: 'POST', body: { login: 'admin', password: 'bad' } })).status, 401);
  const res = await json('/api/login', { method: 'POST', body: { login: 'admin', password: 'test-pass-123' } });
  assert.equal(res.status, 200);
  const set = res.headers.get('set-cookie');
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Strict/);
  cookie = set.split(';')[0];
  assert.equal((await (await json('/api/me')).json()).role, 'admin');
});

test('админ создаёт, меняет и удаляет товар', async () => {
  const created = await json('/api/products', { method: 'POST', body: { title: 'Эмаль', price: 1200, stock: 7, category: 'Эмали' } });
  assert.equal(created.status, 201);
  const product = await created.json();
  assert.equal(product.stock, 7);

  const updated = await (await json(`/api/products/${product.id}`, { method: 'PUT', body: { ...product, price: 999, active: false } })).json();
  assert.equal(updated.price, 999);

  const publicIds = (await (await json('/api/products')).json()).map((p) => p.id);
  assert.ok(!publicIds.includes(product.id), 'скрытый товар не виден покупателям');
  const allIds = (await (await json('/api/products?all=1')).json()).map((p) => p.id);
  assert.ok(allIds.includes(product.id));

  assert.equal((await json(`/api/products/${product.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await json(`/api/products/${product.id}`, { method: 'DELETE' })).status, 404);
});

test('данные товара проверяются', async () => {
  for (const body of [{ title: '', price: 1 }, { title: 'x', price: -5 }, { title: 'x', price: 1.5 }, { title: 'x', price: 1, stock: -1 },
    { title: 'x', price: 1, image: '../../etc/passwd' }]) {
    assert.equal((await json('/api/products', { method: 'POST', body })).status, 400, JSON.stringify(body));
  }
  assert.equal((await fetch(base + '/api/products', { method: 'POST', headers: { cookie, 'content-type': 'text/plain' }, body: '{}' })).status, 415);
});

test('загрузка принимает картинки и отклоняет остальное', async () => {
  const ok = await fetch(base + '/api/upload', { method: 'POST', headers: { cookie }, body: PNG });
  assert.equal(ok.status, 201);
  const { image } = await ok.json();
  assert.match(image, /^uploads\/[0-9a-f]{16}\.png$/);
  assert.equal((await fetch(`${base}/${image}`)).status, 200);
  await rm(join(root, image));

  const script = await fetch(base + '/api/upload', { method: 'POST', headers: { cookie, 'content-type': 'image/png' }, body: '<script>alert(1)</script>' });
  assert.equal(script.status, 415);
});

test('служебные файлы не отдаются', async () => {
  for (const path of ['/server/index.js', '/server/db.js', '/data/evol.db', '/package.json', '/.git/config', '/..%2Fserver%2Fauth.js', '/css/../server/auth.js', '/%2e%2e/package.json']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  assert.equal((await fetch(base + '/index.html')).status, 200);
  assert.equal((await fetch(base + '/js/store.js')).status, 200);
  assert.equal((await fetch(base + '/data/products.json')).status, 200);
});

test('после нескольких неудачных попыток вход блокируется', async () => {
  let last;
  for (let i = 0; i < 7; i++) last = await json('/api/login', { method: 'POST', body: { login: 'admin', password: 'bad' } });
  assert.equal(last.status, 429);
});
