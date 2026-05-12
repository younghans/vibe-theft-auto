# Local Mixamo source characters

Raw Mixamo character FBX files are intentionally not committed. They are large source assets, and the game only needs the optimized runtime GLBs in `assets/runtime/mixamo/characters/`.

To regenerate runtime characters, place the source FBX files in this directory with the filenames listed in `src/shared/mixamoCharacterCatalog.js`, then run:

```bash
npm run optimize:assets
```

You can also keep the source FBX files outside the repo and point the optimizer at them:

```bash
MIXAMO_SOURCE_CHARACTER_DIR=/path/to/local/mixamo-sources npm run optimize:assets
```

Commit the updated runtime GLBs, not the raw FBX source files.
