# 1.2.2 — Tajawal and consistent startup

- Tajawal Regular/Medium/Bold from Google Fonts, bundled under OFL. Arabic letters and Arabic/Latin digits verified in all three weights.
- Shared Text/TextInput components cover all app screens. Nested text preserves inherited weight; medium and bold use actual font files, without synthetic bold. The exported PDF embeds the same Regular/Bold faces.
- Native splash, React startup/loading/error and lock gate use the same navy background. Transparent logo is centered and fits inside the Android safe icon circle (radius 146.5 px; allowed 170.7 px on a 512 px canvas). No colored logo panel or outer circle is rendered during loading.
- Native splash is hidden only after the first ready view has laid out. Stored theme is loaded into the initial ThemeProvider and query cache before revealing the interface.
- TypeScript, 19 tests, 18/18 Expo Doctor checks and Android Hermes export pass locally. Expo prebuild produces matching day/night splash colors.
- Both APK builds and native Android 15 (API 35) / Android 16 (API 36) checks passed. Cold-start videos were captured on both emulators and reviewed: the complete wallet logo appears on one navy background. Dark/light screens and the stored light theme after restart were reviewed visually. Biometric behavior still requires a device with enrolled biometrics; Android 7–14 and physical-device startup were not exercised in this run.
- Speech provider, transcription and spoken-summary logic are unchanged.

## Source and reproducibility

- Runtime source: `ab30a8dfd44e7fdf17b3b3f5e5fe9ed9820bc2c3`.
- [Build and native checks](https://github.com/H0sSs/H0sS-Money/actions/runs/38263271725).
- [Verified APK publication](https://github.com/H0sSs/H0sS-Money/actions/runs/38263586534).
- APK hashes, sizes, package/version and signing certificate are checked again before publication. Both architecture variants retain the same features.

## Published files

| Variant | Bytes | SHA-256 |
| --- | ---: | --- |
| ARM64 | 31,696,485 | `dd9c4c3926ef971599dd1be4cbc4d4438ba75c8fa99f343b0daa048518e2d24a` |
| Universal | 88,804,782 | `fce8365f73fa5d4f1c44827b4d54acb658538d20e932b8d062bbc1fbb63746d3` |

[Public release](https://github.com/H0sSs/H0sS-Money/releases/tag/v1.2.2) includes the APKs, checksum file, report and original emulator screenshots/videos. The signing certificate matches 1.2.1. ARM64 native compilation took 7 minutes; universal native compilation took 19 minutes 25 seconds with restored Gradle/native caches. Cache use does not guarantee a fixed build duration.

![Actual Android 15 cold-start frame](images/startup.png)
