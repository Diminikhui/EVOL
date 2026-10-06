// Правила магазина: расчёт цены, промокоды, телефон.
// Модуль общий: его используют и сайт (для показа итога), и сервер (для настоящего расчёта).

export const FREE_DELIVERY_FROM = 5000;
export const DELIVERY_COST = 500;
export const BONUS_RATE = 0.05;        // начисляем 5% от оплаченной суммы
export const BONUS_MAX_SHARE = 0.3;    // бонусами можно оплатить до 30% заказа

export const formatRub = (n) => `${n.toLocaleString('ru-RU')} ₽`;

// lines: [{ product: { price }, qty }]; options: { promo, bonuses }
export function priceOrder(lines, { promo = null, bonuses = 0 } = {}) {
  const subtotal = lines.reduce((sum, { product, qty }) => sum + product.price * qty, 0);

  let discount = 0;
  if (promo?.type === 'percent') discount = Math.round((subtotal * promo.value) / 100);
  if (promo?.type === 'fixed') discount = Math.min(promo.value, subtotal);
  const discounted = subtotal - discount;

  const freeDelivery = subtotal >= FREE_DELIVERY_FROM || promo?.type === 'delivery';
  const delivery = subtotal === 0 || freeDelivery ? 0 : DELIVERY_COST;

  const maxBonuses = Math.floor(discounted * BONUS_MAX_SHARE);
  const bonusSpent = Math.max(0, Math.min(Math.floor(bonuses), maxBonuses));
  const total = discounted + delivery - bonusSpent;
  const bonusEarned = Math.floor((discounted - bonusSpent) * BONUS_RATE);

  return { subtotal, discount, delivery, bonusSpent, maxBonuses, total, bonusEarned };
}

// usedCodes — коды, которые покупатель уже применял в неотменённых заказах.
export function checkPromo(code, promos, subtotal, usedCodes = []) {
  const promo = promos.find((p) => p.code === String(code ?? '').trim().toUpperCase());
  if (!promo) return { error: 'Такого промокода нет' };
  if (promo.minSubtotal && subtotal < promo.minSubtotal) {
    return { error: `Промокод действует от ${formatRub(promo.minSubtotal)}` };
  }
  if (promo.once && usedCodes.includes(promo.code)) return { error: 'Этот промокод вы уже использовали' };
  return { promo };
}

// Телефон приводим к виду 79001234567. Возвращает null, если номер непохож на настоящий.
export function normalizePhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return /^\d{11,15}$/.test(digits) ? digits : null;
}

// 79001234567 -> +7 900 123-45-67 (для показа людям)
export function formatPhone(digits) {
  const d = String(digits ?? '').replace(/\D/g, '');
  const m = d.match(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : (d ? `+${d}` : '');
}
