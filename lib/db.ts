import * as SQLite from "expo-sqlite";

// Use a mutable reference so all importers see the live binding
export let db: SQLite.SQLiteDatabase = null as any;

const DEFAULT_CATEGORIES = [
  { name: "أكل ومشروبات", icon: "coffee", color: "#F97316" },
  { name: "مواصلات", icon: "truck", color: "#3B82F6" },
  { name: "تسوق", icon: "shopping-bag", color: "#8B5CF6" },
  { name: "ترفيه", icon: "film", color: "#EC4899" },
  { name: "فواتير", icon: "file-text", color: "#10B981" },
  { name: "صحة", icon: "heart", color: "#EF4444" },
  { name: "سجاير", icon: "wind", color: "#6B7280" },
  { name: "تعليم", icon: "book", color: "#F59E0B" },
  { name: "بنزين", icon: "zap", color: "#F59E0B" },
  { name: "حشيش", icon: "star", color: "#EF4444" },
  { name: "أخرى", icon: "more-horizontal", color: "#9CA3AF" },
];

let initializing: Promise<void> | null = null;
export function initDB() {
  if (!initializing) initializing = initialize().catch(error => { initializing = null; throw error; });
  return initializing;
}
async function initialize() {
  // openDatabaseAsync avoids the SharedArrayBuffer requirement on web
  db = await SQLite.openDatabaseAsync("hossmoney.db");

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'tag',
      color TEXT NOT NULL DEFAULT '#F0B429',
      budget REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      note TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      key TEXT NOT NULL,
      kind TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notification_log_created ON notification_log(created_at DESC);
  `);

  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(expenses)");
  if (!columns.some(c => c.name === "uid")) await db.execAsync("ALTER TABLE expenses ADD COLUMN uid TEXT");
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT UNIQUE NOT NULL, name TEXT NOT NULL, opening_balance REAL NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO accounts(uid,name) VALUES ('default-cash','النقدية');
    CREATE TABLE IF NOT EXISTS incomes (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT UNIQUE NOT NULL, amount REAL NOT NULL CHECK(amount>0), description TEXT NOT NULL, date TEXT NOT NULL, account_id INTEGER NOT NULL REFERENCES accounts(id));
    CREATE TABLE IF NOT EXISTS transfers (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT UNIQUE NOT NULL, amount REAL NOT NULL CHECK(amount>0), date TEXT NOT NULL, from_id INTEGER NOT NULL REFERENCES accounts(id), to_id INTEGER NOT NULL REFERENCES accounts(id), CHECK(from_id!=to_id));
    CREATE TABLE IF NOT EXISTS debts (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT UNIQUE NOT NULL, person TEXT NOT NULL, amount REAL NOT NULL CHECK(amount>0), direction TEXT NOT NULL CHECK(direction IN ('owed','owing')), note TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS debt_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT UNIQUE NOT NULL, debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE, amount REAL NOT NULL CHECK(amount>0), date TEXT NOT NULL, account_id INTEGER NOT NULL REFERENCES accounts(id), entry_uid TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS recurring (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT UNIQUE NOT NULL, amount REAL NOT NULL CHECK(amount>0), description TEXT NOT NULL, category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, account_id INTEGER NOT NULL REFERENCES accounts(id), next_date TEXT NOT NULL, cadence TEXT NOT NULL CHECK(cadence IN ('monthly','weekly')), anchor_day INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1);
    CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
  `);
  if (!columns.some(c => c.name === "account_id")) await db.execAsync("ALTER TABLE expenses ADD COLUMN account_id INTEGER REFERENCES accounts(id)");
  await db.execAsync("UPDATE expenses SET account_id=(SELECT id FROM accounts WHERE uid='default-cash') WHERE account_id IS NULL;");
  await db.execAsync(`
    UPDATE expenses SET uid = lower(hex(randomblob(16))) WHERE uid IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_uid ON expenses(uid);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category_date ON expenses(category_id, date);
    PRAGMA user_version = 3;
  `);
  const count = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) as n FROM categories"
  );
  if (!count || count.n === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await db.runAsync(
        "INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)",
        [cat.name, cat.icon, cat.color]
      );
    }
  }
}
