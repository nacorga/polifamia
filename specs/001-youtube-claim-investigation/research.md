# Research — 001 MVP

Decisiones de Phase 0. Formato: Decisión / Razón / Alternativas descartadas.

## R1. Ruta de contenido (gate D0)

- **Decisión**: catálogo de transcripciones `.srt`/`.vtt` importadas por el operador con un fichero de
  derechos `*.rights.json` obligatorio (titular, base legal, alcance, idioma, URL, fecha). Mientras no
  existan permisos reales, el repo incluye 2 vídeos **DEMO** con transcripciones redactadas por el
  equipo y `rightsBasis: "demo-fixture"`; la UI los etiqueta DEMO.
- **Razón**: `captions.download` exige permisos de edición; las políticas de YouTube restringen la
  extracción. El PRD §8 prohíbe scraping.
- **Descartado**: scraping de `timedtext`, captura de audio (tabCapture), descarga de vídeos.
- **Pendiente humano**: seleccionar 12–20 vídeos reales con permiso documentado y revisión jurídica
  (`docs/d0-viability.md`).

## R2. Monorepo y build

- **Decisión**: pnpm workspaces, TypeScript estricto. Paquetes internos (`packages/*`) compilados con
  `tsc` a `dist/` (project references) para que NestJS (decoradores) y WXT los consuman igual.
- **Descartado**: Nx/Turborepo (innecesario para un dev), paquetes publicados.

## R3. Extensión

- **Decisión**: WXT + React + Tailwind. `chrome.sidePanel` con `openPanelOnActionClick`; el panel se
  habilita solo en pestañas `youtube.com`. Content script en `*://*.youtube.com/*` (para captar la
  navegación SPA `yt-navigate-finish` / cambios de URL) que **solo** lee `videoId` de la URL y el
  `HTMLVideoElement` (`currentTime`, `paused`, eventos `play/pause/seeked`) y ejecuta `seek`.
- Mensajería tipada (`packages/contracts/messages`) con `tabId`, `videoId`, `requestId`; el panel
  descarta respuestas cuyo `videoId` no coincide con el activo.
- **Estado**: React local + TanStack Query (polling con backoff, se para en estados terminales).
- **Descartado**: overlays en la página, Redux, lectura del DOM de subtítulos.

## R4. Backend y cola

- **Decisión**: NestJS REST (Node 22 LTS objetivo; funciona en Node ≥22). PostgreSQL 16 en Docker
  Compose. Drizzle ORM + Drizzle Kit (migraciones SQL versionadas en `apps/api/drizzle`). pg-boss
  para jobs: `POST /v1/investigations` encola con `singletonKey = cacheKey` (deduplicación de
  concurrentes) e `idempotencyKey` único en tabla. Worker = proceso separado (`apps/api/src/worker`).
- **Descartado**: Redis/BullMQ, SSE/websockets, serverless.

## R5. Proveedor LLM

- **Decisión**: interfaces `ClaimExtractor`, `EvidenceVerifier`, `ExplanationGenerator` en
  `packages/investigation`; implementación por defecto con el SDK de Anthropic y salidas estructuradas
  validadas con Zod. Modelos por variable de entorno (`LLM_MODEL_EXTRACT`, `LLM_MODEL_SYNTH`);
  por defecto uno económico para extracción y uno de mayor capacidad para síntesis. Se registra
  modelo, versión de prompt, tokens y coste por llamada.
- **Sin clave**: `INVESTIGATION_MODE=demo` produce resultados marcados DEMO; en modo `real` sin
  clave el job termina `FAILED` con motivo operativo (nunca inventa).
- **Pendiente**: comparar modelo económico vs. capaz sobre el dataset (gate G3).

## R6. Fuentes

- **Fact Check Tools**: `GET https://factchecktools.googleapis.com/v1alpha1/claims:search`
  (`query`, `languageCode=es`, `key`). Se usa como índice de verificaciones existentes; la evidencia
  es la reseña enlazada (publisher, url, reviewDate, textualRating) — nunca certificación automática.
- **INE**: API JSON Tempus3 `https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/{codSerie}?nult=N`.
  Registro aprobado de series (`packages/connectors/src/ine/registry.ts`) con indicador, unidad,
  territorio, periodicidad y código; consultas reproducibles (URL exacta guardada como localizador).
- **Corpus**: pasajes de documentos institucionales autorizados (BOE, AIReF…) almacenados como JSON
  con URL, página/sección y texto; búsqueda léxica simple sobre ese corpus.
- **SSRF**: todos los fetch pasan por un cliente con whitelist de hosts (`factchecktools.googleapis.com`,
  `servicios.ine.es`, hosts del corpus), timeout y tamaño máximo.
- **Descartado P0**: búsqueda web abierta, embeddings, vector DB.

## R7. Política de evidencia (determinista)

- La conclusión la decide código, no el LLM: el LLM propone relación por evidencia
  (`supports|contradicts|context|irrelevant`) citando IDs; `evidence-policy.ts` solo permite
  `SUPPORTED`/`CONTRADICTED` si existe ≥1 evidencia con localizador + extracto + relación coincidente
  y ninguna contradicción de igual peso sin explicar; si hay ambas → `NEEDS_CONTEXT`; si ninguna
  pertinente → `INSUFFICIENT_EVIDENCE`.
- Cifras: `stats.ts` calcula variaciones (absoluta, %, pp) con fórmula y redondeo explícitos; solo
  sobre series del mismo indicador/unidad/territorio.
- Validación de citas: toda referencia del texto de síntesis debe ser un `evidenceId` persistido.

## R8. Caché (FR-010)

- **Decisión**: `cacheKey = sha256(normalizedClaim.metric | entity | territory | period | sourcesRevision)`.
  Reutilización solo con clave idéntica y `expiresAt` vigente. Sin similitud vectorial.
- `sourcesRevision` = versión del registro de conectores/corpus (constante en código, se incrementa
  al cambiar fuentes).

## R9. Seguridad, privacidad y operación

- Rate limit por IP + identificador anónimo de instalación (`@nestjs/throttler`, en memoria; una
  instancia en beta). Presupuesto diario global en PostgreSQL (suma de `costEur` del día).
- La extensión no lleva secretos; el `installId` anónimo no es autenticación.
- Logs JSON (pino) con `correlationId` e `investigationId`, sin textos completos.
- Eventos de producto a tabla `events` (nombre, videoId opcional, installId, fecha); retención 30 días.
- Texto no fiable en prompts: delimitado como datos, instrucción de sistema que prohíbe seguirlo.

## R10. Tests

- Vitest: parser SRT/VTT, política de evidencia, stats, cacheKey, invariancia de orador, schemas.
- Integración API contra PostgreSQL de Docker (BD de test) con conectores mockeados.
- Playwright: Chromium con la extensión cargada; las peticiones a `youtube.com/watch` se sirven con
  `context.route` desde una página fixture con `<video>` local → E2E reproducible sin vídeos públicos.
