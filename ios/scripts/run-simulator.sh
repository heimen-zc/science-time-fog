#!/bin/bash
set -euo pipefail
TIMEFOG_IOS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMEFOG_BUILD_DIR="${TIMEFOG_DERIVED_DATA:-${TMPDIR:-/tmp}/TimeFogDerivedData}"
if [[ $# -gt 0 ]]; then
    TIMEFOG_SIMULATOR="$1"
else
    TIMEFOG_SIMULATOR="$(xcrun simctl list devices available -j | /usr/bin/python3 -c 'import sys,json;d=json.load(sys.stdin);phones=[v for group in d["devices"].values() for v in group if v["name"].startswith("iPhone")];booted=[p for p in phones if p["state"]=="Booted"];print((booted or phones)[-1]["udid"])')"
fi
printf '正在准备 iPhone 模拟器…\n'
xcrun simctl boot "$TIMEFOG_SIMULATOR" 2>/dev/null || true
xcrun simctl bootstatus "$TIMEFOG_SIMULATOR" -b
printf '正在构建时间迷雾…\n'
xcodebuild -quiet -project "$TIMEFOG_IOS_ROOT/TimeFog/TimeFog.xcodeproj" -scheme TimeFog -configuration Debug -destination "platform=iOS Simulator,id=$TIMEFOG_SIMULATOR" -derivedDataPath "$TIMEFOG_BUILD_DIR" CODE_SIGNING_ALLOWED=NO build
xcrun simctl install "$TIMEFOG_SIMULATOR" "$TIMEFOG_BUILD_DIR/Build/Products/Debug-iphonesimulator/TimeFog.app"
open -a Simulator --args -CurrentDeviceUDID "$TIMEFOG_SIMULATOR"
xcrun simctl launch "$TIMEFOG_SIMULATOR" org.heimenzc.timefog
printf '时间迷雾已打开，可以开始历险。\n'
