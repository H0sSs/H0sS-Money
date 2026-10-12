#!/usr/bin/env bash
set -euo pipefail
mkdir -p smoke
APK=$(find output -maxdepth 1 -name "H0sS-Money-*-universal.apk" -print -quit)
[ -n "$APK" ] || { echo "Universal APK missing"; exit 1; }
adb install -r "$APK"
adb logcat -c
adb shell am start -W -n com.hossmoney.app/.MainActivity
STATUS=0
python3 scripts/smoke-android.py || STATUS=$?
adb shell screencap -p /sdcard/end.png
adb pull /sdcard/end.png smoke/end.png
adb shell uiautomator dump /sdcard/end.xml
adb pull /sdcard/end.xml smoke/end.xml
adb logcat -d > smoke/logcat.txt
adb shell pidof com.hossmoney.app > smoke/pid.txt
if grep -E 'FATAL EXCEPTION|ReactNativeJS.*(TypeError|ReferenceError|Invariant Violation|Error:)' smoke/logcat.txt; then
  echo 'Startup error detected'; exit 1
fi
exit "$STATUS"
