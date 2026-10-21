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

## G2 — Motor de afirmaciones (D2) · pendiente
## G3 — Motor de evidencias (D3) · pendiente
## G4 — Beta técnica (D4) · pendiente
