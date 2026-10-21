---
description: "Task list — 002 investigar afirmaciones seleccionadas en artículos"
---

# Tasks: Investigar afirmaciones mientras navegas (artículos y vídeos)

**Input**: `/specs/002-web-claim-investigation/` (spec, plan, research, data-model, contracts, quickstart)

**Tests**: requeridos por la constitución (V) y por SC-002…SC-006.

Formato: `[ID] [P?] [Story] Descripción`. Stories: US1 investigar selección, US2 mismo motor, US3 revisar selección,
US4 panel en cualquier página. Cada fase = un slice (S1–S3) ejecutado en contexto nuevo.

**Regla para cada slice**: al terminar, `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm format:check`
en verde (S3: también `pnpm e2e`), tareas marcadas `[x]`, notas en `docs/gates.md`, commit en
`002-web-claim-investigation`.

---

## Phase 1 — S1: Contratos + backend

### Foundational

- [x] T001 [P] `packages/contracts/src/enums.ts`: `EventName` += `selection_investigated`; `FailureReason` += `not_checkable`; `ErrorCode` += `not_checkable`
- [x] T002 `packages/contracts/src/api.ts`: `origin: z.literal('web_selection').optional()` en el miembro `manualClaim` de `CreateInvestigation`; tests en `packages/contracts/src/api.test.ts` (acepta `origin`, rechaza `url`/`title`/otro `origin`, acepta el evento nuevo)
- [x] T003 `apps/api/src/db/schema.ts`: columna nullable `manualOrigin` (`manual_origin`, enum `['web_selection']`); `pnpm --filter @polifamia/api db:generate` → `apps/api/drizzle/0001_*.sql` (enums + columna), sin drift

### US2 — Mismo motor y caché compartida (P1)

- [x] T004 [US2] `apps/api/src/modules/investigations/investigations.service.ts`: en la rama de texto libre, buscar afirmación del catálogo con `normalizeText` igual (import de `@polifamia/investigation`) y, si existe, seguir la ruta `claimId`; recorrido lineal con comentario `ponytail:`; guardar `manualOrigin` cuando no hay coincidencia
- [x] T005 [US2] Tests de integración en `apps/api/test/api.test.ts`: texto = literal DEMO con mayúsculas/puntuación distintas → misma investigación que `{claimId}` (SC-004); mismo texto pegado y con `origin` → mismo id (SC-005; el medio nunca llega al servicio, así que la invariancia por medio es por construcción); `origin` persistido en `manual_origin`; body con `url` → 400

### US3 — No verificable (P2)

- [x] T006 [US3] `investigations.service.ts`: `checkability ≠ CHECKABLE` (directa o resuelta) → `400 not_checkable` en vez de `validation`; ajustar el test existente de opiniones en `apps/api/test/api.test.ts` y añadir texto libre = opinión DEMO de `corpus/videos/demo-02.claims.json` → 400 `not_checkable`
- [x] T007 [P] [US3] `packages/investigation/src/real.ts`: si el extractor clasifica el texto libre como no verificable → `InvestigationFailure('not_checkable')`; test en `packages/investigation/src/evidence.test.ts` con extractor falso que devuelve `opinion`; comprobar que el worker lo persiste como `FAILED/not_checkable` sin caché
- [x] T008 [US1] Evento `selection_investigated` aceptado por `POST /v1/events` (test en `apps/api/test/api.test.ts`)

### Validación S1

- [x] T009 `docs/gates.md`: sección «G5 — Selección web (002)» con evidencia S1; revisar que `GET /openapi.json` refleja `origin`

**Checkpoint**: el backend acepta selecciones, comparte caché con vídeo y rechaza opiniones conocidas.

---

## Phase 2 — S2: Extensión

### Foundational

- [ ] T010 `apps/extension/wxt.config.ts`: `permissions` = `activeTab, contextMenus, sidePanel, storage`; descripción del manifiesto ampliada a artículos; `apps/extension/scripts/check-bundle.mjs` y `check-bundle.test.ts` exigen esa lista (siguen rechazando `tabs` y hosts nuevos) (SC-003)
- [ ] T011 [P] `apps/extension/src/lib/selection.ts` (sin `#imports`): `selectionFromClick(info, tab)` → `{text, url: origin+pathname, domain sin www, title, at}` o `{unsupported: true}` para no http(s) o rutas `.pdf`; `selectionKey(tabId)`; tests `selection.test.ts` (query y fragmento eliminados, SC-006; `chrome://`, `file://`, PDF; recorte de texto)

### US1 — Investigar una frase seleccionada (P1)

