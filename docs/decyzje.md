# Decyzje

Stałe decyzje o sposobie pracy i produkcie. Nowa decyzja na górze swojej sekcji, z datą. Nieaktualną oznacz
dopiskiem zamiast usuwać. Decyzje podjęte przez orkiestratora za użytkownika mają dopisek „(orkiestrator)”.

## Sposób pracy
- **16.11, użytkownik:** o porze e-maila orkiestrator sam wysyła podsumowanie (także w trakcie pracy) i pracuje dalej na rzecz raportu kolejnego dnia; dziennik wysyłek w `docs/raporty.md`.
- **16.11, użytkownik:** cel wizualny: statek i scena jak najwierniej klipowi referencyjnemu (`docs/reference/`), silnik dostrojony do maksimum (woda, efekty).
- **16.11, użytkownik:** praca jednowątkowa, bez agentów; orkiestrator w pętli aż do uznania gry za skończoną, pytania rozstrzyga sam wariantem, który i tak by zarekomendował. Użytkownik dostaje tylko wieczorny e-mail podsumowujący (remuerte@gmail.com).
- **16.11, użytkownik:** rytm pętli i rozwiązania orkiestrator dostosowuje sam do dynamiki prac; lepsze rozwiązanie może zastąpić wcześniej wybrane (z wpisem tutaj).
- **16.11, orkiestrator:** pętla przez zaplanowane zadanie co godzinę do tej sesji, e-mail codziennie o 20:41 czasu polskiego.
- **16.11, orkiestrator:** najlepsze praktyki z repozytoriów SpinalTap i podrcr: warstwy i porty, ECS, depcruise, limity rozmiaru, złoty hash, audyty liczbowe, zrzuty Playwright, APK z Capacitora.

## Produkt
- **16.11, użytkownik:** tryby kolorów: Sepia (domyślna, dalej dopracowywana), Naturalne, Żywe; wybór w ustawieniach, niezależny od presetu jakości.
- **16.11, użytkownik:** gra domyślnie w rzucie izometrycznym (ortograficznym, elewacja 35,26°); kamery pościgowa, filmowa i pokładowa zostają jako przełączalne (immersja).
- **16.11, użytkownik:** kadłub ma siedzieć w wodzie i ją ciąć; woda płynnie reaguje na prędkość, kurs i kołysanie (fala dziobowa, burty, klin Kelvina, bryzgi).
- **16.11, użytkownik:** projektujemy od razu pod mocniejszy sprzęt (AAA), z wyborem grafiki. Orkiestrator: presety Niska, Średnia, Wysoka, Ultra, Kinowa (`engine/src/graphics-settings.ts`), domyślnie Wysoka na komputerze i Średnia na telefonie; zmiana pojedynczej opcji daje „Własna”; wybór zapisany na urządzeniu.
- **16.11, użytkownik:** wizualny punkt odniesienia: klip bitwy morskiej (packaged-media.redd.it, 720p). Host zablokowany w środowisku, próba utworzenia środowiska z dostępem odrzucona przez usługę; do czasu dopuszczenia hosta kierunek: filmowe bitwy z gęstym dymem prochowym, pianą, rozbryzgami, odłamkami i dynamicznym światłem (M5 i wcześniej, przy każdej zmianie wizualnej).
- **16.11, orkiestrator:** Babylon.js (WebGL2) + Capacitor zamiast Babylon Native i three.js (ADR-0001).
- **16.11, orkiestrator:** fizyka własna i deterministyczna w `sim` (bryła sztywna 6DOF, wypór z próbek kadłuba), bez Havoka (ADR-0003).
- **16.11, orkiestrator:** sternik trzyma zadany kurs (PID), sterowanie gracza zmienia kurs; ster bezpośredni zostaje jako komenda `helm`.
- **16.11, orkiestrator:** skala gry: działa ok. 110 m/s wylotowo (zasięg płaski ok. 400 m), morze wg Piersona-Moskowitza ze współczynnikiem wysokości 0,6.
- **16.11, orkiestrator:** hosty assetów (Poly Haven, Kenney, ambientCG, OpenGameArt) i `dl.google.com` są zablokowane w środowisku. Modele, tekstury i dźwięki z generatorów; APK buduje GitHub Actions.

## 16.11 Reżyser populacji (orkiestrator)
Ruch na morzu prowadzi reżyser wzorowany na AI Director z Left 4 Dead (M. Booth, AIIDE 2009): co 8 s symulacji
uzupełnia budżet 6 statków w pierścieniu 1500–2100 m od gracza (poza zasięgiem obserwatora), usuwa statki dalej niż
3200 m, a gdy gracz walczy, dokłada tylko kupców. Z modelu Bootha bierzemy budżet i fazę spokoju, bez krzywej
intensywności (walka morska sama się rozkłada w czasie przez żeglugę). Skład ruchu to tabela `core/data/population.ts`.
Reżyser jest włączany opcją `traffic` (gra tak, testy i scenki nie), żeby złoty hash i testy reguł zostały stabilne.

## 16.11 Reputacja (orkiestrator)
Zmienia się tylko stosunek gracza do nacji; wzajemne wojny nacji są stałe (tabela startowa). Reputację liczy obserwator
zdarzeń domeny (Observer, GoF) podpięty do `EventQueue.subscribe`, synchronicznie w kroku, więc jest deterministyczna i
zapisywana w migawce. Kary: trafienie statku -0,02, fortu -0,025, zatopienie -0,4, abordaż -0,3, zdobycie fortu -0,6;
nagrody: zatopiony lub zdobyty pirat +0,06 u wszystkich nacji, zatopienie wroga nacji +0,1 u niej. Próg wojny -0,5.
Jedna zabłąkana kula nie wywołuje wojny, około 25 trafień tak.

## 16.11 Zlecenia, stocznia, przeróbki (orkiestrator)
- Zlecenia: oferta portu jest funkcją (ziarno, port, epoka 300 s), więc nie trzeba jej zapisywać; zapisuje się tylko
  przyjęte zlecenie. Jedno zlecenie naraz. Cel zlecenia nie znika przez reżysera populacji.
- Stocznia: stary statek w rozliczeniu za połowę ceny razy stan (kadłub 70%, maszty 30%); tańszy kadłub = dopłata
  dla gracza. Byt gracza zachowuje id (komendy, kamera, zapis), dostaje nowy kadłub i nowe ciało (masa z klasy).
- Przeróbki z epoki: poszycie miedzią, wzmocnienia kadłuba (riders), zamki skałkowe. Długie lufy odrzucone, bo
  zmiana prędkości wylotowej rozjechałaby się z tablicą celowania.

## 16.11 Balans walki z audytu AI kontra AI (orkiestrator)
Audyt `battles.audit.ts` (pary klas, ziarna 1–3, 15 min) pokazał 18 remisów na 18: kadłuby 80–95%, walka z 250–350 m,
około 5 salw na statek. Zmiany: obrażenia 1/2500 → 1/600 HP na dżul; AI wstrzymuje ogień do 1,6 × preferowanego
dystansu i wcześniej się zbliża (jak w epoce: ogień z bliska); preferowane dystanse krótsze o ok. 25%; działa
obracane ręcznymi drągami do ±0,3 rad (wcześniej ±0,14), łuk ognia AI 0,28. Wynik: 12 z 18 bitew rozstrzygniętych w
4–13 min, wygrywa większy lub lepiej uzbrojony statek. Remisy to w większości ucieczki pokonanych (próg 30% załogi).

