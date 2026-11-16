# Backlog

Kamienie milowe z planu (`docs/adr/0000-plan.md`). Zrobione pozycje oznaczamy datą i commitem.

## Następne
### M0 szkielet
- [x] monorepo pnpm, ESLint, depcruise, code-health, Vitest (16.11)
- [x] `core`: matematyka, RNG, fale Gerstnera z widma PM, aerodynamika żagli, kształt kadłuba, klasy statków, amunicja, komendy, zdarzenia (16.11)
- [x] `sim`: bryła sztywna, wypór, opór, ster, wiosła, żagle z obsługą, sternik PID, złoty hash (16.11)
- [ ] `engine`: scena Babylon, ocean (shader Gerstnera z uniformów `packWaves`), niebo, światło, kamera trzecioosobowa, siatka kadłuba z `core/hull`, maszty i żagle
- [ ] `app`: pętla ze stałym krokiem, wejście (klawiatura, dotyk), HUD minimum (kurs, prędkość, wiatr, żagle)
- [ ] CI (`ci.yml`), `android.yml` + Capacitor, pierwszy APK
- [ ] Playwright: rozruch i zrzut sceny

### M1 walka
- [ ] działa: ładowanie, salwa burtowa falą, działa pościgowe, moździerz, działko obrotowe; elewacja z zadanego zasięgu
- [ ] pociski: balistyka z oporem, rykoszet od wody, trafienia w sekcje, maszty, żagle, olinowanie, załogę
- [ ] model uszkodzeń: przecieki, zalewanie przedziałów, pożary, magazyn prochu, tonięcie
- [ ] załoga za burtą i wyławianie (hołd Overboard!)
- [ ] AI kapitana: automat stanów (patrol, pościg, ustawienie do burty, ucieczka), sternik i żagle
- [ ] efekty: dym, ogień, rozbryzgi, odłamki; dźwięk syntetyzowany

### M2 żagle i pogoda
- [ ] automat pogody z frontami, szkwały, sztorm, mgła, deszcz, pioruny, trąby wodne, fale olbrzymie
- [ ] HUD planu żagli per maszt, refowanie, ryzyko złamania masztu i wywrotki

### M3 świat
- [ ] generator archipelagu (wyspy, mielizny, porty, forty), kolizje z dnem
- [ ] porty: amunicja, załoga, naprawa, zapasy, handel; zapis gry
- [ ] forty 4 klas i przejmowanie

### M4 głębia
- [ ] pełna amunicja i bronie specjalne, abordaż, taran, zaparcie, zasłona dymna
- [ ] klasy statków do kupienia, ulepszenia, frakcje i reputacja, zlecenia, konwoje

### M5 grafika i telefon
- [ ] przebieg grafiki (piana, kilwater, IBL, cienie, SSAO, bloom, mgła), opcje i suwak rozdzielczości
- [ ] HUD dotykowy, budżety wydajności, wydanie v1.0.0

### M6 balans
- [ ] audyty bitew AI kontra AI, poprawki, wydanie końcowe

## Dług i pomysły
- Fizyka: 10 fregat to ok. 1,25 ms na krok na desktopie; dla dalekich statków rzadsza siatka próbek (LOD fizyki).
