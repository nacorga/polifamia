# Security policy

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private reporting:
[Security → Report a vulnerability](https://github.com/nacorga/polifamia/security/advisories/new).

Include steps to reproduce, the impact and the affected commit. Polifamia is maintained by one person: we reply as
soon as we can, with no guaranteed response times. Once a fix is available we publish the advisory and credit you if
you wish.

## Scope

We are especially interested in:

- **API abuse**: bypassing the per-IP or per-`X-Install-Id` rate limit, or the daily budget
  ([ADR 0004](docs/adr/0004-rate-limit-y-presupuesto.md)).
- **SSRF**: requests to hosts outside the allowlist in `packages/connectors/src/safe-fetch.ts`.
- **Secrets in the extension**: keys or server configuration in the bundle that
  `apps/extension/scripts/check-bundle.mjs` fails to detect.
- **Evidence integrity**: prompt injection (transcripts, documents or pasted text) that produces fabricated citations,
  URLs or figures, or forces `SUPPORTED`/`CONTRADICTED` without primary evidence.
- **Privacy**: browsing data, other tabs or personal identifiers reaching the backend.

Out of scope: debatable results that are not caused by a security flaw. Report those as an
[incorrect result](https://github.com/nacorga/polifamia/issues/new?template=incorrect-result.yml).

## Supported versions

Only the `main` branch. There are no releases yet.
