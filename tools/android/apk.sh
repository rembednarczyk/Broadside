#!/usr/bin/env bash
# Signed release APK built here, the same as the CI job (.github/workflows/android.yml): the web build
# copied into the Capacitor project and assembled by Gradle, signed with the committed key
# (packages/app/android/app/broadside.keystore). The version code is 1000 + the number of commits, as
# in CI, so each new build, from here or from CI, installs over the last one on the phone.
# Output: Broadside.apk in the repository root (outside git).
# Needs JDK 17+ and the Android SDK in $ANDROID_HOME or /root/android-sdk (see tools/android/README.md).
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-/root/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
[ -d "$ANDROID_HOME/platforms" ] || { echo "No Android SDK in $ANDROID_HOME (tools/android/README.md)"; exit 1; }
cd "$root"
pnpm build
(cd packages/app && pnpm exec cap sync android)
export VERSION_CODE="$((1000 + $(git rev-list --count HEAD)))"
export VERSION_NAME="0.1.0-$(git rev-parse --short=7 HEAD)"
(cd packages/app/android && chmod +x gradlew && ./gradlew --no-daemon -q -I "$root/tools/android/maven-mirror.gradle" assembleRelease)
cp packages/app/android/app/build/outputs/apk/release/app-release.apk "$root/Broadside.apk"
echo "Broadside.apk $VERSION_NAME (code $VERSION_CODE), $(du -h "$root/Broadside.apk" | cut -f1)"
