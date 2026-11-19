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

**17.11, kasztel dziobowy wycofany (właściciel: „chyba w naszym przypadku nie jest zupełnie potrzebny”).** Ocena:
kadłuby z modeli mają już wznoszącą się burtę dziobu, a dobudowana skrzynia była kanciasta wobec `ref_064` (tam dziób
wznosi się łagodnie i kończy galionem) i kosztowała 50 wywołań rysowania na scenę (trzy statki z modeli: 219 → 269,
+23%). Commit 3c82831 cofnięty w całości (`git revert`); wpis o nim wyżej zostaje jako historia. Jeśli dziób ma
zyskać sylwetkę z referencji, to przez galion i lekkie podniesienie burty w siatce, bez osobnej skrzyni.

**17.11, APK budowany w sesji (właściciel: „buduj mi tutaj podpisane apk”).** `pnpm apk` (`tools/android/apk.sh`):
web build, `cap sync`, Gradle `assembleRelease`, podpis kluczem z repozytorium (ten sam co w CI), plik `Broadside.apk`
wysyłany właścicielowi po zmianach widocznych w grze. Android SDK w `/root/android-sdk` (platforma 36, build-tools 36),
JDK 21 z systemu. Maven Central nie oddaje Gradle'owi części plików z tej sieci, więc lustro Google podawane przez
`-I tools/android/maven-mirror.gradle` (bez zmian w globalnej konfiguracji Gradle). Numer wersji 1000 + liczba
commitów w obu miejscach (CI miało numer przebiegu Actions): APK z sesji i z CI instalują się jeden na drugim jako
aktualizacje, kolejność wyznacza historia gałęzi.

**17.11, galeria rufowa (C4).** Pawęż kasztelu dostała rząd okien galerii co 1,05 m (wcześniej dwa okna co 2,4 m jak
na burtach), pilastry między nimi z listwą nad oknami i otwartą galerię: podłoga na poziomie podłogi kasztelu,
wysunięta 0,75 m za pawęż, balustrada 0,85 m z tych samych tralek co na pokładzie kasztelu (wzór rufy okrętu z XVII
i XVIII w., Chapman, „Architectura Navalis Mercatoria”, 1768). Galeria, pilastry i listwa scalone w jedną siatkę,
tralki dopisane do instancji kasztelu: +2 wywołania rysowania na statek z modelu. Plansza `stern-castle` pokazuje,
że pawęż referencji jest szersza i wyższa niż nasza (kadłub modelu zwęża się ku linii wody): osobna pozycja.

**17.11, kilwater po przebytej drodze (właściciel: „przecięcie wody za statkiem jest zawsze proste i skręca razem
z nim; niech gra pamięta, gdzie płynęliśmy”).** Ślad liczony w shaderze z bieżącej pozycji i kursu był prostym klinem
w układzie statku. Teraz gra zapisuje drogę (ślad okruchów jak historia ścieżki w wstęgach cząstek, np. Niagara w
Unrealu): co 1,6 s pozycja rufy, prędkość i czas, 16 punktów (ok. 24 s, tyle, ile trwa piana kilwateru), a pierwszy
punkt to zawsze rufa teraz. Shader dla każdego piksela szuka najbliższego punktu łamanej i z jego wieku liczy pianę
w osi śladu i ramiona Kelvina (odsunięte o 0,354 × przebytą drogę, zanik 25 s); te same ramiona podnoszą wodę w
shaderze wierzchołków. Przy kadłubie bez zmian: fala dziobowa, woda przy burtach, dolina pod rufą. Budżet uniformów:
3 statki najbliżej kamery × 16 punktów (52 wektory), z testem odległości od środka śladu, żeby piksele daleko od
śladów nie liczyły odcinków. Ślad jest widokiem (silnik), symulacja i złoty hash bez zmian. Niesprawdzone na
telefonie: limit uniformów fragment shadera (WebGL2 gwarantuje 224 wektory, telefony zwykle mają więcej).

**18.11, proste sterowanie (D3; właściciel: „gracz zaznacza, gdzie chce płynąć, a marynarze ustawiają wszystko; rysuję
przed sobą białą kreskę, statek płynie w tym kierunku; oryginalne sterowanie zostaje, ale nie domyślnie”).**
- Komenda `navigate` (trasa punktów, `hold`) i system pilota w `createSystems()` po kapitanach, przed sterem. Pilot to
  ta sama sztuka żeglarska co patrole AI: kurs na punkt zamieniony na możliwy do żeglugi i ominięcie mielizn
  (`clearHeading`, teraz eksportowany), kurs dla sternika; zwroty i zwroty przez rufę robi istniejący system steru.
- Pod wiatr inaczej niż AI: AI zmienia hals z zapasem 23°, co przy zwrotach przez rufę (każdy to 70–100 m straty z
  wiatrem) dawało ujemny postęp. Pilot płynie jednym halsem do laylinii i robi jeden zwrot (zasada regatowa), z
  poprawką na dryf (mierzony kąt między kursem a drogą, wygładzony) i 0,1 rad zapasu na stratę przy zwrocie. Statek
  rejowy idzie realnie ok. 82° od wiatru, więc 200 m pod wiatr to ponad kilometr halsowania (test: do 700 s).
- Tapnięcie: cel; u celu załoga zwija żagle (statek wytraca prędkość). Narysowana linia: punkty co 15 m (najwyżej 24),
  po ostatnim statek trzyma kierunek ostatniego odcinka pod żaglami. Bez postawionych żagli załoga stawia pełne.
  Żagle gracz dalej ustawia sam (szybciej, wolniej); ster (A i D albo przyciski w trybie klasycznym) kasuje trasę.
- Gesty: w trybie prostym przeciągnięcie jednym palcem lub lewym przyciskiem rysuje, a kamera obraca się prawym
  przyciskiem; przybliżanie dwoma palcami i kółkiem bez zmian; drugi palec przerywa rysowanie. Tapnięcie: ruch do
  10 px i do 0,5 s. Punkt na wodzie z promienia kamery (`pickWater`, poziom morza). W trybie prostym znikają przyciski
  steru. Ustawienie w ustawieniach (Sterowanie: Wskaż i płyń / Ster), pamiętane na urządzeniu.
- Trasa w zapisie gry (pole opcjonalne, stare zapisy bez niej się wczytują). Złoty hash bez zmian (bez trasy system
  nic nie robi).

**18.11, HUD: skalowanie i wygląd (właściciel: „zrób skalowanie interfejsu, aby nic na siebie nie nachodziło; wybierz
czcionkę pasującą do gry i uatrakcyjnij HUD”).**
- Układ: zamiast paneli ustawianych bezwzględnie z kilkoma progami szerokości, siatka CSS z obszarami (lewa kolumna:
  żagle i zlecenie, góra: walka, prawa kolumna: kompas i cel, dolne rogi: ogień, dół: ster, kamera i ustawienia, środek
  wolny dla morza, panel portu u dołu środka). Wszystkie wymiary w jednostce `--u` = mniejsze z szerokość/960
  i wysokość/540 (ograniczone do 0,55–1,7 px): projekt zawsze mieści się w ekranie, więc obszary nie mogą się spotkać.
  Wzorzec: skalowanie interfejsu do rozdzielczości odniesienia, jak Canvas Scaler w Unity („Scale With Screen Size”,
  dopasowanie do mniejszego boku); od wzorca różni się drugą ramką dla niskich ekranów (760 × 430), bo przy jednej
  ramce pismo na telefonie spadało do 5,6 px.
