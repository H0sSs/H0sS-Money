# Google Drive — developer setup

Android users press **الربط بحساب Google**, choose an existing device account and grant `drive.file`. No Web Client ID is required in the Android UI: this app obtains a native access token, not an ID token/server authorization code. The existing Google Sign-In SDK still requires an OAuth Android application registration.

Owner configuration, once per release certificate:

1. Open https://console.cloud.google.com/ and select a project owned by you. Enable **Google Drive API**.
2. Configure Google Auth Platform branding, audience and data access. Request only `https://www.googleapis.com/auth/drive.file` (files created/selected through this app). If the audience is Testing, add the phone account as a test user; use a published audience for general users.
3. Create **Android** OAuth credentials for package `com.hossmoney.app` with SHA-1 `90:A7:D1:02:D0:7C:0E:36:2F:39:A8:98:B3:3B:B6:46:8C:8C:16:17` (private certificate). These credentials are project configuration, not an API key users enter.
4. Install the APK signed with that private certificate, choose the account, consent, upload a dummy JSON backup, list it and restore it. Google Play Services and Internet are required.

The project does not currently have proof that this OAuth registration is active. Do not claim live account linking/upload/restore was tested until step 4 passes. No Google credentials or financial data are used in emulator tests. Local JSON export/share remains available, including sharing to the installed Drive app.

References: https://react-native-google-signin.github.io/docs/original and https://developers.google.com/identity/protocols/oauth2/native-app

## Private release publication without recompilation

Configure the four signing secrets from your private signing kit at https://github.com/H0sSs/H0sS-Money/settings/secrets/actions, then run **Publish private-signed 1.2.3 without rebuilding** from Actions. The workflow reuses the verified 1.2.3 APK artifacts, verifies their hashes/source/native checks, signs them with the private certificate, checks package/version/alignment and publishes a complete release. It refuses publication with missing secrets or the old public development certificate. The current GitHub connection cannot manage repository Secrets; these must be configured by the owner.
