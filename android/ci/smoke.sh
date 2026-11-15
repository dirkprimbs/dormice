#!/usr/bin/env bash
# Smoke test on a running emulator: install the app, start it, open today's
# puzzle, turn a tile, go back. Fails if the home screen never appears; the
# screenshots it leaves in shots/ are for a person to look at.
set -euo pipefail
cd "$(dirname "$0")/.."

APP=io.github.dirkprimbs.dormice
mkdir -p shots

shot() { adb exec-out screencap -p > "shots/$1.png"; }
dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true; adb exec-out cat /sdcard/ui.xml > "shots/$1.xml" || true; }
# tap the middle of the first thing on screen whose text contains $1
tap_text() {
  dump tap
  python3 - "$1" <<'PY'
import re, subprocess, sys
xml = open('shots/tap.xml', encoding='utf-8', errors='replace').read()
for node in re.findall(r'<node [^>]*>', xml):
    text = ' '.join(re.findall(r'(?:text|content-desc)="([^"]*)"', node))
    if sys.argv[1] in text.replace('&apos;', "'"):
        x1, y1, x2, y2 = map(int, re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node).groups())
        subprocess.run(['adb', 'shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2)], check=True)
        sys.exit(0)
sys.exit(f'nothing on screen says "{sys.argv[1]}"')
PY
}

# Emulators on build machines are slow, and Android sometimes offers to close
# one of its own apps on top of ours. Answer "Wait" and carry on.
calm() {
  dump calm
  if grep -q "responding" shots/calm.xml; then tap_text "Wait" || true; sleep 2; fi
}

adb install -r app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am start -W -n "$APP/.MainActivity"

for i in $(seq 1 30); do
  sleep 2
  calm
  dump home
  if grep -q "Free play" shots/home.xml; then break; fi
  if [ "$i" = 30 ]; then shot 0-no-home; adb logcat -d > shots/logcat.txt; echo "the home screen never appeared"; exit 1; fi
done
shot 1-home

tap_text "garden"
sleep 4
calm
shot 2-daily
adb shell input keyevent KEYCODE_BACK   # closes the rules sheet if one is open
sleep 2
shot 3-after-back
read -r W H < <(adb shell wm size | sed -n 's/.*: \([0-9]*\)x\([0-9]*\).*/\1 \2/p' | tail -1)
adb shell input tap $((W / 2)) $((H / 2))
sleep 2
shot 4-tapped
adb shell input keyevent KEYCODE_BACK
sleep 2
adb shell input keyevent KEYCODE_BACK
sleep 2
shot 5-back-again
dump end

adb logcat -d > shots/logcat.txt
grep -iE "chromium|Dormice|AndroidRuntime" shots/logcat.txt | tail -40 || true
if grep -q "FATAL EXCEPTION" shots/logcat.txt; then echo "the app crashed"; exit 1; fi