- Sprawdzanie: `tools/ui/ui-audit.mjs` (Playwright) dla 15 rozmiarów od 568 × 320 do 2560 × 1440, w angielskim z prostym
  sterowaniem i w polskim z klasycznym: nakładanie obszarów, wyjście poza ekran, przewijanie kolumn, pismo poniżej 8 px,
  okno ustawień w ekranie; zrzuty i raport.
- Czcionki: Cinzel (kapitaliki z rzymskich inskrypcji) w tytułach i przyciskach, EB Garamond (antykwa Garamonda z XVI w.)
  w tekście. IM Fell English SC odpadł, bo nie ma polskich znaków. Obie na licencji OFL, wbudowane przez `@fontsource`
  (APK działa bez sieci).
- Wygląd: panele z ciemnego drewna z mosiężnym obramowaniem i nitami, przyciski jak grawerowany mosiądz (wybrany:
  polerowany), przyciski ognia w czerwonym laku z mosiężnym rantem, kompas z mosiężnym pierścieniem i różą 32
  kierunków, komunikaty na pasku pergaminu. Przyciski żagli w dwóch rzędach (pełne nazwy w obu językach), wiersze
  masztów zwinięte pod przyciskiem na każdym ekranie.

**18.11, rozkazy po tapnięciu i efekt kursu (D5; właściciel: „fajny efekt na rysowanie w wodzie; interakcje przez
tapnięcie, np. abordaż po podpłynięciu; całość wydziel ładnie SRP i deterministycznie”).**
- Tapnięcie to rozkaz zależny od kontekstu (wzorzec z gier strategicznych: ten sam gest idzie na wolny teren i atakuje
  wroga): wrogi statek: abordaż; inny statek: płynięcie w jego szyku; port: wejście na redę i stop (panel portu); fort:
  dojście na odległość szturmu, desant, jeśli działa uciszone, inaczej dryf na pozycji ostrzału; własny statek: stop
  (koniec trasy, żagle zwinięte); woda: płyń tam. Cel z najbliższego obiektu w zasięgu palca na ekranie (statek: pół
  długości na ekranie, min. 28 px), czysta funkcja `tap-targets.ts`, dane z `presenters/tappables.ts`.
- Symulacja (deterministyczna, bez losowania): komenda `pilot` (abordaż, eskorta, szturm) obok `navigate` (trasa).
  Pilot podzielony według odpowiedzialności w `sim/ai/pilot/`: `state.ts` (rozkazy jako dane, zapisywane z grą, stare
  zapisy tłumaczone `upgradePilot`), `seamanship.ts` (jedyna umiejętność: kurs na punkt z laylinią i dryfem), `route.ts`,
  `board.ts` (pościg z wyprzedzeniem jak „pursuit” Reynoldsa, żagle zmniejszane z odległością, żeby zrównać prędkość;
  abordaż istniejącą komendą, gdy `canBoard`), `follow.ts` (trzymanie pozycji z konwojów AI, ale z pełnymi żaglami,
  gdy statek zostaje za daleko w tyle), `assault.ts`, `pilot.ts` (wybór modułu według rodzaju rozkazu: Strategy przez
  dane). System pilota tylko wykonuje wynik: kurs, żagle, komendy. Złoty hash bez zmian.
- Aplikacja: sterowanie gracza wydzielone z `GameSession` do `PlayerHelm` (klasyczny ster, trasy, rozkazy; sesja miała
  21 metod przy limicie 20). Gesty (`course-gestures.ts`) nie znają rozkazów: dają tapnięcie albo narysowaną linię.
- Efekt na wodzie (`course-view.ts`, `shaders/course.ts`): kurs jako świetlista nić z jasnym rdzeniem, impulsami
  płynącymi wzdłuż drogi i iskrami jak słońce na pianie; rysowana linia jaśniejsza, po puszczeniu rozpływa się (0,8 s);
  tapnięcie puszcza kręgi na wodzie; cel ma oddychający pierścień z echem w kolorze rozkazu (biały: płyń, złoty: port,
  czerwony: abordaż i szturm, morska zieleń: eskorta). Animacja z czasu symulacji (zrzuty powtarzalne).
- Propozycje dalszego sterowania zapisane w backlogu jako D6, do decyzji właściciela.

**18.11, sterowanie, druga partia (D6; właściciel: „wszystkie pomysły dobre, możesz wdrażać”).**
- Trasa omijająca wyspy: A* (Hart, Nilsson, Raphael 1968) po siatce dna co 40 m, 8 sąsiadów, heurystyka oktylowa,
  remisy rozstrzygane numerem komórki (deterministycznie), bez ścinania rogów lądu; potem naciąganie sznurka. Liczone
  raz przy rozkazie dla odcinków nad lądem lub mielizną; odcinek po czystej wodzie zostaje taki, jak go narysowano.
  Pościg, eskorta i atak dalej omijają mielizny na bieżąco (`clearHeading`).
- Refowanie: rozkaz stały `crew` (komponent `reefing`, zapisywany), domyślnie włączony w grze. Raz na sekundę: maszt
  ponad 0,95 wytrzymałości (próg ostrzeżenia w HUD) traci stopień żagla; po 8 s obciążenia poniżej 0,55 stopień wraca,
  najwyżej do poziomu ustawionego przez kapitana (jego rozkazy i rozkazy pilota zapisują „chciany” plan). Komunikaty
  w HUD.
- Atak burtą (przytrzymanie na wrogu albo linia z własnego statku na wroga): walka kapitanów AI (`captain.engage`:
  zasięg doktryny, burta naładowana, wyprzedzenie celu, działa pościgowe i moździerz), bez wyboru amunicji, beczek,
  min i abordażu, które zostają graczowi; zasięg walki 220 m. Koniec, gdy wróg się podda albo tonie.
- Kolejka punktów: przytrzymanie na wodzie (550 ms bez ruchu) albo Shift+klik dopisuje punkt; `navigate` z `append`.
  Przytrzymanie na statku otwiera menu: abordaż, atak (tylko wróg), płyń za nim. Przycisk „Anuluj kurs” na dole.
- Obrót dwoma palcami: zmiana kąta linii między palcami obraca widok (jak na mapie), przybliżanie zostaje Babylona.
- Stożek martwego kąta: podczas rysowania czerwonawy wachlarz od oka wiatru do granicy na wiatr (74° rejowe, 50°
  skośne); laylinie, gdy cel trasy leży w martwym kącie.
- Wibracje: wtyczka Capacitor Haptics (na stronie Vibration API), lekki impuls przy własnej salwie, średni przy
  trafieniu i wejściu na mieliznę, mocny przy upadku masztu, wybuchu prochowni, zderzeniu; najmocniejszy z klatki,
  nie częściej niż co 0,12 s; przełącznik w ustawieniach.

**18.11, AI wokół wysp.** Kapitanowie AI w patrolu i handlu sterowali prosto na punkt (z omijaniem mielizn na
bieżąco), więc port za wyspą pod wiatr bywał nieosiągalny (seed 3). Teraz biorą drogę z tego samego planera co pilot
gracza (A* po dnie i naciąganie sznurka), liczoną raz, gdy punkt się zmienia, i trzymaną w stanie kapitana (zapis
gry, determinizm); punkt zwrotny uznany za minięty w 80 m. Na czystej wodzie droga to sam punkt. Złoty hash bez
zmian (przebieg wzorcowy nie ma archipelagu); audyty liczbowe po zmianie w raporcie poniżej.
Audyty po zmianie: cztery z pięciu zielone za pierwszym razem; test wytrzymałości dał 2,56 ms/krok (limit 2 ms,
ADR-0005), bo planer kosztował ok. 4,7 ms na plan, a audyt liczył się obok renderowania plansz. Poprawka: siatka A*
wyrównana do stałej kraty 40 m i dno w jej węzłach zapamiętane na mapę (`gridBed`, archipelag się nie zmienia),
a naciąganie sznurka sprawdza widoczność po już policzonej siatce zamiast czytać dno co 10 m: 1,6–1,9 ms na plan
(z 4,7). Test wytrzymałości osobno: 0,97 ms/krok.

