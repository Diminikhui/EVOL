// Статусы заказа. Бэкенда нет, поэтому статус вычисляется по времени с момента оформления.
// Сроки ускорены для демонстрации: весь путь занимает 5 минут.
export const STEPS = [
  { key: 'accepted',   label: 'Принят',     hint: 'Мы получили ваш заказ',     at: 0 },
  { key: 'packing',    label: 'Собирается', hint: 'Собираем товары на складе', at: 30_000 },
  { key: 'delivering', label: 'В пути',     hint: 'Курьер уже едет к вам',     at: 120_000 },
  { key: 'delivered',  label: 'Доставлен',  hint: 'Заказ вручён. Спасибо!',    at: 300_000 },
];
export const CANCELLABLE_UNTIL = 1; // отменить можно на этапах «Принят» и «Собирается»

// Заказ с сервера приходит с готовым статусом (order.status); локальный демо-заказ считаем по времени.
export function statusOf(order, now = Date.now()) {
  if (order.cancelled || order.status === 'cancelled') {
    return { key: 'cancelled', label: 'Отменён', hint: 'Заказ отменён', index: -1, cancelled: true, done: true, active: false, canCancel: false, etaMs: null };
  }
  let index;
  let etaMs = null;
  if (order.status) {
    index = Math.max(0, STEPS.findIndex((step) => step.key === order.status));
  } else {
    const elapsed = Math.max(0, now - new Date(order.date).getTime());
    index = STEPS.reduce((last, step, i) => (elapsed >= step.at ? i : last), 0);
    if (index < STEPS.length - 1) etaMs = STEPS[STEPS.length - 1].at - elapsed;
  }
  const done = index === STEPS.length - 1;
  return { ...STEPS[index], index, cancelled: false, done, active: !done, canCancel: index <= CANCELLABLE_UNTIL, etaMs };
}

export function formatEta(ms) {
  const minutes = Math.ceil(ms / 60_000);
  return minutes <= 1 ? 'меньше минуты' : `около ${minutes} мин`;
}
