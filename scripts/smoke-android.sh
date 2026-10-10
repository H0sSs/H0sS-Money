#!/usr/bin/env bash
set -euo pipefail
mkdir -p smoke
adb install -r output/H0sS-Money-1.1.0-universal.apk
adb logcat -c
adb shell am start -W -n com.hossmoney.app/.MainActivity
sleep 15
# Dismiss first-launch notification explanation; a cancelled dialog leaves permissions untouched.
adb shell input keyevent 4
sleep 3
adb shell screencap -p /sdcard/home.png
adb pull /sdcard/home.png smoke/home.png
adb shell uiautomator dump /sdcard/window.xml
adb pull /sdcard/window.xml smoke/window.xml
adb logcat -d > smoke/logcat.txt
adb shell pidof com.hossmoney.app > smoke/pid.txt
if grep -E 'FATAL EXCEPTION|ReactNativeJS.*(TypeError|ReferenceError|Invariant Violation|Error:)' smoke/logcat.txt; then
  echo 'Startup error detected'; exit 1
fi
if ! grep -q 'مصروفك تحت السيطرة' smoke/window.xml; then
  echo 'Home screen did not become ready'; exit 1
fi
