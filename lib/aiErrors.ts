// HTTP 429 does not establish that the daily quota was exhausted.
export function quotaMessage(body: any, retryAfter?: string | null): string {
  const error = body?.error ?? {};
  const details = Array.isArray(error.details) ? error.details : [];
  const violations = details.flatMap((d: any) => Array.isArray(d.violations) ? d.violations : []);
  const ids = violations.map((v: any) => String(v.quotaId ?? "")).join(" ");
  const retry = details.find((d: any) => String(d["@type"]).endsWith("RetryInfo"))?.retryDelay;
  const seconds = Number.parseFloat(retry ?? retryAfter ?? "");
  const wait = Number.isFinite(seconds) && seconds > 0 ? ` انتظر ${Math.ceil(seconds)} ثانية قبل إعادة المحاولة.` : "";
  if (error.code === "insufficient_quota" || error.type === "insufficient_quota") return "رصيد المزوّد أو الحصة المتاحة غير كافٍ؛ راجع حسابك. لم يُحفظ أي مصروف.";
  if (violations.some((v: any) => String(v.quotaValue) === "0")) return "حصة هذا النموذج صفر في مشروعك؛ راجع إتاحته وحدوده في AI Studio. لم يُحفظ أي مصروف.";
  if (/PerDay/i.test(ids)) return "وصل مشروعك إلى حد اليوم لهذا النموذج؛ راجع الحصة الفعلية في AI Studio. لم يُحفظ أي مصروف.";
  if (/PerMinute/i.test(ids)) return `وصلت إلى حد الطلبات أو الرموز في الدقيقة؛ هذا لا يعني انتهاء حصة اليوم.${wait} لم يُحفظ أي مصروف.`;
  return `المزوّد قيّد الطلب مؤقتًا أو بسبب الحصة؛ لا يمكن تأكيد انتهاء حد اليوم من هذا الرد.${wait} راجع حدود النموذج في حسابك. لم يُحفظ أي مصروف.`;
}

// Show actionable errors without echoing provider responses or credentials.
export function apiErrorMessage(status: number, body: any, retryAfter?: string | null): string {
  if (status === 429) return quotaMessage(body, retryAfter);
  const message = String(body?.error?.message ?? "");
  const details = JSON.stringify(body?.error?.details ?? []);
  if (status === 401 || status === 403 || (status === 400 && /API_KEY_INVALID|API key not valid|invalid api key/i.test(message + details))) {
    return "المفتاح غير صالح أو غير مسموح لهذا النموذج؛ راجعه في إعدادات الذكاء الاصطناعي. لم يُحفظ شيء.";
  }
  if (status === 404) return "النموذج غير متاح لحسابك؛ اختر نموذجًا متاحًا من الإعدادات. لم يُحفظ شيء.";
  if (status === 400 && /schema|too many states|constraint/i.test(message)) {
    return "رفض النموذج إعدادات التحليل؛ حدّث التطبيق أو اختر نموذجًا آخر. لم يُحفظ شيء.";
  }
  if (status === 400) return "رفضت الخدمة بيانات الطلب؛ جرّب تسجيلًا قصيرًا وواضحًا وراجع النموذج المختار. لم يُحفظ شيء.";
  if (status >= 500) return "خدمة الذكاء الاصطناعي غير متاحة مؤقتًا؛ حاول لاحقًا. لم يُحفظ شيء.";
  return `فشلت الخدمة (${status})؛ حاول مجددًا. لم يُحفظ شيء.`;
}
