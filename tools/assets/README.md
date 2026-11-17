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

Licencje i autorzy: `CREDITS.md` w katalogu głównym. Model Thunderhawk (CC BY-NC-SA 4.0) nie jest używany.
