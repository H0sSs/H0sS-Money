#!/usr/bin/env bash
set -euo pipefail
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:?Android SDK required}}"
TOOLS="$SDK_ROOT/build-tools/36.0.0"
PLATFORM="$SDK_ROOT/platforms/android-36/android.jar"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/classes" "$WORK/dex"
if [ ! -f "$PLATFORM" ] || [ ! -x "$TOOLS/d8" ]; then sdkmanager 'platforms;android-36' 'build-tools;36.0.0' >/dev/null; fi
javac -source 8 -target 8 -classpath "$PLATFORM" -d "$WORK/classes" scripts/export-receiver/ReceiverActivity.java
jar cf "$WORK/classes.jar" -C "$WORK/classes" .
"$TOOLS/d8" --lib "$PLATFORM" --min-api 24 --output "$WORK/dex" "$WORK/classes.jar"
"$TOOLS/aapt" package -f -M scripts/export-receiver/AndroidManifest.xml -I "$PLATFORM" -F "$WORK/receiver.apk"
(cd "$WORK/dex" && zip -q "$WORK/receiver.apk" classes.dex)
keytool -genkeypair -keystore "$WORK/qa.jks" -alias qa -storepass android -keypass android -keyalg RSA -validity 1 -dname "CN=Export QA" >/dev/null 2>&1
"$TOOLS/apksigner" sign --ks "$WORK/qa.jks" --ks-pass pass:android --key-pass pass:android --out "$WORK/signed.apk" "$WORK/receiver.apk"
adb install -r "$WORK/signed.apk"
