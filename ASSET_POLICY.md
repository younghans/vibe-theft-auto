# Asset Policy

This repository includes assets so Vibe Theft Auto can run as intended, but the
project does not claim ownership of third-party assets or relicense them under
the source-code license.

- Project source code is licensed under the ISC License in `LICENSE`.
- Third-party assets and vendored code remain under their original licenses or
  terms.
- KayKit and Kenney asset packs include their own license files in their asset
  directories.
- Mixamo-derived characters, animations, and portraits are bundled as runtime
  project assets only so the game runs as intended. They are not ISC-licensed,
  are not reusable as standalone assets, and should not be extracted, resold,
  sublicensed, or repackaged outside this game unless you independently comply
  with Adobe/Mixamo terms. See `assets/mixamo/NOTICE.md`.
- Do not use Mixamo-derived content from this repository to create, train, test,
  or improve machine learning or artificial intelligence systems.
- Raw Mixamo character FBX files are local-only source inputs and are ignored by
  git. Commit optimized runtime GLBs from `assets/runtime/mixamo/characters/`,
  not raw character FBX source files.
- Raw source assets such as FBX, OBJ, MTL, and WAV files should stay local-only.
  Commit runtime-ready GLB, GLTF, JSON, MP3, PNG, or WebP assets instead.

When adding new assets, include the source, license, and any attribution notes in
or near the asset directory.
