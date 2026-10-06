// Сервер EVOL: статические файлы сайта + JSON API. Без внешних зависимостей.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { openDb } from './db.js';
import { verifyPassword, createSessions, parseCookies, createLoginLimiter } from './auth.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_JSON = 100 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
};
const IMAGE_TYPES = [
  { ext: '.png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: '.jpg', magic: [0xff, 0xd8, 0xff] },
  { ext: '.gif', magic: [0x47, 0x49, 0x46, 0x38] },
  { ext: '.webp', magic: [0x52, 0x49, 0x46, 0x46], also: { at: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
];

// Что сайт отдаёт как статику: только публичные папки и страницы в корне.
const PUBLIC_DIRS = ['css', 'js', 'img', 'uploads'];
const PUBLIC_FILES = new Set(['data/products.json', 'data/promos.json', 'sw.js']);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const productFromRow = (r) => ({
  id: r.id, title: r.title, category: r.category, summary: r.summary, description: r.description,
  weight: r.weight, price: r.price, oldPrice: r.old_price ?? undefined, image: r.image, stock: r.stock, active: Boolean(r.active),
});

function validateProduct(body) {
  const text = (v, max, name, required = false) => {
    const s = String(v ?? '').trim();
    if (required && !s) throw new HttpError(400, `Поле «${name}» обязательно`);
    if (s.length > max) throw new HttpError(400, `Поле «${name}» слишком длинное`);
    return s;
  };
  const int = (v, name, { min = 0, required = false } = {}) => {
    if (v === '' || v == null) {
      if (required) throw new HttpError(400, `Поле «${name}» обязательно`);
      return null;
    }
    const n = Number(v);
    if (!Number.isInteger(n) || n < min) throw new HttpError(400, `Поле «${name}» должно быть целым числом от ${min}`);
    return n;
  };
  const weight = Number(body.weight ?? 0);
  if (!Number.isFinite(weight) || weight < 0) throw new HttpError(400, 'Вес указан неверно');
  const image = text(body.image, 200, 'Фото');
  if (image && !/^(uploads\/[\w.-]+|[\w.-]+)$/.test(image)) throw new HttpError(400, 'Недопустимое имя файла фото');
  return {
    title: text(body.title, 120, 'Название', true), category: text(body.category, 60, 'Категория'),
    summary: text(body.summary, 160, 'Краткое описание'), description: text(body.description, 2000, 'Описание'),
    weight, price: int(body.price, 'Цена', { required: true }), old_price: int(body.oldPrice, 'Старая цена'),
    image, stock: int(body.stock ?? 0, 'Остаток', { required: true }), active: body.active === false ? 0 : 1,
  };
}

export function createApp({ db = openDb(), sessions = createSessions(), limiter = createLoginLimiter() } = {}) {
  const readBody = (req, limit) => new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new HttpError(413, 'Слишком большой запрос')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const readJson = async (req) => {
    if (!(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'Нужен JSON');
    try { return JSON.parse((await readBody(req, MAX_JSON)).toString() || '{}'); }
    catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'Некорректный JSON'); }
  };

  const send = (res, status, data, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
    res.end(JSON.stringify(data));
  };

  const currentUser = (req) => {
    const session = sessions.read(parseCookies(req.headers.cookie).evol_session);
    if (!session) return null;
    return db.prepare('SELECT id, login, role FROM users WHERE id = ?').get(session.id) ?? null;
  };
  const requireRole = (req, ...roles) => {
    const user = currentUser(req);
    if (!user) throw new HttpError(401, 'Нужно войти');
    if (!roles.includes(user.role)) throw new HttpError(403, 'Недостаточно прав');
    return user;
  };

  async function api(req, res, url) {
    const { method } = req;
    const path = url.pathname;

    if (path === '/api/login' && method === 'POST') {
      const ip = req.socket.remoteAddress;
      if (limiter.blocked(ip)) throw new HttpError(429, 'Слишком много попыток. Подождите несколько минут');
      const { login = '', password = '' } = await readJson(req);
      const user = db.prepare('SELECT * FROM users WHERE login = ?').get(String(login));
      // Проверяем пароль даже для несуществующего логина, чтобы время ответа не выдавало его наличие.
      const stored = user?.password_hash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`;
      if (!verifyPassword(String(password), stored) || !user) {
        limiter.fail(ip);
        throw new HttpError(401, 'Неверный логин или пароль');
      }
      limiter.reset(ip);
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      return send(res, 200, { login: user.login, role: user.role }, {
        'set-cookie': `evol_session=${sessions.issue(user)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`,
      });
    }
    if (path === '/api/logout' && method === 'POST') {
      return send(res, 200, { ok: true }, { 'set-cookie': 'evol_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }
    if (path === '/api/me' && method === 'GET') {
      const user = currentUser(req);
      return user ? send(res, 200, user) : send(res, 401, { error: 'Нужно войти' });
    }

    if (path === '/api/products' && method === 'GET') {
      const all = url.searchParams.get('all') === '1';
      if (all) requireRole(req, 'admin', 'staff');
      const rows = db.prepare(`SELECT * FROM products ${all ? '' : 'WHERE active = 1'} ORDER BY id`).all();
      return send(res, 200, rows.map(productFromRow));
    }
    if (path === '/api/products' && method === 'POST') {
      requireRole(req, 'admin');
      const p = validateProduct(await readJson(req));
      const { lastInsertRowid } = db.prepare(`INSERT INTO products
        (title, category, summary, description, weight, price, old_price, image, stock, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(p.title, p.category, p.summary, p.description, p.weight, p.price, p.old_price, p.image, p.stock, p.active);
      return send(res, 201, productFromRow(db.prepare('SELECT * FROM products WHERE id = ?').get(lastInsertRowid)));
    }
    const match = path.match(/^\/api\/products\/(\d+)$/);
    if (match && method === 'PUT') {
      requireRole(req, 'admin');
      const id = Number(match[1]);
      if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) throw new HttpError(404, 'Товар не найден');
      const p = validateProduct(await readJson(req));
      db.prepare(`UPDATE products SET title=?, category=?, summary=?, description=?, weight=?, price=?,
        old_price=?, image=?, stock=?, active=? WHERE id=?`)
        .run(p.title, p.category, p.summary, p.description, p.weight, p.price, p.old_price, p.image, p.stock, p.active, id);
      return send(res, 200, productFromRow(db.prepare('SELECT * FROM products WHERE id = ?').get(id)));
    }
    if (match && method === 'DELETE') {
      requireRole(req, 'admin');
      const { changes } = db.prepare('DELETE FROM products WHERE id = ?').run(Number(match[1]));
      if (!changes) throw new HttpError(404, 'Товар не найден');
      return send(res, 200, { ok: true });
    }

    if (path === '/api/upload' && method === 'POST') {
      requireRole(req, 'admin');
      const data = await readBody(req, MAX_IMAGE);
      const type = IMAGE_TYPES.find((t) => t.magic.every((b, i) => data[i] === b)
        && (!t.also || t.also.bytes.every((b, i) => data[t.also.at + i] === b)));
      if (!type) throw new HttpError(415, 'Допустимы PNG, JPG, GIF и WebP');
      const name = `${randomBytes(8).toString('hex')}${type.ext}`;
      await mkdir(join(root, 'uploads'), { recursive: true });
      await writeFile(join(root, 'uploads', name), data);
      return send(res, 201, { image: `uploads/${name}` });
    }

    throw new HttpError(404, 'Не найдено');
  }

  async function serveStatic(req, res, url) {
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, 'Некорректный адрес'); }
    if (pathname === '/') pathname = '/index.html';
    const relative = normalize(pathname).replace(/^[/\\]+/, '').replaceAll('\\', '/');
    if (relative.split('/').some((part) => part === '..' || part.startsWith('.'))) throw new HttpError(404, 'Не найдено');
    const [first] = relative.split('/');
    const allowed = relative.includes('/') ? (PUBLIC_DIRS.includes(first) || PUBLIC_FILES.has(relative)) : (relative.endsWith('.html') || PUBLIC_FILES.has(relative));
    const type = MIME[extname(relative).toLowerCase()];
    if (!allowed || !type) throw new HttpError(404, 'Не найдено');
    try {
      const file = await readFile(join(root, relative));
      res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff', 'cache-control': first === 'uploads' ? 'public, max-age=86400' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : file);
    } catch { throw new HttpError(404, 'Не найдено'); }
  }

  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else if (req.method === 'GET' || req.method === 'HEAD') await serveStatic(req, res, url);
      else throw new HttpError(405, 'Метод не поддерживается');
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error(error);
      if (!res.headersSent) {
        if (url.pathname.startsWith('/api/')) send(res, status, { error: status === 500 ? 'Ошибка сервера' : error.message });
        else { res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }); res.end(status === 404 ? 'Не найдено' : error.message); }
      }
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8000);
  createApp().listen(port, () => console.log(`EVOL: http://localhost:${port}  (админка: /admin.html)`));
}