## 16.11 Komórki burzowe (orkiestrator)
Pogoda zależna od miejsca jako komórki burzowe: ruchome zaburzenie o profilu Gaussa (jak w idealizowanych modelach
szkwału), z narastaniem i zanikiem w czasie życia, dryfujące z 0,6 prędkości wiatru. Rodzą się w procesie Poissona
zależnym od stanu pogody (tabela `CELL_CLIMATE`), 1,5–2,5 km pod wiatr od statku. W komórce wiatr do +80%, deszcz
(mokry proch, gaszenie pożarów), szkwał w HUD. Fale zostają globalne: lokalne fale wymagałyby osobnego pola fal w
shaderze i w wyporze, co przekracza budżet na telefonie.

## 16.11 Ratunek kapitana (orkiestrator)
Audyt soak pokazał, że po zatonięciu gracza gra stawała w miejscu. Wzorem Overboard! (załoga ląduje w wodzie, gra trwa)
kapitan po zatonięciu albo utracie całej załogi trafia do najbliższego portu, który go przyjmie, na slupie z 60%
załogi. Złoto zostaje (u agenta na lądzie), łupy w ładowni przepadają. Byt gracza zachowuje id.

## 16.11 IBL pominięte (orkiestrator)
Oświetlenie obrazem (IBL) z sondy odbić nie wchodzi: materiały statków i lądu to StandardMaterial (drewno, płótno,
kamień, prawie bez połysku), a odbicie nieba w oceanie liczy jego własny shader z tych samych kolorów nieba. Sonda
odbić kosztowałaby sześć dodatkowych renderów sceny na aktualizację, co przekracza budżet telefonu przy małym zysku.

## 17.11 Nawigacja i kotwicowiska (orkiestrator)
Audyt rozgrywki na autopilocie pokazał, że AI nie dopływa do portów: porty stały przy brzegu albo na mieliźnie,
omijanie lądu proponowało kursy w linię wiatru, a rejowce próbowały zwrotu przez sztag. Zmiany: każdy port ma
kotwicowisko (najbliższa woda głęboka na 10 m na zewnątrz od miasta, + 40 m), na nie płyną AI, eskorty i ratunek, a
handel liczy od niego 180 m; rejowce 74° od wiatru (biegunowa: przy 60° galeon cofa się); halsy z histerezą; zwrot przez
rufę, gdy krótsza droga prowadzi przez linię wiatru; wyciąganie kotwicą z mielizny; eskorta ma 30 min (żegluga pod
wiatr). Znane ograniczenie: brak planowania trasy wokół wysp (backlog).

## 17.11 Prośby właściciela (realizm i assety)
Właściciel dodał do planu: prawdziwe taktyki bitew morskich epoki w AI; dźwięki otoczenia, pogody, wody i wiatru;
realistyczną fizykę strzału (odrzut przechyla statek na drugą burtę, dym z dział); modele z jego folderu Drive do
złożenia statków bliskich referencji i innych obiektów gry; ruchome elementy statku zależne od wiatru i pogody (ugięcie
masztów, łopot żagli, napinanie lin); tekstury ze źródeł podrcr albo z modeli. Kolejność: assety (najwięcej zależy od
nich), fizyka strzału i dym, ruchome elementy, dźwięki, taktyki. Backlog: M7.

## 17.11 Odrzut i dym (orkiestrator)
Pęd odrzutu liczony z prędkości wylotowej prawdziwej gładkolufowej armaty (ok. 450 m/s, plus połowa na gazy), a nie
ze spowolnionej kuli balistyki gry (110 m/s). Moment przechylający wzmocniony 3 razy dla czytelności w kamerze: pełna
salwa przechyla statek o 1,5–2,5° na burtę przeciwną do strzelającej (fizycznie byłoby ok. 0,5–1°). Dym prochowy:
kłęby 2,5–4,5 m rosnące do ok. 20 m, szaro-białe, dryfują z wiatrem. Liczba kłębów ograniczona ze względu na
nakładanie się przezroczystości na telefonie.

## 17.11 Kadłuby z modeli właściciela (orkiestrator)
Modele z Drive to skany muzealne i modele artystyczne z żaglami i olinowaniem zlepionymi w jedną bryłę. Gra bierze z nich
tylko kadłub (cięcie nad pokładem, bez bukszprytu), a maszty, żagle i liny zostają proceduralne, bo muszą się ruszać
z wiatrem, refować, łopotać i dziurawić. Kadłub dopasowany do fizyki: szerokość do szerokości klasy, wysokość tak, by
nadburcie na śródokręciu wypadło na pokładzie fizycznym + 0,8 m, długość proporcjonalnie do szerokości. Materiały
PBR z modeli zamienione na StandardMaterial z tą samą teksturą (spójność ze sceną, bez IBL). Uznanie autorstwa
(CC BY 4.0): CREDITS.md i karta „Jak grać”. Model Thunderhawk (CC BY-NC-SA, współczesny) pominięty.

## 17.11 Ruchome ożaglowanie (orkiestrator)
Tylko widok (symulacja trzyma maszty sztywne, determinizm bez zmian). Ugięcie: tłumiony oscylator (0,6 Hz, tłumienie
0,25) dąży do ugięcia statycznego proporcjonalnego do obciążenia masztu z symulacji (belka wspornikowa: ugięcie liniowe
w sile), rysowane jako odchylenie wokół stopy masztu, ok. 2,5° przy obciążeniu 1. Łopot: fala biegnąca od liku
przedniego do tylnego, gdy wypełnienie żagla < 0,35, oraz drganie liku powyżej 9 m/s wiatru. Sztagi: parabola jako
przybliżenie łańcuchowej, zwis 2,6% rozpiętości luźnej liny, 0,4% pod pełnym obciążeniem.

## 17.11 Doktryny i taktyki (orkiestrator)
Doktryny narodowe jako tabela (`core/data/doctrines.ts`): Korona = szkoła brytyjska (0,75 zasięgu, kadłub, nawietrzna,
ostrzał wzdłuż), Republika = francuska (olinowanie łańcuchową do okaleczenia, potem kadłub), Cesarstwo = hiszpańska
(abordaż przy przewadze 1,25), piraci (bliska walka, abordaż przy 1,1). Ostrzał wzdłuż kadłuba: obrażenia kadłuba
+50%, straty w załodze 2,5 raza. Poza skutecznym zasięgiem pościg dziobem z działami pościgowymi. Bramka ADR-0005 dla
równych kadłubów zmieniona: wynik 3:0 dozwolony, walkower nie (zwycięzca traci co najmniej 15% załogi albo 10% kadłuba).

