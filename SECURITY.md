# Security Policy

## Supported Versions

Security updates target the current `main` branch.

## Reporting A Vulnerability

Please do not open public issues for vulnerabilities, secrets, admin keys, or
production configuration leaks.

If GitHub Security Advisories are enabled for this repository, use a private
security advisory. Otherwise, contact [oldfeet](https://x.com/oldfeet) with a
short description, impact, reproduction steps, and any relevant logs or
screenshots.

## Secret Handling

Do not commit `.env`, `.env.local`, `.colyseus-cloud.json`, deployment secrets,
database URLs, OpenAI API keys, or admin keys. Use `.env.example` for placeholder
configuration only.

If a secret is accidentally exposed, rotate it immediately and remove it from
Git history before making the repository public.
