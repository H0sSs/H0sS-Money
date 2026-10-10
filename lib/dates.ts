export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("التاريخ يجب أن يكون YYYY-MM-DD");
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  if (localDate(date) !== value) throw new Error("التاريخ غير صالح");
  return date;
}

export function monthRange(value = localDate()) {
  const date = parseDate(value);
  return {
    start: localDate(new Date(date.getFullYear(), date.getMonth(), 1, 12)),
    end: localDate(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)),
  };
}

export function shiftDate(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return localDate(date);
}