## 17.11 Godzina zrzutów i poziomy jakości kadłubów (prośby właściciela)
Pora dnia z parametru `hours=HH:MM` (albo godzina dziesiętna), `clock=stop` zatrzymuje zegar, żeby światło nie
przesuwało się w trakcie zrzutu. Nazwane ujęcia w `tools/shots/views.json` (iso, chase, bow, broadside, reference,
deck, storm, fog, port, phone), uruchamiane `node tools/shots/view.mjs <ujęcie> [HH:MM] [katalog]` (jak podglądy
SekiSenshi). „Mniej upraszczaj”: kadłuby z modeli w dwóch poziomach (wzorzec LOD wybierany presetem grafiki): pełny
250 tys. trójkątów i tekstury 4096 (high/ultra), `-lite` 80 tys. i 2048 (low/medium, domyślny na telefonie).
Mapy normalnych z modeli przenoszone do StandardMaterial. Rozmiar `dist` 43 MB (fregata pełna 15,6 MB).
Model liniowca 1700 usunięty z `hulls.json`: szkielet ma dziury w poszyciu.

## 17.11 Noc przy księżycu (orkiestrator)
Noc była prawie czarna. Księżyc w pełni naprzeciw słońca (fazy pominięte: gra nie ma kalendarza) jako światło główne
w nocy: 0,55 przy czystym niebie (ćwierć południowego słońca), kolor zimny niebieski jak filmowa „noc za dnia”
(przesunięcie Purkinjego), chmury zabierają do 75%. Odblask na morzu idzie za światłem głównym (ścieżka księżyca).
Adaptacja oka jak auto-ekspozycja w Unreal i HDRP: ekspozycja do 2,2 raza po zachodzie, sterowana wysokością słońca
(burza w dzień zostaje ciemna).

## 17.11 Działa na pokładach (orkiestrator)
Modele „cannon Klein Hollandia” i „canhões do ilhéu” to skany dna morskiego z leżącą lufą, więc na pokład się nie
nadają (pójdą do wraków). Skan działka obrotowego Queen Anne ma czystą lufę, ale jego siatka (1,8 mln trójkątów,
tysiące wysp UV, otwarte krawędzie) nie upraszcza się do budżetu rekwizytu bez dziur. Rozwiązanie: z chmury punktów
skanu zdejmowany jest profil bryły obrotowej (oś z PCA, okrąg dopasowany metodą najmniejszych kwadratów w 36
przekrojach), a gra toczy z niego czystą lufę (ok. 400 trójkątów, thin instances na statek). Długość lufy z
kalibru (1,1 + 0,32·√funty m). Odjazd: sekwencja z regulaminu epoki (skok do tyłu na linie hamującej 0,12 s,
2,2 s ładowania, 1,6 s wytaczania), tylko widok; fizyczny odrzut statku liczy symulacja. Tekstury skanu pominięte
(jednolity ciemny metal).

## 17.11 Wraki na mieliznach (orkiestrator)
Wrak to sceneria: mielizna i tak zatrzymuje statek, więc symulacja i złoty hash bez zmian. Miejsca liczy `core`
(`wreckSites`, z ziarna świata, ok. 40% wysp, głębokość 0,9–2,1 m, 260 m od portów i kotwicowisk), żeby później dało
się dopiąć łup z wraku. Model: skan wraku z Uelvesbüll (CC BY 4.0), obrócony do osi głównych (PCA), podłoga skanu
odcięta (30% wysokości), długość 28–42 m, 8% wysokości w piasku. Skan Älvsnabben (769 tys. trójkątów po
uproszczeniu) i „wrak pod szynami” (płat dna) na razie pominięte.

## 17.11 Linia bojowa (orkiestrator)
Szyk torowy z Fighting Instructions (od 1653): okręty wojenne eskadry (rola patrol, z prowadzącym) idą w kilwaterze
poprzednika, gdy prowadzący walczy; każdy strzela, gdy jego burta ma cel w polu, a bez własnego celu bierze cel
prowadzącego. Sterowanie: line-of-sight guidance (Fossen 2011): kurs poprzednika plus poprawka z odchyłki bocznej
od linii kilwateru (wyprzedzenie 150 m), odstęp 120 m trzymany żaglami (wszystkie żagle powyżej 170 m, zrefowane
poniżej 80 m). Pierwsza wersja (pogoń za punktem za rufą, wzór Reynoldsa) kierowała okręt w poprzek linii, często pod
wiatr, i szyk się rozpadał: zmierzone 26% czasu w szyku, po zmianie 59%, bez reguły 19%. Okręt, który ucieka albo się
poddał, wypada z linii, następny dociąga. Nowy rodzaj ruchu „eskadra” (waga 0,07, patrol z 0,25 na 0,18). Złoty hash
bez zmian (scenariusz nie zawiera eskadr), bramki ADR-0005 zielone.

## 17.11 Tekstury Poly Haven (prośba właściciela: „stamtąd, skąd bierze podrcr”)
Host Poly Haven jest dostępny z sesji. Skrypt `tools/assets/textures.mjs` (curl, bo fetch Node nie idzie przez proxy
sesji) pobiera mapy 2k do `.asset-cache/polyhaven` i zapisuje JPG: `weathered_planks` 1024 (pokład generowanych
kadłubów), `dark_planks` 512 (maszty, reje, lawety, słoje wzdłuż drzewca), `rough_linen` 512 jako mapa normalnych na
malowanym płótnie żagli (siła 0,6). Razem 360 kB. Kadłuby z modeli zachowują własne tekstury.

## 17.11 Woda nocą i jasność kadłubów z modeli (orkiestrator)
Kolor własny wody to światło rozproszone pod powierzchnią, więc skaluje się z dniem (0,1 w nocy do 1 w dzień, od
wysokości słońca). Wcześniej był stały i w trybie Naturalnym morze świeciło turkusem o 23:00. Tekstury kadłubów z
modeli (ciemne, smołowane drewno) mnożone przez 1,8: przy jednym słońcu i świetle nieba bez IBL wychodziły czarne.
Kołysanie latarni odłożone: latarnie proceduralne są ukryte przy kadłubach z modeli, zysk mały.

## 17.11, użytkownik: „nie musisz aż tak upraszczać” (powtórzone)
Zasada: model właściciela wchodzi do gry możliwie w całości, z własnymi teksturami. Upraszczam dopiero wtedy, gdy
pomiar (audyt trójkątów, wywołań rysowania, czasu klatki) pokaże problem, i tylko w wariancie dla dali albo dla
presetu low. Do poprawy z tej zasady: toczona lufa zamiast skanu działka, wrak przycięty do 37 tys. trójkątów i
tekstur 1024, pominięty Älvsnabben, wariant -lite na presecie medium.

## 17.11 Pełniejsze modele i dwa błędy kadłubów z modeli (orkiestrator)
Wraki: Uelvesbüll 362 tys. trójkątów, tekstury 2048 (5,5 MB); Älvsnabben 761 tys. (30 MB), oba z kwantyzacją
atrybutów (KHR_mesh_quantization). Działa: skan działka z teksturą 12 tys. trójkątów na lufę (upraszczanie
meshoptimizer w trybie Permissive, przechodzi przez szwy UV), pokazywany do 140 m od kamery; dalej toczona lufa.
Pierwsza próba (80 tys. na lufę, 3,2 mln na statek) wieszała render programowy, stąd wariant pośredni. Pełne kadłuby
także na presecie medium. Działa stoją przy burcie modelu: promień rzucany w siatkę kadłuba, raz na klasę.
Błędy znalezione przy zbliżeniach: (1) zamiana materiałów PBR na StandardMaterial gubiła orientację ścian z loadera
glTF, więc rysowane było wnętrze kadłuba, a przez poszycie prześwitywało morze (jasna plama pod rufą); (2) siatki po
cięciu nie miały normalnych. Oba naprawione w `model-materials.ts`. Kadłub galeonu pozostaje ciemny, bo taki jest w
teksturze modelu (czarne poszycie). Narzędzie zrzutów: `SHOT_INSPECT="alpha,beta,promień,wysokość"` do zbliżeń.
Rozmiar zbudowanej gry 77 MB (z tego wrak Älvsnabben 30 MB).

