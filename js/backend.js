// Единая точка доступа к данным: сервер, если он есть, иначе localStorage (демо-режим для статического хостинга).
import { orders as localOrders, bonusBalance as localBonus, profile } from './store.js';

async function probe() {
  try {
    const response = await fetch('api/me');
    if ((response.headers.get('content-type') ?? '').includes('json') && [200, 401].includes(response.status)) {
      return { server: true, user: response.status === 200 ? await response.json() : null };
    }
  } catch { /* сервера нет */ }
  return { server: false, user: null };
}

const probed = await probe();
export const isServer = probed.server;
export let user = probed.user;

export async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error ?? `Ошибка ${response.status}`), { status: response.status });
  return data;
}

// Безопасный адрес возврата после входа: только наши страницы.
export const safeNext = (value, fallback = 'catalog.html') => (/^[\w-]+\.html(\?[\w=&.-]*)?$/.test(value ?? '') ? value : fallback);

// В режиме сервера страницы с заказами требуют входа.
export function requireLogin(page) {
  if (!isServer || user) return Promise.resolve(user);
  location.replace(`login.html?next=${encodeURIComponent(page)}`);
  return new Promise(() => {});          // страница уходит на вход, дальше код не выполняем
}

export async function logout() {
  if (isServer) await request('api/logout', { method: 'POST' });
  location.href = isServer ? 'login.html' : 'index.html';
}

export const displayName = () => user?.name || profile.get().name || '';

export const ordersApi = {
  async list() {
    if (!isServer) return localOrders.get();
    if (!user) return [];
    try { return await request('api/orders'); }
    catch (error) { if (error.status === 401) return []; throw error; }
  },
  async get(id) {
    if (!isServer) return localOrders.find(id) ?? null;
    try { return await request(`api/orders/${id}`); }
    catch (error) { if (error.status === 404) return null; throw error; }
  },
  async cancel(id) {
    if (!isServer) { localOrders.update(id, { cancelled: true }); return; }
    await request(`api/orders/${id}/status`, { method: 'POST', body: { status: 'cancelled' } });
  },
};

export async function bonus() {
  if (!isServer) return localBonus();
  if (!user) return 0;
  try { user = await request('api/me'); return user.bonus ?? 0; } catch { return 0; }
}
