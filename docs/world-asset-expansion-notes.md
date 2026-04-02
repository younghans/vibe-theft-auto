# World Asset Expansion Notes

## How the current system works

- The builder catalog is the source of truth for editor items. Every placeable tile or prop is defined in `src/world/builderCatalog.js`.
- Tile placements are single-cell records with `itemId`, `cell`, and `rotationQuarterTurns`. Prop placements are free-placed with `itemId`, `position`, and `rotationQuarterTurns`. See `src/world/WorldState.js`.
- Models are loaded through `ModelLibrary`, which supports `FBXLoader` and `GLTFLoader`. That means `.fbx`, `.gltf`, and `.glb` all work.
- `WorldRenderer` automatically:
  - loads the asset
  - fits it to the configured `item.size`
  - snaps it to ground
  - applies a box collider when `collision` is enabled

## Important constraint

- Buildings are still logically single-tile placements today.
- A bigger mesh can visually overhang neighboring cells, but the placement schema does not currently support true multi-cell occupancy.
- That means packs with compact storefronts, corner buildings, kiosks, row houses, and narrow towers fit best right now.
- Very wide buildings can still work, but they should usually be treated as props or as a future multi-tile feature.

## Small repo improvement already added

- `builderCatalog.js` now accepts an explicit `asset` URL on tile/prop definitions.
- That means new packs no longer need to be copied into the existing KayKit folder just to be used by the editor.
- You can keep third-party packs in their own directory under `assets/` and point definitions straight at them.

Example:

```js
import { assetUrl } from '../src/world/assetManifest.js';

{
  id: 'kenney_building_a',
  assetName: 'building-a',
  label: 'Building A',
  asset: assetUrl('kenney', 'city-kit-commercial', 'Models', 'GLB format', 'building-a.glb'),
  group: 'lots',
  size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82],
  collision: true,
  padding: 0.5
}
```

## Best-fit online packs

### 1. Kenney City Kit (Commercial)

- Link: https://kenney.nl/assets/city-kit-commercial
- Why it fits:
  - 50 city assets
  - CC0
  - current download includes `GLB format` files, so it is the cleanest drop-in option for this repo
  - has many buildings plus low-detail variants and storefront details
- Verified details:
  - Kenney page says the pack is CC0 and 50 assets
  - the current `2.1` zip includes `Models/GLB format/*.glb`
  - recent updates listed on the page: `2.0` on 2025-05-17 and `2.1` on 2025-07-21
- Best use here:
  - add more lot/building tile variants
  - add awnings/parasols as props
  - create a denser downtown district without changing the editor schema

### 2. Quaternius Ultimate Buildings Pack

- Link: https://quaternius.com/packs/ultimatetexturedbuildings.html
- Why it fits:
  - modular buildings with palette-swappable atlas textures
  - CC0
  - good for generating many storefront silhouettes from one pack
- Verified details:
  - official page lists FBX, OBJ, and Blend
  - official page lists CC0
- Best use here:
  - if you want a lot of skyline/building variety quickly
  - best when you are okay doing a quick Blender export to `.glb` or `.gltf`

### 3. Quaternius Buildings Pack

- Link: https://quaternius.com/packs/buildings.html
- Why it fits:
  - simple pack of 9 building variants
  - CC0
  - good for fast expansion of lot tiles
- Verified details:
  - official page lists FBX, OBJ, and Blend
  - official page lists CC0
- Best use here:
  - easy second wave after Kenney
  - good for filler buildings, apartment blocks, and side-street silhouettes

### 4. Quaternius Simple Buildings Pack

- Link: https://quaternius.com/packs/simplebuildings.html
- Why it fits:
  - includes a hospital, houses, and shop
  - CC0
  - compact shapes suit your current single-lot placement model
- Verified details:
  - official page lists FBX, OBJ, and Blend
  - official page lists CC0
- Best use here:
  - add more recognizable building types with low integration risk

### 5. Quaternius Modular Streets Pack

- Link: https://quaternius.com/packs/modularstreets.html
- Why it fits:
  - expands road/tile variety
  - CC0
  - good complement to the current street set
- Verified details:
  - official page lists FBX, OBJ, and Blend
  - official page lists CC0
- Best use here:
  - alternate road materials
  - ramps, bridges, and non-default intersections after conversion/export

## Same-style support packs from KayKit

These are not primarily new exterior buildings, but they are the strongest style match for your current world:

### KayKit Furniture Bits

- Link: https://kaylousberg.itch.io/furniture-bits
- Verified details:
  - 50+ low poly 3D models
  - CC0
  - includes `.OBJ`, `.FBX`, and `.GLTF`
- Best use here:
  - interior dressing for buildings
  - office, apartment, motel, diner, and shop setups

### KayKit Restaurant Bits

- Link: https://kaylousberg.itch.io/restaurant-bits
- Verified details:
  - 140+ low poly 3D models
  - CC0
  - includes `.OBJ`, `.FBX`, and `.GLTF`
- Best use here:
  - diner, cafe, pizza place, kitchen, food court, and restaurant interiors

### Optional thematic expansion: KayKit Medieval Builder Pack

- Link: https://kaylousberg.itch.io/kaykit-medieval-builder-pack
- Verified details:
  - CC0
  - includes `FBX`, `OBJ`, `DAE`, and `GLTF`
- Best use here:
  - separate district, dream sequence, or side-map
  - not the best fit for the current modern city, but technically very easy to integrate

## Lowest-friction integration plan

### Option A: fastest path

1. Download `Kenney City Kit (Commercial)`.
2. Keep the pack in a new folder under `assets/kenney/city-kit-commercial/`.
3. Add 8-12 new tile definitions in `builderCatalog.js` that point at the `Models/GLB format/*.glb` files.
4. Use the existing building footprint rule as a starting point: `size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82]`.
5. Tune only the outliers.

### Option B: best visual consistency

1. Add `KayKit Furniture Bits` and `KayKit Restaurant Bits` first for props/interiors.
2. Add `Kenney City Kit (Commercial)` only for extra exterior shells.
3. Keep KayKit assets for close-up areas and Kenney assets for background lots and denser blocks.

### Option C: maximum variety

1. Add Kenney for ready-to-use `.glb` buildings.
2. Add Quaternius building packs as a second pass.
3. Convert selected `.fbx` or `.obj` models to `.glb` in Blender before importing.

## Practical integration rules

- Prefer `.glb` or `.gltf` first. They flow through the current loader path with no special handling.
- Keep each pack in its own folder under `assets/`.
- Add only a few curated entries at a time instead of bulk-registering every file.
- Start with compact buildings that visually read well inside a single lot footprint.
- Put overhanging or oversized assets in `props` if they do not behave cleanly as snapped tiles.
- If a model looks too big or too small, fix it by changing `item.size`; the renderer already re-fits the mesh at runtime.

## If we want the next upgrade

The next meaningful builder upgrade would be multi-tile footprints:

- `widthInTiles` and `depthInTiles` on tile items
- occupancy checks across all covered cells in `WorldState`
- footprint preview updates in `WorldBuilder`
- collider generation based on covered cells instead of a single anchor cell

That would make skyscrapers, malls, stations, and larger corner buildings much easier to support cleanly.
