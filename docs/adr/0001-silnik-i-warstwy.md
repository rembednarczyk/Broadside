# ADR-0001: Silnik, warstwy i APK

## Status
Przyjęty (16.11, orkiestrator).

## Kontekst
Gra ma mieć grafikę w stronę AAA, rozbudowaną fizykę i finalnie plik `.apk`. Rozważane: Babylon.js (web), Babylon Native, three.js.

## Wzorzec
Architektura heksagonalna (porty i adaptery, A. Cockburn), warstwy z zależnościami do wewnątrz (Clean Architecture),
korzeń kompozycji (M. Seemann). Pakowanie gry webowej w WebView: Capacitor, jak w SpinalTap (ADR-0079) i podrcr.

## Decyzja
- Babylon.js 9 na WebGL2, TypeScript strict, Vite, pnpm workspaces; APK przez Capacitor 8.
- Babylon Native odrzucony: wymaga NDK i C++, nie obsługuje całego zestawu post-processów i `NodeMaterial`, a pomiar
  SpinalTap pokazał, że na telefonie ogranicza wypełnianie pikseli, czego natywny silnik nie zmienia.
- three.js odrzucony: Babylon daje w standardzie cienie kaskadowe, SSAO2, SSR, bloom, cząstki GPU, IBL, a układ pakietów
  i reguły depcruise SpinalTap przenoszą się bez zmian.
- Pakiety i reguły jak w `CLAUDE.md`; reguły egzekwuje `dependency-cruiser.config.cjs`.

## Konsekwencje
Logika gry działa w Vitest bez przeglądarki. Koszt WebGL po stronie procesora w WebView zostaje: budżet wywołań rysowania pilnujemy testem.
