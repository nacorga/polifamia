# Polifamia

> **English:** Polifamia is a Chrome extension that lets you investigate claims in Spanish political speeches on
> YouTube against primary sources (INE, BOE, fact-checks) without leaving the video. Conclusions are decided by
> deterministic code, never by the LLM, and every result shows its evidence and its limits. Early MVP, not yet
> distributed. Docs are in Spanish; issues and PRs in English are welcome. Licensed under AGPL-3.0-or-later.

Extensión de Chrome que permite investigar afirmaciones de discursos políticos en YouTube con evidencia
verificable, sin salir del vídeo. **No le decimos al usuario qué pensar**: mostramos qué se afirmó, qué fuentes
hay, qué prueban y qué queda sin probar.

Estado: **MVP P0 implementado (D0–D4) y verificado en local; no distribuido.** Los gates humanos (legal,
dataset, auditoría, usuarios) siguen abiertos: ver [`docs/gates.md`](docs/gates.md).

## Arquitectura

```text
YouTube ── content script (videoId, tiempo, seek) ── side panel React ──HTTPS──▶ API NestJS
                                                                                 │      │
                                                                       PostgreSQL ◀─────┘ pg-boss
                                                                                 ▲      │
                                                                     evidencias  └── worker
                                                                                        │
                                              INE Tempus3 · corpus BOE · Fact Check Tools · LLM (Anthropic)
```

| Ruta | Qué es |
|---|---|
| `apps/extension` | WXT + React + Tailwind, MV3. Permisos: `sidePanel`, `storage`, YouTube y la API |
| `apps/api` | NestJS REST, Drizzle (migraciones en `drizzle/`), worker pg-boss en `src/worker` |
| `packages/contracts` | Schemas Zod compartidos: API, mensajes de la extensión, enums |
| `packages/investigation` | Extracción y selección de claims, política de evidencia, stats, síntesis con citas validadas |
| `packages/connectors` | `safe-fetch` (SSRF), INE, Fact Check Tools, corpus, comprobación de enlaces |
| `packages/evaluation` | Datasets JSONL y métricas por etapa |
| `scripts/import-transcripts` | CLI de ingesta SRT/VTT con `rights.json` obligatorio y extracción de claims |
| `corpus/` | Vídeos DEMO (ficticios) y documentos institucionales autorizados |
| `infra/` | Docker Compose (PostgreSQL) y plantilla de DigitalOcean App Platform |

Principios no negociables: [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
La conclusión la decide código determinista, nunca el LLM ([ADR 0002](docs/adr/0002-politica-de-evidencia.md)).

## Desarrollo

Requiere Node ≥22.12, pnpm y Docker.

```bash
pnpm install
pnpm db:up && cp .env.example .env && pnpm db:migrate
pnpm import:transcripts corpus/videos
pnpm dev:api        # :3100
pnpm dev:worker
pnpm build          # extensión en apps/extension/.output/chrome-mv3 → chrome://extensions → «Cargar descomprimida»
```

Checks: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build && pnpm e2e`.

Modo real: `INVESTIGATION_MODE=real` y `ANTHROPIC_API_KEY` (y opcional `FACTCHECK_API_KEY`) en el `.env` del
servidor. Sin clave, cada investigación termina `FAILED/no_llm_key`; nunca se inventa un resultado.

Guía completa: [`specs/001-youtube-claim-investigation/quickstart.md`](specs/001-youtube-claim-investigation/quickstart.md).

## Documentación

- Producto: [`prd.md`](prd.md) · Spec-kit: [`specs/001-youtube-claim-investigation/`](specs/001-youtube-claim-investigation/)
- Gates y Definition of Done: [`docs/gates.md`](docs/gates.md) · Viabilidad D0: [`docs/d0-viability.md`](docs/d0-viability.md)
- Gobernanza y neutralidad: [`docs/governance.md`](docs/governance.md)
- Privacidad: [`docs/privacy.md`](docs/privacy.md) · Release/rollback: [`docs/release.md`](docs/release.md) · ADRs: [`docs/adr/`](docs/adr/)

## Estado de gates

| Gate | Estado |
|---|---|
| G0 legal y contenido | Pendiente (humano): solo 2 vídeos DEMO |
| G1 vertical slice | GO técnico; falta prueba manual en youtube.com real |
| G2 afirmaciones | ITERAR: falta eval con clave LLM y dataset revisado por 2 personas |
| G3 evidencias | ITERAR: falta eval con clave, fixture real de Fact Check y auditoría humana |
| G4 beta técnica | GO técnico local; no distribuir hasta cerrar G0–G3 y privacidad |
| V1–V3 | No iniciados |

## Contribuir

Lee [`CONTRIBUTING.md`](CONTRIBUTING.md) y el [Código de Conducta](CODE_OF_CONDUCT.md). Para errores en un resultado,
usa la plantilla «Resultado incorrecto»; las vulnerabilidades se reportan en privado ([`SECURITY.md`](SECURITY.md)).

## Licencia

Código bajo [AGPL-3.0-or-later](LICENSE): si ofreces una versión modificada como servicio, debes publicar sus cambios.
Datos y fixtures según [`DATA-LICENSE.md`](DATA-LICENSE.md).
