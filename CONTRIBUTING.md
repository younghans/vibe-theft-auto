# Contributing

Thanks for taking a look at Vibe Theft Auto. Keep contributions small, focused,
and easy to review.

## Local Setup

Install dependencies from the lockfile:

```sh
npm ci
```

Copy the example environment file and fill in local-only values:

```sh
cp .env.example .env
```

Run the local frontend and backend:

```sh
npm run dev
```

## Checks

Before opening a pull request, run:

```sh
npm run build:all
```

Useful focused checks:

```sh
npm run validate
npm run validate:mixamo
npm run validate:portraits
```

## Assets

Commit runtime-ready assets only:

- `.glb` or `.gltf` for models
- `.json` for extracted animation clips
- `.mp3` for audio
- `.png` or `.webp` for images

Keep raw source exports local. Do not commit `.fbx`, `.obj`, `.mtl`, or `.wav`
files. See [docs/asset-pipeline.md](docs/asset-pipeline.md) and
[ASSET_POLICY.md](ASSET_POLICY.md).

## Secrets

Never commit real secrets or local deployment config. This includes `.env`,
`.env.local`, `.colyseus-cloud.json`, database URLs, OpenAI API keys, admin keys,
and deployment tokens.

Use `.env.example` for placeholders only. See [SECURITY.md](SECURITY.md) for
security reporting and secret-handling notes.
