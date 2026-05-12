# Asset Pipeline

The public repository keeps runtime-ready assets, not bulky source exports.

## Runtime Assets To Commit

- Optimized character models in `assets/runtime/mixamo/characters/*.glb`.
- Extracted animation clips in `assets/mixamo/animations/*.json`.
- Runtime building/object assets as `.glb` or `.gltf`.
- Runtime audio as `.mp3`.
- Runtime images as `.png` or `.webp`.
- License and attribution files that belong with bundled third-party packs.

## Local-Only Source Assets

Keep raw source files local. These are ignored by git:

- `.fbx`
- `.obj`
- `.mtl`
- `.wav`

For Mixamo character optimization, place local FBX files in
`assets/mixamo/characters/` with the filenames listed in
`src/shared/mixamoCharacterCatalog.js`, then run:

```sh
npm run optimize:assets
```

Alternatively, keep the FBX files outside the repo:

```sh
MIXAMO_SOURCE_CHARACTER_DIR=/path/to/mixamo-sources npm run optimize:assets
```

For animation extraction, provide a local FBX input and commit only the generated
JSON clip:

```sh
node scripts/extract-fbx-animation.mjs assets/source/mixamo/animations/walking.fbx assets/mixamo/animations/walking.json Walking
```

For new building packs, prefer source packs that include GLB/GLTF. If a pack only
ships FBX or OBJ, convert selected models to GLB in Blender or another converter,
then commit only the curated runtime GLB files and the pack license.
