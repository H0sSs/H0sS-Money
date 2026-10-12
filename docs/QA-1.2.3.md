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

Local: TypeScript, 21 automated tests, 18/18 Expo Doctor, native prebuild and matching private-signing/backup-policy configuration pass. Android export/build/native checks pending GitHub run.

Native smoke tests install a separate QA receiver (not bundled in the app), export/share an actual PDF and statistics PNG, inspect embedded PDF fonts/logo and expense rows, and check the PNG size. Dummy single/multi-item expenses, income, finance pages, settings, stored theme and restart persistence are exercised. No real Google account/API keys or biometric enrollment are used.

## Security limits

- Dependency audit on 2026-10-12 still reports 28 affected parent entries rooted in three unpatched build-tool packages: braces, node-forge and sprintf-js. These are documented in [dependency review](DEPENDENCY-REVIEW.md); no claim of a zero-vulnerability audit.
- Financial SQLite data is protected by the Android app sandbox and optional application lock, but is not encrypted independently of the OS. Exported JSON is unencrypted and should be stored privately.
- This is a focused source/configuration/dependency review and tested regression fix, not an exhaustive penetration-test certification. Google Cloud OAuth activation and real Xiaomi/biometric behavior remain external checks.
