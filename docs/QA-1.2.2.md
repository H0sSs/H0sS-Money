# 1.2.2 — Tajawal and consistent startup

- Tajawal Regular/Medium/Bold from Google Fonts, bundled under OFL. Arabic letters and Arabic/Latin digits verified in all three weights.
- Shared Text/TextInput components cover all app screens. Nested text preserves inherited weight; medium and bold use actual font files, without synthetic bold. The exported PDF embeds the same Regular/Bold faces.
- Native splash, React startup/loading/error and lock gate use the same navy background. Transparent logo is centered and fits inside the Android safe icon circle (radius 146.5 px; allowed 170.7 px on a 512 px canvas). No colored logo panel or outer circle is rendered during loading.
- Native splash is hidden only after the first ready view has laid out. Stored theme is loaded into the initial ThemeProvider and query cache before revealing the interface.
- TypeScript, 19 tests, 18/18 Expo Doctor checks and Android Hermes export pass locally. Expo prebuild produces matching day/night splash colors.
- Native APK/Android 15/16 checks run on GitHub after push. Cold-start video/frame capture is included when the emulator supports recording. Native biometric behavior still requires a device with enrolled biometrics.
- Speech provider, transcription and spoken-summary logic are unchanged.
