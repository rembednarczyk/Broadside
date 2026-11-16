# Backlog

Kamienie milowe z planu (`docs/adr/0000-plan.md`). Zrobione pozycje oznaczamy datą i commitem.

## Następne
### M0 szkielet
- [x] monorepo pnpm, ESLint, depcruise, code-health, Vitest (16.11)
- [x] `core`: matematyka, RNG, fale Gerstnera z widma PM, aerodynamika żagli, kształt kadłuba, klasy statków, amunicja, komendy, zdarzenia (16.11)
- [x] `sim`: bryła sztywna, wypór, opór, ster, wiosła, żagle z obsługą, sternik PID, złoty hash (16.11)
- [x] `engine`: scena Babylon, ocean (shader Gerstnera z uniformów `packWaves`), niebo, światło, kamera, kadłub z `core/hull` z teksturą malowania, maszty i żagle (16.11)
- [x] `app`: pętla ze stałym krokiem, klawiatura i dotyk, HUD (16.11)
- [x] CI (`ci.yml`), `android.yml` + Capacitor, pierwszy APK zielony (16.11)
- [x] narzędzie zrzutów `tools/shots/shot.mjs` (16.11)

### M1 walka
- [x] działa, pociski, uszkodzenia, tonięcie, rozbitkowie, AI kapitana (16.11, d7ca7b4)
- [x] efekty, dźwięk syntetyzowany, HUD ognia, wybór celu (16.11, 97621dd)
- [ ] audyt bitew AI kontra AI (czas walki, zwycięzcy klas) jako `*.audit.ts`
- [ ] wskaźnik miejsca upadku salwy na wodzie (łuk jak w Black Flag)

### M2 żagle i pogoda
- [x] pogoda jako łańcuch Markowa (8 stanów), porywy, szkwały, pioruny w maszty, trąby wodne, fale olbrzymie, deszcz (gaszenie, mokry proch), mgła (zasięg wykrywania) (16.11)
- [x] HUD: plan żagli na każdy maszt, obciążenie i ostrzeżenie, rodzaj pogody; deszcz, błyskawice, trąby w grafice; upływ pory dnia (16.11)
- [ ] fronty pogodowe przesuwające się po mapie (pogoda zależna od miejsca)
- [ ] widok spod wody (kamera pod powierzchnią, jak w referencji)

### Wygląd (referencja 16.11)
- [x] korekcja barw, promienie słońca, chmury, mgła, iskry na wodzie, ciemne żagle (16.11)
- [x] detal statków: ratliny, marsy, kasztele, balustrady, latarnie, załoga (16.11)
- [x] galeon wg referencji: trzy piętra żagli z godłem, maszty dzielone, marsy, blinda, fok od bukszprytu, kasztele z galerią okien (16.11)
- [x] batching statku: żagle w jednej siatce na materiał, reje jako instancje, maszty scalone (16.11)
- [x] porównanie klatka w klatkę z referencją (`tools/shots/compare.sh`), raport i klatki w `docs/reference/` (16.11)
- [x] gradacja sepii, daleki brzeg we mgle, węższe żagle, wyższy galeon, większe morze (16.11)
- [x] (raport 1) tryb podwodny: okno Snella, promienie w toni, mgła wodna (16.11); do zrobienia: kamera pod wodą patrzy w górę, rozmyta linia wody
- [x] (raport 2) krople na obiektywie, piorun w trzech fazach, ławice mgły (16.11); do zrobienia: rozbłysk pioruna na wodzie
- [x] (raport 3) kilwater (klin Kelvina) i piana dziobowa z iskrami w shaderze (16.11); do zrobienia: krótka fala wiatrowa
- [ ] (raport 4) chmury kłębiaste z ciemnymi podstawami, klify o płaskich szczytach
- [x] (raport 5) świecące godła i okna nocą (16.11); do zrobienia: bocianie gniazda, postrzępione żagle
- [x] (raport 6) rozmycie ruchu (Ultra, Kinowa), kamery: pościg, filmowa, pokład; ukrywanie HUD (16.11)

### Prezentacja (decyzje 16.11)
- [x] presety grafiki, tryby kolorów (sepia, naturalne, żywe), kamera izometryczna domyślna (16.11)
- [x] kadłub tnie wodę: fala dziobowa, burty, wycięcie, klin Kelvina (16.11)
- [x] bryzgi przy uderzeniu dziobu w falę i przy dużej prędkości, z fizyki (16.11)
- [x] wzburzone morze: widmo JONSWAP z rozbiegiem 60 km, faktura fal w skali ok. 4 m (16.11)
- [ ] izometria: ikony celów i zasięgu dział na wodzie (łuk salwy), czytelność HUD

### M3 świat
- [x] generator archipelagu (Poisson disc), wyspy klifowe, piaszczyste, zalesione, mielizny, rafy; wejście na mieliznę; omijanie lądu przez AI; bezpieczny spawn (16.11)
- [x] wyspy w grafice: teren z tej samej funkcji co fizyka, drzewa, płycizny i przybój w shaderze oceanu (16.11)
- [x] porty: amunicja, załoga, naprawa, prowiant, sprzedaż łupów; ceny wg frakcji; zdobyty fort = własny port; nagrody za zatopienia i forty (16.11)
- [x] zapis gry (Memento): migawka, odtworzenie deterministyczne, autozapis co minutę i przy zminimalizowaniu, nowa gra (16.11)
- [x] miasteczka portowe: domy z dachami dwuspadowymi, molo, latarnie świecące nocą (16.11)
- [x] HUD: przycisk ognia lewą burtą (kolizja klasy CSS .port z panelem portu) (16.11)
- [x] forty 4 klas: ostrzał, mury, uciszanie, szturm desantu, modele proceduralne, celowanie w mury, HUD szturmu (16.11)
- [x] wydajność świata: wyspy w jednej siatce, żelazo fortu w jednej, ląd i forty poza przebiegiem promieni (314 -> 228 wywołań w zatoce) (16.11)
- [x] kształty wysp: szum grzbietowy z deformacją dziedziny (16.11)

### M4 głębia
- [x] zderzenia statków i taranowanie, abordaż (reguły, AI piratów, HUD) (16.11)
- [x] reżyser populacji (Booth, L4D): kupcy między portami, patrole, piraci, łowcy gracza; spawn w pierścieniu, usuwanie dalekich, faza spokoju w walce (16.11)
- [ ] zasłona dymna, HUD broni specjalnych (ogień grecki, rakiety)
- [x] reputacja wobec nacji (Observer zdarzeń): ostrzał, zatopienie, abordaż, zdobycie fortu; wróg mojego wroga; wojna = patrole, forty i porty wrogie, łowcy floty (16.11)
- [ ] stosunki z nacjami w HUD portu, zlecenia, konwoje z eskortą
- [ ] klasy statków do kupienia, ulepszenia

### M5 grafika i telefon
- [ ] przebieg grafiki (piana, kilwater, IBL, cienie, SSAO, bloom, mgła), opcje i suwak rozdzielczości
- [ ] HUD dotykowy, budżety wydajności, wydanie v1.0.0

### M6 balans
- [ ] audyty bitew AI kontra AI, poprawki, wydanie końcowe

## Dług i pomysły
- Fizyka: 10 fregat to ok. 1,25 ms na krok na desktopie; dla dalekich statków rzadsza siatka próbek (LOD fizyki).
