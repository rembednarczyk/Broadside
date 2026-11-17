# Potok assetów (modele właściciela)

Źródło: folder Google Drive właściciela (udostępniony przez link). Lista plików i ich ID: `sources.txt`.
Surowe pliki trafiają do `.asset-cache/drive/` (poza gitem), wynik do `packages/app/public/assets/`.

1. Pobranie: `tools/assets/fetch.sh` (pomija pliki już pobrane).
2. Optymalizacja: `node tools/assets/optimize.mjs <in.glb> <out.glb> [trójkąty] [bok tekstury]`
   (spawanie wierzchołków, upraszczanie meshoptimizer, tekstury WebP albo JPEG przez `TEX_FORMAT=jpeg`).
3. Kadłub: `node tools/assets/hull-cut.mjs .asset-cache/preview .asset-cache/hulls [klasa]` według `hulls.json`
   (orientacja, cięcie nad pokładem, przycięcie bukszprytu, kil na y = 0, dziób na +Z).
4. Podgląd: `NODE_PATH=/opt/node-tools/node_modules node tools/assets/view.mjs <model.glb> <prefiks>` (bok, góra, 3/4).
5. Skopiować `.asset-cache/hulls/<klasa>.glb` do `packages/app/public/assets/hulls/` i dopisać klasę do
   `MODELLED_HULLS` w `packages/engine/src/renderer/babylon-renderer.ts`.

Wszystkie kadłuby naraz, w dwóch poziomach jakości (pełny 250 tys. trójkątów i 4096 px, `-lite` 80 tys. i 2048 px):
`bash tools/assets/hulls.sh`. Silnik bierze `-lite` dla presetów low i medium.

Profil lufy ze skanu działka (bryła obrotowa, którą toczy gra):
`node tools/assets/lathe-profile.mjs .asset-cache/drive/18th_century_swivel_gun_queen_anne_nk47-11.glb packages/engine/src/renderer/barrel-profile.json 36 0 0.18 1`.

Wraki na mielizny (pełna siatka skanu, tekstury 2048), potem wyprostowanie przez `upright.mjs` (PCA, odcięcie podłoża):
`TEX_FORMAT=jpeg node tools/assets/optimize.mjs .asset-cache/drive/uelvesbull_wreck_husum_germany.glb .asset-cache/props/uelv-full.glb 500000 2048`,
`node tools/assets/upright.mjs .asset-cache/props/uelv-full.glb packages/app/public/assets/props/wreck.glb 0 0.3`;
`SIMPLIFY_ERROR=0.03 TEX_FORMAT=jpeg node tools/assets/optimize.mjs .asset-cache/drive/alvsnabbenvraket.glb .asset-cache/props/alvs-full.glb 400000 2048`,
`node tools/assets/upright.mjs .asset-cache/props/alvs-full.glb packages/app/public/assets/props/wreck2.glb 0 0.1`.
Działo ze skanu (12 tys. trójkątów, lufa wzdłuż +Z):
`node tools/assets/upright.mjs .asset-cache/props/swivel.glb packages/app/public/assets/props/gun.glb 0 0 1 12000`.

Licencje i autorzy: `CREDITS.md` w katalogu głównym. Model Thunderhawk (CC BY-NC-SA 4.0) nie jest używany.

## Załoga (Quaternius, CC0)
1. Pobranie trzech darmowych paczek (strony itch.io: `modular-character-outfits-fantasy`, `universal-base-characters`,
   `universal-animation-library` na `quaternius.itch.io`): `tools/assets/itch-fetch.sh <adres strony> <katalog>`,
   rozpakowanie do `.asset-cache/quaternius/` (katalogi `... [Standard]` jak w archiwach). W bazowych postaciach brakuje
   dwóch plików, do których odwołuje się glTF: skopiować `T_Eye_Normal.png` na `T_Eye_Normal_png.png` i
   `T_Hair_1_Normal.png` na `T_Hair_1_Normal_png.png` w `Base Characters/Godot - UE/`.
2. Klipy wspinaczki (Mixamo, z Drive właściciela, w `sources.txt` jako `climb_*.fbx`): `bash tools/assets/fetch.sh`, potem
   dla każdego `node tools/assets/fbx-anim.mjs .asset-cache/drive/climb_<n>.fbx .asset-cache/drive/climb_<n>.json`
   (`n`: ladder, rope, wall, top; FBXLoader z three.js, bez programów binarnych). Przeniesienie na szkielet postaci robi
   `retarget.mjs` w czasie wypieku.
3. `node tools/assets/crew-anim.mjs packages/app/public/assets/props/crew-anim.bin [trójkąty=5000] [fps=15]`:
   postacie z kośćmi, klipy wypieczone do tekstury macierzy kości, atlas tekstur (format w komentarzu skryptu).

