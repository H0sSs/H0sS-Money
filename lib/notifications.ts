import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { db } from "./db";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let androidChannelReady = false;
async function ensureAndroidChannel() {
  if (Platform.OS !== "android" || androidChannelReady) return;
  try {
    await Notifications.setNotificationChannelAsync("budget-alerts", {
      name: "تنبيهات الميزانية",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#F0B429",
    });
    androidChannelReady = true;
  } catch {}
}

let initialized = false;
export async function initNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await ensureAndroidChannel();
}

export async function getNotificationsEnabled(): Promise<boolean> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      ["notificationsEnabled"]
    );
    return row?.value === "true";
  } catch {
    return false;
  }
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ["notificationsEnabled", enabled ? "true" : "false"]
  );
}

export async function hasAskedForPermission(): Promise<boolean> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      ["notificationsAsked"]
    );
    return row?.value === "true";
  } catch {
    return false;
  }
}

export async function markPermissionAsked(): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ["notificationsAsked", "true"]
  );
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await ensureAndroidChannel();
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    return status === "granted";
  } catch {
    return false;
  }
}

// Backwards-compatible alias kept after rebase
export const requestPermissions = requestNotificationPermission;

function kindFromKey(key: string): string {
  if (key.startsWith("goal-")) return "goal";
  if (key.startsWith("cat-")) return "category";
  if (key.startsWith("unusual-")) return "unusual";
  if (key.startsWith("weekly-")) return "weekly";
  return "info";
}

async function send(title: string, body: string, key: string) {
  try {
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { key },
        ...(Platform.OS === "android" ? { channelId: "budget-alerts" } : {}),
      },
      trigger: null,
    });
  } catch {}
  try {
    await db.runAsync(
      "INSERT INTO notification_log (title, body, key, kind) VALUES (?, ?, ?, ?)",
      [title, body, key, kindFromKey(key)]
    );
  } catch {}
}

export interface NotificationLogEntry {
  id: number;
  title: string;
  body: string;
  key: string;
  kind: string | null;
  created_at: string;
}

export async function getNotificationLog(limit = 50): Promise<NotificationLogEntry[]> {
  try {
    return await db.getAllAsync<NotificationLogEntry>(
      "SELECT id, title, body, key, kind, created_at FROM notification_log ORDER BY id DESC LIMIT ?",
      [limit]
    );
  } catch {
    return [];
  }
}

export async function clearNotificationLog(): Promise<void> {
  try {
    await db.runAsync("DELETE FROM notification_log");
  } catch {}
}

// Throttle: don't send the same alert key twice on the same day
async function shouldSend(key: string): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const settingKey = `alertSent:${key}:${today}`;
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [settingKey]
  );
  if (row?.value === "1") return false;
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [settingKey, "1"]
  );
  return true;
}

function monthRange(date: string): { start: string; end: string } {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1).toISOString().split("T")[0];
  const end = new Date(y, m + 1, 0).toISOString().split("T")[0];
  return { start, end };
}

/**
 * Check budgets after a new expense and send local notifications when needed.
 * Triggers:
 *   1. Monthly goal reached 80% / 100%
 *   2. Category budget reached 100% (and 80%)
 *   3. Today's spending much higher than recent daily average (≥ 2× and ≥ 200)
 */
export async function checkAndNotify(expense: {
  amount: number;
  date: string;
  category_id: number | null;
}): Promise<void> {
  try {
    if (!(await getNotificationsEnabled())) return;
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== "granted") return;

    const currencyRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      ["currency"]
    );
    const currency = currencyRow?.value ?? "EGP";

    const { start, end } = monthRange(expense.date);

    // 1. Monthly goal
    const goalRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      ["monthlyGoal"]
    );
    const goal = goalRow?.value ? parseFloat(goalRow.value) : 0;
    if (goal > 0) {
      const sumRow = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date >= ? AND date <= ?",
        [start, end]
      );
      const total = sumRow?.total ?? 0;
      const pct = total / goal;
      if (pct >= 1 && (await shouldSend("goal-100"))) {
        await send(
          "تجاوزت الهدف الشهري ⚠️",
          `إنفاق الشهر ${total.toFixed(0)} ${currency} من أصل ${goal.toFixed(0)} ${currency}`,
          "goal-100"
        );
      } else if (pct >= 0.8 && pct < 1 && (await shouldSend("goal-80"))) {
        await send(
          "اقتربت من الهدف الشهري",
          `وصلت ${(pct * 100).toFixed(0)}% (${total.toFixed(0)} / ${goal.toFixed(0)} ${currency})`,
          "goal-80"
        );
      }
    }

    // 2. Category budget
    if (expense.category_id != null) {
      const cat = await db.getFirstAsync<{ name: string; budget: number | null }>(
        "SELECT name, budget FROM categories WHERE id = ?",
        [expense.category_id]
      );
      if (cat?.budget && cat.budget > 0) {
        const catSum = await db.getFirstAsync<{ total: number }>(
          "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE category_id = ? AND date >= ? AND date <= ?",
          [expense.category_id, start, end]
        );
        const total = catSum?.total ?? 0;
        const pct = total / cat.budget;
        if (pct >= 1 && (await shouldSend(`cat-${expense.category_id}-100`))) {
          await send(
            `تجاوزت ميزانية ${cat.name} ⚠️`,
            `صرفت ${total.toFixed(0)} ${currency} من أصل ${cat.budget.toFixed(0)} ${currency}`,
            `cat-${expense.category_id}-100`
          );
        } else if (pct >= 0.8 && pct < 1 && (await shouldSend(`cat-${expense.category_id}-80`))) {
          await send(
            `اقتربت من ميزانية ${cat.name}`,
            `وصلت ${(pct * 100).toFixed(0)}% (${total.toFixed(0)} / ${cat.budget.toFixed(0)} ${currency})`,
            `cat-${expense.category_id}-80`
          );
        }
      }
    }

    // 3. Unusual daily spending: today vs avg of previous 14 days
    const todayRow = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date = ?",
      [expense.date]
    );
    const todayTotal = todayRow?.total ?? 0;

    const since = new Date(expense.date);
    since.setDate(since.getDate() - 14);
    const sinceStr = since.toISOString().split("T")[0];
    const dayBefore = new Date(expense.date);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayBeforeStr = dayBefore.toISOString().split("T")[0];

    const avgRow = await db.getFirstAsync<{ avg: number; days: number }>(
      `SELECT AVG(daily) as avg, COUNT(*) as days FROM (
         SELECT SUM(amount) as daily FROM expenses
         WHERE date >= ? AND date <= ?
         GROUP BY date
       )`,
      [sinceStr, dayBeforeStr]
    );
    const avg = avgRow?.avg ?? 0;
    const days = avgRow?.days ?? 0;
    if (days >= 5 && avg > 0 && todayTotal >= avg * 2 && todayTotal >= 200) {
      if (await shouldSend("unusual-day")) {
        await send(
          "إنفاق اليوم مرتفع 📈",
          `إنفاقك اليوم ${todayTotal.toFixed(0)} ${currency} وهو أعلى من متوسطك (${avg.toFixed(0)} ${currency})`,
          "unusual-day"
        );
      }
    }
  } catch {}
}