**18.11, noc jak w referencji (C1, `night-bow` kontra `ref_075`).** Nocne klatki klipu są ciepło szare, kolor mają
tylko światła: latarnie i godła na żaglach podświetlone od tyłu na bursztynowo, z ciemnym godłem na tle światła.
U nas noc była brązowa od sepii, godła białe, a piana jasna. Zmiany: ramp tonowania przechodzi nocą (z jasności
słońca, jak `setNightGlow`) w ciepłą szarość; piksele jasne i mocno ciepłe (stosunek (r − b)/r powyżej ok. 0,35)
są tonowane do 75% słabiej, więc bursztyn przeżywa, a drewno w słońcu nie łapie się na to; mapa świecenia żagla
ma węższy, głęboko pomarańczowy krąg i ciemne godło (to samo miejsce i rozmiar co na płótnie), siła 2,4 zamiast 3
(przy 3 kolor przepalał się do bieli przed tonowaniem); jasność piany z koloru światła i nieba zamiast z wysokości
„słońca” (nocą to księżyc pod chmurami). Kadr sceny bliżej (70 m zamiast 115).

**18.11, szeroka, płaska rufa (C4, `stern-castle` kontra `ref_090`).** Na klatce rufa galeonu to wysoka płyta od
relingu prawie do wody, szeroka na ok. trzy czwarte rei; u nas kasztel zwężał się z zaokrągloną rufą modelu,
a pod nim widać było krągły tył kadłuba, więc sylwetka od rufy była wąska. Zmiany: kasztel rufowy nie węższy niż 0,82
największej szerokości kadłuba pod nim (nadbudówka galeonu wystaje nad zwężającą się rufą); płaska pawęż z desek od
podłogi kasztelu do 0,9 m nad wodą, zwężająca się trapezem do szerokości kadłuba u dołu (kwadratowa rufa galeonu),
z trzema listwami w poprzek. Wszystko w siatce ścian kasztelu (bez nowych wywołań rysowania poza listwami).

## 18.11 Mgła rośnie z zachmurzeniem, chmury z tekstury na presecie high (orkiestrator, M9 C2)
Plansza `horizon` (ref_152): na klatce pełne zachmurzenie i zamglony horyzont, u nas ostre wyspy i gładkie bryły chmur.
Gęstość mgły zależy teraz od pokrycia w potędze 1,5 (`0.0006 + 0.0028·cover^1.5 + 0.006·fog`), więc pogodne niebo
zostaje przejrzyste, a pod ciężkim niebem horyzont szarzeje. Preset high przechodzi na chmury z tekstury szumu 3D
(`cloudOctaves` 6, jak ultra): na stanowisku `tools/sky/sky-test.mjs` (SwiftShader) wariant proceduralny z 5 oktawami
liczył się 3,58 s, teksturowy 2,71 s, a ma drobniejszą fakturę. Na WebGL1 silnik i tak wraca do wariantu proceduralnego.

## 18.11 Warstwa stratusów między kłębami, węższa poświata słońca, ciemniejsza mgiełka (orkiestrator, M9 C2)
Plansze `horizon` (ref_152) i `side-dark` (ref_060). Pod ciężkim niebem przerwy między kłębami były czystym, prześwietlonym
niebem, a horyzont jasnym pasem; na klatkach całe niebo jest zachmurzone, słońce przebija cienką warstwę, horyzont jest
szary. Zmiany: za kłębami cienka warstwa stratusów na płaszczyźnie (grubość `smoothstep(0.3, 0.7, cover)`, szarpana trzema
skalami szumu, szara od światła dnia, srebrzysta w wąskim stożku wokół słońca); prześwietlony rdzeń słońca w wariancie
objętościowym węższy (`pow(c, 64)` zamiast `pow(c, 5)`); mgiełka horyzontu i mgła sceny przyciemnione tą samą krzywą
(`hazeShade` w `look.ts`, `horizonHaze` w `shaders/sky.ts`, do 0,6 przy pełnym zachmurzeniu); iskry na wodzie gasną od
pokrycia 0,5 (było 0,55) prawie do zera przy 0,85. Na stanowisku nieba wariant proceduralny (3 oktawy) bez zmian.

## 18.11 Jaśniejsze półtony sepii (orkiestrator, M9 C1)
Pomiar percentyli jasności na planszach (gra kontra klatka, siedem scen) pokazał, że czerń mamy jak klip, ale dolny
kwartyl i mediana są o 10–40 poziomów za niskie. Próba z mniejszym kontrastem (1,3 i cienie −12) dała 3–4 poziomy i
rozjaśniła czerń wichury ponad klatkę, więc odrzucona. Ekspozycja looku sepii 0,95 → 1,15: rufa pod słońce mediana
41 → 51 i 75. percentyl 96 → 117 (klatka 82 i 148), bok w wichurze 75. percentyl 72 → 83 (klatka 87), noc lekko ponad
klatką (56 przy 46). Ujęcie rufy pod słońce (ref_090) jest dalej czarne tam, gdzie klatka pokazuje okna i galerię:
następny krok to światło na pawęży (latarnie, okna), bo samo rozproszone niebo daje tam ok. 1/4 światła słońca.
Narzędzie: `SHOT_INSPECT` z kątem „@a” względem kursu (ujęcie rufy z wiatrem).

## 18.11 Dolny rząd okien rufowych, lampy zapalane o zmierzchu (orkiestrator, M9 C4)
Na ref_090 rufa ma dwa rzędy okien i świeci od środka, zanim zapadnie noc. U nas pawęż pod kasztelem była gładka, a
szyby i latarnie zapalały się dopiero razem z godłami żagli. Zmiany: na pawęży między dwiema górnymi listwami rząd okien
mesy oficerskiej (rozstaw 1,4 rozstawu galerii, bez balkonu; galeria dalej tylko przy oknach kasztelu); `setNightGlow`
dostaje wysokość słońca i lampy (szyby kasztelu, latarnie) rozjaśnia już od wysokości 0,45 do 45% przy 0,1, godła żagli
dalej tylko nocą. Scena `stern-castle` z kamerą 52 m za rufą. Zostaje: rufa na klatce jest szersza względem rej niż u nas,
piana kilwateru przy skręcie układa się w grube komórki.

## 18.11 Drobniejsza piana kilwateru (orkiestrator, M9 C3)
Koronka piany kilwateru miała komórki ok. 1,1 m: z 40–50 m za rufą układała się w siatkę z dziurami. Teraz komórki
kilwateru są 2,6 raza mniejsze od komórek grzbietów fal i leżą na miękkim mlecznym podkładzie z szumu fbm (do 0,55
krycia), więc z daleka piana czyta się jako biały pas, z bliska jako pęcherzyki.

## 18.11 Żagle przeświecają pod słońce (orkiestrator, M9 C4)
Na ref_124 i ref_090 ciemne żagle między kamerą a słońcem mają ciepłą poświatę i widoczne godła; u nas były jednolicie
czarne. Wzorzec: przeświecanie cienkiej powierzchni jak liście w Crysis (Sousa, GPU Gems 3 rozdz. 16): światło z tylnej
strony płótna, N·(−L) po stronie widzianej, z płatkiem rozpraszania w przód `pow(−V·L, 4)`. Wtyczka materiału Babylona
(`MaterialPluginBase`, `sail-translucency.ts`) na każdym sklonowanym materiale żagla, kod przed kolorem końcowym; światło
kluczowe (słońce albo księżyc) wspólne dla sceny, aktualizowane co klatkę. Różnice: bez mapy grubości (płótno jest równe)
i bez cienia (żagiel zasłonięty innym też prześwieca). Przepuszczalność 0,07 dobrana na planszach: 0,32 i 0,1 robiły z
żagli pod słońce jasne płótno jak oświetlone od przodu. Scena `quarter-close` od dziobu ze słońcem za rufą.