## 17.11 Udźwiękowienie statku (prośba właściciela; pakiet zaakceptowany: „brzmi idealnie”)
Wzorzec: warstwowe audio gry (stałe podkłady o głośności ze stanu gry plus pojedyncze dźwięki odpalane regułami z
własnymi licznikami). Decyzje podejmuje czysta funkcja `planShipSounds` (stan statku, pamięć liczników, dt, losowość
jako parametr), odtwarza `ShipSounds`. Stan czyta prezenter `presentShipAudio`. Nagrania: JC Sounds „Pirate Pack
Vol 1” (CC BY 4.0, uznanie w CREDITS.md) i „Chain winch sounds” (CC0). Synteza tam, gdzie nagrania brak: woda wzdłuż
burty, wiatr w olinowaniu (dwa wąskie pasma szumu na częstotliwości 0,2·wiatr/średnica liny 12 mm i jej oktawie),
łopot i strzał płótna, turkot lawety, dzwon. Dzwon bije według wacht: co pół godziny gry od 1 do 8 uderzeń parami.
Dźwięki własnego statku cichną z oddaleniem kamery (do 20%). Kabestan gra tylko przy mieliźnie gracza.

## 17.11, użytkownik: fizyka żagli i ożaglowania (później w kolejce)
Żagle i olinowanie mają płynnie reagować na zastane warunki, projektowane z góry jako deterministyczne, na poziomie
grafik referencyjnych. Przeszycia materiału żagla (szwy brytów) mają istnieć i wpływać na fizykę materiału
(sztywniejsze pasma). Kolejność: po teksturach wysokiej jakości.

## 17.11 Tekstury żagli i drewna, część 1 (pytanie właściciela)
Żagiel malowany proceduralnie w 2048 px (preset high i wyżej; 1024 medium, 512 low): 12 brytów o różnym odcieniu,
szwy płaskie z dwoma rzędami ściegów, dwa refbanty z refsejzingami, obszycie lików, zacieki od deszczu, łaty ze
ściegiem. Układ (liczba brytów, refbanty, szerokość obszycia) jest w stałej `SAIL_LAYOUT`, żeby ta sama geometria
szwów weszła później do fizyki płótna. Pokład 2048, drzewce 1024, splot lnu 1024 (kafelkowany 8 razy).

## 17.11 Przeglądarka statku jako artefakt (prośba właściciela)
Prywatny artefakt https://claude.ai/artifact/LYAkDLuLzZmuniUaP1gZCV: gra uruchomiona na statku gracza z wolną orbitą
(od 6 m), bez HUD, godzina 16:40, bryza, kolory naturalne. Buduje ją `node tools/viewer/pack.mjs <katalog>` (wejście
`packages/app/viewer.html`, `vite.viewer.config.ts`: jeden skrypt), publikacja narzędziem Artifact z tego katalogu pod
ten sam adres. Host artefaktów nie serwuje .glb, więc modele idą jako JSON z base64, a strona zamienia je na adresy
obiektów (`globalThis.__broadsideAssets`, `engine/renderer/asset-url.ts`). Opcje gry bez query stringu:
`globalThis.__broadsideQuery`. Aktualizować po zmianach widocznych na statku gracza.

## 17.11 Tekstury, część 2 (orkiestrator)
Liny: sztagi i wanty jako rurki (uogólniony walec wokół łamanej, jedna siatka na rodzaj lin i statek, przeliczana na
CPU razem z ruchem olinowania), promień 45 i 32 mm, tekstura trójpokrętnej smołowanej liny malowana proceduralnie;
cienkie linie zostają, bo z daleka rurka jest cieńsza niż piksel. Żagle: mapa normalnych szwów malowana z tego samego
`SAIL_LAYOUT` co kolor (szew to podwójna warstwa płótna), a splot lnu z Poly Haven idzie jako mapa detalu
StandardMaterial (R szarość koloru, G i A normalne), kafelkowana 9 razy. Deski: relief z `weathered_planks` na
kadłubach generowanych i kasztelach.

## 17.11 Poprawki po obejrzeniu statku w artefakcie (uwagi właściciela)
Kadłub galeonu był zamontowany rufą do przodu: automat w `hull-cut` porównuje wysokość końców, a tu były równe;
`bowAtMin` ustawione jawnie. Pełny poziom kadłubów nie jest już upraszczany (simplify bez blokady krawędzi rozrywał
poszycie na szwach UV); wariant low upraszczany z `LOCK_BORDER=1`; pliki z kwantyzacją atrybutów. Maszty: ugięcie
jako krzywa belki wspornikowej Eulera-Bernoulliego w(s) = s²(3 − s)/2, siatka masztu deformowana wierzchołkami
(`bent-mast.ts`), drzewce z podziałem co 1,5 m. Jasność tekstury kadłuba to parametr modelu (`gain` w `hulls.json`,
galeon 4): StandardMaterial obcina własny mnożnik koloru do 1, więc jasność idzie przez `texture.level`.
Użytkownik: braki modelu (kikuty want, urwane barierki) mam wykryć i dorobić sam; części statku mają dostać stałe
oznaczenia, żeby generator sam oceniał kompletność (obie pozycje w backlogu M8).

## 17.11 Braki modeli: kikuty olinowania, barierki, ławy wantowe (prośba właściciela)
Galeon jest jedną zrośniętą siatką, więc olinowania nie da się zdjąć jako osobnych części. `hull-cut` szuka wysp
siatki ponad linią nadburcia (union-find po trójkątach leżących w całości nad linią): wyspa o małym obrysie to kikut
(wanta, sztag), szeroka to nadburcie kasztelu. Reguły w `hulls.json` (`stumps`: linia, korzeń, obrys), dwie dla
galeonu. Usuwanie osobnych części przecinających cięcie (`remnantShare`) jest wyłączone domyślnie: skan fregaty
składa się z setek fragmentów i reguła robiła w nim dziury. Potok zapisuje profil burty (percentyle, żeby lufa czy
rzeźba nie liczyły się), gra czyta go przez medianę (`side-profile.ts`) i stawia na nim własne okucia: barierkę
(`model-rails.ts`), ławy wantowe i jufersy (`ratlines.ts`). Miara nadburcia galeonu spadła z 11,0 do 9,67 (kikuty
ją zawyżały), więc kadłub jest dopasowany do pokładu dokładniej.

