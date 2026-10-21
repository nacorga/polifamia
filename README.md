# Polifamia

Chrome extension to investigate claims made in Spanish political speeches on YouTube against verifiable evidence,
without leaving the video. **We don't tell users what to think**: we show what was claimed, which sources exist,
what they actually prove and what remains unproven.

Status: **P0 MVP implemented (D0–D4) and verified locally; not distributed.** Human gates (legal, dataset, audit,
users) are still open: see [`docs/gates.md`](docs/gates.md).

> **Language.** The product targets Spanish speakers (Spanish politics, INE and BOE sources), so the product and
> design docs (PRD, specs, ADRs, constitution, gates) are in Spanish. Issues and pull requests are welcome in
> English or Spanish.

## Architecture

```text
YouTube ── content script (videoId, time, seek) ── React side panel ──HTTPS──▶ NestJS API
                                                                                 │      │
                                                                       PostgreSQL ◀─────┘ pg-boss
                                                                                 ▲      │
                                                                      evidence   └── worker
                                                                                        │
                                              INE Tempus3 · BOE corpus · Fact Check Tools · LLM (Anthropic)
```

| Path | What it is |
|---|---|
| `apps/extension` | WXT + React + Tailwind, MV3. Permissions: `sidePanel`, `storage`, YouTube and the API |
| `apps/api` | NestJS REST, Drizzle (migrations in `drizzle/`), pg-boss worker in `src/worker` |
| `packages/contracts` | Shared Zod schemas: API, extension messages, enums |
| `packages/investigation` | Claim extraction and selection, evidence policy, stats, synthesis with validated citations |
| `packages/connectors` | `safe-fetch` (SSRF), INE, Fact Check Tools, corpus, link checks |
| `packages/evaluation` | JSONL datasets and per-stage metrics |
| `scripts/import-transcripts` | SRT/VTT ingestion CLI with mandatory `rights.json`, and claim extraction |
| `corpus/` | DEMO (fictional) videos and authorised institutional documents |
| `infra/` | Docker Compose (PostgreSQL) and DigitalOcean App Platform template |

Non-negotiable principles: [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
Conclusions are decided by deterministic code, never by the LLM ([ADR 0002](docs/adr/0002-politica-de-evidencia.md)).

## Development

Requires Node ≥22.12, pnpm and Docker.

```bash
pnpm install
pnpm db:up && cp .env.example .env && pnpm db:migrate
pnpm import:transcripts corpus/videos
pnpm dev:api        # :3100
pnpm dev:worker
pnpm build          # extension in apps/extension/.output/chrome-mv3 → chrome://extensions → "Load unpacked"
```

Checks: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build && pnpm e2e`.

Real mode: `INVESTIGATION_MODE=real` and `ANTHROPIC_API_KEY` (optionally `FACTCHECK_API_KEY`) in the server `.env`.
Without a key, every investigation ends as `FAILED/no_llm_key`; a result is never made up.

Full guide (Spanish): [`specs/001-youtube-claim-investigation/quickstart.md`](specs/001-youtube-claim-investigation/quickstart.md).

## Documentation

- Product: [`prd.md`](prd.md) · Spec-kit: [`specs/001-youtube-claim-investigation/`](specs/001-youtube-claim-investigation/)
- Gates and Definition of Done: [`docs/gates.md`](docs/gates.md) · D0 viability: [`docs/d0-viability.md`](docs/d0-viability.md)
- Governance and neutrality: [`docs/governance.md`](docs/governance.md)
- Privacy: [`docs/privacy.md`](docs/privacy.md) · Release/rollback: [`docs/release.md`](docs/release.md) · ADRs: [`docs/adr/`](docs/adr/)

## Gate status

| Gate | Status |
|---|---|
| G0 legal and content | Pending (human): only 2 DEMO videos |
| G1 vertical slice | Technical GO; manual test on real youtube.com pending |
| G2 claims | ITERATE: eval with an LLM key and a dataset reviewed by 2 people pending |
| G3 evidence | ITERATE: eval with a key, real Fact Check fixture and human audit pending |
| G4 technical beta | Local technical GO; do not distribute until G0–G3 and privacy are closed |
| V1–V3 | Not started |

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). To report a wrong result, use
the "Incorrect result" issue template; report vulnerabilities privately ([`SECURITY.md`](SECURITY.md)).

## License

Code under [AGPL-3.0-or-later](LICENSE): if you offer a modified version as a network service, you must publish your
changes. Data and fixtures as described in [`DATA-LICENSE.md`](DATA-LICENSE.md).
