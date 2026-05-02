import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'wallet.db')
let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initSchema(_db)
  }
  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      color TEXT DEFAULT '#8b5cf6',
      icon TEXT DEFAULT 'tag',
      budget_limit REAL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category_id INTEGER,
      date TEXT NOT NULL,
      recurring INTEGER DEFAULT 0,
      recur_interval TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'AUD',
      billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('weekly','fortnightly','monthly','quarterly','annually')),
      next_billing_date TEXT NOT NULL,
      category TEXT DEFAULT 'Subscriptions',
      color TEXT DEFAULT '#8b5cf6',
      url TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','cancelled')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shopping_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      store TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','archived')),
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL,
      gtin TEXT,
      name TEXT NOT NULL,
      brand TEXT,
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'each',
      price_woolworths REAL,
      price_coles REAL,
      price_aldi REAL,
      price_iga REAL,
      best_store TEXT,
      best_price REAL,
      last_price_check TEXT,
      checked_off INTEGER DEFAULT 0,
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
    );
  `)

  // Seed default admin user if none exists
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
  if (userCount.c === 0) {
    const bcrypt = require('bcryptjs')
    const hash = bcrypt.hashSync('ace2024!', 10)
    const userId = (db.prepare(
      "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')"
    ).run('admin@acewallet.com', 'Admin', hash)).lastInsertRowid as number

    // Default categories
    const cats = [
      { name: 'Salary', type: 'income', color: '#10b981', icon: 'briefcase' },
      { name: 'Freelance', type: 'income', color: '#00d4ff', icon: 'laptop' },
      { name: 'Other Income', type: 'income', color: '#8b5cf6', icon: 'plus-circle' },
      { name: 'Groceries', type: 'expense', color: '#f59e0b', icon: 'shopping-cart' },
      { name: 'Rent / Mortgage', type: 'expense', color: '#ef4444', icon: 'home' },
      { name: 'Utilities', type: 'expense', color: '#f97316', icon: 'zap' },
      { name: 'Transport', type: 'expense', color: '#06b6d4', icon: 'car' },
      { name: 'Dining Out', type: 'expense', color: '#ec4899', icon: 'utensils' },
      { name: 'Entertainment', type: 'expense', color: '#a855f7', icon: 'tv' },
      { name: 'Health', type: 'expense', color: '#84cc16', icon: 'heart' },
      { name: 'Clothing', type: 'expense', color: '#14b8a6', icon: 'shirt' },
      { name: 'Subscriptions', type: 'expense', color: '#8b5cf6', icon: 'repeat' },
      { name: 'Insurance', type: 'expense', color: '#64748b', icon: 'shield' },
      { name: 'Other', type: 'expense', color: '#475569', icon: 'tag' },
    ]
    const insertCat = db.prepare('INSERT INTO categories (user_id, name, type, color, icon) VALUES (?, ?, ?, ?, ?)')
    cats.forEach(c => insertCat.run(userId, c.name, c.type, c.color, c.icon))
  }
}
