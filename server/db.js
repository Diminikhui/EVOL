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
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrateUsers(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'courier', 'customer')),
      name TEXT NOT NULL DEFAULT '',
      phone TEXT UNIQUE
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
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'accepted',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      payment TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      promo TEXT,
      delivery INTEGER NOT NULL DEFAULT 0,
      bonus_spent INTEGER NOT NULL DEFAULT 0,
      bonus_earned INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      courier_id INTEGER REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS orders_status ON orders(status);
    CREATE TABLE IF NOT EXISTS order_items (
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      image TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL CHECK (qty > 0)
    );
  `);
  seed(db);
  return db;
}

// База версии 1.5.0 не знала роли «покупатель»: пересоздаём таблицу пользователей, сохранив данные.
function migrateUsers(db) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!row || row.sql.includes("'customer'")) return;
  db.exec(`
    PRAGMA foreign_keys = OFF;
    ALTER TABLE users RENAME TO users_old;
    CREATE TABLE users (
      id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'courier', 'customer')),
      name TEXT NOT NULL DEFAULT '', phone TEXT UNIQUE
    );
    INSERT INTO users (id, login, password_hash, role) SELECT id, login, password_hash, role FROM users_old;
    DROP TABLE users_old;
    PRAGMA foreign_keys = ON;
  `);
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
