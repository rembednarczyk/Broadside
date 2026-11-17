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
- [x] audyt bitew AI kontra AI (`battles.audit.ts`) i pierwszy balans walki (16.11)
- [x] znaczniki upadku salwy na wodzie (pomarańczowe: burta wycelowana, jasne: na ślepo, rosną z ładowaniem dział); kamera izometryczna oddala się w walce i celuje między statki, ujemna bliska płaszczyzna w rzucie ortogonalnym (16.11)
- [x] strzałka do wroga, gdy jest poza kadrem albo pod panelem HUD (16.11)

### M2 żagle i pogoda
- [x] pogoda jako łańcuch Markowa (8 stanów), porywy, szkwały, pioruny w maszty, trąby wodne, fale olbrzymie, deszcz (gaszenie, mokry proch), mgła (zasięg wykrywania) (16.11)
- [x] HUD: plan żagli na każdy maszt, obciążenie i ostrzeżenie, rodzaj pogody; deszcz, błyskawice, trąby w grafice; upływ pory dnia (16.11)
- [x] komórki burzowe dryfujące z wiatrem (lokalny szkwał: mocniejszy wiatr, deszcz moczy proch i gasi pożary), kurtyny deszczu widoczne z daleka, HUD pokazuje wiatr na miejscu (16.11); fale nadal globalne
- [x] widok spod wody: okno Snella, promienie w toni, przejście kamery przez powierzchnię z meniskiem (16.11)

### Wygląd (referencja 16.11)
- [x] korekcja barw, promienie słońca, chmury, mgła, iskry na wodzie, ciemne żagle (16.11)
- [x] detal statków: ratliny, marsy, kasztele, balustrady, latarnie, załoga (16.11)
- [x] galeon wg referencji: trzy piętra żagli z godłem, maszty dzielone, marsy, blinda, fok od bukszprytu, kasztele z galerią okien (16.11)
- [x] batching statku: żagle w jednej siatce na materiał, reje jako instancje, maszty scalone (16.11)
- [x] porównanie klatka w klatkę z referencją (`tools/shots/compare.sh`), raport i klatki w `docs/reference/` (16.11)
- [x] gradacja sepii, daleki brzeg we mgle, węższe żagle, wyższy galeon, większe morze (16.11)
- [x] (raport 1) tryb podwodny: okno Snella, promienie w toni, mgła wodna (16.11); kamera przechodzi przez powierzchnię: falujący menisk na obiektywie, pod linią toń, kamera filmowa co jakiś czas się zanurza (16.11)
- [x] (raport 2) krople na obiektywie, piorun w trzech fazach, ławice mgły (16.11); rozbłysk pioruna na wodzie (16.11)
- [x] (raport 3) kilwater (klin Kelvina) i piana dziobowa z iskrami w shaderze (16.11); do zrobienia: krótka fala wiatrowa
- [x] (raport 4) wały cumulusów nad horyzontem: płaska ciemna podstawa, kłęby, jasne brzegi od słońca (16.11); mgiełka nad horyzontem, jaśniejsze brzegi od słońca, klify z płaskowyżami (16.11)
- [x] (raport 5) świecące godła i okna nocą (16.11); postrzępione żagle, bocianie gniazdo na grotmaszcie (16.11)
- [x] (raport 6) rozmycie ruchu (Ultra, Kinowa), kamery: pościg, filmowa, pokład; ukrywanie HUD (16.11)

### Prezentacja (decyzje 16.11)
- [x] presety grafiki, tryby kolorów (sepia, naturalne, żywe), kamera izometryczna domyślna (16.11)
- [x] kadłub tnie wodę: fala dziobowa, burty, wycięcie, klin Kelvina (16.11)
- [x] bryzgi przy uderzeniu dziobu w falę i przy dużej prędkości, z fizyki (16.11)
- [x] wzburzone morze: widmo JONSWAP z rozbiegiem 60 km, faktura fal w skali ok. 4 m (16.11)
- [x] izometria: znaczniki upadku salwy, oddalanie w walce, strzałka do wroga pod panelem (16.11)

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
- [x] zasłona dymna (garnki za rufą, linia wzroku AI i fortów), HUD broni specjalnych (ogień grecki, rakiety), sprzedaż w porcie (16.11)
- [x] reputacja wobec nacji (Observer zdarzeń): ostrzał, zatopienie, abordaż, zdobycie fortu; wróg mojego wroga; wojna = patrole, forty i porty wrogie, łowcy floty (16.11)
- [x] stosunki z nacjami w panelu portu (16.11)
- [x] zlecenia z portów: nagroda za pirata, eskorta kupca do innego portu, napad (porty pirackie); oferta z ziarna co 5 min, jedno naraz, termin, zapłata i dobra wola nadawcy, HUD (16.11)
- [x] konwoje: prowadzący kupiec, drugi kupiec i eskorta trzymają szyk (podążanie za liderem, Reynolds), konwój płynie tempem najwolniejszego (16.11)
- [x] audyt biegunowy trzyma kurs sternikiem (wcześniej statki odpadały i kolumny mieszały kursy) (16.11)
- [x] stocznia: zakup statku z rozliczeniem starego (połowa ceny × stan), pirackie stocznie tylko małe kadłuby (16.11)
- [x] przeróbki w stoczni: poszycie miedzią (opór ×0,9), wzmocnienia kadłuba (obrażenia ×0,8), zamki skałkowe (rozrzut ×0,6, przeładowanie ×0,9) (16.11)
- [x] panel portu w zakładkach: port, amunicja, stocznia (16.11)

