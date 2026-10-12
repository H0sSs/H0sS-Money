# 1.2.3 — PDF assets, account linking, startup and security

## Implemented

- Android release asset names (e.g. `assets_images_icon`) are copied to a cache file before Base64 reading. `copyAsync` supports native raw/drawable resource names; legacy Base64 read does not. Default logo and both Tajawal faces use this path.
- Android Google Drive connection uses the native Google account picker without asking the user to create/enter Web Client ID. Cancellation is quiet, duplicate connects are disabled, account email is shown, and developer registration errors are explained without exposing tokens. Only app-owned/selected Drive files are requested via `drive.file`. [Owner setup](GOOGLE-DRIVE-SETUP.md) remains required externally.
- Transparent legacy Android launcher and adaptive foreground remove the opaque logo panel used by some device launchers; app/window/native splash backgrounds remain navy. Native startup evidence includes Android 10, 15 and 16. Device-specific MIUI launch behavior still requires an actual Xiaomi test.
- Render errors at startup reveal the error fallback instead of indefinitely retaining the native splash. Database retry/data preservation behavior is retained.
- Android automatic cloud backup/device transfer is explicitly excluded for root/files/databases/shared preferences/external files. Manual JSON export and Drive backups remain available. Cleartext HTTP is disabled in the release manifest.
- CSV formula protection now handles leading whitespace/newlines. Oversized backup JSON is rejected before parsing (50 MB limit). Drive file identifiers are URL-encoded and backup lists restrict JSON MIME type. The account email is excluded from exported backups.
- A new private RSA-3072 certificate replaces the public development certificate for distributed APKs. Private key/password are saved only in the owner's private signing kit, never in source. [Public certificate](SIGNING-CERTIFICATE.txt). Switching certificates requires export → uninstall old app → install private-signed app → import.

## Validation

Local: TypeScript, 23 automated tests, 18/18 Expo Doctor, native prebuild and matching private-signing/backup-policy configuration pass. Native libraries were built in run 38278402182. Actual export tests found an orphan footer page and two test-harness compatibility issues (Android 10 offscreen bounds and Android 16 Type3 fonts). The report now uses explicit A4 media and a normal-flow footer. Run 38284985369 validates the corrected Hermes bundle and actual PDF/image sharing on Android 10/15/16; all four jobs pass. Both APK containers retain all 1,479/1,545 native/resource entries byte-for-byte; only matching-version Hermes bytecode and signatures are replaced. Full Gradle compilation is not repeated for this JS-only fix.

Native smoke tests install a separate QA receiver (not bundled in the app), export/share an actual PDF and statistics PNG, inspect embedded PDF fonts/logo and expense rows, and check the PNG size. Dummy single/multi-item expenses, income, finance pages, settings, stored theme and restart persistence are exercised. No real Google account/API keys or biometric enrollment are used.

## Security limits

- Dependency audit on 2026-10-12 still reports 28 affected parent entries rooted in three unpatched build-tool packages: braces, node-forge and sprintf-js. These are documented in [dependency review](DEPENDENCY-REVIEW.md); no claim of a zero-vulnerability audit.
- Financial SQLite data is protected by the Android app sandbox and optional application lock, but is not encrypted independently of the OS. Exported JSON is unencrypted and should be stored privately.
- This is a focused source/configuration/dependency review and tested regression fix, not an exhaustive penetration-test certification. Google Cloud OAuth activation and real Xiaomi/biometric behavior remain external checks.

## Verified final files

- Runtime/test source: `7c42168c1a977304022afc166c16815cddd118f8`; main fix commit `dd25efa60b8737617a39cf7e869a8b5ce6fcbe23` has the exact same Git tree.
- [Native base build](https://github.com/H0sSs/H0sS-Money/actions/runs/38278402182); [successful final regression run](https://github.com/H0sSs/H0sS-Money/actions/runs/38284985369).
- Each API produced a one-page report with all three expense rows, Tajawal Regular/Bold and logo. A4 paper, footer and Arabic layout were reviewed visually; Android 16 uses embedded Type3 glyph programs instead of embedded TTF font streams. Full statistics PNG is 1080 × 3490 pixels.
- Native account-link UI contains no Android Client ID field; mocked sign-in/cancellation/cold sign-out tests pass. Real account upload/restore is still not tested or activated by this review.
- ARM64 private APK: 31,815,665 bytes; SHA-256 `d1b4ed157b1509d46b2c302734f5190af0ea051f02cacd06c9cd3a3ef08322ed`.
- Universal private APK: 88,947,706 bytes; SHA-256 `b27de742fbf16b433d4f200bd87ca8b5634130f7f3c914513526f777b034faa1`.
- Both final files pass apksigner verification (private RSA-3072 certificate), package/version/non-debuggable checks and zipalign 16 KB checks.
- Public release publication requires owner GitHub signing secrets. The prepared publisher reuses the verified artifacts, signs and uploads without recompiling native libraries.

![Actual Android 10 cold start](images/startup.png)

[Actual sample PDF from the Android 15 test](report-sample-1.2.3.pdf) (synthetic data).
