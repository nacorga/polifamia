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
## G3 — Motor de evidencias (D3) · ITERAR (pendiente clave LLM y auditoría humana)

Construido (S4, 2026-10-21):

- `packages/connectors`:
  - `safe-fetch`: whitelist exacta de hosts, solo https, sin IPs literales, credenciales ni puertos raros,
    redirecciones revalidadas salto a salto, timeout y tamaño máximo.
  - INE Tempus3 con registro de series aprobadas (`EPA452434` tasa de paro, `IPC251856` IPC variación
    anual, `CNTR6597` PIB trimestral a precios corrientes), verificado contra la API real el 2026-10-21
    (`SERIE/{cod}?det=1`). Consulta por periodo exacto (`?date=AAAAMMDD:AAAAMMDD`) o últimas observaciones.
    El localizador de la evidencia es la URL exacta consultada.
  - Fact Check Tools `claims.search` (forma documentada); se trata como índice, no como certificación.
  - Corpus institucional `corpus/documents/*.json`: Real Decreto 145/2024 (SMI 2024, `BOE-A-2024-2251`),
    artículos 1 y 3 copiados literalmente del BOE por `pnpm --filter @polifamia/connectors record:fixtures`.
- `packages/investigation`:
  - `stats.ts`: comparación determinista con fórmula, periodo y redondeo explícitos; solo
    `supports`/`contradicts` si coinciden indicador, unidad, territorio y periodo exacto.
  - `evidence-policy.ts` (R7): la conclusión la decide código. Solo fuentes primarias sostienen
    `SUPPORTED`/`CONTRADICTED`; las verificaciones de terceros cuentan como contexto.
  - `LlmEvidenceVerifier`: el LLM propone relación por evidencia; IDs desconocidos se descartan y lo no
    evaluado queda `irrelevant`.
  - `LlmExplanationGenerator` con validador de citas: rechaza IDs inexistentes, URLs en el texto y cifras
    que no aparezcan en afirmación, evidencias o cálculo. Si falla, plantilla determinista.
  - `RealInvestigator`: normaliza afirmaciones manuales con el extractor, recupera, verifica, decide y
    sintetiza con presupuesto por job (`JobBudget`: llamadas, tokens, tiempo; documentos vía `maxDocuments`).
    Fuente caída sin otra evidencia → `FAILED/source_unavailable`; fuentes respondiendo sin evidencia →
    `INSUFFICIENT_EVIDENCE` («no significa que sea falsa»).
  - Procedencia: `declared_source` solo si el orador nombra la fuente; el resto `retrieved_evidence`.
  - Versionado: caducidad por origen (INE 30 d, verificaciones 90 d, corpus 180 d, sin evidencia 7 d);
    una nueva versión de la misma clave marca `superseded_by` en las anteriores (no se borran).
    `SOURCES_REVISION` = `ine3-boe1-factcheck1@2026-10-21` en la clave de caché (FR-010).
- Worker: `INVESTIGATION_MODE=real` arranca; sin `ANTHROPIC_API_KEY` cada job termina `FAILED/no_llm_key`.

Evidencia:

- Tests: conectores 22 (SSRF, INE con respuestas reales grabadas, Fact Check, corpus), investigación 59
  (stats, política, pipeline real con LLM falso, integridad de citas, inyección, presupuesto), evaluación 7,
  API 15 (incluye pipeline real persistido con respuesta INE grabada, `no_llm_key` y supersesión).
- `pnpm eval:investigation` (modo **offline-scripted**, 22 casos): precisión de resultado 1, 0 violaciones
  de integridad de citas, 0 conclusiones categóricas sin evidencia primaria, contexto estadístico 9/9,
  5 abstenciones, 1 fallo operativo esperado. **Solo valida el pipeline determinista; el LLM está
  guionizado por caso.**
- Smoke: API + worker en modo real sin clave → `POST` 202 → `FAILED`, `failureReason: no_llm_key`.

Pendiente para cerrar G3:

- **Operador**: `ANTHROPIC_API_KEY` → `pnpm eval:investigation -- --real` y comparar modelo económico vs.
  capaz (`LLM_MODEL_SYNTH`) sobre el mismo corpus.
- **Operador**: `FACTCHECK_API_KEY` → grabar una respuesta real de `claims.search` y sustituir
  `packages/connectors/fixtures/factcheck.synthetic-shape.json` (hoy solo reproduce la forma documentada).
- **Humano**: auditoría manual de cada referencia en la muestra de aceptación (≥95 % de correspondencia,
  0 citas fabricadas, contexto estadístico ≥90 %); revisar términos de reutilización del corpus.
- Ampliar registro INE y corpus (BOE, AIReF) según las afirmaciones del catálogo real (G0).

## G4 — Beta técnica (D4) · GO técnico local · NO-GO a distribución (gates humanos abiertos)

