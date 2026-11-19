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
- [x] AI bez planowania trasy wokół wysp: kapitanowie (patrole, kupcy, konwoje) płyną do punktu drogą z planera A* (`ai/waypoints.ts`, ten sam co pilot gracza), planowaną raz na punkt i zapisywaną w stanie kapitana
- [ ] wydanie końcowe po sprawdzeniu na telefonie
- [x] fregata smuklejsza (szer. 11,4 m, zanurzenie 4,4 m, ostrzejszy dziób): 90° 9,3 kn i 135° 9,9 kn wobec galeonu 8,2 i 9,2 (16.11)

### M7 realizm i assety (prośba właściciela 17.11)
- [x] noc w trybie Naturalnym: kolor wody gaśnie z dniem (morze nie świeci turkusem w nocy); kadłuby z modeli rozjaśnione 1,8 raza (17.11); APK po pełnych kadłubach 39 MB, CI zielone
- [x] linia bojowa: okręty wojenne eskadry idą w kilwaterze poprzednika (odstęp 120 m), gdy prowadzący walczy, i strzelają, gdy działa mają cel w polu; nowy ruch „eskadra” (fregata albo liniowiec + fregata i bryg); test: szyk trzymany przez 59% czasu walki wobec 19% bez reguły (17.11)
- [x] wraki na mieliznach: skan wraku z Uelvesbüll (37 tys. trójkątów, 1,6 MB) wyprostowany przez PCA (`tools/assets/upright.mjs`), rozstawiony z ziarna świata przy ok. 40% wysp (`core/world/wrecks.ts`), przechylony na obło, z dala od portów; tylko sceneria (17.11); do zrobienia: drugi model (Älvsnabben), łup z wraku
- [x] działa na pokładach w miejscach, z których strzela symulacja: lufa toczona z profilu skanu działka obrotowego Queen Anne (`tools/assets/lathe-profile.mjs`), lawety, moździerze, działka na relingu; odjazd po strzale i wytoczenie (17.11); oba modele „armat” z Drive to skany dna z leżącą lufą, zostają na wraki
- [x] noc: księżyc jako światło główne (zimne, przyćmione, zasłaniane chmurami), odblask księżyca na morzu, adaptacja oka (ekspozycja do 2,2 raza po zachodzie), jaśniejsze nocne niebo (17.11)
- [x] potok assetów (`tools/assets`): pobranie z Drive, licencje (16 x CC BY 4.0, CREDITS.md), optymalizacja meshoptimizer, cięcie kadłuba, metryki nadburcia; kadłub galeonu z modelu Galaxy Abundant z proceduralnym, ruchomym ożaglowaniem (17.11)
- [x] kadłuby z modeli: fregata (Baron Anders von Höpken 1759), bryg (Dutch ship) (17.11)
- [ ] okręt liniowy (szkielet 1700 ma dziury w poszyciu: sprawdzić albo trójpokładowiec 1660); armaty i działka z modeli; wraki na mieliznach
- [x] tekstury z modeli (albedo i mapy normalnych z GLB właściciela, 4096 px w pełnym poziomie) (17.11); Poly Haven CC0 jak w podrcr: deski pokładu, ciemne drewno masztów i rej, splot płótna jako mapa normalnych (`tools/assets/textures.mjs`) (17.11)
- [x] mniej uproszczeń: kadłuby w dwóch poziomach (pełny 250 tys. trójkątów i tekstury 4096 dla presetów high/ultra, `-lite` 80 tys. i 2048 dla low/medium) (17.11); nie sprawdzono pamięci na telefonie
- [x] godzina zrzutów jak w SekiSenshi: `hours=HH:MM`, `clock=stop`, nazwane ujęcia `tools/shots/views.json` i `node tools/shots/view.mjs <ujęcie> [HH:MM]` (17.11)
- [x] taktyki z epoki w AI (doktryny jako dane): nawietrzna, ostrzał wzdłuż kadłuba (obrażenia +50%, straty w załodze x2,5), pościg dziobem z działami pościgowymi, szkoła brytyjska (kadłub z bliska) i francuska (olinowanie łańcuchową, potem kadłub), abordaż według doktryny (17.11); audyt: 16 z 18 bitew rozstrzygniętych; linia bojowa eskadr zrobiona (17.11)
- [x] fizyka strzału: odrzut z realnego pędu armaty przechyla statek o 1,5–2,5° na przeciwną burtę (test), dym prochowy większy i dryfuje z wiatrem (17.11); odjazd lawet zrobiony
- [x] ruchome elementy: ugięcie masztów (tłumiony oscylator od obciążenia masztu, żagle, reje, flaga i sztagi idą z masztem), łopot żagli bez wiatru i drganie liku w silnym wietrze, sztagi zwisają luźne i prostują się pod obciążeniem (17.11); wanty i ratliny idą za ugiętym masztem, zawietrzne luzują się pod obciążeniem, nawietrzne stoją proste (17.11); do zrobienia: kołysanie latarni
- [x] dźwięki otoczenia z nagrań CC0 (OpenGameArt): morze, lekki i sztormowy wiatr, deszcz, burza z grzmotem, skrzypienie kadłuba (częstsze na przechyle), mewy i fale przy lądzie; strzał, trafienie, plusk, taran, tonięcie z nagrań, synteza jako zapas (17.11); nieodsłuchane w kontenerze