## 17.11 Katalog części statku (prośba właściciela)
Każda część ma rodzaj, stały identyfikator z rodzaju i położenia (`yard:1:2`, `shroud:0:port:3`), punkt zaczepienia
w układzie kadłuba i część nośną (drzewo po `on`: Composite). Katalog i reguły są w `core` (czyste dane), więc
generator statków może sam ocenić wynik: `auditParts` zgłasza duplikaty, brak nośnika, zły rodzaj nośnika, część
poza statkiem, maszt bez sztagu albo bez want z obu burt. Widok wylicza listę z tych samych układów, z których robi
siatki (plan ożaglowania, `stayEnds`, `shroudLadders`, stanowiska dział z symulacji), i udostępnia ją jako
`ShipView.parts`. Test `ship-parts.test.ts` sprawdza wszystkie klasy; profil burty modelu, który nie pasuje do klasy,
daje błędy „outside” na ławach i wantach.

## 17.11 Fizyka żagli, część 1 (prośba właściciela)
Wzorzec: XPBD (Macklin, Müller, Chentanez 2016) na siatce żagla 12 x 8 (kolumny to bryty z `SAIL_LAYOUT`). Tylko
widok: siły na statek dalej liczy model żagla w symulacji, a tkanina bierze z niej wypełnienie żagla (znak i siła
ciśnienia), wiatr pozorny, postawienie żagla i łopot. Deterministycznie: stały krok 1/120 s, do 4 kroków na klatkę,
bez losowości (łopot wzbudza fala sinusoidalna biegnąca od liku przedniego). Zamocowania: głowa żagla rejowego do
rei i rogi szotowe; gaflowy do masztu, gafla i bomu; kliwer do sztagu i szotu. Krój z zapasem 3,2% w poprzek i 1,2%
wzdłuż. Przeszycia: sztywność zginania wzdłuż szwu, na refbantach i obszyciu 1,5e-5 m/N wobec 6e-3 dla gładkiego
płótna, masa większa o 25%. Pominięte względem publikacji: kolizje własne i z osprzętem. Symulowane tylko statki
bliżej niż 220 m, dalsze mają kształt analityczny.

## 17.11 Pokład kasztelu i liny ruchome (uwaga właściciela i kolejka)
Kasztel: `hull-cut` zapisuje wysokość cięcia; `SideProfile.deckCaps` uznaje przekrój za przecięty, gdy burta sięga
cięcia z tolerancją 6% wysokości kadłuba, i daje pas pokładu 0,95 m poniżej góry burty (`buildModelDecks`). To łata
na otwartą skorupę; pełny kasztel jak w referencji jest osobną pozycją. Liny ruchome: układ w `runningRigging`
(42 liny na galeonie), końce brane z rogów siatki żagla po symulacji (`SailCloth.corner`), punkt na kadłubie po tej
stronie, po której jest róg (reje się brasuje), zwis 0,6–5,6% rozpiętości z wypełnienia żagla. Gafel nazywany
`yard:gaff:i`, bez brasów (trzymają go fały).

## 17.11 Kasztel rufowy na kadłubie z modelu (prośba właściciela: porównać z referencją)
Referencja (klatki `ref_060`, `ref_090`): wysoka, płaska rufa z tralkową balustradą, postaciami i latarniami. Model
właściciela kończy się niskim pokładem rufowym, więc kasztel jest dobudowany: `sternCastle` bierze przekroje rufy
przecięte cięciem modelu (najwyżej 30% długości od rufy), ściany 7% do wewnątrz od poszycia, wysokość 2,5 m,
balustrada 0,95 m. Materiał ścian to tekstura kaszteli z oknami (klon dwustronny `castle-open`, żeby nocna poświata
działała tak samo). Latarnie: emisja 18% w dzień, pełna w nocy.

## 17.11 Poprawki po uwagach do przeglądarki (właściciel)
Kasztel: klon materiału kaszteli kopiował malowane tekstury jako puste i ściany się nie rysowały; nowy materiał na
tych samych teksturach. Ściany idą po burcie (1,01 szerokości z profilu), kasztel zajmuje 24% długości od rufy,
wysokość 2,2 m. Tekstura ścian: `hull-patches.mjs` wypala rzut boczny poszycia śródokręcia modelu (pas 30–54%
wysokości nadburcia, 512 x 256) i zapisuje rozmiar w metrykach; gra kafelkuje ją lustrzanie. Wypalanie pokładu z góry
odrzucone (pokłady modeli są zastawione, wynik rozmazany), pokład zostaje z desek Poly Haven. Dźwięk: paczka
przeglądarki dostała katalog nagrań; zapasowy szum syntezatora ma pętlę 9 s zamiast 2 s.

## 17.11 Bryzga dziobowa i woda cięta przez kadłub (uwaga właściciela)
Stare kłęby brały się z emitera plusków (duże, rosnące cząstki). Nowy emiter `fx-mist`: krople 0,22–0,6 m, życie
0,45–1,1 s, krycie do 0,34, opór powietrza; emisja z czterech punktów wzdłuż dziobu po obu burtach, na zewnątrz i
lekko ku rufie, tempo min(90, 1,1·v²) kropel na sekundę i punkt, razy do 7 przy uderzeniu dziobu w falę. Shader
oceanu dostaje długość kadłuba rysowanego (model dopasowany do klasy), a obniżenie morza pod kadłubem wynosi 3,2 m w
szerszym obrysie, żeby grzbiet fali nie wchodził do wnętrza.

## 17.11 Kasztel z klepek (uwaga właściciela: nie rozciągać jednej tekstury)
Ściana kasztelu to osobne klepki: liczba pasów = wysokość / 0,3 m, dół pasa wysunięty 3,5 cm po normalnej ściany
(zakładka, linia cienia). UV każdego pasa: skala fizyczna wycinka poszycia modelu (szerokość i wysokość z metryk),
przesunięcie w poziomie i pas w pionie z funkcji mieszającej numer pasa i ściany, więc pasy się nie powtarzają.
Okna jako geometria (rama z 4 belek, szprosy w krzyż, szyba `castle-glass` z emisją sterowaną porą dnia), listwy jako
rurki. Poziom tekstury 0,22 jasności kadłuba, barwa (0,95, 0,72, 0,52).

## 17.11 Woda przy kadłubie, część 2 (orkiestrator)
Fala dziobowa rozbieżna: grzbiet po obu stronach dziobu wzdłuż linii |poprzecznie| = 0,7 + 0,354·odległość od dziobu
(kąt Kelvina 19,47°), wysokość 0,03·v², zanik z odległością; piana na grzbiecie od 1,5 m/s. Piana kilwateru zanika
na długości 25·v zamiast 12·v. Bryzga spod rufy tym samym emiterem `fx-mist` (35% tempa dziobowego).

## 17.11, użytkownik: grafika całej gry do poziomu klatek referencyjnych, kolizje na statku
Cel serii M9: każde ujęcie klipu ma w grze odpowiednik zestawiany z klatką (plansze porównawcze jako bramka zmian
graficznych). „Kolizje na statku” rozumiem jako przenikanie części w widoku (żagle, liny, działa, kasztel, maszty);
kolizje fizyczne między statkami dopiszę po tej serii, jeśli to o nie chodziło.