## 18.11 Mokry pokład na kadłubach z modeli (orkiestrator, M9 C1)
Pozycja z backlogu „plamy słońca na mokrych deskach”: kadłuby z modeli mają jeden materiał na pokład i burty, prawie bez
połysku. Wtyczka `WetDeck` (`wet-deck.ts`, `MaterialPluginBase`) podmienia przed pętlą świateł kolor i połysk
odbicia Blinna-Phonga tam, gdzie normalna patrzy w górę (maska nachylenia jak śnieg na płaskim w shaderach terenu):
pokład, wierzchy relingów i luków błyszczą (0,6 i połysk 32), burty zostają matowe; cienie i światła bez zmian. Sprawdzone
ujęciem z boku (burty matowe) i z pokładu pod słońce: efekt jest subtelny, bo przy nisko stojącym słońcu pokład leży w
cieniu nadburć; jasne plamy z `ref_112` wymagają jeszcze światła przez szczeliny między żaglami.
Drugi wniosek tej rundy: jasna przerwa przy słońcu na `horizon` nie pochodzi z promieni (`VolumetricLightScattering`
wyłączony daje prawie ten sam obraz), tylko z samego nieba z ekspozycją i bloomem; zostawiona, bo klip też ma tam
prześwietlenie.

## 18.11 Okno Snella jaśniejsze, scena podwodna na planszach (orkiestrator, M9 C5)
Pozycja „jaśniejsze okno Snella przy wysokim słońcu (`ref_161`)”. Nowa scena `underwater`: kamera filmowa przypięta w
chwili zanurzenia (czas, kąt orbity, głębokość 2,5 m i pochylenie przez `before`, czyli `SHOT_BEFORE` z 15 s klatek po
nim, `SHOT_BEFORE_WAIT` w `shot.mjs`); bez przypięcia kadr zmieniał się między przebiegami, bo kamera jedzie w czasie
rzeczywistym. Zmiany: gradacja pod wodą przepuszcza jasne partie prawie w pełni (wcześniej cały obraz szedł do 55% i
turkusu, więc okno było szarozielone), słońce w oknie ma twardy rdzeń i szeroką poświatę (`pow(·, 6)`), jasność okna
spada ku brzegowi (transmisja Fresnela przy kącie granicznym) i ma smugi zmarszczek z normalnej, brzeg okna miękki
(0,5–0,82 zamiast 0,62–0,7: przy stromej fali twardy próg rozbijał okno na czarne łaty), promienie pod wodą słabsze
(0,2). Kamera pod wodą patrzy w górę ok. 45°. Zostaje: słońce w kadrze sceny (azymut względem kamery), smugi powierzchni
dłuższe jak na klatce.

## 18.11, użytkownik: rozjaśnianie statku w grze, kinowe słońce tylko w widoku kinowym
Właściciel: „Przyda się chyba jeszcze rozjaśnianie samego statku… żeby wygodnie się grało i zawsze było go widać. Takie
słońce kinowe jak referencja proponuję w widoku kinowym”. Wzorzec: światło wypełniające z oświetlenia trójpunktowego,
jak gry oświetlają postać gracza dla czytelności. `ShipFill` (`ship-fill.ts`): światło kierunkowe od strony kamery,
lekko z góry, tylko na siatkach statków (`includedOnlyMeshes`, lista odświeżana przy zmianie statków i co sekundę),
bez odbić i cieni; siła 0,5 za dnia, 0,9 nocą (słońce w południe ok. 1,4). Wyłączone w kamerze kinowej (twarde
światło pod słońce jak w klipie) i parametrem `fill=0`, którego używają plansze porównawcze z klipem. Materiały statków
biorą do 6 świateł, żeby wypełnienie nie wypchnęło świateł błysków luf. Sprawdzone zrzutami: rufa pod słońce czytelna
(deski, galeria, żagle) zamiast sylwetki; nocą w widoku izometrycznym statek widoczny zamiast prawie czarnego.
Przy okazji pod wodą: słońce widziane spod powierzchni wzdłuż załamanego promienia (Snell, n = 1,33), smugi światła
tylko pod słońcem i na ciemnej wodzie, okno Snella przygaszone do 1,8 (słońce jest w kadrze sceny `underwater`, sun=97).

## 18.11 Mniej plamek na morzu z daleka i nocą (orkiestrator, M9 C3)
Na zrzucie izometrycznym nocą całe morze pokrywały jasne kropki. Dwa źródła: iskry odblasku księżyca (mnożnik 70 i
nocna ekspozycja ×2,2) i koronka piany na grzbietach, której komórki (0,4–1,1 m) z wysokiej kamery są mniejsze od
piksela i aliasują w plamki. Zmiany: iskry nocą do 10% dziennych (szeroki połysk zostaje); koronka grzbietów przechodzi
w swoje średnie pokrycie, gdy piksel obejmuje 0,12–0,5 m wody, a drobniejsza koronka kilwateru przy 0,05–0,2 m
(filtrowanie po rozmiarze piksela, `foot = length(fwidth(xz))`, jak przy normalnych iskier). Kilwater z daleka zostaje
widoczny jako miękki pas (średnia 0,85 pokrycia).

## 18.11, użytkownik: optymalizacje bez straty efektów, rozdzielczość na suwaku także dla ultra
Właściciel: „Pomyśl nad jakimiś trickami optymalizacyjnymi które poprawią wydajność bez straty efektów… obniżenie
rozdzielczości na suwaku również dla ultra”. Najpierw pomiar: `tools/perf/frame-bench.mjs` mierzy czas `scene.render()`
z wyłączanymi po kolei częściami (niebo, ocean, statki, cienie, post-procesy), z rozgrzewką po każdym przełączeniu
(przełączenie przebudowuje shadery). SwiftShader liczy na CPU: milisekundy nie są telefonu, udziały kosztu pikseli tak;
MSAA liczy w nim każdą próbkę osobno, więc jego koszt jest tu zawyżony względem GPU. Wyniki 640×360, ziarno 7, 17:00:
- Ultra nie miał wygładzania krawędzi: SSAO prowadzi scenę przez pre-pass Babylona (wiele celów renderowania) z jedną
  próbką, a MSAA ×4 łańcucha post-procesów trafiało dopiero w gotowy obraz. Próbki ustawione na pre-passie: liny i reje
  gładkie (zrzut A/B). Koszt klatki ultra rośnie (na SwiftShader 1,7 → 3,2 s), to cena wygładzania, które było tylko
  w ustawieniach.
- Niebo i chmury objętościowe w połowie rozdzielczości (`skyScale` 0,5 dla high i ultra, pełne dla cinematic i presetów
  bez chmur objętościowych): kopuła rysowana do tekstury half-float (rdzeń słońca dalej powyżej 1 dla bloomu) i pokazana
  jako tło (`Layer`), reszta sceny na wierzchu w pełnej rozdzielczości, więc krawędzie masztów i wybrzeża bez zmian.
  Koszt nieba 110–330 → 31–70 ms (ok. 75% mniej); na planszach `stern-sun` i `horizon` różnicy w chmurach nie widać.
  Wzorzec: wolumetria w obniżonej rozdzielczości z silników gier, u nas bez rzutowania czasowego.
