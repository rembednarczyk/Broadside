# ADR-0005: Progi balansu i wydajności (bramki M6)

## Status
Przyjęty (17.11, orkiestrator). Kryterium „gra skończona” z ADR-0000 odwołuje się do tych progów.

## Wzorzec
Testy akceptacyjne na metrykach symulacji bez renderera (podrcr: audyty liczbowe całego wyścigu AI; SpinalTap:
bramka wydajności na liczbie wywołań rysowania, ADR-0046 tamtego repozytorium). Audyt raportuje i jednocześnie
sprawdza próg, więc regresja balansu przerywa `pnpm run audit`.

## Decyzja
Bitwy AI kontra AI (`packages/sim/test/battles.audit.ts`, ziarna 1–3, limit 15 min, wiatr 8 m/s):
- co najmniej 50% bitew rozstrzygniętych (zatopienie albo opuszczenie bandery) przed limitem;
- w parach o wyraźnej przewadze (bryg kontra fregata, okręt liniowy kontra fregata) silniejszy nie przegrywa ani razu;
- w parach równych (bryg kontra bryg, fregata kontra fregata) żadna strona nie wygrywa 3:0 przy tych samych ziarnach
  pozycji startowych (sprawdzane tylko, gdy wszystkie trzy są rozstrzygnięte).

Piaskownica (`packages/app/test/soak.audit.ts`, 20 min, szkwały):
- najwyżej 120 bytów w świecie w każdej minucie, statków najwyżej budżet reżysera + 3;
- brak NaN w pozycjach;
- najgorszy czas kroku symulacji ≤ 2 ms na maszynie CI/kontenera (telefon ok. 3–4 razy wolniejszy daje ≤ 8 ms, czyli
  połowę klatki przy 60 Hz).

Biegunowa prędkości (`polar.audit.ts`) zostaje raportem: liczby porównuje się z epoką (rejowiec do ok. 70° od wiatru,
szkuner najszybszy ostro na wiatr, fregata szybsza od galeonu).

## Konsekwencje
Zmiana reguł walki wymaga uruchomienia `pnpm run audit`; przekroczenie progu to błąd do naprawy albo świadoma zmiana tego
ADR z uzasadnieniem.
