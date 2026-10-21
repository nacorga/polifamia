# D0 — Viabilidad técnica y de contenido

Estado: **técnica verificada · legal PENDIENTE (humano)**. Este documento no constituye aprobación
jurídica; registra qué se ha comprobado en código y qué debe revisar una persona antes del gate G0.

## 1. Verificado técnicamente (2026-10-21)

Evidencia: `pnpm e2e` (Playwright, Chromium con la extensión MV3 cargada; 7 tests en verde).

| Capacidad | Cómo | Evidencia |
|---|---|---|
| Panel lateral con `chrome.sidePanel` que se abre desde el icono | `setPanelBehavior({ openPanelOnActionClick: true })` | test «panel lateral…» |
| Panel habilitado solo en pestañas de YouTube | `sidePanel.setOptions({ tabId, enabled })` en `tabs.onUpdated` | mismo test (example.org → deshabilitado) |
| Detección de `videoId` en `youtube.com/watch` | content script: solo `location` | test «vídeo del catálogo…» |
| `currentTime`, play/pause/seek | eventos `play/pause/seeked/timeupdate` del `<video>` capturados en `document` | ídem |
| Salto al minuto ≤2 s sin pausar | mensaje `video:seek` → `video.currentTime = s` | ídem (desfase y `paused` sin cambios) |
| Navegación SPA sin recarga | `wxt:locationchange` + `yt-navigate-finish` + `tabs.onUpdated` | test «navegación SPA…» y «resultado tardío…» |
| Sin mezclar datos entre vídeos | panel reinicia el estado por `tabId:videoId`; respuestas con `requestId` | test «resultado tardío…» (falla si se quita el reinicio) |

Limitación de las pruebas: YouTube se sustituye por una página fixture servida en `https://www.youtube.com/watch`
(misma URL, `#movie_player video`). Funciona porque el content script no depende de nada más del DOM de YouTube,
pero hace falta una **prueba manual en youtube.com real** antes de G1 definitivo (ver §4).

## 2. Lo que la extensión NO hace (por diseño)

- No lee subtítulos, `timedtext`, endpoints internos ni el DOM de YouTube más allá del `<video>`.
- No captura audio (`tabCapture`) ni descarga vídeos.
- No pausa el vídeo, no dibuja overlays, no lee otras pestañas ni el historial.
- Sin panel abierto, los mensajes del content script no tienen receptor y no salen del navegador.
- Las transcripciones provienen solo del catálogo importado por el operador con `rights.json`.

## 3. Restricciones externas identificadas

- **YouTube Data API — `captions.download`**: requiere que el usuario autenticado tenga permiso para editar el
  vídeo. No sirve para vídeos de terceros.
  <https://developers.google.com/youtube/data/reference/rest/v3/captions/download>
- **Políticas de desarrolladores de YouTube**: limitan extraer, almacenar y redistribuir contenido y datos de
  la plataforma. <https://developers.google.com/youtube/terms/developer-policies>
- **Chrome Web Store — Limited Use**: los datos de usuario solo pueden usarse para la función visible de la
  extensión; nada de publicidad ni perfiles. <https://developer.chrome.com/docs/webstore/program-policies/limited-use>
- **Tab Capture**: exige que el usuario lo invoque. Además, poder capturar el audio no da permiso para procesar
  el contenido; solo sirve como investigación futura.
  <https://developer.chrome.com/docs/extensions/reference/api/tabCapture>
- **Permisos del manifest**: `sidePanel`, `storage`, `tabs`; hosts `*://*.youtube.com/*` y el origen de la API.
  `tabs` permite leer la URL de la pestaña para habilitar el panel y obtener el `videoId`, y habrá que
  justificarlo en la ficha de la Store.

## 4. Pendiente de revisión humana (bloquea G0)

- [ ] Seleccionar 12–20 vídeos y registrar para cada uno: titular, URL, idioma, base legal (`own-content`,
      `explicit-permission`, `open-license`), alcance de uso/almacenamiento y evidencia del permiso.
- [ ] Revisión jurídica de la ruta de contenido (almacenar transcripciones y fragmentos, mostrarlos en el panel).
- [ ] Consultar manualmente Google Fact Check Tools e INE con 10 afirmaciones representativas y documentar
      cobertura (requiere `FACTCHECK_API_KEY`; se automatiza en S4).
- [ ] Prueba manual en youtube.com real: cargar la extensión, abrir un vídeo cualquiera y comprobar
      «Vídeo todavía no compatible», navegación SPA entre vídeos y que el panel no aparece fuera de YouTube.
- [ ] Revisar tratamiento de datos (RGPD), política de privacidad y requisitos de la Chrome Web Store para la
      modalidad de beta cerrada.

Si no existe una ruta lícita y repetible para el catálogo: `NO-GO` a análisis automático sobre vídeos y se
mantiene el modo «Pegar una afirmación», que ya funciona sin transcripción.
