#!/usr/bin/env bash
set -euo pipefail
mkdir -p smoke
APK=$(find output -maxdepth 1 -name "H0sS-Money-*-universal.apk" -print -quit)
[ -n "$APK" ] || { echo "Universal APK missing"; exit 1; }
adb install -r "$APK"
bash scripts/build-export-receiver.sh
adb logcat -c
adb shell screenrecord --time-limit 8 --bit-rate 2000000 /sdcard/startup.mp4 >smoke/startup-recording.txt 2>&1 &
RECORD_PID=$!
sleep 0.5
adb shell am start -W -n com.hossmoney.app/.MainActivity
STATUS=0
python3 scripts/smoke-android.py || STATUS=$?
adb shell screencap -p /sdcard/end.png
adb pull /sdcard/end.png smoke/end.png
adb shell uiautomator dump /sdcard/end.xml
adb pull /sdcard/end.xml smoke/end.xml
wait "$RECORD_PID" || true
if adb shell test -s /sdcard/startup.mp4; then
  adb pull /sdcard/startup.mp4 smoke/startup.mp4
  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -hide_banner -loglevel error -y -i smoke/startup.mp4 -vf fps=5 -frames:v 15 smoke/startup-frame-%02d.png || true
  fi
fi
adb logcat -d > smoke/logcat.txt
adb shell pidof com.hossmoney.app > smoke/pid.txt
if grep -E 'FATAL EXCEPTION|ReactNativeJS.*(TypeError|ReferenceError|Invariant Violation|Error:)' smoke/logcat.txt; then
  echo 'Startup error detected'; exit 1
fi
if [ "$STATUS" -eq 0 ]; then
  adb pull /sdcard/Android/data/com.hossmoney.exportqa/files/report.pdf smoke/report.pdf
  adb pull /sdcard/Android/data/com.hossmoney.exportqa/files/stats.png smoke/export-stats.png
  python3 scripts/check-native-exports.py
fi
exit "$STATUS"
