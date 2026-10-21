# Research — 002 selección en artículos

Decisiones de Phase 0. Formato: Decisión / Razón / Alternativas descartadas.

## R1. Permisos

- **Decisión**: `permissions: ['activeTab', 'contextMenus', 'sidePanel', 'storage']`; `host_permissions` sin cambios
  (YouTube + API). `scripts/check-bundle.mjs` exige exactamente esa lista y sigue rechazando `tabs`.
- **Razón**: `contextMenus` entrega `info.selectionText` y `info.pageUrl` con el propio clic; `activeTab` da acceso
  temporal a `tab.title` de la pestaña invocada. Constitución IV.
- **Descartado**: `tabs`, `<all_urls>`, `scripting` + content script para leer la selección.

## R2. Panel en cualquier pestaña

- **Decisión**: eliminar `syncPanel` (deshabilitaba el panel fuera de YouTube); el manifiesto ya declara
  `side_panel.default_path`. Se mantiene `openPanelOnActionClick`. Sin `tabs`, `useActiveVideo` obtiene `tabId` pero no
  la URL → `videoId: null` → estado `idle`, que pasa a mostrar la guía de US4 + «Pegar una afirmación».
- **Razón**: FR-013 con el mínimo cambio; el panel sigue sin ver la URL de pestañas no invocadas.
- **Descartado**: `setOptions` por pestaña (necesita la URL, es decir `tabs`).

## R3. Menú contextual y entrega al panel

- **Decisión**: item «Investigar esta afirmación» (`contexts: ['selection']`,
  `documentUrlPatterns: ['http://*/*', 'https://*/*']`) creado en `runtime.onInstalled`. En `contextMenus.onClicked`:
  primero `sidePanel.open({ tabId })` sin `await` previo (el gesto se pierde tras el primer `await`), después
  `storage.session.set({ ['selection:' + tabId]: { text, url, domain, title, at } })`. La URL se canoniza a
  `origin + pathname` en un módulo puro `src/lib/selection.ts`. El panel lee la clave de su pestaña y escucha
  `storage.session.onChanged`; la borra al enviar o cancelar.
- **Razón**: el panel puede no estar cargado aún; `storage.session` es accesible desde páginas de la extensión, se borra
  al cerrar el navegador y no persiste en disco.
- **Prueba**: Playwright no puede pulsar menús nativos. El E2E construye la carga con `selectionFromClick` y la escribe
  vía `sw.evaluate`; el cableado `onClicked` + `sidePanel.open` se verifica a mano (quickstart).
- **Descartado**: mensajería `runtime.sendMessage` (se pierde si el panel no está abierto); exponer el handler en
  `globalThis` en modo e2e (código de prueba en el bundle).

## R4. Mismo motor y caché compartida

- **Decisión**: en `POST /v1/investigations`, el texto libre (pegado o seleccionado) cuya `normalizeText` coincide con
  la de un literal del catálogo se resuelve a ese `claimId` y sigue la ruta de 001 para afirmaciones de vídeo
  (verificabilidad, normalización, caché). Sin coincidencia: ruta manual de 001.
- **Razón**: hoy el texto libre usa `normalized = {}`, así que su `cacheKey` nunca coincide con el de vídeo (SC-004).
  Resolver al `claimId` (en vez de copiar `normalized`) mantiene como «vídeo» las filas reutilizadas por el flujo de
  YouTube (FR-015). El panel pinta la procedencia con su copia local, así una respuesta de tipo vídeo nunca muestra
  minuto en un artículo.
- **Límite**: coincidencia exacta tras normalizar; recorrido lineal del catálogo (comentario `ponytail:`; índice sobre
  texto normalizado si el catálogo crece).
- **Descartado**: similitud semántica/embeddings (alcance), copiar solo `normalized`.

## R5. No verificable

- **Decisión**: nuevo valor `not_checkable` en `ErrorCode` y `FailureReason`. (a) Coincidencia con afirmación
  `NOT_CHECKABLE` → `400 not_checkable` (reemplaza el `validation` actual del `claimId`). (b) Modo real: si el
  extractor clasifica el texto como opinión o predicción, `InvestigationFailure('not_checkable')` → `FAILED`, no
  cacheado. (c) Panel: copy propio en `FAILURE_COPY`, sin reintento.
- **Razón**: constitución II; hoy el texto pegado se investiga como hecho. Aprovecha la clasificación que el extractor
  ya calcula y descarta.
- **Límite**: en DEMO, una opinión sin coincidencia en el catálogo no se detecta (documentado en spec FR-012).

## R6. Contratos y datos

- **Decisión**: `{ manualClaim, origin?: 'web_selection', idempotencyKey }` (objeto estricto: `url`, `title` → 400).
  Respuesta sin cambios (`claim.kind` sigue siendo `video | manual`). Columna `investigations.manual_origin` nullable,
  solo auditoría, no se serializa. Evento `selection_investigated` con `investigationId`. Migración `0001` generada con
  `pnpm db:generate`.
- **Razón**: medio, dirección y título nunca llegan al servicio (clarificación 2026-10-21); una investigación reutilizada
  la lee cualquiera con su id, por lo que no puede llevar datos de navegación.
- **Descartado**: guardar dirección/título ocultos en lecturas compartidas (más código, más datos personales).