## 17.11 Plansze porównawcze i pierwsze wnioski (M9)
Zestawienie zza rufy i z boku z klatkami `ref_090` i `ref_060` pokazało, że największą różnicę robi kierunek
światła i niebo: klip jest kręcony pod słońce na jasne, kłębiaste chmury, a w grze azymut słońca zależy tylko od
godziny. Dodany parametr `sun=<stopnie>` (stały azymut) dla ujęć; chmury: podstawa w odcieniu horyzontu (0,34–0,42)
z własnym cieniowaniem kłębów zamiast stałej czerni 0,06. Następne różnice z plansz: żagle w klipie są ciemne,
mniejsze i częściowo zwinięte; statek jest niższy i dłuższy; horyzont tonie we mgle; kadr z większej odległości.

## 17.11 Chmury objętościowe, pierwszy krok (uwaga właściciela: „mięsiste, puszyste chmury”)
Wzorzec: Schneider, „The Real-Time Volumetric Cloudscapes of Horizon Zero Dawn” (SIGGRAPH 2015), okrojony do kopuły
nieba: warstwa 0,9–4,4 jednostki, mapa pokrycia 2D decyduje o komórkach i wysokości wież, profil z płaską podstawą,
erozja kłębami szumu 3D, 30 kroków (44 na ultra) z ditheringiem, 4 kroki ku słońcu (Beer-Lambert), efekt „powder”,
faza Henyey-Greensteina z dwóch płatów. Włączane od `cloudOctaves` 5 (high). Wynik po czterech iteracjach nie
dorównuje klipowi (gładkie bryły), praca trwa; iteracje na pełnym zrzucie gry trwają po 3 minuty, stąd plan strony
testowej nieba.

**17.11, chmury objętościowe, część 2 (orkiestrator, za prośbą „rób 1 aż do efektu z referencji”).** Stanowisko
`tools/sky/sky-test.mjs` renderuje sam shader nieba w ok. 2–4 s (zamiast 2–3 min zrzutu gry). Kształt kłębów: odwrócony
szum komórkowy (Worley 1996, baza Perlin-Worley u Schneidera 2015) w trzech skalach, szukany w 8 komórkach z punktami
w środkowych 70% komórki (różnica wobec wzorca: 8 zamiast 27 komórek, dla kosztu), dziedzina wygięta wolnym szumem,
żeby nie było widać siatki. Szum grzbietowy z części 1 dawał włókna zamiast kłębów i został usunięty. Światło: 4 próbki
ku słońcu (pierwsza z detalem), jedna próbka ku górze jako zacienienie zagłębień, drugi człon Beera 0,22. Warstwa
0,9–13 jednostek. Poświata wokół słońca mnożona przez przepuszczalność chmur (była dodawana na wierzch i zmywała niebo
pod słońce przy wichurze). Ławice mgły od deszczu: 0,08 zamiast 0,3 natężenia deszczu, mgła zostaje przy pogodzie
mglistej. Koszt: po dodaniu szumu komórkowego zrzut 596×480 w SwiftShader przekraczał limit, po ograniczeniu próbek
mieści się (2 min 40 s na planszę); czasu klatki na telefonie nie zmierzono.

**17.11, chmury z tekstury szumu 3D (orkiestrator, po pytaniu właściciela o efekt 1:1 bez ograniczeń sprzętowych).**
Presety ultra i cinematic (`cloudOctaves` 6) przy WebGL2 czytają kłęby z tekstury 3D 64³ RGBA generowanej przy starcie
z całkowitoliczbowego hasha (`engine/src/shaders/cloud-noise.ts`): R, G, B to odwrócony szum Worleya o 4, 8 i 16
komórkach na kafel (27 sąsiadów, zawijanie), A to kafelkowy szum wartości do wyginania dziedziny. Wzorzec: tekstura
bazowa Perlin-Worley Schneidera 2015; różnice: kanały trzymane osobno i ważone w shaderze, część Perlina zastąpiona
szumem wartości. Jeden odczyt daje trzy skale, więc wariant ma sześć skal, 96 kroków i 6 próbek ku słońcu. Preset high
i WebGL1 zostają przy szumie liczonym w shaderze. Stanowisko `tools/sky/sky-test.mjs` działa na WebGL2, argument
`octaves` 6 pokazuje wariant teksturowy. Pamięć: 1 MB tekstury. Nie zmierzono czasu generowania na telefonie ani czasu
klatki na GPU.

**17.11, niebo przy wichurze (orkiestrator).** Plansza `side-dark` miała w grze gładkie, ciemne niebo. Przyczyny po
kolei wykluczone zrzutami: ławice mgły i zasłony deszczu (wyłączone w żywej scenie, bez zmiany), preset (domyślny to
high, objętościowy). Właściwa przyczyna: przy pokryciu 0,8 mapa pokrycia dawała wszędzie pełną wieżę, czyli jednolitą
płytę grubości 12 jednostek bez przerw. Próg wież zależy teraz słabiej od pokrycia (0,42 zamiast 0,55), więc przy
wichurze zostają cieńsze miejsca i przerwy, a przy sztormie jedna szczelina; drugi człon Beera 0,3·exp(−1,1·τ) przepuszcza
więcej światła przez cienkie miejsca; płat fazy do przodu ograniczony do 3,2 (było 1,6). Pas przy horyzoncie pod ciężkim
niebem zamyka przyćmiona mgiełka dalekich chmur (`lid`), bo jasna szczelina pod pokrywą nie występuje w klatkach.
Mgiełka chmur przy horyzoncie do ok. 6° (było 11°). Skutek uboczny: przy pogodzie `fresh` (0,45) chmur jest mniej niż
przed zmianą. Ujęcie `deck` wraca do kamery pokładowej gry; ustawienie jak w `ref_112` zostaje do zrobienia.

**17.11, przenikanie części statku (orkiestrator, „Bierz”).** Części w katalogu mają bryły (kapsuła dla drzewc, dział
i lin, prostopadłościan w układzie kadłuba dla zabudowy; Ericson, „Real-Time Collision Detection”, rozdz. 4–5), a
`auditClashes` zgłasza pary, które nie mogą się przecinać. Różnica wobec wzorca: kapsuła–prostopadłościan liczona w 17
punktach osi kapsuły zamiast dokładnie. Audyt na kadłubach z modeli (z prawdziwymi profilami burt) wykrył cztery wanty
bezanmasztu galeonu w kasztelu; stopy want są teraz przesuwane przed kasztel. Działo w kasztelu jest dozwolone tylko
z furtą (`port:<nr działa>`), bo działa w kajutach rufowych strzelały przez furty; furta to ciemny otwór z ramą i
podniesioną klapą. Baksztagi schodzą do burty modelu (były do burty kadłuba fizycznego, ponad metr poza modelem na
rufie). Maszt przechodzący przez pokład kasztelu nie jest regułą audytu: maszty przechodzą przez pokłady.
Żagle rejowe wisiały w osi masztu; teraz reja wisi 0,42 m przed masztem po stronie dziobu (`foreSide`), a tkanina ma
jeden kolider, walec masztu o promieniu 0,3 m (Müller i in. 2007, §3.4, bez tarcia). Położenie dział liczy jeden moduł
`gun-layout.ts` dla siatek i dla listy części.

