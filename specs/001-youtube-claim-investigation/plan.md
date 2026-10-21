# Implementation Plan: Investigación de afirmaciones en vídeos de YouTube (MVP P0)

**Branch**: `001-mvp` | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-youtube-claim-investigation/spec.md` + PRD v1.1.

## Summary

Extensión Chrome MV3 (WXT + React) con panel lateral en YouTube que muestra afirmaciones de un catálogo
autorizado de vídeos, sincronizadas con el reproductor, y permite investigarlas bajo demanda. Backend
NestJS + PostgreSQL con cola pg-boss y worker que recupera evidencia (Fact Check Tools, INE, corpus
institucional), aplica una política de evidencia determinista y sintetiza con un LLM encapsulado.
Se entrega por fases D0→D4 del PRD; los gates humanos (legal, usuarios) quedan documentados.

## Technical Context

**Language/Version**: TypeScript 5.x estricto; Node ≥22 (objetivo de despliegue Node 22 LTS)

**Primary Dependencies**: WXT, React, Tailwind, TanStack Query; NestJS, Zod, Drizzle ORM/Kit, pg-boss, pino; SDK Anthropic

**Storage**: PostgreSQL 16 (Docker Compose en local; gestionado en beta)

**Testing**: Vitest (unit/integración), Playwright (E2E con extensión cargada)

**Target Platform**: Chrome escritorio (MV3) + servidor Linux (API y worker)

**Project Type**: monorepo pnpm — extensión de navegador + web-service + worker

**Performance Goals**: caché p95 <2 s; investigación nueva p95 <45 s; seek ≤2 s de desfase

**Constraints**: sin secretos en la extensión; coste/inv. objetivo ≤0,25 €; presupuesto diario global; sin scraping

**Scale/Scope**: beta cerrada 15–25 usuarios, 12–20 vídeos, ~10 claims/vídeo

## Constitution Check

| Principio | Cómo se cumple | Estado |
|---|---|---|
| I Evidencia antes que veredicto | `evidence-policy.ts` determinista decide la conclusión; validador de citas por `evidenceId`; abstención por defecto | ✅ diseño |
| II Neutralidad | `speaker` excluido de extracción/ranking; tests de invariancia | ✅ diseño |
| III Contenido lícito | importador exige `rights.json`; DEMO etiquetado; sin scraping | ✅ diseño (gate legal humano pendiente) |
| IV Privacidad/seguridad | permisos mínimos, aviso de envío, rate limit, presupuesto, whitelist SSRF | ✅ diseño |
| V Simplicidad | stack PRD; sin Redis/vector DB; 4 paquetes del PRD | ✅ |

Re-check post-diseño: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/001-youtube-claim-investigation/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/api.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
  extension/                  # WXT + React
    entrypoints/background.ts
    entrypoints/youtube.content.ts
    entrypoints/sidepanel/{index.html,main.tsx,App.tsx}
    src/components/ src/hooks/ src/lib/{chrome-bridge.ts,api-client.ts}
    e2e/                      # Playwright + fixture de página de vídeo
  api/
    src/main.ts               # NestJS HTTP
    src/modules/{videos,claims,investigations,feedback,events,health}/
    src/worker/main.ts        # consumidor pg-boss
    src/db/{schema.ts,client.ts}
    drizzle/                  # migraciones SQL
    test/                     # integración con PostgreSQL
packages/
  contracts/                  # Zod: API, mensajes, enums, errores
  investigation/              # pipeline, interfaces LLM, evidence-policy, stats, cache-key, demo
  connectors/                 # factcheck, ine (+registry), corpus, safe-fetch
  evaluation/                 # dataset JSONL + script de métricas por etapa
scripts/import-transcripts/   # CLI SRT/VTT + rights.json
corpus/                       # transcripciones DEMO + derechos; pasajes institucionales
docs/                         # d0-viability.md, privacy.md, adr/
infra/docker-compose.yml
.github/workflows/ci.yml
```

**Structure Decision**: la del PRD §10.3, añadiendo `corpus/` (datos versionados) y `docs/`.

## Phases & slices (estado compartido entre sesiones)

Cada slice se ejecuta en un contexto nuevo, marca sus tareas en `tasks.md` y hace commit en `001-mvp`.

1. **S1 — Fundaciones + API vertical (D1 backend)**: T001–T024
2. **S2 — Extensión (D0 spike + D1 UI)**: T025–T042
3. **S3 — Motor de afirmaciones + evaluación (D2)**: T043–T053
4. **S4 — Motor de evidencias (D3)**: T054–T067
5. **S5 — Integración, seguridad y beta técnica (D4)**: T068–T080

## Complexity Tracking

Sin violaciones que justificar.
