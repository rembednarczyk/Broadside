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