**17.11, piana, kamera pokładowa, załoga (orkiestrator, „lecimy dalej”).** Piana w shaderze oceanu to koronka z szumu
komórkowego (F2−F1, Worley 1996) w dwóch skalach, gęstniejąca do pełnej plamy; bez tekstury, bo ten sam kod liczy
grzbiety, kilwater i przybój. Kamera pokładowa stoi na przełamaniu pokładu rufowego (4,6 m nad pokładem, 8 m za
grotmasztem) i patrzy lekko w dół; niżej przednia część kadłuba zasłaniała pokład. Załoga na kadłubach z modeli jest
rozmieszczana z profilu burty i kasztelu (`crew-layout.ts`): rząd przy balustradzie rufowej, reszta na śródokręciu,
liczba jak dotąd (szósta część załogi, najwyżej 40); znikają w miarę strat jak wcześniej.

**17.11, figurki załogi (właściciel: „postacie z SekiSenshi”, potem „poszukaj w sieci”, „popraw jakość”).** Modele VRM z
folderu SekiSenshi odrzucone na prośbę właściciela (współczesne stroje, jeden na licencji niekomercyjnej). W sieci:
rejestr Open Source Avatars (CC0) ma prawie wyłącznie kreskówkowe postacie, a zestaw piracki Quaterniusa proporcje chibi;
wybrane darmowe paczki Quaterniusa (CC0) o realistycznych proporcjach: stroje „Peasant” i „Ranger” wyglądają jak
ubiór marynarzy XVII–XVIII w. Postać składa skrypt (strój, głowa wycięta z postaci bazowej po kościach szyi i głowy,
fryzura), pozuje jedną klatką animacji i wypieka skinning na CPU (glTF 2.0, liniowe mieszanie kości) do statycznej
siatki; wszystkie tekstury w jednym atlasie, żeby gra rysowała figurki instancjami jednego materiału. 5 tys. trójkątów
na postać (pierwsza wersja z kolorem w wierzchołkach i 1,6 tys. była zbyt zgrubna); widoczne tylko z bliska (jak drobne
detale). Gra ładuje plik bez korzenia glTF, więc jego przeliczenie układu wpieka się w wierzchołki przy ładowaniu.
Następny etap (D2): animacje i role ze stanu symulacji.

**17.11, brasowanie z czasem (reguła symulacji, D1; właściciel: „wstaw do kolejki”).** Kąt rei był ustawiany
natychmiast na najlepszy do wiatru pozornego. Teraz reje i bomy dochodzą do niego z prędkością `BRACE_RATE`: rejowe
6°/s (70° zakresu w ok. 12 s), skośne 18°/s, razy udział załogi (min. 0,15) i stan olinowania (0,35 + 0,65 ×
olinowanie); siła z kąta, który reja ma teraz. Skala gry: na okrętach epoki przebrasowanie wszystkich rej przy zwrocie
trwało blisko minutę. Złoty hash c420eba5 → 81d3dd8a. Audyty: biegunowy, zwrotów i bitew zielone. Audyt rozgrywki
na 3 ziarnach padł, bo jego próg wymagał opłaconego zlecenia, a autopilot przed zmianą miał jedno zlecenie na trzech
(i sześciu) ziarnach, wygrane przypadkiem: po zmianie przypływa 6 s wcześniej, dostaje eskortę galeonu i eskortowany
statek poddaje się napastnikom. Nawigacja na sześciu ziarnach nie jest gorsza (ziarno 11 dopiero teraz dociera do
portu, 3 i 21 o 1–2 min później, 33 i 45 nie docierały już wcześniej). Próg audytu zmieniony zgodnie z jego opisem
(blokady): co najmniej jedno zlecenie wzięte i żadne niezakończone; liczba opłaconych jest raportowana. Do zrobienia:
autopilot bierze zlecenie rzadko (1 na 6 ziaren), ziarna 33 i 45 nie docierają do portu w 20 min.

**17.11, żywa załoga, część 1 (właściciel: „więcej postaci, różne operacje, ruchome, zależnie od ruchu statku i decyzji
gracza”).** Wzorzec: tekstury animacji wierzchołków (GPU Gems 3, rozdz. 2 „Animating Crowds”; w Babylonie
`BakedVertexAnimationManager`): macierze kości każdej klatki w teksturze, klip i faza na instancję, jedno wywołanie
rysowania na wariant postaci. Własny wypiek w `tools/assets/crew-anim.mjs` zamiast `VertexAnimationBaker` Babylona,
bo ten odtwarza tylko animacje przypięte do szkieletu, a biblioteka Quaterniusa ma animacje węzłów glTF; układ tekstury
ten sam co u Babylona. Szkielet biblioteki ma krótszą szyję niż postacie: brane są obroty kości i przesunięcie miednicy
przeskalowane do wysokości bioder postaci. Gra buduje siatki sama z pliku binarnego (bez ładowarki glTF), więc postać
jest lustrzanym odbiciem (lewa z prawą), co dla marynarza nie ma znaczenia; rysowane obie strony. Czas klipów = czas
symulacji (ta sama scena przy tym samym ziarnie). Stanowiska obsadzane w kolejności: ster, mars, reling kasztelu,
fały, brasy, działa pokładu górnego (najwyżej ćwierć ludzi), śródokręcie; przy stratach pustoszeje najpierw śródokręcie.
Statyczne figurki (`crew-figures.mjs`, `crew.glb`) usunięte. Plik 3,4 MB.


**17.11, piorun (C6).** Kształt kanału: przesunięcie punktu środkowego (Reed i Wyvill 1994, „Visual simulation of
lightning”), 7 poziomów podziału, 2–5 gałęzi odchodzących w dół; ziarno z pozycji uderzenia, więc ten sam piorun przy
tym samym zdarzeniu, bez `Math.random`. Rysowany rurami z materiałem emisyjnym ponad 1 (łapie bloom): kanał 0,9 m,
gałęzie 0,35 m. Jasność z krzywej trzech wyładowań zwrotnych (0; 0,11; 0,26 s, szczyty 1; 0,75; 0,55; Uman 1987,
„The Lightning Discharge”: kilka wyładowań w jednym kanale co kilkadziesiąt ms), kanał widoczny tylko w impulsach,
całość 0,5 s. Niebo i chmury dostają uniform `lightning` (kierunek od oka do uderzenia i jasność): słaby wzrost
wszędzie i silny w stronę kanału. Współczynniki dobrane zrzutem: przy nocnej ekspozycji mocniejsze bieliły całe niebo
i chowały kanał. Kierunek sprawdzony pomiarem jasności lewej i prawej strony kadru dla uderzeń po obu stronach.
Uwaga do narzędzia zrzutów: `tools/shots/shot.mjs` serwuje `packages/app/dist`, więc po zmianie kodu przed zrzutem
trzeba `pnpm build`.

