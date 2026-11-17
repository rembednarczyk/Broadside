# Autorzy zewnętrznych assetów

Modele z kolekcji właściciela projektu (Sketchfab), używane po optymalizacji i przycięciu (`tools/assets`).
Licencja CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) wymaga podania autora i źródła; zmiany:
uproszczenie siatki, zmniejszenie tekstur, odcięcie masztów i olinowania, przeskalowanie.

| Model | Autor | Źródło | Licencja | Użycie |
|---|---|---|---|---|
| GA Free_251 Weathered 18th Century Galleon | Galaxy Abundant | https://sketchfab.com/3d-models/ga-free-251-weathered-18th-century-galleon-b097e67c207540628828ebb55afce914 | CC BY 4.0 | kadłub galeonu |
| Ship of the line, c. 1700 | Swedish National Maritime and Transport Museums | https://sketchfab.com/3d-models/ship-of-the-line-c-1700-linjeskepp-ca-1700-3afea352a40045b0a638c9900f669ed4 | CC BY 4.0 | planowany: okręt liniowy |
| Baron Anders von Höpken (1759) | Swedish National Maritime and Transport Museums | https://sketchfab.com/3d-models/baron-anders-von-hopken-1759-2ceabad6370844d198e4f503435d0b5f | CC BY 4.0 | kadłub fregaty |
| Dutch ship | m23ldx0191 | https://sketchfab.com/3d-models/dutch-ship-6e1a27f4db4c48e6adc53f6a3528ac9d | CC BY 4.0 | kadłub brygu |
| Carrack / Holk | Swedish National Maritime and Transport Museums | https://sketchfab.com/3d-models/carrack-holk-65d4a28ca8ab40fd8c693aca1447fd56 | CC BY 4.0 | planowany |
| Three-decker (c. 1660) | Swedish National Maritime and Transport Museums | https://sketchfab.com/3d-models/three-decker-c-1660-b584d0bf6edd433193f2651b6c71a3c8 | CC BY 4.0 | planowany |
| Cannon 17th c. Dutch warship Klein Hollandia | Stichting Maritieme Archeologie | https://sketchfab.com/3d-models/cannon-17th-c-dutch-warship-klein-hollandia-1552d62eb113493db782d2c07d6d2ddf | CC BY 4.0 | planowany: armaty |
| 18th century swivel gun (Queen Anne NK47-11) | Stichting Archeos Fryslan | https://sketchfab.com/3d-models/18th-century-swivel-gun-queen-anne-nk47-11-ed970af0c0324f2a9b05dae36bce0aa4 | CC BY 4.0 | profil lufy dział (bryła obrotowa) |
| Canhões do Ilhéu | Vila 3D - Património Cultural | https://sketchfab.com/3d-models/canhoes-do-ilheu-d3efa7fbcf95459c90fe8b757ff5af98 | CC BY 4.0 | nieużywany (skan dna) |
| Älvsnabbenvraket, Uelvesbüll wreck, Wooden shipwreck covered by railway rails | Swedish National Maritime and Transport Museums; Stichting Archeos Fryslan; Stichting Maritieme Archeologie | Sketchfab (linki w `tools/assets/sources.txt`) | CC BY 4.0 | wrak z Uelvesbüll na mieliznach; pozostałe planowane |

Nieużywany: Thunderhawk Wreckage 15572 (BOEM Archaeology, CC BY-NC-SA 4.0), współczesny wrak spoza epoki.

## Dźwięki (CC0, OpenGameArt)
Uznanie autorstwa nie jest wymagane przy CC0; podajemy je z grzeczności. Lista plików i stron: `tools/assets/audio-sources.txt`.
randommind (morze, Wisła), tsorthan-grove (wiatr sztormowy, Storm Arwen 2022), sketchman3 (lekki wiatr), kresiek-the-furry
(deszcz), wuxiascrub (deszcz z grzmotem), antumdeluge (skrzypienie drewna), rango-mango (mewy), qubodup i jasinski (fala
przy brzegu), thimras (strzał, trafienie, plusk, taran, tonięcie).

## Dźwięki statku (CC BY 4.0 i CC0, OpenGameArt)
„Pirate Pack Vol 1”, JC Sounds, https://opengameart.org/content/jc-sounds-pirate-pack-vol-1, CC BY 4.0: skrzypiący
pokład, liny, kroki po drewnie, szable, pistolet, monety, skrzynia (przycięte i znormalizowane przez `tools/assets/audio.sh`).
„Chain winch sounds”, https://opengameart.org/content/chain-winch-sounds, CC0: kabestan i pompa.

## Tekstury (CC0, Poly Haven)
`weathered_planks` (pokład), `dark_planks` (maszty, reje, lawety), `rough_linen` (splot płótna żagli) z polyhaven.com.
Pobieranie i skalowanie: `node tools/assets/textures.mjs`.

## Postacie załogi (CC0, Quaternius)
„Modular Character Outfits - Fantasy”, „Universal Base Characters” i „Universal Animation Library” (wersje Standard,
bezpłatne) autorstwa Quaterniusa, https://quaternius.com, CC0 1.0. Stroje, głowy, fryzury i pozy złożone i wypieczone
skryptem `tools/assets/crew-figures.mjs` do `packages/app/public/assets/props/crew.glb`.
