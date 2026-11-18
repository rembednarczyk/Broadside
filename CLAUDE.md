# Broadside: zasady pracy w repozytorium

Gra morska w przeglądarce i na Androidzie (Babylon.js + TypeScript + Vite, APK przez Capacitor), inspirowana
Overboard! (Psygnosis 1997), rozwinięta w sandbox walki statków i fortów z pogodą wpływającą na żeglowanie.

## Start sesji
Sesje w chmurze nie mają pamięci: trwałe jest tylko to, co wypchnięte. Na starcie przeczytaj:
- `docs/backlog.md` (sekcja „Następne”): kolejność prac i kamienie milowe;
- `docs/decyzje.md`: stałe decyzje (użytkownika i orkiestratora za użytkownika);
- `docs/adr/`: decyzje architektoniczne.

## Jak pisać do właściciela
- Po polsku, wprost i konkretnie, bez patosu i marketingowych frazesów, bez myślników em, bez antytezy kontrastowej.
- Raporty i e-mail: co zrobione, co sprawdzone, czego nie sprawdzono (np. na prawdziwym telefonie).

## Architektura (ADR-0001)
| Pakiet | Odpowiedzialność |
|---|---|
| `packages/core` | czyste TS: matematyka, fale, aerodynamika, kształt kadłuba, dane klas, komendy, zdarzenia |
| `packages/sim` | ECS (miniplex), fizyka, systemy w `createSystems()`, AI, świat |
| `packages/engine` | Babylon za jednym modułem `engine/src/babylon.ts`, fasada renderera z częściami |
| `packages/ui` | React + Zustand, HUD, wąskie interfejsy intencji |
| `packages/persistence` | zapis, `SAVE_SCHEMA_VERSION`, migracje |
| `packages/app` | korzeń kompozycji, `GameSession` bez przeglądarki, Capacitor |

## Reguły twarde
- `core` nie importuje niczego. `sim` tylko `core` (+ miniplex). UI nie zna `engine` ani `sim`. Pilnuje `pnpm depcheck`.
- Babylon importuje wyłącznie `packages/engine/src/babylon.ts`.
- W `core` i `sim`: bez `any`, `Math.random`, `Date.now`, `performance.now`. Losowość z `createRng`/`subRng` (ziarno), czas z kroku symulacji.
- Kolejność systemów tylko w `createSystems()`; iteracja po bytach w kolejności `id` (`sortedById`), gdy wynik zależy od kolejności.
- Plik do 500 linii, funkcja do 120 (ESLint), klasa do 20 metod (`tools/code-health`, baza tylko spada).
- Zmiana reguł symulacji zmienia złoty hash w `packages/sim/test/determinism.test.ts`; aktualizacja tylko ręcznie (`vitest -u`) z nazwą reguły w commicie.
- Jedno źródło prawdy: fale (`core/ocean`) liczy i symulacja, i shader (te same parametry jako uniformy); kadłub (`core/hull`) daje i próbki wyporu, i siatkę 3D.
- Dane (klasy statków, amunicja, forty) jako tabele w `core/src/data` (wzorzec Type Object), zachowanie w systemach.
- Teksty dla gracza tylko w katalogach i18n UI (angielski domyślny, polski w opcjach); `core` i `sim` trzymają klucze.

## Wzorce i standardy
Każde rozwiązanie opiera się na nazwanym, istniejącym wzorcu albo standardzie (GoF, „Game Programming Patterns”, ECS,
prace naukowe i branżowe dla fizyki i grafiki). Komentarz modułu i ADR podają wzorzec i źródło oraz opisują, czym się
od niego różnimy i dlaczego. Bez własnych interpretacji wzorców i bez niedopowiedzeń.

## Determinizm i generatory
Co się da, skryptujemy: generatory (kadłuby, ożaglowanie, wyspy, tekstury, dźwięki) biorą ziarno i dają ten sam wynik.
Powtarzana ręczna praca (pomiary, zrzuty, raporty) od razu dostaje skrypt w `tools/` albo audyt w `*.audit.ts`.

## Przeglądarka statku
Prywatny artefakt z żywą sceną statku gracza: https://claude.ai/artifact/LYAkDLuLzZmuniUaP1gZCV. Po zmianie widocznej
na statku gracza: `node tools/viewer/pack.mjs <katalog>` i publikacja `index.html` z tego katalogu (z plikami obok)
pod ten sam adres.

## HUD
Style w `packages/app/src/style.css`: siatka obszarów wokół wolnego środka, wymiary w jednostce `--u` (projekt 960 × 540,
na niskich ekranach 760 × 430). Po zmianie HUD: `pnpm build` i `node tools/ui/ui-audit.mjs <katalog>` (15 rozmiarów
ekranu, angielski i polski, nakładanie paneli, wyjście poza ekran, przewijane kolumny, pismo poniżej 8 px; zrzuty).

## APK
`pnpm apk` buduje tutaj podpisany APK (`Broadside.apk` w katalogu głównym, poza gitem; SDK i lustro Maven:
`tools/android/README.md`). Po zmianie widocznej w grze: zbudować i wysłać właścicielowi plik razem z aktualizacją
przeglądarki statku. CI (`android.yml`) buduje ten sam APK tym samym kluczem i numerem wersji.

## PWA i ikona
Gra instaluje się jako PWA (`public/manifest.webmanifest`, `public/sw.js`, rejestracja w `src/pwa.ts`, poza Capacitorem)
i działa offline po pierwszym uruchomieniu. Sprawdzenie: `pnpm build && node tools/pwa/pwa-check.mjs` (manifest, ikony,
service worker, start bez sieci). Ikona z generatora `node tools/icons/icon.mjs` (PWA i ikony Androida naraz).

## Definition of Done
`pnpm typecheck && pnpm lint && pnpm depcheck && pnpm test && pnpm build`. Audyty liczbowe: `pnpm run audit`.
Koszt klatki po zmianie grafiki: `node tools/perf/frame-bench.mjs "quality=<preset>&…"` (udział nieba, oceanu, statków,
cieni i post-procesów; SwiftShader, więc udziały, nie milisekundy telefonu).
Zmiana widoczna: zrzut Playwright (SwiftShader) przed/po. Commity Conventional Commits po polsku, małe zmiany,
bez identyfikatora modelu. Gałąź robocza `claude/youthful-galileo-kzhtmo`, PR tylko na prośbę użytkownika.