### M8 dopracowanie modeli i walki (plan z 17.11, po 93afbcf)
- [x] mniej upraszczać (właściciel, 17.11, drugi raz): wrak z Uelvesbüll w siatce 362 tys. trójkątów i teksturach 2048, Älvsnabben jako drugi wrak (761 tys., 30 MB), skan działka z teksturą (12 tys. trójkątów na lufę) na statkach do 140 m od kamery, pełne kadłuby także na medium; działa stoją przy rzeczywistej burcie modelu (promień w siatkę); naprawione rysowanie wnętrza kadłuba zamiast poszycia i brak normalnych w modelach (17.11); zbudowana gra 77 MB
- [x] udźwiękowienie statku (właściciel, 17.11): reżyser dźwięków statku (`engine/audio/ship-sound-plan.ts`, testowany) ze stanu symulacji: skrzypiący pokład (pętla z przechyłem i obciążeniem masztów), woda wzdłuż burty (z prędkością), wiatr w olinowaniu (ton eolski ze wzoru Strouhala), liny jęczące pod obciążeniem i w szkwale, bloki i bieg załogi przy stawianiu żagli, brasowanie przy zwrocie, łopot i strzał płótna, kroki wachty, dzwon okrętowy co pół godziny wachty (1–8 uderzeń parami), wytaczanie działa po załadowaniu, dziób uderzający w falę, pompa przy wodzie w kadłubie, kabestan przy mieliźnie, szable i pistolety przy abordażu, monety, skrzynia przy zleceniu; nagrania: JC Sounds Pirate Pack (CC BY 4.0) i kabestan (CC0); nieodsłuchane w kontenerze
- [ ] dźwięki statku, czego jeszcze brak: głosy i komendy załogi, gwizdek bosmański, kotwica (łańcuch i plusk), ster (skrzyp rumpla), ogień na pokładzie, dźwięki innych statków z bliska (ich liny i żagle), nagrany łopot żagla zamiast syntezy
- [x] fizyka żagli, część 1 (17.11): płótno jako symulowana tkanina (XPBD, stały krok 1/120 s, bez losowości) dla statków do 220 m od kamery: żagiel przywiązany do rei, masztu, sztagu i szotów, skrojony z zapasem (brzuch ok. 11% cięciwy), nić tylko ciągnie, grawitacja i ciśnienie wiatru z wypełnienia żagla z symulacji, łopot od fali biegnącej przy utracie wiatru, zbieranie do rei przy refowaniu; przeszycia z `SAIL_LAYOUT` wchodzą do fizyki: każda linia brytu, refbanty i obszycie są sztywniejsze na zginanie i cięższe (test: zszyty żagiel ma mniejszy brzuch i spokojniejsze liki niż gładkie płótno); siatka żagla 12 x 8; koszt ok. 0,17 ms na żagiel i klatkę
- [x] kasztel statku gracza bez podłogi (uwaga właściciela, 17.11): cięcie modelu nad pokładem przechodziło przez kasztel rufowy i zostawiało otwartą skorupę; gra wykrywa przekroje, w których burta sięga wysokości cięcia, i zamyka je pokładem z desek od burty do burty, wysokość nadburcia poniżej góry
- [x] kasztel rufowy jak na statku referencyjnym (17.11): na przeciętych przekrojach rufy modelu stoi kasztel wysokości 2,5 m (ściany z deskowaniem i oknami galerii świecącymi nocą, pokład z desek, tralkowa balustrada dookoła, schody z obu burt na śródokręcie, trzy latarnie rufowe przygaszone za dnia); układ w `castle-layout.ts` (wspólny dla siatek i katalogu części: `castle`, `lantern`); to zamyka też pozycję „latarnie rufowe”
- [x] uwagi właściciela do przeglądarki (17.11): kasztel nie wisi w powietrzu (ściany nie rysowały się przez sklonowany materiał, kasztel był węższy od kadłuba i za krótki: teraz ściany przedłużają burtę, ćwierć długości od rufy); ściany kasztelu z poszycia wypalonego z tekstury modelu (`tools/assets/hull-patches.mjs`); dźwięk w przeglądarce: paczka nie zawierała nagrań, więc grał zapasowy szum z 2-sekundowej pętli, teraz przeglądarka ma wszystkie nagrania, a pętla szumu ma 9 s
- [x] woda przy kadłubie, część 1 (17.11): bryzga dziobowa jako płachta drobnych, krótko żyjących kropel z czterech punktów wzdłuż obu stron dziobu (ilość z kwadratu prędkości, wyższa przy uderzeniu dziobu w falę) zamiast białych kłębów; wycięcie morza pod kadłubem i piana przy burcie liczone z długości kadłuba, który widać (model jest dłuższy od kadłuba fizycznego), wycięcie głębsze i szersze
- [x] woda przy kadłubie, część 2 (17.11): odkos fali dziobowej jako grzbiet odchodzący od dziobu pod kątem Kelvina z pianą na grzbiecie, dłuższy pas spienionej wody za rufą (ok. 25 s żeglugi), niska bryzga spod rufy
- [ ] woda przy kadłubie, część 3: zestawienie z klatkami referencji (`tools/shots/compare.sh`), bryzga przy burcie na fali, piana kilwateru z własną teksturą zamiast szumu
- [x] kasztel z klepek (uwaga właściciela, 17.11): ściany składane z pasów desek 0,3 m (dolna krawędź każdego pasa wysunięta 3,5 cm, więc styki rzucają cień jak na burcie), każdy pas bierze inny wycinek poszycia modelu w skali 1:1 zamiast jednej rozciągniętej tekstury; listwy u dołu i u góry jak wręgi burty; okna co ok. 2,4 m w ramach ze szprosami, szyby ciemne w dzień i świecące nocą; odcień dobrany do burty
- [ ] kasztel, dalej: drzwi w grodzi czołowej, rzeźbiona pawęż, kasztel dziobowy, załoga na pokładzie rufowym jak w referencji (6–8 postaci), porównanie zrzutu z klatką `ref_090`
- [x] liny ruchome (17.11): szoty i brasy jako cienkie rurki od rogów symulowanych żagli (szoty żagli dolnych do burty, górnych do noków rei poniżej, brasy do następnego masztu albo na rufę, szot gafla i kliwra), zwis zależny od wypełnienia żagla; części `sheet` i `brace` w katalogu z regułami audytu (każdy żagiel ma szot, każda reja dwa brasy)
- [ ] fizyka żagli, część 2, reszta: gejtawy, kolizja płótna z masztem i rejami (żagiel wstecz), wpływ dziur po kulach na tkaninę, bezwładność przy zwrocie rei, dalsze statki z tańszą symulacją
- [x] tekstury wysokiej jakości, część 1 (17.11): żagle malowane w 2048 px (1024 na medium, 512 na low) z brytami o różnym odcieniu, szwami płaskimi ze ściegiem, refbantami z refsejzingami, obszyciem lików, zaciekami i łatami; układ szwów jako dane `SAIL_LAYOUT` (wejdzie do fizyki płótna); pokład 2048, drzewce 1024, splot płótna 1024 (warianty -lite dla low)
- [x] tekstury wysokiej jakości, część 2 (17.11): sztagi i wanty jako rurki ze splotem smołowanej liny (z bliska; cienkie linie zostają na dal), wypukłość szwów, refbantów i obszycia na żaglach (mapa normalnych z tego samego układu co malowanie), splot lnu jako mapa detalu (kolor i faktura), relief desek na kadłubach generowanych i kasztelach
- [x] uwagi właściciela po obejrzeniu artefaktu (17.11): kadłub galeonu obrócony dziobem do przodu (automat nie rozpoznał dziobu, ustawione jawnie); kadłuby w pełnej siatce bez upraszczania (galeon 475 tys., fregata 323 tys. trójkątów; uproszczenie otwierało poszycie na szwach UV), wariant low upraszczany z zablokowanymi szwami; maszty uginają się płynnie krzywą belki wspornikowej (siatka masztu deformowana, zamiast sztywnego obrotu wokół stopy); kadłub z modelu nie jest już czarny (jasność tekstury jako parametr modelu, przez poziom tekstury)
- [x] braki modelu galeonu (17.11): potok wykrywa i usuwa kikuty want i sztagów (wyspy siatki nad linią nadburcia o małym obrysie, 83 fragmenty, 74 tys. trójkątów), mierzy profil burty (szerokość i wysokość nadburcia w 64 przekrojach) i zapisuje go obok modelu; gra kładzie na nim ciągłą barierkę z obu stron ze słupkami tam, gdzie nadburcie modelu jest niższe, a wanty schodzą do ław wantowych z juferami przy burcie modelu; do zrobienia: talrepy, kołkownice, to samo dla fregaty i brygu po obejrzeniu ich braków
- [x] oznaczenie części statku (17.11): katalog części w `core/ship/parts.ts` (rodzaj, stały identyfikator jak `shroud:0:port:3`, punkt zaczepienia, część nośna) i audyt `auditParts` (nic nie wisi w powietrzu, każda wanta ma ławę, każde działo lawetę albo reling, każdy maszt ma sztag i wanty z obu burt, wszystko mieści się w statku); widok buduje listę części z tych samych układów co siatki (`engine/renderer/ship-parts.ts`, `rig-layout.ts`); test przechodzi dla wszystkich klas, galeon gracza ma 148 części
- [ ] części statku, dalej: siatki budowane wprost z listy części (dziś lista i siatki korzystają ze wspólnych układów, ale to dwa przebiegi), kasztele, latarnie, kotwice, szalupy i liny ruchome w katalogu, audyt zgodności z kadłubem z modelu (działo naprzeciw furty)
- [ ] tekstury, co zostało: kolor desek Poly Haven na kasztelach i poszyciu generowanym (dziś tylko relief), liny ruchome (szoty, brasy) jako rurki, ratliny jako rurki z bliska
- [x] zrzut salwy burtowej z bliska: rząd błysków i dym wzdłuż burty, salwa działa (17.11); odjazdu luf i zgodności z furtami kadłuba z modelu nie widać w rozdzielczości zrzutu, do sprawdzenia na żywo
- [x] jasna płaszczyzna pod rufą: to było morze widziane przez niewyrysowane poszycie kadłuba z modelu (zgubiona orientacja ścian przy zamianie materiałów), naprawione (17.11)
- [ ] kadłub okrętu liniowego z modelu trójpokładowca 1660 (zamiast szkieletu 1700), potem karaka dla kolejnej klasy bez modelu
- [x] łup z wraków (18.11): postój do 60 m od wraku, najwyżej 1,5 m/s przez 5 s daje raz złoto 150–600 z ziarna świata
  (`core/data/salvage.ts`, `sim/economy/salvage.ts`, zdarzenie złota z powodem `wreck`, komunikat „Łup z wraku!”, zapis
  w migawce, test); złoty hash bez zmian (przebieg kontrolny bez archipelagu)
