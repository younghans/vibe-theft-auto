# Building Style Guide

This repo already has a clear building language. New custom lots should feel like they belong beside:

- `assets/KayKit_City_Builder_Bits_1.0_FREE/Assets/gltf/building_*.gltf`
- `assets/kenney_city-kit-commercial_2.1/Models/GLB format/building-*.glb`
- `assets/stickrpg_custom/models/hospital-building.glb`

## What the current style looks like

- Low-poly, readable, and intentionally game-like rather than realistic.
- Modern city shells with flat roofs, parapets, rooftop boxes, vents, or light HVAC silhouettes.
- Simple blocky massing with a strong front-facing silhouette that reads from a slight isometric angle.
- Light wall colors, dark roofs, blue-tinted windows, and one or two accent colors for storefront trims, signs, awnings, or thematic details.
- Details are clustered around the ground floor and roofline, not spread as tiny noise all over the facade.
- Materials are matte and clean. No grunge maps, heavy roughness variation, or realistic wear are needed.

## Style rules to keep

- Favor 1-3 large building masses over many tiny offsets.
- Make the entrance obvious with a canopy, recess, trim band, sign panel, or stairs.
- Keep window rhythm simple and repeated. Large readable rows beat bespoke window-by-window variation.
- Use thematic accents sparingly:
  - medical: red cross, teal panel, ambulance bay hint
  - retail: bold awning, brighter storefront strip
  - office: taller glass bands, rooftop utility box
- Add a small roof story with parapet cutouts, vents, ducts, or a simple utility block when the building needs personality.
- Keep silhouettes chunky. Avoid thin railings, antenna forests, dense pipes, and tiny props that will disappear in play.

## Technical constraints

- Buildings are currently single-lot tiles in the editor.
- Tile footprint is `BUILDER_TILE_SIZE * 0.82`, which is `11.48 x 11.48` world units.
- The renderer auto-fits each model to the configured tile footprint using the smaller X/Z scale.
- A larger mesh can visually overhang a neighboring cell, but collision and placement are still fundamentally single-cell.

## Practical size targets

- The custom hospital was authored at about `11.4 x 11.1 x 13.8`, which is almost a perfect match for the target lot footprint.
- Most current non-skyscraper references land around roughly `9-20` world units tall after the game fits them into a standard lot.
- The safest default for new custom lots is:
  - footprint: about `10.8-11.4` wide and deep
  - height: about `11-16`
  - roof: flat with parapet

## Default assumptions for future prompts

If a prompt only gives the building type, use these defaults unless the request says otherwise:

- single-lot footprint
- flat roof and parapet
- readable front entrance
- light facade, dark roof, cool blue windows
- one thematic accent color
- detail focused on storefront and roofline
- low-poly, clean, and close to the hospital/KayKit/Kenney blend

## Recommended workflow for new buildings

1. Pick the building role and one strong silhouette idea.
2. Block the building from large forms first so it reads at distance.
3. Add only the signature details that sell the type.
4. Keep the palette in the existing family: off-white or light concrete walls, charcoal roof, blue glass, restrained accent color.
5. Export to `.glb` in `assets/stickrpg_custom/models/`.
6. Run `npm run inspect:buildings -- assets/stickrpg_custom/models/your-building.glb`.
7. Confirm the footprint, estimated rendered height, and mesh count are in family.
8. Register the asset in `src/world/builderCatalog.js` with the standard lot size unless the building is an intentional outlier.

## Fast acceptance checklist

- Does it read clearly from an isometric game camera?
- Does it feel like one building, not many scattered details?
- Is the entrance obvious?
- Would it still look good next to the hospital?
- Is the palette mostly light walls, dark roof, blue glass, and one accent?
- Is the silhouette interesting before texture or tiny props do any work?
