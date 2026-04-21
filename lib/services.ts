import { db } from "./db";

export type Category = {
  id: number;
  name: string;
  icon: string;
  color: string;
  budget: number | null;
  created_at: string;
};

export type Expense = {
  id: number;
  amount: number;
  description: string;
  category_id: number | null;
  note: string | null;
  date: string;
  created_at: string;
  category?: Category | null;
};

export type Settings = {
  currency: string;
  theme: "dark" | "light";
  fingerprintEnabled: boolean;
  aiProvider: "openai" | "gemini";
  logoBase64: string | null;
  logoUri: string | null;
  monthlyGoal: number | null;
  notificationsEnabled: boolean;
  googleClientId: string | null;
  driveAccessToken: string | null;
  driveRefreshToken: string | null;
  driveTokenExpiresAt: string | null;
  driveAutoBackup: boolean;
  driveLastBackupAt: string | null;
};

// ─── Categories ──────────────────────────────────────────────
export async function getCategories(): Promise<Category[]> {
  return db.getAllAsync<Category>(
    "SELECT * FROM categories ORDER BY id ASC"
  );
}

export async function createCategory(data: {
  name: string;
  icon: string;
  color: string;
  budget?: number | null;
}): Promise<Category> {
  const res = await db.runAsync(
    "INSERT INTO categories (name, icon, color, budget) VALUES (?, ?, ?, ?)",
    [data.name, data.icon, data.color, data.budget ?? null]
  );
  return (await db.getFirstAsync<Category>(
    "SELECT * FROM categories WHERE id = ?",
    [res.lastInsertRowId]
  ))!;
}

export async function updateCategory(
  id: number,
  data: { name?: string; icon?: string; color?: string; budget?: number | null }
): Promise<void> {
  const fields = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => `${k} = ?`);
  const values = Object.values(data).filter((v) => v !== undefined);
  if (fields.length === 0) return;
  await db.runAsync(
    `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`,
    [...values, id]
  );
}

export async function deleteCategory(id: number): Promise<void> {
  await db.runAsync("DELETE FROM categories WHERE id = ?", [id]);
}