**17.11, wspinaczka załogi (D2 część 3; właściciel podrzucił animacje wspinania).** Cztery klipy Mixamo („Climbing
Ladder”, „Climbing A Rope”, „Climbing Up Wall”, „Climbing To Top”) z Drive właściciela. FBX czyta `tools/assets/fbx-anim.mjs`
(FBXLoader i AnimationMixer z three.js w Node, `three` jako zależność narzędzi); gotowy konwerter FBX2glTF z npm odpadł,
bo to obcy program binarny. Przeniesienie na szkielet Quaterniusa (`tools/assets/retarget.mjs`): metoda „różnicy w
układzie świata” jak `SkeletonUtils.retarget` z three.js: obrót kości źródła względem jej pozy spoczynkowej, w układzie
świata, nakładany na pozę spoczynkową kości celu; przedtem każda kość celu obrócona tak, by w spoczynku wskazywała
tam, gdzie kość źródła (poza T Mixamo kontra poza postaci). Skręt kości wzdłuż jej osi nie jest dopasowywany (tu
pełne retargetery, np. HumanIK, robią więcej); na zbliżeniu niewidoczne. Układy obu szkieletów z bioder, głowy i ud,
klip obrócony przodem do postaci w pierwszej klatce, przesunięcie bioder w skali długości nóg. Klipy zapętlone mają
zdjęty stały przyrost wysokości (wspinaczka w miejscu), a nagłówek pliku podaje wzniesienie na cykl (drabina 0,50 m na
0,77 s), przesunięcie i zasięg rąk; grę porusza człowieka sama (ruch korzenia sterowany przez grę, jak animacje „in
place” w Unrealu), a klatkę klipu bierze z tej samej pozycji, więc ręce i nogi idą w takt wznoszenia, a schodzenie to
ten sam klip wstecz. Topman przy każdej drabince want pod marsem (do 6 na galeonie), w kolejności obsadzania po
brasach: wchodzi, gdy na jego maszcie stawia się albo zwija żagiel, zostaje na marsie 20 s po robocie, potem schodzi;
pochylony wzdłuż wanty, przodem do masztu, ręce na wyblinkach (zasięg rąk z klipu). Klipy liny i ściany wypieczone na
później (wejście po linie, abordaż przez burtę). Plik postaci 3,85 → 4,45 MB. W zrzutach (`shot.mjs` przewija symulację
bez klatek renderu) pozycje topmanów ustawiane ręcznie przez `SHOT_EVAL_FIRST`.

**17.11, kamera filmowa (C5).** Oko w trybie `cinematic` jedzie po fali jak kamera na pławie albo łodzi: wysokość
oka to wysokość morza w tym punkcie plus prześwit ok. 1,3 m, wygładzona wykładniczo (1 − e^(−2,5 dt)), więc długą falę
oko przechodzi, a na krótkiej zostaje w tyle i grzbiet zalewa obiektyw (linia wody i krople po wynurzeniu już były
w `grade.ts`). Co 45 s prześwit spada pod zero na ok. 2 s (zanurzenie jak w `ref_158`–`ref_165`), a celownik płynnie
unosi się o ok. 40° ku powierzchni i wraca po wynurzeniu. Orbita 1,8 długości statku (26–90 m), obrót raz na ok. 2 min.
Kamera orbitalna miała górny limit kąta 1,78 rad, który przy patrzeniu w górę wyrzucał oko na 42 m: w tym trybie
limit 2,9. Przy okazji: w shaderze spodu fali kąt widzenia liczono względem normalnej skierowanej w dół, więc okno
Snella nigdy się nie pokazywało (pod wodą była ciemna toń); po poprawce okno pokazuje niebo i słońce, a spód ma te
same drobne zmarszczki co wierzch. Rozmycie ruchu przy obrocie zostaje na później (osobny przebieg postprocesu, koszt
na telefonie).

**17.11, olinowanie i płótno (C4).** Do lin ruchomych doszły topenanty (dwie na każdą reję rejową, od nok do masztu
nad reją: do stopy rei wyższej albo do topu masztu), gejtawy (od rogu szotowego do nok rei tej samej burty: przy
postawionym żaglu biegną wzdłuż liku) oraz fał gafla i topenanta bomu do topu masztu; wzór prowadzenia według Levera
(„The Young Sea Officer's Sheet Anchor”, 1808). Gejtawa idzie do nok rei zamiast do ćwierci rei, bo katalog rogów
żagla zna tylko rogi; różnica przy brasowanej rei jest mniejsza niż przy punkcie na stałe w kadłubie. Katalog części:
rodzaje `lift` i `clewline`, reguła audytu `noLifts`. Płótno: lik dolny wycięty w alfie tekstury (ząbki 0,4–1,8%
wysokości i trzy rozdarcia 5–13% wysokości, dwa przy rogach szotowych), z ziarnem tkaniny; materiał żagla przechodzi
na test alfa, więc cień ma ten sam kształt. Postrzępienie jest jednakowe na wszystkich statkach (zużycie płótna);
dziury po kulach dalej zależą od uszkodzeń masztu.

**17.11, zwinięte żagle (C4).** Płótno zwiniętego żagla rejowego znikało i reje były gołe. Teraz leży na rei jako
wałek (instancje jednej kapsuły na statek, jedno wywołanie rysowania): średnica rośnie z zwiniętą częścią i z
pierwiastkiem powierzchni żagla (ok. 0,55 m dla grota 14 × 8 m, najwyżej 0,7 m), długość 0,94 szerokości żagla,
na wierzchu rei; materiał gładkiego płótna bez szwów i godła. Częściowo postawiony żagiel ma wałek z części zwiniętej.
Żagle skośne i sztaksle bez wałka (gafel i bom zwijane do masztu, sztaksle opuszczane na sztag: do zrobienia).

**17.11, kasztel dziobowy (C4).** Ten sam układ i ten sam budowniczy co kasztel rufowy, w odbiciu lustrzanym: profil
burty czytany od drugiego końca (z → −z), siatka pod węzłem ze skalą z = −1 (Babylon odwraca kolejność ścian przy
ujemnym wyznaczniku macierzy świata). Bez nowego budowniczego, więc deski, listwy, balustrada, furty i schody są te
same. Różnice: ściany 1,7 m (rufowy 2,2 m), długość do 2,5 m przed fokmasztem (najwyżej 16% kadłuba, poniżej 6%
kasztelu nie ma), podłoga na najniższym pokładzie pod kasztelem, a pokład 0,35 m nad najwyższą burtą dziobu (kadłub
modelu wznosi się ku dziobowi i pierwsza wersja kasztelu schowała się w nim), bez koła, okien i latarni. Śródokręcie
załogi kończy się 1,2 m przed jego przerwą. Kształt jest kanciasty wobec `ref_064` (tam dziób wznosi się łagodnie
i kończy galionem): do dalszej pracy.

**17.11, zwinięte żagle, poprawka (właściciel: „te cygara nie wyglądają najlepiej”).** Gładką kapsułę zastąpił
zwój liczony w `furl-geometry.ts` według opisu zwijania u Levera (1808): grubszy środek (płótno zebrane w środku
żagla), zwężenie ku nokom, dwa sejzingi po bokach (po dwa zwoje liny, w ciemnym obszyciu górnego liku tekstury),
przewężenie płótna pod nimi, łuk zwisający między sejzingami (do 0,3 średnicy) i krótsze na zewnątrz, fałdy wzdłuż
zwoju. Faktura: środek tej samej tekstury płótna co żagle (bez godła, z dala od postrzępionego liku dolnego).
Nadal jedna bryła instancjonowana na statek (wierzchołki 585 → ok. 700), koszt rysowania bez zmian.
