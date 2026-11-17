# ADR-0004: Ocean i fale

## Status
Przyjęty (16.11, orkiestrator).

## Wzorzec
Suma fal Gerstnera (GPU Gems 1, rozdz. 1, M. Finch; J. Tessendorf, „Simulating Ocean Water”), amplitudy z widma
Piersona-Moskowitza (1964): S(w) = alpha g^2 / w^5 exp(-beta (g/(U w))^4).

## Decyzja
- Osiem stałych pasm (długość, kierunek, faza z ziarna); wiatr zmienia tylko amplitudy, więc zmiana pogody nie skacze fazą.
- Morze dogania wiatr z opóźnieniem (rozwój fali).
- Wysokość pod punktem świata z iteracji punktu spoczynku (4 kroki).
- Shader dostaje te same parametry (`packWaves`), więc kadłub pływa na widocznej fali.
- Ograniczenie stromości: orbita co najwyżej kołowa i brak pętli (suma k·Q·A ≤ s).

## Zmiana 16.11
Widmo PM (morze w pełni rozwinięte) zastąpione JONSWAP z rozbiegiem 60 km (Hasselmann i in. 1973): krótsze, bardziej strome fale, bliżej referencji wizualnej i wód archipelagu. Najdłuższe pasmo 160 m, skala wysokości 1,0.