- [ ] wraki dalej: znacznik wraku (gra nie ma jeszcze mapy), tapnięcie wraku jako rozkaz „ratuj” (kurs i postój), ładunek
  zamiast samego złota
- [ ] audyt budżetu trójkątów i wywołań rysowania na preset (pełne kadłuby, działa, wraki), próg w ADR-0005

### M9 grafika do poziomu klatek referencyjnych i kolizje części statku (właściciel, 17.11)
- [x] A. plansze porównawcze (17.11): siedem scen klipu w `tools/shots/reference-scenes.json`, `node tools/shots/reference-sheet.mjs <katalog> [scena]` składa zrzut gry obok klatki; parametr `sun=<stopnie>` ustawia azymut słońca do ujęć pod światło; do zrobienia: przegląd wszystkich siedmiu scen i tabela stanu w `docs/reference/README.md`
- [x] B1. bryły części w katalogu (`core/ship/part-volumes.ts`: kapsuły i prostopadłościany) i reguła `auditClashes`: działo–kasztel (dozwolone przy furcie), wanta–kasztel, sztag–kasztel, reja–obcy maszt, działo–maszt; test dla wszystkich klas i trzech kadłubów z modeli (17.11)
- [x] B2. naprawy z audytu: wanty bezanmasztu galeonu przesunięte przed kasztel (albo na pokład kasztelu, gdy maszt w nim stoi), baksztagi do rzeczywistej burty modelu, furty z ramą i klapą dla dział stojących w kasztelu (`castle-ports.ts`; na dzisiejszych modelach żadne działo w kasztelu nie stoi, furty sprawdza test) (17.11). Zostaje: otwór na maszt w pokładzie kasztelu, gdy maszt w nim stanie
- [ ] B3 (część, 17.11). reje i żagle rejowe wiszą 0,42 m przed masztem (były w jego osi), tkanina zderza się z masztem (rzut na powierzchnię walca po każdym przejściu, PBD §3.4), test żagla wybranego wstecz. Zostaje: kolizja z rejami niższych pięter i sztagami, szoty i brasy poza płótnem
- [ ] C1 (w toku, 17.11). światło i kolor: sepia z prześwietlonym niebem i czarnymi cieniami, bloom wokół słońca, promienie przez omasztowanie. Zrobione: szerszy i niższy próg bloomu od presetu high (próg 0,72, waga 0,45, jądro 72): niebo wokół słońca prześwietlone jak w `ref_090`; mokry pokład z połyskiem. Kamera pokładowa wyżej (4,6 m nad pokładem) i 8 m za grotmasztem, patrzy lekko w dół wzdłuż pokładu. Zostaje: plamy słońca na mokrych deskach (pokład kadłuba modelu ma własny materiał bez połysku), promienie przez omasztowanie Noc (18.11): ton sepii przechodzi nocą w ciepłą szarość (`night` w `grade.ts`), ciepłe jasne światła zachowują barwę przez tonowanie, godła żagli świecą bursztynem z ciemną sylwetką godła, piana nocą przygasa z faktycznym światłem; kadr `night-bow` bliżej (70 m). Półtony (18.11): pomiar percentyli jasności plansz, ekspozycja looku sepii 1,15 (mediana i dolny kwartyl były o 10–40 poziomów niżej niż w klipie); lampy w kabinach zapalane od niskiego słońca.
- [ ] C2 (w toku, 17.11). niebo i mgła. Zrobione: chmury objętościowe dla presetów high i wyżej, stanowisko testowe nieba `tools/sky/sky-test.mjs`, kłęby z szumu komórkowego Worleya w trzech skalach (kalafiorowa faktura), zacienienie zagłębień jedną próbką ku górze, wieże do 13 jednostek, poświata słońca zasłaniana przez grubą chmurę (wcześniej zmywała chmury pod słońce), mniej ławic mgły od samego deszczu; plansze `stern-castle` i `side-dark` zbliżone do `ref_090` i `ref_060`. Presety ultra i cinematic czytają kłęby z tekstury szumu 3D 64³ (`shaders/cloud-noise.ts`, WebGL2): sześć skal detalu, 96 kroków, 6 próbek ku słońcu; zrzut ultra `stern-castle` ma postrzępione głowy z jasnym brzegiem jak `ref_090`. Przy wichurze i szkwale niebo ma przerwy i jasne szczeliny (plansze `side-dark`, `horizon`). Zostaje: akumulacja między klatkami (wzór ditheringu), rozpraszanie wielokrotne,  pomiar czasu klatki na GPU i telefonie, ławice mgły zakrywające statek, klify we mgle. Noc (17.11): zachmurzenie świeci matową szarością nieba, oświetlone równo przez księżyc nad nim (`ref_075`); stanowisko nieba bierze kolory z `look.ts` (`SKY_HOURS`, `SKY_EXPOSURE`) 18.11: mgła rośnie z pokryciem w potędze 1,5 i ciemnieje pod chmurami (`hazeShade`), preset high na chmurach z tekstury (szybszych na stanowisku), cienka warstwa stratusów między kłębami pod ciężkim niebem, węższy rdzeń słońca (`ref_152`). Zostaje: jasna przerwa przy słońcu na `horizon` nadal szersza niż w klipie.
- [ ] C3 (w toku, 17.11). woda: krótka, ostra, ciemna fala, szeroka ścieżka iskier, piana z teksturą, linia wody na obiektywie. Zrobione: odblask i ścieżka iskier słabną pod ciężkim niebem (`sunGlint` z pokrycia: przy wichurze ok. 0,3, przy sztormie 0,08; `ref_060` kontra `ref_090`). Morze odbija ciemny spód chmur pod ciężkim niebem (`ref_060`). Piana jako koronka z szumu komórkowego (F2−F1, Worley 1996), gęstnieje do pełnej plamy przy kadłubie, w kilwaterze, na grzbietach i w przyboju (17.11). Zostaje: linia wody na obiektywie (sprawdzić w trybie filmowym) Kilwater po drodze statku (17.11, właściciel: „gra niech pamięta, gdzie płynęliśmy”): ślad rufy zapisywany co 1,6 s dla 3 statków najbliżej kamery (`wake-trails.ts`), shader rysuje białą wodę i ramiona Kelvina wokół tej łamanej (`shaders/wake-trail.ts`) zamiast prostego klina obracanego z kadłubem. 18.11: iskry gasną od pokrycia 0,5; drobniejsza piana kilwateru na miękkim podkładzie (bez siatki dziur z daleka).
- [ ] C4 (w toku, 17.11). statek: kasztel dziobowy, pawęż i galeria, okrągłe furty, drzwi, załoga na rufie, postrzępione żagle, gęstsze olinowanie. Zrobione: załoga na kadłubach z modeli (była ukryta razem z proceduralnym ciałem statku): rząd 6–7 postaci przy balustradzie kasztelu twarzą na rufę jak w `ref_090`, reszta na śródokręciu z dala od masztów i dział (`crew-layout.ts`); postać to korpus z głową zamiast samej kapsuły. Figurki z postaci Quaterniusa (CC0): pięć wariantów marynarzy (strój wieśniaka i tropiciela, głowy, fryzury, pozy z biblioteki animacji), 5 tys. trójkątów, wspólny atlas tekstur, instancje na każdym statku z bliska (`crew-figures.mjs`, `CrewFigures`) Dalej (17.11): gęstsze olinowanie: topenanty z nok rej do masztu nad nimi, gejtawy od rogów szotowych wzdłuż liku do nok rej, fał gafla i topenanta bomu (`rig-layout.ts`, części `lift` i `clewline`, reguła audytu `noLifts`); postrzępiony lik dolny żagli (ząbki i 3 rozdarcia wycięte w alfie tekstury, test alfa, cień idzie za kształtem). Kasztel dziobowy zrobiony i wycofany (decyzja właściciela 17.11: niepotrzebny; kosztował 50 wywołań rysowania na scenę). Pawęż: rząd okien galerii co 1,05 m z pilastrami i listwą nad nimi, otwarta galeria 0,75 m za pawężą z balustradą z tralek kasztelu (`sternGallery`). Zostaje: szersza i wyższa pawęż jak w `ref_090` (dziś węższa ku linii wody), galion (`ref_064`), okrągłe furty, drzwi; zwinięte płótno leży już na rejach jako zwój z płótna żagla (gruby środek, cieńsze końce, łuki zwisające między dwoma sejzingami po bokach, fałdy; `furl-geometry.ts`, średnica `furlDiameter`) 18.11: dolny rząd okien rufowych na pawęży (mesa), scena `stern-castle` płynie z wiatrem z kamerą za rufą (`SHOT_INSPECT` „@a”). Zostaje: rufa węższa względem rej niż w `ref_090`. Żagle przeświecają pod słońce (wtyczka materiału, przepuszczalność 0,07); scena `quarter-close` od dziobu ze słońcem za rufą jak `ref_124`. Szerszy kasztel (0,95) sprawdzony i cofnięty: od rufy prawie bez zmiany.
- [x] kamera pokładowa jak `ref_112`: oko 4,6 m nad pokładem, 8 m za grotmasztem, przy osi, spojrzenie lekko w dół wzdłuż pokładu, szerszy kąt (1,2 rad); plansza `deck` z żaglami bojowymi (17.11). Zostaje: pokład za ciemny pod słońce (C1)
- [ ] C5 (w toku, 17.11). kamera filmowa tuż nad wodą, zanurzenie obiektywu, krople, rozmycie ruchu. Zrobione: oko jedzie po fali ok. 1,3 m nad wodą jak kamera na pławie (wygładzenie wysokości, na krótkiej fali grzbiety zalewają obiektyw), krąży wokół statku w odległości 1,8 długości, co 45 s zanurza się na ok. 2 s i patrzy w górę na powierzchnię (`camera/cinematic.ts`); spód fali z okna Snella pokazuje teraz niebo (błąd znaku: okno nigdy się nie pojawiało) i zmarszczki. Krople po wynurzeniu i linia wody na obiektywie już były. Zostaje: rozmycie ruchu przy obrocie, jaśniejsze okno Snella przy wysokim słońcu (`ref_161`) 18.11: jaśniejsze okno Snella z poświatą słońca, gradacja pod wodą nie gasi jasnych partii, scena `underwater` na planszach (kamera przypięta w chwili zanurzenia). Zostaje: słońce w kadrze tej sceny.
- [x] C6. piorun: rozgałęziony kanał do wody (przesunięcie punktu środkowego, ziarno z miejsca uderzenia), trzy wyładowania w 0,4 s, zbielenie przy pierwszym, niebieski odcień, chmury i niebo rozświetlone w stronę uderzenia (plansza z `ref_142`)
- [x] D1 (właściciel 17.11). brasowanie z czasem: załoga wybiera najlepszy kąt (`sailForce`), a reje dochodzą do niego z prędkością `BRACE_RATE` (rejowe 6°/s, skośne 18°/s przy pełnej załodze i sprawnym olinowaniu, mniej przy stratach), siła żagla liczona przy obecnym kącie (`sailForceAt`); złoty hash 81d3dd8a. Zostaje: limit 35° od położenia w poprzek do sprawdzenia w źródłach epoki
- [x] D5 (właściciel 18.11). Rozkazy po tapnięciu i efekt kursu na wodzie: wrogi statek (pościg z wyprzedzeniem, wyrównanie prędkości, abordaż), inny statek (płynięcie w jego szyku), port (wejście na redę), fort (dojście na odległość szturmu, szturm po uciszeniu albo dryf na pozycji ostrzału), własny statek (stop); pilot rozdzielony na moduły (`sim/ai/pilot/`: stan, sztuka nawigacji, trasa, abordaż, eskorta, fort, wybór); kurs na wodzie jako świetlista nić z płynącymi impulsami i iskrami, rysowanie rozpływa się po puszczeniu, kręgi na wodzie po tapnięciu, pulsujący pierścień celu w kolorze rozkazu; sterowanie gracza wydzielone z sesji (`PlayerHelm`)
- [x] D6 (właściciel 18.11: „wszystkie pomysły dobre, możesz wdrażać”). Stożek martwego kąta wiatru przy statku podczas rysowania i laylinie celu pod wiatr (`presentWind`, `noGoFan`, `laylines`); załoga refuje w szkwale (`systems/reefing.ts`, przełącznik w ustawieniach); kolejka punktów (przytrzymanie na wodzie albo Shift+klik, `navigate` z `append`); obrót kamery dwoma palcami (`camera/twist.ts`); przytrzymanie na statku: menu rozkazów (abordaż, atak burtą, eskorta); linia z własnego statku na wroga: atak burtą (`pilot/engage.ts`); trasa omijająca wyspy (A*, `pilot/plan.ts`); przycisk „Anuluj kurs”; wibracje (Capacitor Haptics, `feedback/haptics.ts`, przełącznik)
- [x] D4 (właściciel 18.11). HUD bez nakładania i w stylu epoki: siatka obszarów skalowana jednostką `--u` (projekt 960 × 540, telefony 760 × 430 z mniejszą ilością wierszy), audyt `tools/ui/ui-audit.mjs`, czcionki Cinzel i EB Garamond wbudowane w paczkę, panele z drewna z mosiężnym obramowaniem, mosiężne przyciski, czerwone przyciski ognia, kompas z różą 32 kierunków, komunikaty na pergaminie
- [x] D3 (właściciel 17.11). Proste sterowanie, domyślne: tapnięcie w morze wysyła tam załogę (pilot kursem jak kapitanowie AI, halsowanie z jednym zwrotem na laylinie i poprawką na dryf, zwinięcie żagli u celu), przeciągnięcie palcem rysuje kurs, po którym statek płynie i potem trzyma jego kierunek; trasa i cel widoczne na wodzie; klasyczny ster w ustawieniach (Sterowanie: Ster), A i D zawsze przejmują koło (`ai/pilot.ts`, `systems/pilot.ts`, `controllers/course-gestures.ts`, `course-view.ts`)
- [ ] D2 (w toku, właściciel 17.11). żywy pokład: więcej postaci, animowanych (animacje z Universal Animation Library Quaterniusa wypieczone do tekstur wierzchołków, `BakedVertexAnimationManager` Babylona dla instancji), z rolami ze stanu symulacji: ludzie przy brasach przy zmianie kursu i trymu (D1), na rejach przy zmianie żagli i refowaniu, obsługa dział przy salwie i ładowaniu, sternik przy kole, obserwator na marsie, ludzie na wantach; podział z `crew` statku (straty widać), deterministycznie z czasu symulacji. Zrobione: postacie z kośćmi i 7 klipów (spoczynek, rozmowa, ciągnięcie, ster, praca na klęczkach, obsługa, obserwacja) wypieczone do tekstury macierzy kości (`crew-anim.mjs`, `CrewRig`), klip i faza na instancję; stanowiska z rolami (ster, mars, reling kasztelu, fały, brasy, działa pokładu górnego, śródokręcie; `crew-layout.ts`) i klip ze stanu statku (`crew-roles.ts`, `crew-activity.ts`): ciągnięcie przy brasowaniu i zmianie żagli, obsługa 18 s po strzale, sternik, obserwator, pobici stoją. Część 2: druga biblioteka (CC0): oparcie o reling, wołanie, skrzyżowane ręce; oficer wachtowy przy sterniku; koło sterowe na kasztelu; zbliżenie: pozy poprawne, postacie na pokładzie. Część 3: wspinaczka z Mixamo (pliki właściciela): topmani przy każdej drabince want pod marsem wchodzą po wyblinkach przy stawianiu i zwijaniu żagli, przechodzą przez krawędź marsa, stoją tam 20 s po robocie i schodzą (`crew-aloft.ts`, retargeting `tools/assets/retarget.mjs`). Zostaje: ruch między stanowiskami (chód), wyjście na reje (brak klipu chodzenia po pertach), klipy liny i ściany (wypieczone, jeszcze nieużyte: abordaż przez burtę, wejście po linie), obsługa dział niższych pokładów widoczna przez furty, latarnie wacht nocą (`Idle_Lantern_Loop`)

