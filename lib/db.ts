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

export async function initDB() {
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
