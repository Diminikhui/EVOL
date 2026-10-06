// Пароли (scrypt) и сессии (подписанная cookie).
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function createSessions(secret = process.env.SESSION_SECRET ?? randomBytes(32).toString('hex')) {
  const sign = (payload) => createHmac('sha256', secret).update(payload).digest('base64url');
  return {
    issue(user) {
      const payload = Buffer.from(JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
      return `${payload}.${sign(payload)}`;
    },
    read(token) {
      if (typeof token !== 'string') return null;
      const [payload, signature] = token.split('.');
      if (!payload || !signature) return null;
      const expected = Buffer.from(sign(payload));
      const given = Buffer.from(signature);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
      try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
        return data.exp > Date.now() ? data : null;
      } catch { return null; }
    },
  };
}

export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((c) => c.trim().split('=')).filter(([k]) => k)
    .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

// Ограничение попыток входа: 5 неудач за 10 минут с одного адреса.
export function createLoginLimiter({ max = 5, windowMs = 10 * 60 * 1000 } = {}) {
  const attempts = new Map();
  const recent = (ip) => (attempts.get(ip) ?? []).filter((t) => Date.now() - t < windowMs);
  return {
    blocked: (ip) => recent(ip).length >= max,
    fail: (ip) => attempts.set(ip, [...recent(ip), Date.now()]),
    reset: (ip) => attempts.delete(ip),
  };
}