### Promienie słońca przez olinowanie (18.11)
- [x] zastąpione promieniami w przestrzeni ekranu w końcowym przebiegu (GPU Gems 3 rozdz. 13): `VolumetricLightScatteringPostProcess`
  nic nie rysował (tarcza słońca poza warstwami kamery), a co klatkę renderował scenę drugi raz; usunięty

### Woda wokół statku (właściciel 18.11: „maksymalny realizm… chlapanie wody o burtę, uderzanie fal i fizyka”)
- [x] chlapanie o burtę z prędkości względnej wody i kadłuba (`effects/hull-slap.ts`, Kerner 2015), piana po uderzeniu
  przy linii wodnej (`shipB.w` w shaderze), `waterState` w `core` (wysokość i prędkość orbitalna wody w fali, test)
- [x] fizyka (18.11, zgoda właściciela): opór pionowy na prędkości względem ruchu wody w fali (człon oporu Morisona):
  uderzenia fali w dno i burtę, kołysanie i nurkowanie z martwą falą; poziomy ruch wody pominięty (wytrącał statki z kursu,
  autopilot audytu rozgrywki nie kończył zleceń). Reżyser świata liczy cały skład grupy (konwój to 4 statki), żeby morze
  mieściło się w budżecie + 3 z graczem (ADR-0005)
