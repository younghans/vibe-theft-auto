# Open Source Release

Use this checklist before changing repository visibility or importing a public
copy of Vibe Theft Auto.

## Recommended Publishing Path

Create a fresh public repository from the current sanitized tree instead of
making the existing private repository public with its full commit history.
Older private history may contain raw source exports or experimental assets that
are no longer present on `main`.

```sh
npm run public:export -- ../vibe-theft-auto-public --init-git
```

Review the exported directory, commit it in the fresh repository, then push that
new repository to GitHub. The export script copies only files tracked in the
current tree; it does not copy `.git`, ignored local environment files, browser
profiles, generated builds, or local worker state.

## Before Publishing

- Run `npm run build:all`.
- Run `npm run validate:all`.
- Run `npm audit --audit-level=moderate`.
- Run `npm --prefix tools/mixamo-optimizer audit --audit-level=moderate`.
- Confirm `.env.local`, `.env.worker.production`, `.colyseus-cloud.json`,
  `.codex/`, `dist/`, and other ignored local files are absent from the export.
- Rotate production admin keys, worker tokens, deploy tokens, and database
  credentials before announcing the public repository.
- Verify `ASSET_POLICY.md`, `assets/mixamo/NOTICE.md`, and third-party asset
  license files are included in the export.

## If You Rewrite History Instead

If you decide to publish this existing repository rather than importing a fresh
copy, rewrite history first and then force-push only after taking a private
backup. At minimum, remove historical raw assets such as `.fbx`, `.obj`, `.mtl`,
`.wav`, old source-export directories, and any experimental third-party assets
that are not intended for public redistribution.