### M5 grafika i telefon
- [x] przebieg grafiki (piana, kilwater, cienie, SSAO, bloom, mgła, promienie, rozmycie ruchu), presety i suwak rozdzielczości (16.11); IBL pominięte (decyzje)
- [x] kompaktowy HUD na telefon w poziomie (wysokość < 500 px): bez masztów, przechyłu i pogody w panelu żeglugi, mniejsze przyciski (16.11)
- [x] maszty osobno na telefonie: rozwijany wiersz w panelu żeglugi (16.11)
- [x] ratunek kapitana (Overboard!): po zatonięciu albo utracie całej załogi gracz trafia do najbliższego przyjaznego portu na slupie, złoto zostaje, łupy przepadają (16.11)
- [x] audyt soak piaskownicy (`soak.audit.ts`): godzina gry, liczba bytów stała (ok. 40), 1,0–1,4 ms na krok symulacji (16.11)
- [x] ostrzeżenie „mielizna przed dziobem” (sonda 40–250 m po kursie) (16.11)
- [x] karta „Jak grać” przy pierwszym uruchomieniu i w ustawieniach (16.11)
- [x] floty oblegają forty nacji, z którymi są w wojnie (ostrzał burtą i moździerzem, szturm po uciszeniu), forty zmieniają właścicieli bez gracza (16.11)
- [ ] budżety wydajności na prawdziwym telefonie, wydanie v1.0.0

### M6 balans
- [x] progi balansu i wydajności w ADR-0005, audyty jako bramki (`pnpm run audit`) (17.11)
- [x] nawigacja AI: rejowce 74° od wiatru, halsy z histerezą, zwrot przez rufę, wyciąganie kotwicą z mielizny, omijanie lądu tylko kursami do żeglugi, kotwicowiska portów (17.11)
- [x] audyt rozgrywki na autopilocie (`playtest.audit.ts`): port, zlecenie, zapłata (17.11)
- [ ] AI bez planowania trasy wokół wysp: port za wyspą pod wiatr bywa nieosiągalny (seed 3); planer trasy (A* na siatce głębokości) 
- [ ] wydanie końcowe po sprawdzeniu na telefonie
- [x] fregata smuklejsza (szer. 11,4 m, zanurzenie 4,4 m, ostrzejszy dziób): 90° 9,3 kn i 135° 9,9 kn wobec galeonu 8,2 i 9,2 (16.11)

### M7 realizm i assety (prośba właściciela 17.11)
- [x] potok assetów (`tools/assets`): pobranie z Drive, licencje (16 x CC BY 4.0, CREDITS.md), optymalizacja meshoptimizer, cięcie kadłuba, metryki nadburcia; kadłub galeonu z modelu Galaxy Abundant z proceduralnym, ruchomym ożaglowaniem (17.11)
- [x] kadłuby z modeli: fregata (Baron Anders von Höpken 1759), bryg (Dutch ship) (17.11)
- [ ] okręt liniowy (szkielet 1700 ma dziury w poszyciu: sprawdzić albo trójpokładowiec 1660); armaty i działka z modeli; wraki na mieliznach
- [ ] tekstury z tych samych źródeł co podrcr albo z modeli
- [ ] taktyki z epoki w AI: linia bojowa, przejęcie nawietrznej (weather gauge), ostrzał przez rufę (raking: crossing the T), strzelanie na przechyle w kadłub albo w olinowanie (szkoła brytyjska kontra francuska), abordaż po uciszeniu
- [x] fizyka strzału: odrzut z realnego pędu armaty przechyla statek o 1,5–2,5° na przeciwną burtę (test), dym prochowy większy i dryfuje z wiatrem (17.11); do zrobienia: odjazd lawet przy strzale
- [ ] ruchome elementy: ugięcie masztów pod obciążeniem, łopot żagli przy złym trymie i w łopocie, napinanie i luzowanie lin (Verlet / position-based dynamics, sprężyny), kołysanie latarni i flag
- [ ] dźwięki otoczenia: morze, wiatr w olinowaniu (zależny od prędkości wiatru), skrzypienie kadłuba, deszcz, grzmot, mewy przy lądzie, fale o burtę; źródła CC0

## Dług i pomysły
- [x] LOD fizyki: statki dalej niż 700 m od gracza pływają na zgrubnych próbkach (80 → 30 dla fregaty); soak 0,55–0,93 ms na krok zamiast 1,05–1,40 (16.11)