- [ ] do rozważenia: poziomy ruch wody przy statkach gracza (z regulatorem kursu autopilota odpornym na pchnięcia fal)

### Sterowanie „Akcja” (właściciel 18.11: pad jak w Black Flag)
- [x] Żeglowanie wspomagane w symulacji (prędkość kadłubowa na każdym kursie, skręt po kole, wstecz), pad w HUD, klawiatura, pomoc PL i EN.
- [ ] Sprawdzić na telefonie: czułość gałki, strefa martwa, czy kciuk nie zasłania statku; ewentualnie pad po lewej, przyciski akcji po prawej w jednej kolumnie.
- [ ] Kamera w tym trybie bliżej i za rufą (jak w Black Flag), jeśli właściciel zechce.

### M10 wydajność (właściciel 18.11: „chwilowo przerwijmy tę optymalizację, na razie do backlogu”)
Zrobione 18.11 (pomiar `tools/perf/frame-bench.mjs`, SwiftShader 640×360, high 2,9 → 1,9 s na klatkę): niebo w połowie
rozdzielczości, wygładzanie krawędzi na ultra naprawione (MSAA na pre-passie SSAO), suwak rozdzielczości obok presetu
z wyostrzeniem, gęstość pikseli do 2, skany dział do 45 m, kadłub z modelu w dwóch poziomach (pełny do 50 m), ocean
pomija dalekie statki i wygaszone skale detalu. Wstrzymane, do podjęcia po sprawdzeniu na telefonie:
- [x] 19.11: niebo w 35% rozdzielczości na high i ultra (klatka −28% w pomiarze), dynamiczna rozdzielczość pod suwakiem
- [x] 19.11: piana przyboju liczona tylko przy brzegu (ultra: ocean 817 → 679 ms, −17%)
- [ ] limit 30 kl./s jako opcja (telefon: równiej, mniej grzania)
- [ ] chmury: rozłożenie marszu na kilka klatek z reprojekcją (Schneider 2015), jeśli niebo dalej będzie największym kosztem
- [ ] pomiar na prawdziwym telefonie (klatki na high i ultra po zmianach); bez niego koszt MSAA jest nieznany (SwiftShader
  cieniuje każdą próbkę osobno, więc zawyża go)