Construido (S5, 2026-10-21):

- Worker en modo `real` conectado al pipeline (S4) con trazas por etapa (`normalize`, `retrieve`, `verify`,
  `decide`, `synthesize`, `link_check`) que registran duración, llamadas, tokens y coste con
  `investigationId`/`correlationId`, sin textos. `demo` sigue disponible y etiquetado.
- Rate limit por IP y por `X-Install-Id` (independientes) en `POST /v1/investigations` y feedback; el polling no
  se limita. Presupuesto global diario sobre costes persistidos → `429 budget_exceeded` para trabajo nuevo
  (la caché se sigue sirviendo). ADR 0004.
- Comprobación de enlaces vía `safe-fetch` (whitelist INE + hosts del corpus) → `check_status`
  `verified`/`link_failed`; reseñas de terceros fuera de whitelist quedan `unverified` (sin fetch arbitrario).
- Extensión: estados distintos y neutrales para `provider_error`, `no_llm_key`, `timeout`, `budget_exceeded`,
  `source_unavailable` y `rate_limited`; «Reintentar» en un job FAILED crea una investigación nueva.
  Vista «Cobertura y límites». Permiso `tabs` eliminado (solo `sidePanel` + `storage`), CSP explícita.
- `scripts/check-bundle.mjs` se ejecuta tras cada build y falla si hay claves, nombres de variables del servidor,
  URLs con credenciales, permisos extra, host permissions amplios o CSP relajada.
- Retención: job pg-boss `retention-purge` (diario 03:17 UTC) borra eventos >30 días; logs 14 días en plataforma.
- `infra/digitalocean-app.yaml` (no desplegado), `docs/release.md`, `docs/privacy.md`, ADRs 0001–0004.

Evidencia (2026-10-21):

- `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build && pnpm e2e` en verde.
  Tests 142: contracts 6, connectors 26, extensión 12, investigation 59, evaluation 7, API 20 (PostgreSQL real),
  importador 12. E2E 17 (Playwright + extensión MV3 + API/worker reales en DEMO).
- API: 20 POST concurrentes con claves distintas → 1 investigación y 1 job pg-boss; presupuesto agotado → 200
  desde caché y 429 `budget_exceeded` para lo nuevo; rate limit por IP e installId; `check_status` persistido;
  purga de eventos >30 días.
- E2E nuevos: cinco fallos operativos con estado propio y sin conclusión; 429 `rate_limited` y `budget_exceeded`
  al crear; doble clic → un solo ID; dos pestañas sin mezcla de vídeos; cobertura sin perder la vista; panel
  deshabilitado fuera de YouTube y URL de la otra pestaña invisible para la extensión.
- Quickstart ejecutado a mano (BD de desarrollo, `RATE_LIMIT_PER_MINUTE=5`): health ok; availability
  `claims_ready`/`unsupported_video`; POST 202 → PENDING → RUNNING → `COMPLETED/NEEDS_CONTEXT` DEMO; feedback 201;
  5 POST más → `202 202 202 429 429`; 7 GET de polling → todos 200; OpenAPI con 7 rutas; schedule
  `retention-purge | 17 3 * * * | UTC` registrado; logs de worker con `stage` y `correlationId`.

## G5 — Selección web (002) · EN CURSO

Spec `specs/002-web-claim-investigation/`. Solo se envía el texto (con `origin: "web_selection"`); medio, dirección y
título quedan en el panel.

### Backend (S1) · GO técnico

Evidencia (2026-10-21):

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm format:check` en verde. Tests: contracts 7,
  connectors 26, extensión 12, investigation 60, evaluation 7, API integración 23 (PostgreSQL real), importador 12.
- Migración `0001_web_selection` (`event_name += selection_investigated`, `failure_reason += not_checkable`, columna
  `investigations.manual_origin`); `db:generate` sin drift.
- Integración API cubre: texto libre igual (normalizado) a un claim del catálogo → misma investigación que `{claimId}`,
  respuesta 200 desde caché (SC-004); pegado y seleccionado → misma investigación (SC-005); `manual_origin` guardado y
  no serializado; `url` en el body → 400; opinión del catálogo (por `claimId` o por texto) → 400 `not_checkable`;
  opinión clasificada por el motor → `FAILED/not_checkable`, no reutilizada; evento `selection_investigated` → 204.
- Motor real: el extractor que clasifica el texto libre como opinión/predicción corta con `not_checkable` (unit test).
  Cambia también el texto pegado de 001 en modo real (antes se investigaba como hecho; constitución II).
- Límite conocido: en DEMO, una opinión sin coincidencia en el catálogo no se detecta.

### Extensión (S2) · GO técnico (pendiente E2E de S3 y prueba manual del menú)

Evidencia (2026-10-21):

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm format:check` en verde. Unit extensión 20 (+8:
  `selectionFromClick` quita query y fragmento, marca `chrome://`, `file://` y PDF como no compatibles; guardia de
  permisos con `activeTab, contextMenus, sidePanel, storage`, `tabs` sigue rechazado).
