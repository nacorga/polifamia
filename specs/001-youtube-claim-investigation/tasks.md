---
description: "Task list — 001 MVP investigación de afirmaciones en YouTube"
---

# Tasks: Investigación de afirmaciones en vídeos de YouTube (MVP P0)

**Input**: `/specs/001-youtube-claim-investigation/` (plan, spec, research, data-model, contracts)

**Tests**: requeridos por la constitución (V) y el PRD §10.7.

Formato: `[ID] [P?] [Story] Descripción`. Stories: US1 lista+seek, US2 investigar, US3 manual,
US4 feedback, US5 importación. Cada fase = un slice (S1–S5) ejecutado en contexto nuevo.

**Regla para cada slice**: al terminar, `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
en verde, tareas marcadas `[x]`, notas de gate en `docs/gates.md`, commit en `001-mvp`.

---

## Phase 1 — S1: Fundaciones + API vertical (D1 backend)

### Setup

- [x] T001 Monorepo pnpm: `package.json` raíz (scripts typecheck/lint/test/build/e2e/dev:*), `pnpm-workspace.yaml`, `tsconfig.base.json` estricto, ESLint flat config + Prettier, `.gitignore`, `.nvmrc` (22), `.env.example`
- [x] T002 [P] `infra/docker-compose.yml` con PostgreSQL 16 (bd `polifamia` y `polifamia_test`)
- [x] T003 [P] `.github/workflows/ci.yml`: install, typecheck, lint, test (servicio postgres), build, validación de migraciones

### Foundational

- [x] T004 `packages/contracts`: enums (estados UX, conclusiones, job status, claim types, provenance, feedback reasons, event names), schemas Zod de `contracts/api.md`, errores, `messages.ts`
- [x] T005 [P] Tests de schemas en `packages/contracts/src/*.test.ts`
- [x] T006 `apps/api/src/db/schema.ts` según `data-model.md` + `drizzle.config.ts` + primera migración en `apps/api/drizzle/`
- [x] T007 NestJS bootstrap `apps/api/src/main.ts`: pipe de validación Zod, filtro de errores `{error:{code,message}}`, logger pino JSON con `correlationId`, CORS limitado a `chrome-extension://*`, límite de body
- [x] T008 [P] `GET /health` y `GET /openapi.json` generado desde contracts
- [x] T009 Config tipada (Zod sobre `process.env`): DB, modo demo/real, límites por job, presupuesto diario, rate limit

### US5 — Importación autorizada (P1)

- [x] T010 [P] [US5] Parser SRT/VTT con tests (timestamps, multilínea, BOM, cues inválidos) en `scripts/import-transcripts/src/parse.ts`
- [x] T011 [US5] Schema `rights.json` (holder, basis, scope, language, youtubeId, url, importedBy) y CLI `pnpm import:transcripts <dir>`: valida, calcula `revision_hash`, upsert idempotente de vídeo + transcripción
- [x] T012 [US5] Carga de claims curadas `*.claims.json` (literal debe ser subcadena de la transcripción y caer en el tramo temporal; si no → rechazo) marcando `extractor: "fixture"`
- [x] T013 [P] [US5] Corpus DEMO: 2 vídeos en `corpus/videos/` (transcripción redactada por el equipo, `basis: "demo-fixture"`, claims DEMO de economía/empleo, incl. una opinión y una predicción)

### US1 — API de catálogo (P1)

- [x] T014 [US1] `GET /v1/videos/:videoId/availability` (unsupported_video si no está)
- [x] T015 [US1] `GET /v1/videos/:videoId/claims` ordenado por rank, solo CHECKABLE + marcado de no verificables

### US2 — Investigaciones con worker DEMO (P1)

- [x] T016 [US2] `packages/investigation`: `cacheKey()` con tests; interfaz `Investigator`; `DemoInvestigator` que devuelve resultado claramente DEMO con evidencia ficticia marcada
- [x] T017 [US2] `POST /v1/investigations`: idempotencyKey único, reutiliza caché válida (200), si no crea PENDING y encola en pg-boss con `singletonKey=cacheKey` (202)
- [x] T018 [US2] `GET /v1/investigations/:id` con evidencias y fuentes
- [x] T019 [US2] Worker `apps/api/src/worker/main.ts`: consume, RUNNING → resultado, persiste versión, coste, latencia, timeout por job y estados FAILED con motivo
- [x] T020 [P] [US3] Soporte `manualClaim` (10..500 chars), sin timestamp, `claim.kind="manual"`

### US4 — Feedback y eventos (P2)

- [x] T021 [P] [US4] `POST /v1/investigations/:id/feedback` (no altera la investigación)
- [x] T022 [P] `POST /v1/events` (FR-017), sin datos personales salvo `installId`

### Validación S1

- [x] T023 Tests de integración API (`apps/api/test/`) contra `polifamia_test`: availability, claims, idempotencia, deduplicación concurrente, caché, manual, feedback, errores 404/400
- [x] T024 `docs/gates.md` con notas G1 (backend) y actualización de `quickstart.md`

**Checkpoint**: backend D1 operativo en modo DEMO con datos del corpus.

---

## Phase 2 — S2: Extensión (D0 spike + D1 UI)

- [x] T025 WXT + React + Tailwind en `apps/extension`, manifest: `sidePanel`, `storage`, `tabs`; host permissions `*://*.youtube.com/*` y la URL de la API (configurable por `WXT_API_URL`)
- [x] T026 `entrypoints/background.ts`: `openPanelOnActionClick`, panel habilitado solo en pestañas YouTube, relay de mensajes tipados por `tabId`
- [x] T027 `entrypoints/youtube.content.ts`: `videoId` desde URL, `HTMLVideoElement` (play/pause/seeked/timeupdate con throttle), navegación SPA (`yt-navigate-finish` + observación de URL), `video:seek`; sin leer otra cosa del DOM
- [x] T028 `src/lib/chrome-bridge.ts`: hook `useActiveVideo()` con `requestId`, descarta mensajes de otro `videoId/tabId`
- [x] T029 `src/lib/api-client.ts`: fetch tipado con contracts, `X-Install-Id` anónimo en `storage.local`, mapping de errores a estados UX
- [x] T030 [US1] Máquina de estados UX (los 11 de FR-009) en `src/hooks/usePanelState.ts` con tests
- [x] T031 [US1] Vista lista de afirmaciones: minuto, literal, insignia DEMO, clic → seek; foco/teclado/aria
- [x] T032 [US1] Estados `unsupported_video`, `transcript_unavailable`, `preparing_claims`, lista vacía, `error` con reintento
- [x] T033 [US2] Botón Investigar + polling TanStack Query (backoff 1→2→4 s máx., parada en terminal, cancelación al cambiar de vídeo)
- [x] T034 [US2] Vista resultado: literal → qué muestran las evidencias → contexto/limitaciones → fuentes (URL, publicador, fechas, fragmento, procedencia), «comprobado el…», caducidad, volver al minuto
- [x] T035 [US3] «Pegar una afirmación» con aviso de qué se envía y a quién (FR-012), sin timestamp
- [x] T036 [US4] Formulario «Hay un problema con esta investigación»
- [x] T037 Eventos `panel_opened`, `investigation_requested`, `result_opened`, `source_clicked`, `feedback_sent`
- [x] T038 Estados `rate_limited`, `source_unavailable`, `insufficient_evidence` con copy neutral
- [x] T039 Fixture E2E: página de vídeo servida vía `context.route` para `https://www.youtube.com/watch?v=*` con `<video>` local y navegación SPA simulada
- [x] T040 Playwright E2E: lista + seek ≤2 s, cambio de vídeo sin datos cruzados, no compatible + manual, investigación DEMO, API caída
- [x] T041 Spike D0 documentado en `docs/d0-viability.md`: capacidades verificadas (sidePanel, videoId, currentTime, SPA) y restricciones YouTube/Chrome Web Store
- [x] T042 Actualizar `docs/gates.md` (G1 completo) y `quickstart.md`

**Checkpoint**: Gate G1 — experiencia completa DEMO, sincronizada, sin cruces.

---

## Phase 3 — S3: Motor de afirmaciones + evaluación (D2)

- [x] T043 Interfaz `LlmClient` (structured output → Zod, registro de modelo/promptVersion/tokens/coste) + impl. Anthropic en `packages/investigation/src/llm/`
- [x] T044 Segmentación de transcripción en tramos con contexto y solape (`segment.ts`) con tests
- [x] T045 `ClaimExtractor` LLM: claims atómicas con literal, contexto, tipo, normalización; rechazo de literales que no sean subcadena del tramo; timestamps desde segmentos
- [x] T046 Clasificación statistic/fact/opinion/prediction/uncheckable y checkability
- [x] T047 Selección determinista 3–10 (`select.ts`): especificidad (cifra, periodo, territorio), área beta, deduplicación conservadora; sin speaker/partido; tests
- [x] T048 Comando `pnpm extract:claims <youtubeId>` que persiste claims (versionadas por transcript) y pasa vídeo a `claims_ready`
- [x] T049 [P] `packages/evaluation`: formato JSONL de dataset (claims etiquetadas, tipo, checkable, esperado), seed inicial con negativos, ambiguos, equivalencias y pares de invariancia de orador
- [x] T050 Script `pnpm eval:extraction` que reporta precisión/recobrado de extracción, errores de clasificación y de timestamp por separado
- [x] T051 Tests de invariancia (misma frase, distinto orador/partido → misma clasificación y rank)
- [x] T052 Prompt con delimitación de datos no confiables + test de inyección
- [x] T053 `docs/gates.md` G2 (resultado de eval con/ sin clave; pendiente humano: ≥100 ejemplos revisados por 2 personas)

---

## Phase 4 — S4: Motor de evidencias (D3)

- [ ] T054 `packages/connectors/src/safe-fetch.ts`: whitelist de hosts, timeout, tamaño máximo, solo https; tests SSRF
- [ ] T055 [P] Conector Fact Check Tools `claims.search` con fixtures reales grabados y mocks
- [ ] T056 [P] Conector INE Tempus3 + registro de series aprobadas (paro EPA, PIB, IPC, afiliación…) con unidad/territorio/periodicidad; localizador = URL exacta de consulta
- [ ] T057 [P] Corpus institucional `corpus/documents/*.json` (pasajes con URL, página/sección) + búsqueda léxica
- [ ] T058 `EvidenceRetriever`: caché contextual → fact-checks → INE (según normalized.metric) → corpus; deduplicación de fuentes dependientes
- [ ] T059 `stats.ts` determinista (variación absoluta, %, pp; comprobación de homogeneidad indicador/unidad/territorio) con tests
- [ ] T060 `EvidenceVerifier` LLM: relación por evidencia citando IDs; validación de que extracto y localizador existen
- [ ] T061 `evidence-policy.ts` determinista (R7) con tests exhaustivos (sin evidencia, solo contexto, apoyo+contradicción, fuente caída, sin localizador)
- [ ] T062 `ExplanationGenerator`: summary/context/limitations con referencias solo a evidenceIds persistidos; validador de citas (rechaza IDs/URLs ajenos)
- [ ] T063 `RealInvestigator` orquestando etapas con límites por job (llamadas, tokens, documentos, tiempo) y salida honesta al agotarse
- [ ] T064 Provenance: `declared_source` solo si el orador cita la fuente explícitamente; resto `retrieved_evidence`/`unknown_origin`
- [ ] T065 Versionado/caducidad (`expiresAt` por tipo de fuente), `superseded_by`, caché contextual FR-010
- [ ] T066 `pnpm eval:investigation`: integridad de citas, abstención, contexto estadístico sobre el dataset (offline con fixtures)
- [ ] T067 `docs/gates.md` G3 (pendiente humano: auditoría manual de cada referencia; comparación económico vs. capaz)

---

## Phase 5 — S5: Integración, seguridad y beta técnica (D4)

- [ ] T068 Worker en modo `real` conectado al pipeline; `demo` sigue disponible y etiquetado
- [ ] T069 Rate limit por IP + installId (`@nestjs/throttler`) y presupuesto diario global → `rate_limited` / `budget_exceeded`
- [ ] T070 Logs de etapa con `investigationId`/`correlationId`, duración, coste; sin textos completos
- [ ] T071 Validación de enlaces de fuentes (HEAD vía safe-fetch) → `check_status`
- [ ] T072 Pantalla de cobertura y explicación de límites en el panel
- [ ] T073 E2E: proveedor caído, rate limited, idempotencia doble clic, pestañas múltiples
- [ ] T074 Test de estrés pequeño: 20 POST concurrentes misma claim → 1 job
- [ ] T075 Revisión de permisos de la extensión y CSP; sin secretos en el bundle (test que inspecciona build)
- [ ] T076 `docs/privacy.md` (qué se envía, retención 14/30 días, contacto) + purga programada de logs/eventos
- [ ] T077 `infra/digitalocean-app.yaml` (API + worker + PG gestionado) y notas de release/rollback
- [ ] T078 ADRs breves en `docs/adr/` (proveedor LLM, política de evidencia, ruta de contenido)
- [ ] T079 Validación completa de `quickstart.md` + Definition of Done §14 en `docs/gates.md`
- [ ] T080 README raíz con arquitectura, comandos y estado de gates

---

## Dependencies

S1 → S2 → S3 → S4 → S5 (secuencial; S2 y S3 solo comparten `packages/contracts`).
Gates humanos fuera del código: D0 legal, dataset revisado, auditoría G3, V1–V3.
