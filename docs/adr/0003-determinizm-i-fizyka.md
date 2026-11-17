# ADR-0003: Determinizm i fizyka statków

## Status
Przyjęty (16.11, orkiestrator).

## Kontekst
Testy całych bitew bez przeglądarki, powtarzalne zapisy i odtwarzanie wymagają deterministycznej symulacji. Havok (WASM)
w testach dokłada zależność i nie gwarantuje wyniku niezależnego od budowy.

## Wzorzec
- Stały krok 60 Hz i całkowanie półjawne Eulera (G. Fiedler, „Fix Your Timestep!”, „Integration Basics”).
- Bryła sztywna 6DOF z diagonalnym tensorem bezwładności; promienie bezwładności statków wg ITTC 7.5-02-07-04 (przechył 0,4 B, przegłębienie i myszkowanie 0,25 L).
- Wypór i opór z próbek objętości kadłuba (J. Kerner, „Water interaction model for boats in video games”, Gamasutra 2015), opór falowy rosnący z liczbą Froude'a powyżej 0,3.
- Żagle jako profil: biegunowe współczynniki siły nośnej i oporu (C. A. Marchaj, „Sail Performance”), trym z przeszukania kątów (deterministyczne, bez solvera).
- Ster jako płat z przeciągnięciem; sternik PID z ograniczeniem całki (autopilot okrętowy).
- RNG mulberry32 z ziarnem, osobne strumienie (`subRng`).

## Decyzja
Cała fizyka w `sim`, bez silnika fizycznego. Złoty hash przebiegu w `packages/sim/test/determinism.test.ts`.

## Konsekwencje
Masa statku wynika z objętości kadłuba pod linią wodną, więc statek pływa na zadanym zanurzeniu z definicji. Koszt: ok. 0,12 ms na fregatę na krok (desktop); LOD fizyki w backlogu.