// ─── Expenses ─────────────────────────────────────────────────
export async function getExpenses(filters?: {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  limit?: number;
}): Promise<Expense[]> {
  let sql = `
    SELECT e.*, 
      c.id as cat_id, c.name as cat_name, c.icon as cat_icon,
      c.color as cat_color, c.budget as cat_budget, c.created_at as cat_created_at
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (filters?.startDate) {
    sql += " AND e.date >= ?";
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    sql += " AND e.date <= ?";
    params.push(filters.endDate);
  }
  if (filters?.categoryId) {
    sql += " AND e.category_id = ?";
    params.push(filters.categoryId);
  }
  sql += " ORDER BY e.date DESC, e.created_at DESC";
  if (filters?.limit) {
    sql += ` LIMIT ${filters.limit}`;
  }

  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(mapExpenseRow);
}

function mapExpenseRow(row: any): Expense {
  return {
    id: row.id,
    amount: row.amount,
    description: row.description,
    category_id: row.category_id,
    note: row.note,
    date: row.date,
    created_at: row.created_at,
    category: row.cat_id
      ? {
          id: row.cat_id,
          name: row.cat_name,
          icon: row.cat_icon,
          color: row.cat_color,
          budget: row.cat_budget,
          created_at: row.cat_created_at,
        }
      : null,
  };
}

export async function createExpense(data: {
  amount: number;
  description: string;
  categoryId?: number | null;
  note?: string | null;
  date?: string;
}): Promise<Expense> {
  const date = data.date ?? new Date().toISOString().split("T")[0];
  const res = await db.runAsync(
    "INSERT INTO expenses (amount, description, category_id, note, date) VALUES (?, ?, ?, ?, ?)",
    [data.amount, data.description, data.categoryId ?? null, data.note ?? null, date]
  );
  const rows = await db.getAllAsync<any>(
    `SELECT e.*, c.id as cat_id, c.name as cat_name, c.icon as cat_icon, c.color as cat_color, c.budget as cat_budget, c.created_at as cat_created_at
     FROM expenses e LEFT JOIN categories c ON e.category_id = c.id WHERE e.id = ?`,
    [res.lastInsertRowId]
  );
  const expense = mapExpenseRow(rows[0]);
  // Fire-and-forget: check budgets and send local notifications if needed.
  // Auto-backup is intentionally NOT called here — Drive backup/restore is manual only.
  import("./notifications")
    .then((m) =>
      m.checkAndNotify({
        amount: expense.amount,
        date: expense.date,
        category_id: expense.category_id,
      })
    )
    .catch(() => {});
  return expense;
}

export async function updateExpense(
  id: number,
  data: {
    amount?: number;
    description?: string;
    categoryId?: number | null;
    note?: string | null;
    date?: string;
  }
): Promise<void> {
  const mapping: Record<string, string> = {
    amount: "amount",
    description: "description",
    categoryId: "category_id",
    note: "note",
    date: "date",
  };
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, col] of Object.entries(mapping)) {
    if ((data as any)[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push((data as any)[key]);
    }
  }
  if (fields.length === 0) return;
  await db.runAsync(
    `UPDATE expenses SET ${fields.join(", ")} WHERE id = ?`,
    [...values, id]
  );
}

export async function deleteExpense(id: number): Promise<void> {
  await db.runAsync("DELETE FROM expenses WHERE id = ?", [id]);
}

// ─── Stats ────────────────────────────────────────────────────
export type StatsResult = {
  total: number;
  count: number;
  byDay: { date: string; total: number }[];
  byCategory: { categoryId: number | null; name: string; color: string; total: number }[];
};

export async function getStats(
  period: "day" | "week" | "month",
  date?: string
): Promise<StatsResult> {
  const today = date ?? new Date().toISOString().split("T")[0];
  let startDate: string;
  let endDate: string = today;

  if (period === "day") {
    startDate = today;
  } else if (period === "week") {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    startDate = d.toISOString().split("T")[0];
  } else {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    startDate = d.toISOString().split("T")[0];
  }

  const totalRow = await db.getFirstAsync<{ total: number; count: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date >= ? AND date <= ?",
    [startDate, endDate]
  );

  const byDay = await db.getAllAsync<{ date: string; total: number }>(
    "SELECT date, SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ? GROUP BY date ORDER BY date ASC",
    [startDate, endDate]
  );

  const byCatRaw = await db.getAllAsync<any>(
    `SELECT e.category_id, COALESCE(c.name, 'أخرى') as name, COALESCE(c.color, '#9CA3AF') as color,
     SUM(e.amount) as total
     FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.date >= ? AND e.date <= ?
     GROUP BY e.category_id ORDER BY total DESC`,
    [startDate, endDate]
  );

  return {
    total: totalRow?.total ?? 0,
    count: totalRow?.count ?? 0,
    byDay,
    byCategory: byCatRaw.map((r: any) => ({
      categoryId: r.category_id,
      name: r.name,
      color: r.color,
      total: r.total,
    })),
  };
}

export type MonthCompareResult = {
  current: { month: string; total: number; count: number };
  previous: { month: string; total: number; count: number };
  diff: number;
  diffPct: number;
};

export async function getMonthComparison(referenceDate?: string): Promise<MonthCompareResult> {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const curStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const curEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  const prevStart = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const prevEnd = new Date(ref.getFullYear(), ref.getMonth(), 0);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const monthLabel = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const cur = await db.getFirstAsync<{ total: number; count: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date >= ? AND date <= ?",
    [fmt(curStart), fmt(curEnd)]
  );
  const prev = await db.getFirstAsync<{ total: number; count: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date >= ? AND date <= ?",
    [fmt(prevStart), fmt(prevEnd)]
  );
  const curTotal = cur?.total ?? 0;
  const prevTotal = prev?.total ?? 0;
  const diff = curTotal - prevTotal;
  const diffPct = prevTotal > 0 ? (diff / prevTotal) * 100 : curTotal > 0 ? 100 : 0;
  return {
    current: { month: monthLabel(curStart), total: curTotal, count: cur?.count ?? 0 },
    previous: { month: monthLabel(prevStart), total: prevTotal, count: prev?.count ?? 0 },
    diff,
    diffPct,
  };
}

// ─── Weekly Summary (Task #8) ─────────────────────────────────
export type WeeklySummary = {
  weekStart: string;
  weekEnd: string;
  total: number;
  count: number;
  prevTotal: number;
  diff: number;
  diffPct: number;
  topCategory: { name: string; color: string; total: number; pct: number } | null;
  topDay: { date: string; total: number } | null;
  busiestDayLabel: string;
  avgPerDay: number;
};

function fmtDate(d: Date): string { return d.toISOString().split("T")[0]; }

export async function getWeeklySummary(referenceDate?: string): Promise<WeeklySummary> {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const end = new Date(ref); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(end.getDate() - 6);
  const prevEnd = new Date(start); prevEnd.setDate(start.getDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - 6);

  const startStr = fmtDate(start);
  const endStr = fmtDate(end);
  const prevStartStr = fmtDate(prevStart);
  const prevEndStr = fmtDate(prevEnd);

  const cur = await db.getFirstAsync<{ total: number; count: number }>(
    "SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM expenses WHERE date >= ? AND date <= ?",
    [startStr, endStr]
  );
  const prev = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date >= ? AND date <= ?",
    [prevStartStr, prevEndStr]
  );
  const topCat = await db.getFirstAsync<{ name: string; color: string; total: number }>(
    `SELECT COALESCE(c.name, 'أخرى') as name, COALESCE(c.color, '#9CA3AF') as color, SUM(e.amount) as total
     FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.date >= ? AND e.date <= ?
     GROUP BY e.category_id ORDER BY total DESC LIMIT 1`,
    [startStr, endStr]
  );
  const topDay = await db.getFirstAsync<{ date: string; total: number }>(
    "SELECT date, SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ? GROUP BY date ORDER BY total DESC LIMIT 1",
    [startStr, endStr]
  );

  const total = cur?.total ?? 0;
  const prevTotal = prev?.total ?? 0;
  const diff = total - prevTotal;
  const diffPct = prevTotal > 0 ? (diff / prevTotal) * 100 : total > 0 ? 100 : 0;
  const busiestDayLabel = topDay
    ? new Date(topDay.date).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })
    : "—";

  return {
    weekStart: startStr,
    weekEnd: endStr,
    total,
    count: cur?.count ?? 0,
    prevTotal,
    diff,
    diffPct,
    topCategory: topCat
      ? { name: topCat.name, color: topCat.color, total: topCat.total, pct: total > 0 ? (topCat.total / total) * 100 : 0 }
      : null,
    topDay: topDay ? { date: topDay.date, total: topDay.total } : null,
    busiestDayLabel,
    avgPerDay: total / 7,
  };
}

// ─── Settings ─────────────────────────────────────────────────
export async function getSettings(): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM settings"
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    currency: map.currency ?? "EGP",
    theme: (map.theme ?? "dark") as "dark" | "light",
    fingerprintEnabled: map.fingerprintEnabled === "true",
    aiProvider: (map.aiProvider ?? "gemini") as "openai" | "gemini",
    logoBase64: map.logoBase64 ?? null,
    logoUri: map.logoUri ?? null,
    monthlyGoal: map.monthlyGoal ? parseFloat(map.monthlyGoal) : null,
    notificationsEnabled: map.notificationsEnabled === "true",
    googleClientId: map.googleClientId || null,
    driveAccessToken: map.driveAccessToken || null,
    driveRefreshToken: map.driveRefreshToken || null,
    driveTokenExpiresAt: map.driveTokenExpiresAt || null,
    driveAutoBackup: map.driveAutoBackup === "true",
    driveLastBackupAt: map.driveLastBackupAt || null,
  };
}

// ─── Backup / Restore ────────────────────────────────────────
// Sensitive keys never written to backup files (avoid OAuth/API leakage when sharing JSON)
const SENSITIVE_SETTING_KEYS = new Set([
  "driveAccessToken",
  "driveRefreshToken",
  "driveTokenExpiresAt",
  "driveLastBackupAt",
  "driveAutoBackup",
  "googleClientId",
]);

export async function exportBackup(): Promise<string> {
  const cats = await db.getAllAsync<any>("SELECT * FROM categories");
  const exps = await db.getAllAsync<any>("SELECT * FROM expenses");
  const sets = await db.getAllAsync<any>("SELECT * FROM settings");
  const safeSets = sets.filter((s: any) => !SENSITIVE_SETTING_KEYS.has(s.key));
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), categories: cats, expenses: exps, settings: safeSets },
    null,
    2
  );
}

export async function importBackup(json: string, mode: "merge" | "replace"): Promise<{ categories: number; expenses: number }> {
  const data = JSON.parse(json);
  if (!data || typeof data !== "object" || !Array.isArray(data.expenses)) {
    throw new Error("ملف النسخة الاحتياطية غير صالح");
  }
  if (mode === "replace") {
    await db.execAsync("DELETE FROM expenses; DELETE FROM categories; DELETE FROM settings;");
  }
  let cCount = 0, eCount = 0;
  if (Array.isArray(data.categories)) {
    for (const c of data.categories) {
      try {
        const r = await db.runAsync(
          "INSERT OR IGNORE INTO categories (id, name, icon, color, budget) VALUES (?, ?, ?, ?, ?)",
          [c.id, c.name, c.icon ?? "tag", c.color ?? "#F0B429", c.budget ?? null]
        );
        if (r.changes > 0) cCount++;
      } catch {}
    }
  }
  for (const e of data.expenses) {
    try {
      const r = await db.runAsync(
        "INSERT OR IGNORE INTO expenses (id, amount, description, category_id, note, date) VALUES (?, ?, ?, ?, ?, ?)",
        [e.id, e.amount, e.description, e.category_id ?? null, e.note ?? null, e.date]
      );
      if (r.changes > 0) eCount++;
    } catch {}
  }
  if (Array.isArray(data.settings)) {
    for (const s of data.settings) {
      try {
        await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [s.key, s.value]);
      } catch {}
    }
  }
  return { categories: cCount, expenses: eCount };
}

export async function updateSetting(key: string, value: string): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, value]
  );
}

// ─── Export CSV ───────────────────────────────────────────────
export async function exportExpensesCSV(): Promise<string> {
  const expenses = await getExpenses();
  const header = "التاريخ,المبلغ,الوصف,القسم,ملاحظة\n";
  const rows = expenses
    .map(
      (e) =>
        `${e.date},${e.amount},"${e.description}","${e.category?.name ?? ""}","${e.note ?? ""}"`
    )
    .join("\n");
  return header + rows;
}

// ─── Smart categorization: get AI history hint ────────────────
export async function getCategoryHint(description: string): Promise<number | null> {
  const clean = description.trim().split(" ").slice(0, 3).join(" ");
  const row = await db.getFirstAsync<{ category_id: number }>(
    `SELECT category_id FROM expenses
     WHERE description LIKE ? AND category_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [`%${clean}%`]
  );
  return row?.category_id ?? null;
}
