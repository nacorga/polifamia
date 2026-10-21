# Gates — estado y evidencias

Cada gate del PRD §13 se registra aquí con evidencia ejecutada. Los gates humanos no se dan por
cerrados desde el desarrollo.

## G0 — Viabilidad legal y de contenido (D0) · PENDIENTE (humano)

- Ruta técnica preparada: importador con `rights.json` obligatorio (`basis` ∈ `own-content`,
  `explicit-permission`, `open-license`, `demo-fixture`). Sin scraping.
- Catálogo actual: 2 vídeos **DEMO** (`corpus/videos/demo-0{1,2}.*`) con transcripciones redactadas por
  el equipo; IDs ficticios `DEMOvideo01/02`. No corresponden a vídeos ni oradores reales.
- Pendiente del propietario: seleccionar 12–20 vídeos con permiso documentado y revisión jurídica.

## G1 — Vertical slice sin IA (D1)

### Backend (S1) · GO técnico

Evidencia (2026-10-21):

- `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build` en verde.
  Tests: contracts 6, investigation 5, API integración 12 (PostgreSQL real), importador 10.
- Integración API cubre: availability (catálogo / no compatible / id inválido), claims ordenadas sin
  `speaker`, creación → worker → resultado DEMO, reutilización de caché (200), idempotencia por
  `idempotencyKey`, 10 POST concurrentes → 1 investigación (índice único parcial en curso + pg-boss
  `singletonKey`), rechazo de opiniones (400), manual sin timestamp, fallos operativos (`FAILED` con
  `failureReason`: `source_unavailable`, `timeout`, `provider_error` tras último intento), feedback que no
  altera la investigación, eventos validados con `X-Install-Id`, health, OpenAPI, correlationId, 413.
- Smoke manual: migraciones → importación DEMO (idempotente) → API + worker → availability, claims,
  POST 202 → GET `COMPLETED/NEEDS_CONTEXT` DEMO → POST con otra clave 200 (caché) → feedback 201 →
  manual 202 → manual corto 400.
- Modo `demo` nunca emite `SUPPORTED`/`CONTRADICTED`; todo resultado y evidencia lleva `[DEMO]`.

### Extensión (S2) · GO técnico (pendiente prueba manual en youtube.com real)

Evidencia (2026-10-21):

- `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build && pnpm e2e` en verde.
  Unit extensión 9 (máquina de estados UX y backoff de polling). E2E 7 (Playwright, Chromium + extensión MV3,
  API + worker reales en modo DEMO sobre `polifamia_e2e`):
  1. vídeo del catálogo: lista DEMO, salto al minuto ≤2 s y estado de pausa sin cambios;
  2. navegación SPA entre `DEMOvideo01` → `DEMOvideo02` sin afirmaciones cruzadas;
  3. investigar: progreso → resultado DEMO en el orden Afirmación → Evidencias → Contexto → Fuentes,
     «comprobado el…», «volver al minuto», reporte de problema;
  4. resultado tardío no aparece tras cambiar de vídeo (verificado que el test falla si se quita el reinicio
     de estado por vídeo);
  5. vídeo no compatible → «Pegar una afirmación» (validación de longitud, aviso de envío, sin minuto);
  6. API caída → error recuperable → «Reintentar»;
  7. panel lateral abre desde el icono y solo está habilitado en YouTube.
- Eventos registrados durante E2E: `panel_opened`, `investigation_requested`, `result_opened`, `feedback_sent`.
- Detalle técnico y restricciones: `docs/d0-viability.md`.

Pendiente para cerrar G1: prueba manual de instalación en Chrome estable sobre youtube.com real (fuera del
catálogo DEMO, que usa IDs ficticios).

## G2 — Motor de afirmaciones (D2) · ITERAR (pendiente clave LLM y revisión humana)

Construido (S3, 2026-10-21):

- `packages/investigation`: `LlmClient` (impl. Anthropic con salida estructurada Zod + `FakeLlmClient`),
  registro por llamada de modelo, `promptVersion`, tokens y coste (EUR). Modelos por entorno:
  `LLM_MODEL_EXTRACT` (def. `claude-haiku-5-5`), `LLM_MODEL_SYNTH` (def. `claude-opus-5-5`).
- Segmentación en tramos con solape; `LlmClaimExtractor` con validación determinista: literal debe ser
  subcadena exacta del tramo (si no → rechazada `not_in_transcript`), timestamps y contexto desde los
  segmentos, `declaredSource` solo si la fuente aparece en el tramo, checkability derivada del tipo.
- Selección determinista `selectClaims` (máx. `CLAIMS_MAX`=10): especificidad (cifra, periodo, territorio,
  métrica, unidad), área beta, fuente declarada; deduplicación conservadora. No lee orador ni partido.
- `pnpm extract:claims <youtubeId>` persiste las claims seleccionadas de la última transcripción
  (inmutables por revisión) y pasa el vídeo a `claims_ready` (lista vacía válida).
- Prompt con transcripción delimitada como datos no confiables + saneado de etiquetas; test de inyección.

Evidencia:

- Tests: investigation 20 (segmentación, extracción, inyección, selección, invariancia de orador/partido),
  importador+extracción 12 (BD real), evaluación 5.
- `pnpm eval:extraction` (modo **offline-oracle**, 40 ejemplos / 42 claims): P=R=1, clasificación 1,
  0 errores de timestamp, 3/3 grupos de invariancia consistentes. **Esto solo valida el arnés y la
  validación determinista; no es una métrica de calidad de modelo** (el LLM falso devuelve las etiquetas).
- Sin `ANTHROPIC_API_KEY` en el entorno: `extract:claims` y `eval:extraction -- --real` salen con código 2
  sin tocar nada.

Pendiente para cerrar G2:

- **Clave LLM (operador)** y ejecutar `pnpm eval:extraction -- --real` → precisión/recobrado reales.
- **Humano**: ampliar el dataset a ≥100 ejemplos revisados por dos personas (`reviewStatus: "reviewed"`,
  desacuerdos documentados). El seed actual (`packages/evaluation/data/extraction.seed.jsonl`, 40 ejemplos)
  está etiquetado solo por el equipo de desarrollo (`unreviewed-seed`).
- Decidir umbrales preliminares de §12 a partir de la ejecución real; si no se alcanzan, reducir tipos admitidos.
## G3 — Motor de evidencias (D3) · pendiente
## G4 — Beta técnica (D4) · pendiente
