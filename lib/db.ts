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
      country TEXT DEFAULT 'AU',
      currency TEXT DEFAULT 'AUD',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      abn TEXT,
      tax_id TEXT,
      country TEXT DEFAULT 'AU',
      currency TEXT DEFAULT 'AUD',
      tax_framework TEXT DEFAULT 'AU_GST',
      industry TEXT,
      color TEXT DEFAULT '#00d4ff',
      logo_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS business_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member' CHECK(role IN ('owner','admin','member','viewer')),
      joined_at TEXT DEFAULT (datetime('now')),
      UNIQUE(business_id, user_id),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      business_id INTEGER,
      name TEXT NOT NULL,
      account_type TEXT DEFAULT 'personal' CHECK(account_type IN ('personal','business')),
      type TEXT DEFAULT 'checking' CHECK(type IN ('checking','savings','credit','loan','cash','crypto','investment')),
      currency TEXT DEFAULT 'AUD',
      balance REAL DEFAULT 0,
      color TEXT DEFAULT '#8b5cf6',
      icon TEXT DEFAULT 'bank',
      institution TEXT,
      last_four TEXT,
      notes TEXT,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS income_streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      business_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#00d4ff',
      icon TEXT DEFAULT 'trending-up',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      color TEXT DEFAULT '#8b5cf6',
      icon TEXT DEFAULT 'tag',
      budget_limit REAL DEFAULT 0,
      is_tax_deductible INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      business_id INTEGER,
      account_id INTEGER,
      income_stream_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
      scope TEXT DEFAULT 'personal' CHECK(scope IN ('personal','business')),
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'AUD',
      description TEXT NOT NULL,
      category_id INTEGER,
      date TEXT NOT NULL,
      recurring INTEGER DEFAULT 0,
      recur_interval TEXT,
      recur_start_date TEXT,
      is_tax_deductible INTEGER DEFAULT 0,
      gst_inclusive INTEGER DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      platform_source TEXT,
      platform_transaction_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
      FOREIGN KEY (income_stream_id) REFERENCES income_streams(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      business_id INTEGER,
      account_id INTEGER,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'AUD',
      billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('weekly','fortnightly','monthly','quarterly','annually')),
      next_billing_date TEXT NOT NULL,
      category TEXT DEFAULT 'Subscriptions',
      color TEXT DEFAULT '#8b5cf6',
      url TEXT,
      notes TEXT,
      scope TEXT DEFAULT 'personal' CHECK(scope IN ('personal','business')),
      is_tax_deductible INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','cancelled')),
      pause_until TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('stripe','paypal','woocommerce','shopify')),
      credentials TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_sync TEXT,
      sync_from_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(business_id, platform),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS platform_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      external_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('sale','refund','payout','fee','transfer')),
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'AUD',
      description TEXT,
      customer_name TEXT,
      customer_email TEXT,
      date TEXT NOT NULL,
      matched_transaction_id INTEGER,
      raw_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(integration_id, external_id),
      FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (matched_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
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


    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'other' CHECK(type IN ('credit_card','personal_loan','car_loan','student_loan','mortgage','buy_now_pay_later','medical','other')),
      balance REAL NOT NULL,
      original_balance REAL NOT NULL,
      interest_rate REAL DEFAULT 0,
      minimum_payment REAL NOT NULL,
      due_day INTEGER DEFAULT 1,
      lender TEXT,
      color TEXT DEFAULT '#ef4444',
      is_paid_off INTEGER DEFAULT 0,
      paid_off_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bucket_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      bucket TEXT NOT NULL CHECK(bucket IN ('blow_daily','blow_splurge','mojo_smile','mojo_fire','grow_super','grow_invest')),
      UNIQUE(user_id, account_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
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

  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
  if (userCount.c === 0) {
    const bcrypt = require('bcryptjs')
    const hash = bcrypt.hashSync('ace2024!', 10)
    const userId = (db.prepare(
      "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')"
    ).run('admin@acewallet.com', 'Admin', hash)).lastInsertRowid as number

    const bizId = (db.prepare(
      "INSERT INTO businesses (owner_id, name, country, currency, tax_framework) VALUES (?, ?, 'AU', 'AUD', 'AU_GST')"
    ).run(userId, 'My Business')).lastInsertRowid as number

    db.prepare("INSERT INTO business_members (business_id, user_id, role) VALUES (?, ?, 'owner')").run(bizId, userId)

    db.prepare(
      "INSERT INTO accounts (user_id, name, account_type, type, currency, color, is_default) VALUES (?, 'Personal Spending', 'personal', 'checking', 'AUD', '#00d4ff', 1)"
    ).run(userId)

    const streams = [
      { name: 'Salary / Wages', color: '#10b981' },
      { name: 'Freelance', color: '#00d4ff' },
      { name: 'Business Revenue', color: '#8b5cf6' },
    ]
    const insertStream = db.prepare('INSERT INTO income_streams (user_id, business_id, name, color) VALUES (?, ?, ?, ?)')
    streams.forEach(s => insertStream.run(userId, bizId, s.name, s.color))

    const cats = [
      { name: 'Salary', type: 'income', color: '#10b981', icon: 'briefcase', deductible: 0 },
      { name: 'Freelance', type: 'income', color: '#00d4ff', icon: 'laptop', deductible: 0 },
      { name: 'Business Sales', type: 'income', color: '#8b5cf6', icon: 'trending-up', deductible: 0 },
      { name: 'Other Income', type: 'income', color: '#f59e0b', icon: 'plus-circle', deductible: 0 },
      { name: 'Groceries', type: 'expense', color: '#f59e0b', icon: 'shopping-cart', deductible: 0 },
      { name: 'Rent / Mortgage', type: 'expense', color: '#ef4444', icon: 'home', deductible: 0 },
      { name: 'Utilities', type: 'expense', color: '#f97316', icon: 'zap', deductible: 1 },
      { name: 'Transport', type: 'expense', color: '#06b6d4', icon: 'car', deductible: 1 },
      { name: 'Dining Out', type: 'expense', color: '#ec4899', icon: 'utensils', deductible: 0 },
      { name: 'Entertainment', type: 'expense', color: '#a855f7', icon: 'tv', deductible: 0 },
      { name: 'Health', type: 'expense', color: '#84cc16', icon: 'heart', deductible: 1 },
      { name: 'Clothing', type: 'expense', color: '#14b8a6', icon: 'shirt', deductible: 0 },
      { name: 'Subscriptions', type: 'expense', color: '#8b5cf6', icon: 'repeat', deductible: 1 },
      { name: 'Insurance', type: 'expense', color: '#64748b', icon: 'shield', deductible: 1 },
      { name: 'Advertising', type: 'expense', color: '#f43f5e', icon: 'megaphone', deductible: 1 },
      { name: 'Office Supplies', type: 'expense', color: '#0ea5e9', icon: 'package', deductible: 1 },
      { name: 'Professional Services', type: 'expense', color: '#d946ef', icon: 'users', deductible: 1 },
      { name: 'Travel', type: 'expense', color: '#fb923c', icon: 'plane', deductible: 1 },
      { name: 'Other', type: 'expense', color: '#475569', icon: 'tag', deductible: 0 },
    ]
    const insertCat = db.prepare('INSERT INTO categories (user_id, name, type, color, icon, is_tax_deductible) VALUES (?, ?, ?, ?, ?, ?)')
    cats.forEach(c => insertCat.run(userId, c.name, c.type, c.color, c.icon, c.deductible))
  }

  runMigrations(db)
}

function runMigrations(db: Database.Database) {
  const txCols = (db.prepare("PRAGMA table_info(transactions)").all() as { name: string }[]).map(r => r.name)
  if (!txCols.includes('business_id')) db.exec("ALTER TABLE transactions ADD COLUMN business_id INTEGER")
  if (!txCols.includes('account_id')) db.exec("ALTER TABLE transactions ADD COLUMN account_id INTEGER")
  if (!txCols.includes('income_stream_id')) db.exec("ALTER TABLE transactions ADD COLUMN income_stream_id INTEGER")
  if (!txCols.includes('scope')) db.exec("ALTER TABLE transactions ADD COLUMN scope TEXT DEFAULT 'personal'")
  if (!txCols.includes('currency')) db.exec("ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'AUD'")
  if (!txCols.includes('is_tax_deductible')) db.exec("ALTER TABLE transactions ADD COLUMN is_tax_deductible INTEGER DEFAULT 0")
  if (!txCols.includes('gst_inclusive')) db.exec("ALTER TABLE transactions ADD COLUMN gst_inclusive INTEGER DEFAULT 0")
  if (!txCols.includes('tax_amount')) db.exec("ALTER TABLE transactions ADD COLUMN tax_amount REAL DEFAULT 0")
  if (!txCols.includes('platform_source')) db.exec("ALTER TABLE transactions ADD COLUMN platform_source TEXT")
  if (!txCols.includes('recur_start_date')) db.exec("ALTER TABLE transactions ADD COLUMN recur_start_date TEXT")
  if (!txCols.includes('platform_transaction_id')) db.exec("ALTER TABLE transactions ADD COLUMN platform_transaction_id TEXT")

  const catCols = (db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]).map(r => r.name)
  if (!catCols.includes('is_tax_deductible')) db.exec("ALTER TABLE categories ADD COLUMN is_tax_deductible INTEGER DEFAULT 0")

  const subCols = (db.prepare("PRAGMA table_info(subscriptions)").all() as { name: string }[]).map(r => r.name)
  if (!subCols.includes('business_id')) db.exec("ALTER TABLE subscriptions ADD COLUMN business_id INTEGER")
  if (!subCols.includes('account_id')) db.exec("ALTER TABLE subscriptions ADD COLUMN account_id INTEGER")
  if (!subCols.includes('scope')) db.exec("ALTER TABLE subscriptions ADD COLUMN scope TEXT DEFAULT 'personal'")
  if (!subCols.includes('is_tax_deductible')) db.exec("ALTER TABLE subscriptions ADD COLUMN is_tax_deductible INTEGER DEFAULT 0")
  if (!subCols.includes('pause_until')) db.exec("ALTER TABLE subscriptions ADD COLUMN pause_until TEXT")

  // Ensure debts and bucket_assignments tables exist (safe to run multiple times)
  db.exec(`
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'other',
      balance REAL NOT NULL,
      original_balance REAL NOT NULL,
      interest_rate REAL DEFAULT 0,
      minimum_payment REAL NOT NULL,
      due_day INTEGER DEFAULT 1,
      lender TEXT,
      color TEXT DEFAULT '#ef4444',
      is_paid_off INTEGER DEFAULT 0,
      paid_off_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS bucket_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      bucket TEXT NOT NULL,
      UNIQUE(user_id, account_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );
  `)
  const userCols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map(r => r.name)
  if (!userCols.includes('country')) db.exec("ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'AU'")
  if (!userCols.includes('currency')) db.exec("ALTER TABLE users ADD COLUMN currency TEXT DEFAULT 'AUD'")

  // Category mappings for smart auto-categorisation on bank statement imports
  db.exec(\`
    CREATE TABLE IF NOT EXISTS category_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      description_pattern TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      scope TEXT DEFAULT 'personal',
      type TEXT DEFAULT 'expense',
      times_used INTEGER DEFAULT 1,
      last_used TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, description_pattern),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
  \`)
}
