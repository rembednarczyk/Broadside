# APK na Androida, budowany lokalnie

`pnpm apk` buduje podpisany APK (wariant release, ten sam klucz co CI: `packages/app/android/app/broadside.keystore`)
i kładzie go jako `Broadside.apk` w katalogu głównym (poza gitem). Numer wersji: 1000 + liczba commitów, tak samo
w CI (`.github/workflows/android.yml`), więc każda nowsza wersja, z sesji albo z Actions, instaluje się na
telefonie jako aktualizacja.

Pierwszy raz w nowym środowisku trzeba zainstalować Android SDK (JDK 17+ musi już być):

```bash
mkdir -p /root/android-sdk/cmdline-tools && cd /root/android-sdk
curl -sSO https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip
unzip -q commandlinetools-linux-*_latest.zip -d cmdline-tools && mv cmdline-tools/cmdline-tools cmdline-tools/latest
yes | cmdline-tools/latest/bin/sdkmanager --licenses
cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

Maven Central nie oddaje Gradle'owi części plików z tej sieci (curl je pobiera), więc skrypt podaje Gradle'owi
`tools/android/maven-mirror.gradle` (`-I`): lustro Maven Central od Google przed innymi repozytoriami. Konfiguracja
Gradle w katalogu domowym zostaje nietknięta.

Sprawdzenie podpisu: `/root/android-sdk/build-tools/36.0.0/apksigner verify --print-certs Broadside.apk`.

Instalacja: plik na telefon, otworzyć, zezwolić na instalację z tego źródła; kolejne wersje tak samo, na istniejącą.