- Ocean: pole komórek Worleya liczone raz zamiast dwa razy na wywołanie koronki, a koronki nie liczy się tam, gdzie z
  daleka i tak zastępuje ją średnia (ocean 693 → 565 ms przy szumie pomiaru ok. ±100 ms).
- Suwak rozdzielczości obok presetu: zmiana samej rozdzielczości nie robi z presetu „własnego” (ultra przy 80% zostaje
  ultra ze wszystkimi efektami). Poniżej 95% lekkie wyostrzenie po skalowaniu (`sharpen` Babylona, siła 1,2 × ubytek, do
  0,45), jak krok wyostrzania w FSR i DLSS. Gęstość pikseli ograniczona do 2: ekran 3x liczył 2,25 raza więcej pikseli
  niż 2x przy różnicy niewidocznej z odległości ręki (tak samo robią three.js i większość gier w przeglądarce).
Nie sprawdzone: czasy na prawdziwym telefonie i GPU.

## 18.11 Poziomy szczegółów dział i kadłubów po odległości (orkiestrator, optymalizacja)
Podział kosztu statków w `frame-bench` (grupy materiałów) pokazał dwa duże koszty na high przy kamerze pościgowej
(ok. 73 m): skany dział (14% klatki; 12 tys. trójkątów na działo, ok. 300 tys. na galeon, rysowane do 140 m i bez
odrzucania poza kadrem) i pełny kadłub z modelu (12%; ok. 250 tys. trójkątów). Zmiany: skan dział do 45 m (kamera
pokładowa i zbliżenia; dalej toczona lufa z tego samego profilu); kadłub z modelu w dwóch poziomach, pełny do 50 m, dalej
lekki (ok. 80 tys., plik `-lite` już budowany dla presetu low), oba wczytywane razem, zanim klasa liczy się jako gotowa
(widok statku powstaje od razu); brak pliku lekkiego zostawia pełny na każdej odległości (przeglądarka statku).
Zrzut A/B z kamery pościgowej: kadłuby nie do odróżnienia. Wynik high w dniu (SwiftShader, 640×360): 2,9 → 1,9 s na
klatkę (−34%), statki 1,19 → 0,32 s.
Dalej ocean (na ultra ok. 45% klatki): pętle po statkach w shaderze wierzchołków (`hullWater`, trzy wywołania na
wierzchołek do normalnej) i pikseli (`wakes`, `hullOcclusion`) pomijają statek, gdy punkt leży poza zasięgiem jego
wyrazów (rufa: e^-6 na 25 m, grzbiet fali dziobowej: trzy długości zaniku), a drobne skale detalu powierzchni (trzy
trójki fbm po cztery oktawy) liczą się tylko tam, gdzie ich waga od rozmiaru piksela jest niezerowa. Wynik bez zmiany w
obrazie (pominięte wyrazy są zerowe). Ultra: 2,56 → 2,23 s, ocean 1,23 → 0,93 s. SwiftShader cieniuje każdą próbkę MSAA
osobno, więc koszt pikseli na ultra jest tu zawyżony względem GPU.

## 18.11 Wybrzeże w warstwach we mgle (orkiestrator, M9 C2)
Klatki `ref_095` i `ref_176`: wzdłuż horyzontu długi, płaski płaskowyż w kilku coraz jaśniejszych warstwach. U nas
pierścień wybrzeża stał 3400 m od kamery w zwykłej mgle sceny (przy gęstości ok. 0,0014 zostawało ok. 1% obrazu), więc
go nie było widać, a jedyne lądy na horyzoncie to bliskie wyspy. Zmiana: dwa pierścienie (2600 m i 3800 m, drugi 1,45
raza wyższy, inne ziarno), bez oświetlenia i bez mgły sceny, z własną perspektywą powietrzną: kolor skały w cieniu (35%
koloru mgły) przechodzi w kolor mgły według `1 - exp(-d * gęstość * 0,35)` (prawo Koschmiedera ze zmniejszonym
wygaszaniem, `coastHaze`, test). Dalsza warstwa wychodzi jaśniejsza, pod ciężkim niebem obie znikają. Plansze
`stern-castle`, `horizon`, `stern-sun`.

## 18.11 Zabłąkane ławice mgły w kolorze nieba (orkiestrator, M9 C1)
Ławice mgły pojawiały się tylko przy pogodzie z mgłą i deszczem i miały stały, jasny kolor (nocą świeciłyby na biało).
Teraz przy zachmurzeniu dryfuje kilka zabłąkanych ławic (6% budżetu przy pokryciu od 0,6; na klipie s. 8–9 ławica
przechodzi przez kadr przy zachodzie z rozbitymi chmurami), a kolor ławic co klatkę idzie za kolorem mgły sceny (ciepły
o zachodzie, szary nocą). Zostawione rzadkie, żeby nie zasłaniały widoku do grania. Tabela stanu w
`docs/reference/README.md` uaktualniona (wiele pozycji ✘ było już zrobionych).

## 18.11 Mokry pokład odbija niebo (orkiestrator, M9 C1)
Na ujęciu z pokładu pod słońce (`ref_112`) cały pokład leży w cieniu żagli, więc połysk od słońca (mnożony przez cień)
nie miał się gdzie pokazać, a na klatce deski są jasne. Mokra powierzchnia oglądana wzdłuż desek odbija przede wszystkim
jasne niebo, którego cień żagli nie zatrzymuje. `WetDeck` dodaje odbicie nieba z członem Fresnela Schlicka (F0 = 0,02 jak
dla wody), kolor nieba z wysokości odbitego promienia (horyzont do zenitu, ten sam gradient co kopuła), tylko na
powierzchniach skierowanych w górę. Bez sondy odbić: relief desek i ciemne zakamarki pod nadbudówkami nie wchodzą.
Plansza `deck`: deski i luki szare i czytelne zamiast czarnej plamy.

## 18.11 Spód powierzchni łagodniejszy i w smugach (orkiestrator, M9 C5)
Plansza `underwater` (ref_161): okno Snella rozpadało się na czarne łaty całkowitego wewnętrznego odbicia, bo widok od
spodu brał pełne nachylenie fal i detalu. Teraz do widoku spod wody normalna jest spłaszczona w połowie ku pionowi (przez
kilka metrów wody zbocza czyta się łagodniej): okno jest okrągłe, z błądzącym brzegiem. Jasność okna dostaje smugi z szumu
rozciągniętego 8 razy wzdłuż wiatru, niebo w oknie przygaszone do 1,4, scena z kamerą pochyloną mniej (0,6), jak na klatce.

## 18.11 Nocne dostosowanie oka do ×2 (orkiestrator, M9 C1)
Po podniesieniu ekspozycji sepii (1,15) jasne partie nocy wyszły ponad klatkę `ref_075` (75. percentyl 56 przy 46).
Dostosowanie oka w nocy z ×2,2 do ×2,0: 75. percentyl 48 przy 46, 95. percentyl 64 przy 67.

## 18.11 Rufa względem rej: bez zmiany kamery kinowej (orkiestrator, M9 C5)
Szeroka rufa na `ref_090` to perspektywa bliskiej kamery. Kamera kinowa krąży na 1,8 długości statku, 1,3 m nad wodą
(kąt 0,9 rad); żeby rufa wyszła szersza od rej, musiałaby podejść na ok. 1,3 długości, a wtedy ucina wierzchołki masztów
(potrzebny pionowy kąt ok. 41°), podczas gdy klatka pokazuje cały statek z niebem nad nim. Zostaje jak jest; wcześniej
sprawdzony szerszy kasztel (0,95) też nie zmieniał obrazu.

