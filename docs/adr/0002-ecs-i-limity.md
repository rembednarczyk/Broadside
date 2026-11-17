# ADR-0002: ECS i limity rozmiaru

## Status
Przyjęty (16.11, orkiestrator).

## Wzorzec
Entity Component System (miniplex 2), Component i Update Method („Game Programming Patterns” rozdz. 14 i 10),
Type Object (rozdz. 13) dla klas statków i amunicji, Flyweight (GoF) dla modelu klasy statku.

## Decyzja
- Byt to obiekt z opcjonalnymi komponentami (`sim/src/world/components.ts`), systemy pytają `world.with(...)`.
- Kolejność systemów tylko w `createSystems()`.
- Stan gorący mutowany w miejscu, dane klas niemutowalne i współdzielone (`shipModel(id)`).
- Limity: plik 500 linii, funkcja 120, klasa 20 metod (ESLint + `tools/code-health`, z SpinalTap ADR-0031).
