#!/usr/bin/env bash
set -euo pipefail
mkdir -p smoke
adb install -r output/H0sS-Money-1.2.0-universal.apk
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