- Manifest: permisos `activeTab, contextMenus, sidePanel, storage`; host permissions sin cambios (YouTube + API);
  content script solo en YouTube. Bundle check en verde en `chrome-mv3` y `chrome-mv3-e2e`.
- Background: menú «Investigar esta afirmación» solo sobre selección en http(s); `sidePanel.open` antes de cualquier
  `await`; la selección (texto, origen+ruta, dominio, título) va a `storage.session` y se borra al enviar, cancelar o
  cerrar la pestaña. Panel disponible en cualquier pestaña.
- Panel: selección → vista prellenada con medio y dirección «no se envían»; envío `{manualClaim, origin, idempotencyKey}`;
  resultado con la afirmación local («Texto seleccionado por ti en <medio>», sin minuto aunque la API la resuelva a un
  vídeo del catálogo); `not_checkable` sin reintento; evento `selection_investigated`; guía US4 en pestañas sin vídeo.
- E2E existentes: 16/17 en verde. Falla, como estaba previsto, «panel lateral: … solo está habilitado en YouTube»
  (`other.enabled` es ahora `true` por diseño, R2); se reescribe en S3 (T023).

## Definition of Done (PRD §14)

| # | Criterio | Estado | Evidencia / pendiente |
|---|---|---|---|
| 1 | Instalar y ejecutar en Chrome sin errores críticos | ⚠️ parcial | E2E en Chromium con la extensión cargada; falta prueba manual en Chrome estable sobre youtube.com real |
| 2 | Conjunto útil de vídeos autorizados; no compatibles gestionados | ❌ humano (G0) | No compatibles ✅ (E2E). Catálogo real: 0 vídeos; solo 2 DEMO |
| 3 | Del minuto a la evidencia sin salir de YouTube | ✅ (DEMO) | E2E lista → seek → investigar → fuentes |
| 4 | Fuentes abren documentos reales; citas localizables | ⚠️ parcial | INE y BOE reales grabados con URL exacta y localizador; Fact Check sintético hasta tener clave; auditoría humana pendiente (G3) |
| 5 | Ninguna conclusión categórica sin evidencia pertinente | ⚠️ diseño ✅, medición pendiente | Política determinista + tests; eval offline 0 violaciones; falta eval real con clave y auditoría humana |
| 6 | Fallos de red/permisos/proveedores/sin evidencia no inventan | ✅ | Tests API + E2E de cada `failureReason`, API caída, presupuesto |
| 7 | No obstaculiza reproducción; SPA | ✅ | E2E: seek sin cambiar pausa, sin overlays, navegación SPA, resultado tardío descartado |
| 8 | Tests automatizados y regresión con distintos oradores | ✅ técnico / ❌ humano | 142 tests + 17 E2E + invariancia de orador; dataset ≥100 revisado por 2 personas pendiente (G2) |
| 9 | Condiciones de acceso al contenido, privacidad y seguridad | ⚠️ técnico ✅, legal pendiente | Permisos mínimos, bundle check, SSRF, rate limit; revisión jurídica YouTube/CWS/RGPD pendiente (`docs/privacy.md`) |
| 10 | Instrumentados utilidad, repetición, latencia, coste y errores | ✅ | Eventos FR-017, `latency_ms`/`cost_eur`/`failure_reason` por investigación, trazas por etapa |

**Decisión G4**: el sistema es desplegable y el control de costes funciona en local. **No distribuir** a
usuarios hasta cerrar:

- [ ] **G0 legal** — 12–20 vídeos con permiso documentado y revisión jurídica (`docs/d0-viability.md` §4).
- [ ] **Clave LLM** — `pnpm eval:extraction -- --real` y `pnpm eval:investigation -- --real`; comparar modelo
      económico vs. capaz.
- [ ] **Clave Fact Check** — grabar respuesta real y sustituir el fixture sintético.
- [ ] **G2 humano** — dataset ≥100 ejemplos revisados por dos personas.
- [ ] **G3 humano** — auditoría de cada referencia en la muestra de aceptación (≥95 %, 0 citas fabricadas).
- [ ] **Privacidad/CWS** — responsable, contacto, DPA con proveedores, retención de texto manual.
- [ ] **Prueba manual** en Chrome estable sobre youtube.com real.
- [ ] **Despliegue** — aprobar coste y crear la app en DigitalOcean (`infra/digitalocean-app.yaml`).
- [ ] **V1–V3** — usabilidad moderada, beta cerrada instrumentada, validación comercial (PRD §13).
