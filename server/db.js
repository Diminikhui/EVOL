// База данных (SQLite, встроенная в Node) и первичное наполнение.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './auth.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function openDb(file = process.env.DB_FILE ?? join(root, 'data', 'evol.db')) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'courier'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      weight REAL NOT NULL DEFAULT 0,
      price INTEGER NOT NULL CHECK (price >= 0),
      old_price INTEGER,
      image TEXT NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      active INTEGER NOT NULL DEFAULT 1
    );
  `);
  seed(db);
  return db;
}

function seed(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
    const file = join(root, 'data', 'products.json');
    if (existsSync(file)) {
      const insert = db.prepare(`INSERT INTO products
        (id, title, category, summary, description, weight, price, old_price, image, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 100)`);
      for (const p of JSON.parse(readFileSync(file, 'utf8'))) {
        insert.run(p.id, p.title, p.category ?? '', p.summary ?? '', p.description ?? '',
          p.weight ?? 0, p.price, p.oldPrice ?? null, p.image ?? '');
      }
    }
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    const login = process.env.ADMIN_LOGIN ?? 'admin';
    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      password = randomBytes(9).toString('base64url');
      console.log(`\n  Создан администратор. Логин: ${login}  Пароль: ${password}`);
      console.log('  Пароль показан один раз. Задайте свой через ADMIN_PASSWORD.\n');
    }
    db.prepare('INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)')
      .run(login, hashPassword(password), 'admin');
  }
}
