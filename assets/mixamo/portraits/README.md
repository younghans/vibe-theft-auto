Place pre-rendered NPC mug-shot PNGs here.

Expected file names come from:
- `src/shared/mixamoCharacterCatalog.js`
- `src/player/playableCharacterCatalog.js` for non-Mixamo variants like `classicBot`

Workflow:
1. Run `npm run dev:client`.
2. Open `http://localhost:4173/npc-portrait-studio.html`.
3. Adjust the shared angle / zoom / framing preset and click `Save Shared Framing`.
4. Click `Render and Save All`.
5. Commit the generated `*.png` files plus `portrait-presets.json` in this folder.

Validation:
- Run `npm run validate:portraits` to verify every NPC has a portrait PNG.

Usage:
- NPC builder cards read these static PNGs.
- Character selector cards also use these static PNGs and fall back to runtime rendering only if a file is missing.
- `portrait-presets.json` now stores one shared framing preset that is applied to the full character roster.
