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