## 18.11 Jaśniejszy, wyższy pas mgły pod słońcem; wybrzeże bledsze (orkiestrator, M9 C2)
Klatki `ref_020`, `ref_090`: pod nisko stojącym słońcem horyzont to szeroki, jasny pas mgły bez ostrej linii morza, a
wybrzeże ledwo z niego wychodzi. Zmiany: pas mgiełki nieba sięga pod słońcem do ok. 11° (było stałe 5°) i świeci mocniej
(×1,6); mgła nad morzem rozprasza słońce dwoma płatkami (szerokim `pow(·, 3)` i rdzeniem `pow(·, 12)`) zamiast jednego
wąskiego; wybrzeże z mocniejszym zamgleniem (współczynnik 0,5) i jaśniejszym światłem powietrza (do ok. 1,1 koloru mgły,
bo pas na horyzoncie jest jaśniejszy od mgły sceny). Trzy próby na planszy `stern-castle`: 0,65 zostawiało ciemny pas,
0,95 chowało wybrzeże całkiem, 0,8 daje blady płaskowyż jak na klatce.

## 18.11, użytkownik: klify na wyspach bez ruszania wysp
Właściciel: „Zmień klify bez ruszania wysp”. Siatka wysp powyżej plaży (0,8 m) przeliczana krzywą wklęsłą
1 - (1 - u)^n udziału w wysokości wyspy (`cliffProfile` w `island-geometry.ts`): brzeg wznosi się n razy bardziej stromo,
szczyt płaski, najwyższy punkt bez zmian; n = 5 dla wysp klifowych, 3 dla reszty. Tylko rysowanie: linia wody (wysokość
0), mielizny i ląd w symulacji (`islandHeight` w `core`) bez zmian, złoty hash bez zmian, drzewa na przeliczonej
wysokości. Test profilu; zrzuty `horizon`, `stern-sun` i szerokie ujęcie: wyspy jako płaskowyże ze stromymi ścianami.

## 18.11 Iskry przy burcie; promienie słońca do backlogu (orkiestrator, M9 C1, C3)
Wzburzona woda wzdłuż linii wodnej kadłuba błyszczy jak kilwater (pasmo szersze od piany, rośnie z prędkością). Promienie
przez olinowanie: okazało się, że przebieg promieni od początku nic nie rysował (tarcza słońca poza warstwami kamery);
próba naprawy dawała biały statek, więc wycofana i opisana w backlogu.

## 18.11 Promienie słońca w przestrzeni ekranu zamiast VolumetricLightScattering (orkiestrator, M9 C1)
Promienie Babylona nic nie rysowały (tarcza słońca poza warstwami kamery), a ich przebieg co klatkę renderował scenę drugi
raz. Naprawa przez tarczę na warstwie kamery bieliła statek. Nowe promienie liczy końcowy przebieg gradacji: rozmycie
promieniste w stronę słońca jasnych pikseli samego obrazu (maska z progu jasności 0,72–0,95, wygaszanie 0,955 na próbkę,
GPU Gems 3 rozdz. 13; maszty, żagle i liny są w obrazie ciemne, więc same przecinają smugi). Próbek: jedna trzecia
dawnego ustawienia `sunShafts` (8 do 32). Siła: nisko stojące słońce przed kamerą, słabnąca gdy słońce wysoko, za kamerą
albo pod ciężkim niebem; pod wodą zostają promienie podwodne. Plansze `deck` i `stern-sun`: smugi między wantami i wokół
masztów. Pomiar high: klatka 1,90 → 1,77 s, wywołania rysowania 243 → 176.

## 18.11, użytkownik: woda wokół statku, chlapanie o burtę, uderzenia fal, fizyka
Właściciel: „popraw wodę wokół statku do maksymalnego realizmu… chlapanie wody o burtę, uderzanie fal i fizyka”.
Zrobione: punkty wzdłuż linii wodnej obu burt porównują ruch wody (nowe `waterState` w `core`: pochodna przemieszczenia
Gerstnera w punkcie spoczynku, zanik Airy'ego w głąb) z ruchem kadłuba; woda podnosząca się względem burty albo
napływająca na nią szybciej niż 1,2 m/s rzuca bryzgi w górę i na zewnątrz, cięższe przy mocnych uderzeniach (Kerner,
„Water interaction model for boats in video games”, 2015); wygasająca siła uderzeń bieli wodę przy linii wodnej w
shaderze. Fizyka (opór na prędkości względem wody, człon oporu Morisona) zrobiona, ale wycofana: pełna psuje dwa audyty,
sam pion psuje bramkę liczby statków o jeden statek (opis w backlogu). Bramki ADR-0005 nie luzuję bez decyzji.

## 18.11, użytkownik („Tak”): fizyka uderzeń fal i reżyser liczący całe grupy
Zgoda właściciela na propozycję: reżyser świata liczy przed pojawieniem się grupy cały jej skład (konwój: prowadzący,
kupiec i dwie eskorty, czyli 4 statki) i wybiera tylko ruch, który mieści morze w budżecie + 2 (z graczem budżet + 3, jak
bramka ADR-0005; wcześniej konwój dobierany przy pięciu statkach dawał dziesięć). Potem włączona fizyka pionowa: opór
pionowy kadłuba liczony od prędkości względem wody w fali (człon oporu Morisona z `waterState`), więc fala unosząca się
pod dnem i przy burcie uderza w nie, a statek kołysze się i nurkuje z martwą falą. Poziom pominięty (opis w backlogu).
Złoty hash ręcznie: 81d3dd8a → 8cfc76e. Audyty: 5 z 5, najgorszy krok długiego przebiegu 1,05 ms (bramka 2 ms).

## 18.11, użytkownik: PWA i podpisany APK
Właściciel: „zrób PWA i podpisz APK”. PWA: manifest (pełny ekran, poziomo, sepia), własny service worker według „The
Offline Cookbook” (strona: najpierw sieć; paczki Vite z hashem: najpierw pamięć; modele, tekstury, dźwięki: z pamięci z
odświeżaniem w tle), rejestracja tylko w przeglądarce przez HTTPS albo localhost (nie w aplikacji Capacitora). Pierwsza
wizyta ładuje grę przed startem workera, więc strona przekazuje mu listę wczytanych plików (Resource Timing) do zapisania.
Sprawdzenie skryptem `tools/pwa/pwa-check.mjs`: manifest i 3 ikony, worker aktywny, 154 pliki w pamięci, start offline.
Ikona: aplikacja miała domyślną ikonę Capacitora; nowa z generatora `tools/icons/icon.mjs` (sylwetka galeonu pod niskim
słońcem w sepii, SVG renderowany przez sharp) dla PWA i Androida (ikona adaptacyjna, kwadratowa i okrągła w 5 gęstościach).
APK: podpisany kluczem wydania (`broadside.keystore`, ten sam w CI), schemat v2, `apksigner verify` przechodzi
(CN=Broadside). Hosting PWA (adres HTTPS) nie jest ustawiony: wymaga decyzji, gdzie publikować.

## 18.11 Łup z wraków (orkiestrator, M8)
Pozycja backlogu M8. Statek gracza, który stoi do 60 m od nietkniętego wraku z prędkością najwyżej 1,5 m/s przez 5 s
(wysyła łodzie), dostaje raz złoto 150–600, stałe dla ziarna świata i wraku (tabela `SALVAGE`, wzorzec Type Object).
Stan (ograbione wraki, licznik postoju) w symulacji i w zapisie jako pole opcjonalne `salvage?` (jak `jobs?`, bez
podbijania wersji schematu); system `salvageSystem` w `createSystems()` po zleceniach; stan w osobnym `salvage-state.ts`
(bez cyklu z kontekstem systemów). Komunikat „Łup z wraku!” / „Salvage from the wreck!”. Mapy ze znacznikami w grze nie
ma, więc znacznik wraku i rozkaz po tapnięciu w backlogu.

## 18.11, użytkownik: pływanie po zaznaczeniu „dziwnie działa” (pomiar i pierwsze poprawki)
Pomiar bez przeglądarki (statek gracza, rozkaz trasy do punktów 150–400 m w różnych kierunkach od wiatru, 10–20 minut):
z wiatrem, w bok i ukośnie statek dociera, ale kurs z wiatrem kołysze się o ok. ±20° (sterowanie przy wietrze z rufy),
a po zwinięciu żagli płynie jeszcze 2,5–3 m/s i mija cel o ok. 150 m (za silny napór wiatru na gołe maszty); pod wiatr
cel jest w praktyce nieosiągalny: rejowiec ostro na wiatr (74°) ma tor ok. 80–95° od wiatru, a zwrot przez rufę kosztuje
150–200 m, więc bilans halsowania jest bliski zera albo ujemny. Poprawione w pilocie: poprawka na dryf rośnie z sinusem
kąta do wiatru (bez skoków znaku przy wietrze z rufy), pilot pamięta wybrany hals i trzyma go względem niego (koniec
zawracania tam i z powrotem na starcie, gdy cel był za rufą), żagle zwijane z wyprzedzeniem drogi hamowania. Próby
odrzucone: zwrot przez sztag dla rejowców (statek nie przechodzi dziobem przez wiatr, po 90 s i tak zawraca przez rufę),
zwrot, gdy cel wypada za trawers (krótkie halsy, więcej strat). Zostaje do decyzji (fizyka): dryf na gołych masztach,
osiągi pod wiatr, stabilność kursu z wiatrem.

## 18.11, użytkownik: „woda przy statku wygląda źle”
Zbliżenia rufy i burty przy świeżym wietrze: wzdłuż linii wodnej szedł jednolity, ostry biały pas (piana na obrysie o
stałej jasności), a za rufą koronka piany przy pełnym pokryciu wycinała ciemne oczka (biała siatka na morzu). Zmiany:
pas przy linii wodnej węższy, przy postoju ledwo widoczny (rośnie z prędkością) i porwany szumem płynącym wzdłuż burty,
tak samo kołnierz przy dziobie i piana po uderzeniu fali; w kilwaterze koronka jest fakturą mlecznej warstwy (od 45% do
100% pokrycia, bez dziur), jasność warstwy faluje wolnym szumem. Zrzuty przed i po: rufa bez siatki, burta bez białego pasa.

## 18.11, użytkownik: „jak wejść w tryb ataku burtą w pościgu”
Atak burtą był ukryty pod gestem przeciągnięcia od własnego statku do wroga i w menu po przytrzymaniu; samo tapnięcie
wroga oznaczało abordaż. Teraz tapnięcie wroga to atak burtą (załoga obraca statek burtą i strzela, gdy działa
namierzą), abordaż i eskorta zostają w menu po przytrzymaniu palca na statku. Karta pomocy dostała akapit o rozkazach
(PL i EN). Przy okazji: panel ustawień zasłaniał własny przycisk ⚙ (urósł po przełącznikach refowania i wibracji), więc
dostał przycisk „Zamknij”; audyt interfejsu zamyka nim panel.

## 18.11: trzeci tryb sterowania „Akcja” (pad, żeglowanie wspomagane)
Właściciel zaproponował tryb jak w Black Flag: dotykowy pad (przód, tył, lewo, prawo), przyciski akcji po prawej, statek
płynie swoją największą prędkością i odczuwa pogodę kosztem realizmu. Decyzja (wariant rekomendowany):
- Reguła symulacji `sim/systems/assist.ts` (komponent `assist`, komenda `assist`), dane w `core/data/assist.ts`. Wzorzec:
  zachowania sterujące Reynoldsa (1999), siła = prędkość pożądana minus obecna, obcięta do maksimum; u nas tylko wzdłuż
  kilu i wokół osi pionowej. Prędkość docelowa to prędkość kadłubowa z liczby Froude'a 0,35 (v = Fr·√(gL); galeon ok.
  12,5 węzła) razy udział postawionego płótna (zrefowane 0,35, bojowe 0,65, pełne 1, lizele 1,25) i udział wiatru
  (55% w ciszy, pełna od 6 m/s). Kurs względem wiatru nie ma znaczenia: pod wiatr płynie tak samo jak z wiatrem.