- [ ] ultra: MSAA ×4 → ×2 albo domyślne 80–85% rozdzielczości, jeśli telefon nie uciągnie naprawionego wygładzania
- [ ] cienie: rzadsze odświeżanie mapy dla nieruchomych wysp (osobna mapa statyczna albo `refreshRate`), na ultra 5–15%
- [ ] ocean (high ok. 30%, ultra ok. 40%): detal fal z tekstury zamiast szumu daje mało (detal to już ok. 5% oceanu,
  pomiar 18.11); większe źródła do zmierzenia: `shallows` (pętla po 32 wyspach z fbm), koronka piany, gęstość siatki
  `oceanCells` na ultra (360) i wywołania `hullWater` w shaderze wierzchołków
- [ ] statki: załoga z animacją wierzchołkową i liny ruchome (w podziale kosztu pojawiają się po 0–8%, pomiar zaszumiony:
  powtórzyć z większą liczbą klatek)
- [ ] post-procesy na ultra (ok. 13%): SSAO w połowie rozdzielczości już jest; sprawdzić koszt rozmycia ruchu i bloomu

## Dług i pomysły
- [x] LOD fizyki: statki dalej niż 700 m od gracza pływają na zgrubnych próbkach (80 → 30 dla fregaty); soak 0,55–0,93 ms na krok zamiast 1,05–1,40 (16.11)
