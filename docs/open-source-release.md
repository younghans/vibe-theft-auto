# Open Source Release

Use this checklist before changing repository visibility for Vibe Theft Auto.

## Publishing Path

This repository is intended to be made public directly after the release checks
pass. Its Git history has been rewritten to remove historical raw/source assets
and credential-shaped local files that should not be exposed publicly.

The export script is still available if you ever want a separate tree-only copy
without Git history:

```sh
npm run public:export -- ../vibe-theft-auto-public --init-git
```

The export script copies only files tracked in the current tree; it does not copy
`.git`, ignored local environment files, browser profiles, generated builds, or
local worker state.

## Before Publishing

- Run `npm run build:all`.
- Run `npm run validate:all`.
- Run `npm audit --audit-level=moderate`.
- Run `npm --prefix tools/mixamo-optimizer audit --audit-level=moderate`.
- Confirm `.env.local`, `.env.worker.production`, `.colyseus-cloud.json`,
  `.codex/`, `dist/`, and other ignored local files are not tracked by git.
- Rotate production admin keys, worker tokens, deploy tokens, and database
  credentials before announcing the public repository.
- Verify `ASSET_POLICY.md`, `assets/mixamo/NOTICE.md`, and third-party asset
  license files are included.

## History Rewrite Notes

If history ever needs to be rewritten again, take a private backup first and
force-push only after verifying a fresh clone. At minimum, remove historical raw
assets such as `.fbx`, `.obj`, `.mtl`, `.wav`, old source-export directories,
and any experimental third-party assets that are not intended for public
redistribution.