- Pogoda nadal działa: fale ruszają kadłubem, 40% bocznej siły żagli daje przechył i trochę dryfu, maszty niosą pełne
  obciążenie wiatru (za dużo płótna w szkwale nadal łamie maszt), załoga sama refuje w szkwale (stały rozkaz).
- Skręt: koło o promieniu 1,2 długości kadłuba przy pełnym wychyleniu (liczone od co najmniej 2,5 m/s, więc wolny statek
  też się obraca), ster przekłada się dwa razy szybciej niż zwykle.
- Pad (`ui/hud/drive-pad.tsx`, wirtualna gałka): w lewo i w prawo wychyla ster proporcjonalnie, puszczenie wraca na
  środek; ruch w górę lub w dół zmienia „bieg” żagli o jeden; poniżej zwiniętych żagli statek wybiera je na wstecz i cofa
  się 1,6 m/s. Klawiatura w tym trybie: A i D wychylają ster, W i S biegi. Przyciski ognia zostają w rogach.
- Tryb tylko dla gracza i tylko na życzenie (ustawienia, Sterowanie: Akcja); AI płynie po staremu. Złoty hash bez zmian.

## 19.11, użytkownik: „czy pokład może być z desek takich jak statek, aby było go widać”
Pokład galeonu z modelu był z góry prawie czarny, a nasze pokłady (kasztel, zaślepki nad przeciętymi kasztelami) miały
deski Poly Haven innego koloru niż burta. Zmiany (`engine/renderer/deck-planks.ts`):
- wszystkie pokłady statku z modelu (kasztel rufowy, zaślepki, śródokręcie) dostają teksturę desek wypieczoną z burty
  tego samego modelu (`HullModels.planks`), deski wzdłuż statku w zmierzonym rozmiarze, kolor jaśniejszy od burty
  (pokład wybielony słońcem), połysk mokrego pokładu jak dotąd;
- wysokość pokładu na śródokręciu mierzymy promieniami w dół w siatkę modelu (raz na klasę, jak `HullModels.sides`):
  najniższe z trzech trafień w poprzek pokładu, mediana z trzech stacji; tam, gdzie model nie ma pokładu (galeon ma pustą
  studnię ok. 6–13 m przed środkiem), deski idą dalej na wysokości pokładu za nią;
- załoga stoi na zmierzonym pokładzie (wcześniej reguła „wierzch burty minus 0,95 m” podnosiła ją na śródokręciu
  o 0,7–1,4 m ponad pokład modelu).
Śródokręcie galeonu to głęboka studnia między wysokimi burtami, w cieniu żagli: z kamery gry nadal jest ciemniejsze od
kasztelu. Pokład dziobówki modelu zostaje własny (pomiar tam jest zaszumiony przez nadbudówki).

## 19.11, użytkownik: „grafika dalej daje w kość, jakie mamy możliwości optymalizacji”
Pomiar `tools/perf/frame-bench.mjs` (high, 800×450, SwiftShader; przełącznik `shallows` dodany do pomiaru): klatka
2,1 s, z czego niebo z chmurami objętościowymi 53%, ocean 17% (płycizny tylko 3%), statki 14%, post-procesy 4%.
Pieczenie płycizn do tekstury odłożone (mały zysk). Zrobione:
- niebo i chmury w 35% rozdzielczości zamiast 50% na high i ultra (`skyScale`): koszt nieba 1110 → 554 ms, klatka
  2,1 → 1,5 s (−28%); na zrzutach ujęć z dużą ilością nieba (horyzont w wichurze) różnicy nie widać, bo chmury są
  miękkie, a maszty i liny rysujemy w pełnej rozdzielczości; kinowy zostaje w pełnej;
