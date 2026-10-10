# Release review checklist

## Automated
- TypeScript strict compilation.
- Expo dependency/config validation.
- Android JS/Hermes export.
- Local Cairo dates including DST, leap February, year transition.
- Arabic number validation, CSV quoting/formula safety, HTML escaping.
- AI result validation and unknown category handling.
- SQLite migrations, calendar monthly statistics, merge collisions, repeat import, replace rollback, secret filtering.
- Both release APK builds, signature validation, non-debuggable check, size and SHA-256 evidence.
- Android 35 emulator cold launch, home screen readiness, process survives, no fatal/JS errors.

## Device acceptance (requires user credentials and hardware)
1. Export an existing backup before installation; check signing compatibility without uninstalling.
2. Add/edit/delete Arabic expenses and dates; confirm all summaries refresh and category deletion unassigns expenses.
3. Compare calendar month target and notification totals; verify rolling 30-day chart stays independent.
4. Import v1 and v2, merge twice, test invalid JSON, restore after restart; check logo and theme.
5. For each provider, test key success/failure and quota handling. For Z.ai, test both Gemini and OpenAI speech combinations.
6. Record on physical Android, confirm amount/category/note editing; disable network during analysis and retry.
7. Enable fingerprint, cold launch, cancel/retry, background over 15s, return, and disable/re-enable.
8. Google consent, token renewal, backup/list/restore/delete/logout; ensure each failure is actionable.
9. Enable/disable notifications and verify 80/100% alerts once per day.
10. Export CSV with quotes/newlines and PDF with Arabic category names; share the full image.
11. Check dark/light modes and keyboard with small-screen and large-font accessibility settings.
12. Check both APK variants on compatible hardware and measure installed size.
