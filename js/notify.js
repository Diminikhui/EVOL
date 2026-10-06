// Уведомления о смене статуса заказа.
// Работают, пока сайт открыт в браузере (бэкенда для настоящего push пока нет).
import { notifyPrefs } from './store.js';
import { isServer, ordersApi } from './backend.js';
import { statusOf } from './status.js';

export const supported = 'Notification' in window;
export const isEnabled = () => supported && Notification.permission === 'granted' && notifyPrefs.enabled();

let registration;
async function getRegistration() {
  if (registration) return registration;
  if (!('serviceWorker' in navigator)) return null;
  try { registration = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; }
  catch { registration = null; }
  return registration;
}

async function show(title, body, url) {
  const options = { body, icon: 'img/person.svg', tag: url, data: { url } };
  const reg = await getRegistration();
  if (reg) reg.showNotification(title, options);
  else new Notification(title, options);
}

export async function enable() {
  if (!supported) return 'unsupported';
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return permission;
  notifyPrefs.set(true);
  await show('Уведомления включены', 'Мы сообщим, когда статус заказа изменится', 'account.html');
  return 'granted';
}

export const disable = () => notifyPrefs.set(false);

async function check() {
  if (!isEnabled()) return;
  let list;
  try { list = await ordersApi.list(); } catch { return; }
  const seen = notifyPrefs.seen();
  for (const order of list) {
    const status = statusOf(order);
    const number = order.id % 100000;
    const previous = seen[order.id];
    if (previous !== undefined && previous !== status.key && !status.cancelled) {
      show(`Заказ №${number}: ${status.label}`, status.hint, `track.html?id=${order.id}`);
    }
    seen[order.id] = status.key;
  }
  notifyPrefs.setSeen(seen);
}

check();
setInterval(check, isServer ? 10000 : 5000);