- dynamiczna rozdzielczość (`engine/renderer/dynamic-resolution.ts`, technika konsolowa): gdy wygładzony czas klatki
  przekracza 1/28 s, skala renderu spada o 5% co 1,5 s, najniżej do 60% ustawienia suwaka; gdy klatki są szybsze niż
  1/42 s, wraca do suwaka (nigdy ponad). Telefon, który nadąża, nie widzi zmiany. Wyłączona w narzędziach Playwright
  (`navigator.webdriver`) i parametrem `dynres=0`, żeby zrzuty i pomiary były w zadanej rozdzielczości.
Limit 30 kl./s jako opcja w ustawieniach czeka (wymaga przełącznika w panelu i audytu interfejsu).

## 19.11, użytkownik: uszkodzenia statków jak w Black Flag (do planu)
Zapisane jako M11 w backlogu, przed dalszą optymalizacją (M10): stany zdrowia z tabeli, lecące deski z modeli desek
właściciela (tylko w widoku, bez wpływu na symulację), przestrzeliny i osmalenia na kadłubie, łańcuch ścinający liny,
żagle, reje i maszty (maszt przewraca się za burtę i hamuje statek), unieruchomienie i poddanie jak „disabled” w Black
Flag. Zmiany reguł symulacji (grupy olinowania, reje z HP, poddanie unieruchomionego) zmienią złoty hash i wymagają
audytu bitew w progach ADR-0005.

## 19.11: lecące deski (M11.2)
Skany desek z folderu właściciela (Stichting Archeos Fryslan, CC BY 4.0) nie nadają się na odłamki: każdy to 6–8 kawałków
atlasu tekstur z deskami wraku pokrytymi pąklami, a po uproszczeniu nadal 24–83 tys. trójkątów. Odłamek to więc
generowana deska z poszarpanymi końcami (12 trójkątów, instancje jednej siatki na rodzaj desek) z teksturą desek
trafionego kadłuba (wypieczoną z modelu, jak pokład i kasztel; dla kadłubów generowanych deski pokładu). Ruch tylko
w widoku (`effects/debris-motion.ts`: lot z obrotem, plusk, pływanie na tej samej fali co statki, obrót na płasko,
dryf, zatonięcie po ok. 16 s), ziarno z miejsca trafienia. Liczba desek: 1–6 na trafienie w kadłub, działo albo ster
(rośnie z obrażeniami), do 6 przy zderzeniu, 24 przy wybuchu prochowni; pula 160 sztuk na presecie high.

## 19.11: przestrzeliny w kadłubie (M11.3, część)
Dziura po kuli to kwadrat z teksturą rysowaną raz na scenę (czarny, poszarpany otwór, brązowa krawędź, jasne drzazgi
świeżo pękniętego drewna), kładziony na powierzchni kadłuba, w którą trafia promień z zewnątrz na wysokości i stacji
trafienia (`scene.pickWithRay` na siatkach kadłuba: test przecięcia pojedynczej siatki trafiał w wewnętrzną warstwę
skalowanego modelu). Jedna zwykła siatka na statek, przebudowywana przy trafieniu, pod węzłem kadłuba; do 40 dziur na
statek, rozmiar 0,9–1,7 m z obrażeniami. Instancje (thin instances) pod węzłem kadłuba nie rysowały się we właściwym
miejscu, stąd zwykła siatka. Ciężko uszkodzony statek (kadłub poniżej 40%) dymi ze śródokręcia.

## 19.11: unieruchomiony statek się poddaje (M11.5)
Reguła (`core/data/damage-states.ts` `DISABLED`, `sim/ai/captain.ts`, `sim/combat/boarding.ts`): statek bez stojącego
masztu albo z olinowaniem poniżej 20% nie ucieka (kapitan AI nie przechodzi w ucieczkę); gdy wróg jest bliżej niż 300 m,
a jego załoga jest liczniejsza niż 1,3 załogi unieruchomionego, opuszcza banderę. Przy abordażu unieruchomiony broni
się mnożnikiem 0,85 zamiast 1,15. Złoty hash bez zmian (scenariusz determinizmu nikogo nie unieruchamia), audyty bitew
w progach ADR-0005.

## 19.11: wrak masztu przy burcie (M11.4)
Złamany maszt spada na zawietrzną i wisi przy burcie na olinowaniu (`core WRECKAGE`, `sim/systems/wreckage.ts`, nowe pole
stanu `wrecks` z domyślną pustą listą dla starych zapisów). Opór kwadratowy wraku (0,35 m² na metr masztu, współczynnik 1)
przyłożony na linii wody przy burcie: statek zwalnia (test: brig o ponad 25%) i skręca w stronę wraku, aż załoga go
odetnie, 40 s przy pełnej załodze, dłużej przy mniejszej. Widok trzyma maszt przy burcie do odcięcia, potem tonie.
Przestrzelone liny stałe zwisają z górnego końca (każda pęka przy swoim progu stanu olinowania), żagiel z płótnem
poniżej 30% odrywa się i wisi z jednego rogu (tylko w symulacji tkaniny z bliska). Złoty hash bez zmian, audyty w progach.

## 19.11: reje, wanty i osmalenia (M11.3–4, widok)
- Reje przewróconego masztu obracają się z nim wokół złamania i toną z nim; drabinki want znikają (wcześniej zostawały
  w powietrzu).
- Każda reja ma własny próg stanu olinowania (8–42%, stały skrót jak liny); poniżej zsuwa się w 1,5 s na pokład, a jej
  żagiel znika. Symulacja nadal liczy ciąg żagli z udziału olinowania w trymie (`sails.ts`), reje nie mają własnego HP:
  przy olinowaniu poniżej 20% statek i tak jest unieruchomiony (M11.5).
- Sekcja kadłuba po pożarze albo poniżej 1/3 wytrzymałości dostaje raz trzy plamy sadzy na swojej burcie.
- Celowanie gracza zależy od załadowanej amunicji: łańcuchy na 40% wysokości masztów celu, kartacze na pokład, kula na
  linię wody (jak kanonierzy AI w `tactics.aimHeightFor`).

## 19.11: niebo co drugą klatkę (M10)
Tło nieba (połowa rozdzielczości z chmurami objętościowymi, 38–40% klatki na high) odświeżane co drugą klatkę, gdy kamera
obraca się mniej niż 0,003 rad na klatkę i nie ma błyskawicy (`Sky.refresh`, amortyzacja czasowa jak w niebach gier).
Chmury dryfują wolno, więc przeskok o klatkę nie jest widoczny; obrót widoku odświeża od razu, żeby niebo nie zostawało
za masztami. Pomiar: high 18% klatki mniej przy nieruchomym widoku. Na telefonie przy kamerze śledzącej kołyszący się
statek zysk będzie mniejszy (część klatek z obrotem).

## 19.11: rozświetlona mgiełka nad lądem (C2)
Plansze porównawcze: w referencji (ref_152, ref_060) dalekie lądy pod słońce giną w jasnej mgle, w grze stały ciemne
i ostre, bo mgła Babylona barwi je jednym kolorem. Wtyczka materiału `sun-haze.ts` dodaje wyspom i dalekiemu
wybrzeżu ten sam człon rozpraszania w stronę słońca co ocean (dwa płaty: potęgi 3 i 12), razy udział mgły przed
powierzchnią (czynnik mgły Babylona albo zamglenie pierścienia wybrzeża). Z dala od słońca bez zmian.
