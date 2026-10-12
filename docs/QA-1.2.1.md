# 1.2.1 quota, reports and splash verification

Local checks completed before pushing:
- TypeScript compilation and 17 tests pass, including migration/backup/atomic expense batches.
- Six mocked speech/analysis provider combinations pass. Gemini + Gemini makes **one** request; other combinations retain two. All three prices and categories survive.
- Quota regression checks distinguish minute, day, zero quota, insufficient credit and unknown 429. A 429 request is not retried automatically. Raw provider error text/keys are not shown.
- Expo Doctor: 18/18 checks pass. Android Hermes export succeeds.
- Expo prebuild succeeds. Generated day/night `splashscreen_background` both equal `#102D39`. The new splash bitmap has transparent corners and no opaque background panel.
- The report HTML was rendered locally using WeasyPrint with 90 expenses, a salary, 12 days and a zero previous month. All 90 rows, including the final sentinel, survive across six A4 pages. First, middle and last pages were visually reviewed for Arabic shaping, table continuation, logo and margins.

Limits of these checks:
- WeasyPrint is a local layout check; the installed app uses Android WebView through expo-print. Its exact native PDF/image output must also be checked on Android.
- A live Gemini connection request succeeded (HTTP 200). Four synthetic Arabic audio cases were then sent through the actual single-request code: three prices (20/30/100), decimals (12.5/7.25), and quantity (2 × 25 = 50) passed their amount checks. In the missing-price case, Gemini returned only the priced item and omitted the unpriced item. This is a model-output limitation; the review screen shows the transcript and allows adding omitted items. These are synthetic Piper recordings, not microphone recordings from the user's device. A separate repeat of the missing-price recording returned both items (milk 20, bread null), with imperfect transcription. This variability is why manual review remains required. No 429 was returned in these requests; this does not prove a 1500/day quota or future unlimited availability. The key was not written to repository files or public logs. Official quota documentation: https://ai.google.dev/gemini-api/docs/rate-limits . Quotas vary by model/project; 1500 RPD is not assumed.
- The image exporter captures a non-collapsible report view at its full measured height, with scroll clipping disabled. It excludes the screen controls and includes brand, period, all category rows, charts, comparison and daily average.
- Android's system splash centers an icon by design. The background fills the screen; this patch removes the second rectangular background rather than stretching the logo.
- Existing features/provider options/custom logo support are preserved. Income/net in PDF is scoped to the selected report dates; net is not an account balance.
- Native resources changed, so the strict 1.2 native-skip workflow is unsuitable. The main build uses normal Gradle/cache compilation and existing API 35/36 smoke checks.