- [ ] T012 [US1] `apps/extension/entrypoints/background.ts`: quitar `syncPanel` y sus listeners; `contextMenus.create` («Investigar esta afirmación», `contexts: ['selection']`, `documentUrlPatterns` http/https) en `onInstalled`; `onClicked`: `sidePanel.open({tabId})` antes de cualquier `await`, luego `storage.session.set(selectionKey, selectionFromClick(...))`
- [ ] T013 [US1] `apps/extension/src/lib/chrome-bridge.ts`: `usePageSelection(tabId)` (lee la clave, escucha `storage.session.onChanged`, `clear()`)
- [ ] T014 [US1] `apps/extension/entrypoints/sidepanel/App.tsx`: una selección abre la vista manual prellenada (con `key` por `at` para no mezclar resultados tardíos); `start()` envía `origin: 'web_selection'`; la vista de resultado recibe la procedencia local; `selection_investigated` tras crear; borra la selección al enviar/cancelar; selección `unsupported` → aviso «Esta página no es compatible»
- [ ] T015 [P] [US1] `apps/extension/src/components/InvestigationView.tsx`: prop opcional de procedencia local («texto seleccionado por ti en <medio>» / «Texto aportado por ti»), usada siempre que la vista viene de texto libre, sin «Volver al minuto»; `FAILURE_COPY.not_checkable` sin reintento

### US3 — Revisar la selección (P2)

- [ ] T016 [P] [US3] `apps/extension/src/components/ManualClaim.tsx`: `initialText`; línea de origen (medio + dirección sin parámetros, «no se envía»); aviso «solo se envía el texto»; sugerencia de recortar a una sola afirmación; límites 10..500 como en 001; error `not_checkable` mostrado como no verificable

### US4 — Panel en cualquier página (P2)

- [ ] T017 [US4] `App.tsx`: estado `idle` (pestaña sin vídeo) con «Selecciona una frase y elige Investigar esta afirmación» + «Pegar una afirmación»; cabecera del panel sin referencia exclusiva a vídeo; flujo de vídeo sin cambios (FR-015)
- [ ] T018 Tests unit de la extensión en verde (`usePanelState.test.ts` intacto) y `docs/gates.md` G5 con evidencia S2

**Checkpoint**: la extensión compila con los permisos nuevos y el flujo de selección funciona en desarrollo.

---

## Phase 3 — S3: E2E + documentación

- [ ] T019 [P] `apps/extension/e2e/fixtures/article.html`: artículo marcado DEMO con «La inflación interanual cerró 2023 en el 3,1 %.» (demo-01) y la opinión de demo-02; ruta `https://diario.example/**` en el fixture `context` de `apps/extension/e2e/extension.spec.ts`
- [ ] T020 [US1] E2E: selección escrita vía `sw.evaluate` con `selectionFromClick` sobre `https://diario.example/2026/10/articulo-demo?utm_source=x#p3` → el panel muestra texto, `diario.example` y la ruta sin `?`/`#`; 0 POST antes de confirmar; body = `manualClaim`, `origin`, `idempotencyKey` sin dominio/URL/título (SC-006); resultado DEMO con «texto seleccionado por ti en diario.example» y sin minuto; el formulario «Hay un problema con esta investigación» está disponible (FR-017)
- [ ] T021 [US2] E2E: investigar la afirmación en el vídeo DEMO y después la misma frase seleccionada → mismo id, respuesta 200 (SC-004)
- [ ] T022 [US3] E2E: editar/recortar la selección; texto demasiado corto deshabilita el envío; la opinión DEMO → aviso no verificable
- [ ] T023 [US4] E2E: pestaña de artículo sin selección → guía + pegar; reescribir el test «panel solo habilitado en YouTube» (panel habilitado en todas, URL de la otra pestaña sigue invisible); SC-002: navegar sin invocar → `storage.session` vacío y 0 peticiones al servicio
- [ ] T024 [P] `docs/privacy.md`: permisos nuevos, qué se envía (solo texto), qué queda local, evento nuevo
- [ ] T025 `docs/gates.md` G5: evidencia S3 (E2E), pendientes humanos (revisión legal de la ampliación, SC-008 validación con usuarios, justificación de `contextMenus`/`activeTab` para Chrome Web Store, prueba manual del quickstart; umbrales de calidad de 001 para afirmaciones de artículos (SC-007) cubiertos por el mismo motor, auditoría G2/G3 pendiente)

**Checkpoint**: Gate G5 técnico — selección web completa en DEMO; gates humanos pendientes.

---

## Dependencies & Execution Order

- S1 → S2 → S3 (S2 usa los contratos de S1; S3 prueba S1+S2).
- Dentro de S1: T001–T003 antes de T004–T008. T007 es independiente del API.
- Dentro de S2: T010–T011 antes de T012–T017; T015 y T016 en paralelo.
- US2 (backend) habilita US1 extremo a extremo; US3 y US4 dependen de los componentes de US1.

## Parallel Examples

- S1: T001 ‖ T007
- S2: T011 ‖ T015 ‖ T016 (tras T010)
- S3: T019 ‖ T024

## Implementation Strategy

MVP = S1 + S2 (US1 + US2 utilizables en desarrollo). S3 cierra la prueba automática y la documentación. Cada slice
entrega en verde y deja el estado en este fichero.
