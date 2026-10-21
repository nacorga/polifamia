# PRD — MVP de investigación de afirmaciones en vídeos de YouTube

**Estado:** Propuesta para implementación · **Versión:** 1.1 · **Fecha:** 21/10/2026  
**Nombre de trabajo:** Por definir  
**Producto:** Extensión de Chrome que permite investigar afirmaciones de discursos políticos con evidencia verificable, sin abandonar YouTube.

> **Evolución de producto (v1.2, 21/10/2026):** el producto pasa a ser una extensión para investigar las afirmaciones
> que encuentras mientras navegas (artículos, noticias y vídeos), con la política como primer ámbito. YouTube pasa a ser
> uno de los canales de entrada; la entrada principal es seleccionar una frase y elegir «Investigar esta afirmación».
> Ver `specs/002-web-claim-investigation/spec.md` y la constitución v1.1.0. Este PRD sigue siendo la fuente del MVP 001.

> **Principio de producto:** No le decimos al usuario qué pensar sobre un político. Le mostramos qué se ha afirmado, qué fuentes encontramos, qué prueban realmente y qué incertidumbres permanecen.

## 1. Resumen ejecutivo

Construir una extensión de Chrome (Manifest V3) con un panel lateral en YouTube. Durante la reproducción de vídeos compatibles, el usuario podrá identificar afirmaciones verificables, investigar una de ellas bajo demanda y consultar una explicación breve respaldada por fuentes originales, fragmentos localizables, contexto estadístico y límites explícitos de la evidencia.

**Wedge inicial:** discursos, entrevistas y debates políticos en español sobre economía, empleo y presupuestos de España. **Usuario beta:** personas interesadas en comprender información pública y profesionales que contrastan declaraciones.

El MVP **no** promete verificación instantánea de cualquier vídeo ni de todas sus frases. Se lanzará primero sobre un catálogo limitado de vídeos con transcripciones obtenidas con autorización o de fuentes permitidas. Se contempla un modo de entrada manual para analizar una afirmación cuando un vídeo no esté soportado. La cobertura generalizada y los directos quedan fuera hasta resolver viabilidad técnica, jurídica y calidad.

## 2. Problema, propuesta de valor e hipótesis

**Problema:** quien escucha una afirmación política debe parar el vídeo, recordar o transcribir la frase, buscar fuentes, comprobar fechas y definiciones y decidir si las fuentes realmente prueban lo que se ha dicho. Es un flujo lento y propenso a errores.

**Propuesta de valor:** «Investiga lo que acaban de decir, consulta las fuentes originales y entiende el contexto sin salir de YouTube».

**Hipótesis que validar:**

- H1 — Las personas usan voluntariamente «Investigar esta afirmación» mientras ven un vídeo.
- H2 — Las investigaciones permiten localizar evidencia relevante más deprisa que una búsqueda manual sin reducir precisión.
- H3 — Una explicación verificable con incertidumbre explícita genera más confianza que un veredicto genérico de IA.
- H4 — Hay un segmento que repite el uso y expresa una necesidad profesional o disposición de pago; no se presupone monetización en el MVP.

**Principios:** evidencia antes que veredicto; abstención antes que invención; fuentes primarias antes que resúmenes de medios; política neutral; lectura rápida y profundización opcional; transparencia de cuándo y cómo se verificó.

## 3. Usuarios y trabajos por realizar

| Usuario | Trabajo por realizar | Necesidad principal |
|---|---|---|
| Espectador curioso | Investigar una cifra o afirmación que acaba de escuchar | Rapidez, claridad y fuentes abiertas |
| Periodista / investigador | Contrastar declaraciones y reutilizar referencias | Trazabilidad, tiempos y fragmentos exactos |
| Divulgador / creador | Comprender un dato citado en un vídeo | Contexto, método y enlaces compartibles |

**No construir perfiles de afinidad política ni inferir preferencias electorales a partir de la actividad.**

## 4. Alcance

### P0 — Incluido en el MVP

1. Extensión Chrome MV3 con panel lateral, activado explícitamente en páginas `youtube.com/watch`.
2. Identificación del vídeo por ID y sincronización lectura/pause/seek con marcas temporales, sin modificar el reproductor.
3. Catálogo beta de vídeos compatibles, con **transcripciones y permisos de uso documentados**; soporte de `.srt`/`.vtt` importados por el operador del sistema.
4. Detección de afirmaciones factuales y estadísticas en español, con fragmento literal, timestamp y contexto circundante.
5. Lista discreta de afirmaciones relevantes (priorizar 3–10 por vídeo, configurable), no notificaciones constantes.
6. Acción principal **«Investigar esta afirmación»**, con investigación bajo demanda, estado de carga y respuesta reutilizable en caché.
7. Consulta de verificaciones existentes (Google Fact Check Tools API) y fuentes primarias seleccionadas (ej. INE, BOE, AIReF cuando proceda); búsqueda adicional restringida y auditable.
8. Respuesta breve con evidencia, fragmentos de fuente, URL, fecha, contexto y límites; diferenciación entre fuente declarada por el orador y fuente encontrada por el sistema.
9. Estados explícitos: `SUPPORTED`, `CONTRADICTED`, `NEEDS_CONTEXT`, `INSUFFICIENT_EVIDENCE`; `NOT_CHECKABLE` en la etapa de selección, sin veredicto público.
10. Guardado de resultados versionados, marca «comprobado el…», indicador de actualización/caducidad y feedback «Hay un problema con esta investigación».
11. Modo alternativo de **«Pegar una afirmación»** cuando el vídeo no está soportado, indicando que el texto ha sido aportado por el usuario; no inventar timestamp.
12. Instrumentación de uso, rendimiento, calidad y coste sin seguimiento general de navegación ni perfiles políticos.

### P1 — Solo tras validar P0

- Aumento gradual de catálogo y fuentes conectadas.
- Reconocimiento de afirmaciones equivalentes con control estricto de entidad, territorio, indicador y periodo.
- Comparaciones estadísticas calculadas y pequeñas gráficas cuando exista una serie fiable.
- Exportación de una investigación con sus fuentes y timestamp.
- Revisión humana de investigaciones sensibles en un flujo editorial ligero.

### Fuera de alcance

- Directos, streaming y transcripción continua de vídeos arbitrarios.
- Scraping de subtítulos, uso de endpoints internos no autorizados o descarga masiva de vídeos.
- Rankings, notas globales o perfiles de «credibilidad» de políticos y partidos.
- Inferencia de mentiras, intenciones, manipulación o estados mentales.
- Chat general con todo el vídeo, generación de contenido persuasivo electoral o recomendaciones de voto.
- Otros navegadores, plataformas, móvil, cuentas, pagos, red social o dashboard analítico completo.

## 5. Experiencia de usuario

### Flujo A — Vídeo compatible

1. El usuario abre un vídeo de YouTube y pulsa la extensión.
2. El panel identifica el vídeo e indica «Análisis disponible», «Preparando afirmaciones» o «Vídeo todavía no compatible».
3. Se muestran afirmaciones seleccionadas con minuto y texto fiel. El usuario puede saltar al minuto.
4. Al elegir una afirmación, pulsa **Investigar**. Si existe resultado válido, se muestra inmediatamente; si no, se inicia una investigación.
5. La vista de resultado presenta, en este orden: **Afirmación literal → Qué muestran las evidencias → Contexto / limitaciones → Fuentes**.
6. El usuario puede abrir documentos originales, consultar cuándo se verificó, volver al minuto del vídeo y reportar errores.
7. Al navegar a otro vídeo, el estado se reinicia correctamente; no se mezclan afirmaciones de vídeos diferentes.

### Flujo B — Vídeo no compatible

El panel explica de forma corta por qué no hay análisis automático. Ofrece **Pegar una afirmación** para investigarla manualmente, sin asegurar que se extrajo del vídeo ni asignar marcas temporales inexistentes.

### Estados UX obligatorios

`idle`, `unsupported_video`, `transcript_unavailable`, `preparing_claims`, `claims_ready`, `investigation_pending`, `investigation_ready`, `insufficient_evidence`, `rate_limited`, `source_unavailable`, `error`.

**Reglas UX:** el vídeo nunca se pausa automáticamente; no cubrir controles, anuncios ni fotogramas con overlays; una tarjeta principal visible sin desplazamiento excesivo; cero lenguaje sensacionalista; diseño accesible por teclado y lector de pantalla; no convertir opiniones o predicciones en hechos verificables.

## 6. Requisitos funcionales y aceptación

| ID | Requisito P0 | Criterio de aceptación |
|---|---|---|
| FR-01 | Detectar vídeo y tiempo actual | Identifica `videoId`; escucha play/pause/seek; cambio de vídeo en navegación SPA sin recarga completa |
| FR-02 | Sincronización | Clic en una afirmación desplaza al instante correspondiente; desfase objetivo ≤2 s en vídeos de prueba |
| FR-03 | Selección de afirmaciones | Conserva frase literal y contexto; excluye opiniones y predicciones no verificables; puede devolver lista vacía |
| FR-04 | Investigación bajo demanda | Una petición por acción del usuario; indicador de progreso, cancelación visual y reintentos limitados |
| FR-05 | Evidencia trazable | Cada afirmación factual del resultado incluye referencia a un pasaje/serie/tabla concreta; si falta, se expresa incertidumbre |
| FR-06 | Fuentes y procedencia | URL, título, publicador, fecha disponible, fecha de consulta y fragmento justificativo; distingue original/secundaria |
| FR-07 | Contexto estadístico | Cuando sea aplicable, identifica indicador, unidad, ámbito geográfico, periodo y base de comparación; no inventa campos |
| FR-08 | Conclusiones limitadas | Nunca etiqueta opiniones; la conclusión no supera el alcance de la evidencia; puede abstenerse |
| FR-09 | Errores y cobertura | Video no soportado, falta de permiso, API caída y sin fuentes tienen tratamiento comprensible y recuperable |
| FR-10 | Caché seguro | Reutiliza investigación solo si significado, periodo, entidad, territorio y revisión de fuentes son compatibles |
| FR-11 | Feedback | Reporte con motivo y referencia de investigación; no altera automáticamente la conclusión publicada |
| FR-12 | Privacidad | Extensión actúa solo al invocarse; comunica qué se envía al backend; no captura historial de otras páginas |

## 7. Política de evidencia y neutralidad

1. **Distinguir hechos de opiniones.** Solo investigar afirmaciones con contenido empírico contrastable; el resto se puede mostrar como «No verificable como hecho» sin evaluación política.
2. **No confundir fuente coincidente con fuente utilizada.** Mostrar `declared_source` solo cuando hay una referencia explícita en el discurso; cualquier documento encontrado se marca `retrieved_evidence`.
3. **Fuente primaria preferente.** Guardar cadena de procedencia: organismo/dataset/documento → pasaje/tabla → cifra → afirmación. Si tres medios replican un estudio, agruparlos alrededor de ese estudio.
4. **Comparaciones homogéneas.** Comprobar año, ámbito, población, unidad, nominal/real, acumulado/anual y cambios metodológicos antes de derivar conclusiones estadísticas.
5. **Fechas.** Diferenciar fecha de afirmación, fecha del dato, fecha de publicación de fuente y fecha de investigación. Marcar claramente las conclusiones condicionadas por fecha.
6. **Sin falsas certezas.** No inferir «falso» simplemente por no encontrar fuentes. No presentar análisis del LLM como evidencia original.
7. **Sin falsa equivalencia.** Mostrar desacuerdos documentados sin sugerir que todas las fuentes tienen el mismo peso probatorio.
8. **Mismo estándar para cualquier orador.** Tests de consistencia con afirmaciones idénticas atribuidas a oradores distintos; ninguna clasificación, alerta o prioridad depende de partido o identidad política.
9. **Rectificaciones.** Resultados versionados e identificables, opción de corrección y registro de cambios significativo.
10. **Defensa de inyección de instrucciones.** Todo texto procedente de vídeos, webs y documentos se trata como datos no confiables; no ejecuta órdenes contenidas en las fuentes.

**Condición para etiquetas:** `SUPPORTED` y `CONTRADICTED` solo cuando un conjunto de evidencias pertinentes ha sido comprobado frente al significado exacto y contexto de la afirmación; de otro modo `NEEDS_CONTEXT` o `INSUFFICIENT_EVIDENCE`. Mostrar explicaciones, no insignias de «verdadero/falso» aisladas.

## 8. Obtención de contenido y condición de viabilidad

**Bloqueo P0 — No iniciar un desarrollo dependiente de subtítulos arbitrarios.** La documentación oficial de YouTube restringe `captions.download` a usuarios con permisos de edición, y sus políticas imponen condiciones sobre extracción, descargas y almacenamiento. La captura de audio de una pestaña mediante Chrome requiere interacción del usuario; **viabilidad técnica no equivale a autorización contractual o jurídica para procesar todo el contenido**.

**Ruta aprobada para la beta:** seleccionar entre 12 y 20 vídeos de fuentes cuya transcripción se pueda usar y almacenar legítimamente (contenido propio, permisos explícitos u otra base autorizada revisada), importando SRT/VTT con derechos y procedencia documentados. Vincular transcripción, URL/ID de YouTube, fecha, idioma y alcance de licencia. La extensión reproduce el vídeo en el sitio original y consulta únicamente los artefactos autorizados.

**Investigación manual:** permitir pegar una frase; el sistema la estudia como entrada del usuario sin afirmar que dispone de una transcripción del vídeo.

**Puerta de salida (`GO/NO-GO`) antes de ampliar cobertura:** documentar de forma verificable qué métodos de acceso, procesamiento, almacenamiento y redistribución están permitidos por YouTube y titulares, con revisión jurídica cuando sea necesario. Si no hay método lícito y estable, no prometer verificación universal de YouTube: mantener catálogo autorizado y entrada manual o cambiar el canal inicial de distribución.

## 9. Motor de análisis

### 9.1 Pipeline

1. **Ingesta:** transcripción autorizada con intervalos temporales, `videoId`, idioma, permisos y huella de versión.
2. **Segmentación:** tramos con contexto cercano; deduplicación conservadora.
3. **Extracción:** identificar afirmaciones atómicas contrastables, literal, tipo, entidades, fechas, geografía, unidades y timestamp; detectar ambigüedades.
4. **Selección:** priorizar afirmaciones específicas y contrastables de las áreas beta; no usar relevancia partidista ni «impacto electoral».
5. **Normalización:** representación estructurada de la afirmación sin perder las palabras originales ni el contexto.
6. **Recuperación:** buscar coincidencias en caché contextual → verificaciones existentes → fuentes primarias del registro aprobado → búsqueda externa acotada.
7. **Validación:** comprobar la correspondencia entre evidencia y afirmación, fechas, límites y pasaje referido; validar enlaces y registrar fallos de acceso.
8. **Síntesis:** explicación comprensible, conclusión limitada, citas vinculadas a fragmentos e incertidumbre.
9. **Revisión:** persistir versión, modelo, prompts/configuración y fuentes usadas; permitir invalidación/corrección.

### 9.2 Estrategia de fuentes

- **Conector de fact-checks:** Google Fact Check Tools `claims.search`; tratarlo como índice de verificaciones, no como certificación automática de verdad.
- **Conector estadístico:** API JSON del INE con parámetros reproducibles para indicadores aprobados.
- **Documentos:** URLs institucionales autorizadas y material del corpus; lectura de documentos con extracción y localización de tabla/página/pasaje cuando sea factible.
- **Búsqueda web opcional:** proveedor externo para descubrimiento, con whitelist/criterios de inclusión y restricciones de coste; no depender de una búsqueda libre no auditable.

**No usar** exclusivamente «el LLM buscó y dijo que es cierto» como algoritmo de verificación. Para cifras sencillas, calcular diferencias mediante código determinista y explicar fórmula, periodo y redondeo. Nunca presentar cálculos realizados sobre series no comparables.

### 9.3 Políticas de ejecución

- Máximo configurable de llamadas, tokens, resultados web y tiempo por investigación.
- Caché de resultados basada en clave semántica + jurisdicción + periodo + versión de fuentes; sin reuso ciego por similitud vectorial.
- Investigación asíncrona con estado y reintentos; deduplicación de peticiones concurrentes.
- Fallos de proveedor o límite de presupuesto → salida honesta, no afirmación inventada.
- Identificación de pasajes y URLs antes de permitir una conclusión respaldada.

## 10. Stack tecnológico y arquitectura de referencia

**Decisión:** monorepo TypeScript, extensión Chrome MV3 en React y API/worker NestJS con PostgreSQL. La selección prioriza velocidad de ejecución para un único desarrollador, trazabilidad y costes operativos bajos. **No hace falta montar microservicios, un vector DB ni un sistema multiagente.**

### 10.1 Stack cerrado para P0

| Capa | Tecnología elegida | Función / criterio de elección |
|---|---|---|
| Monorepo | **pnpm workspaces + TypeScript** | Contratos compartidos entre extensión, backend y evaluador; un solo lockfile. |
| Extensión | **WXT + React + TypeScript** | Construcción MV3, content scripts, background service worker y empaquetado. |
| UI | **Tailwind CSS + componentes accesibles Radix/shadcn adaptados al side panel** | Panel compacto y consistente; evitar instalar una librería masiva. |
| Estado de UI | **React local state + TanStack Query** | Estado efímero del vídeo; consultas y polling de investigaciones. No Redux. |
| Integración Chrome | **`chrome.sidePanel`, content script limitado a YouTube, runtime messaging** | Panel persistente, lectura del reproductor y sincronización segura. |
| Backend | **Node.js 22 LTS + NestJS REST** | Módulos simples para vídeos, claims, investigaciones y fuentes; backend estable. |
| Validación de contratos | **Zod** | Schemas estrictos para salida LLM, importación, API y almacenamiento. |
| Persistencia | **PostgreSQL + Drizzle ORM + Drizzle Kit** | Datos relacionales, migraciones versionadas, trazabilidad de fuentes. |
| Trabajo asíncrono | **pg-boss sobre PostgreSQL** | Investigaciones lentas, reintentos y deduplicación sin Redis. |
| IA | **Proveedor LLM encapsulado con structured outputs y esquema Zod** | Extracción/síntesis configurables, sustitución de modelo sin reescritura. |
| Fuentes | **Google Fact Check Tools API + API del INE + corpus institucional permitido** | Verificaciones existentes y estadísticas originales. |
| Tests | **Vitest + Playwright** | Unitarios/contratos y pruebas E2E del navegador. |
| Observabilidad | **Logs JSON estructurados + métricas de PostgreSQL + Sentry opcional** | Seguir etapas, fallos, duración, uso y coste; sin recopilar actividad ajena. |
| Desarrollo local | **Docker Compose para PostgreSQL** | Arranque reproducible; API y extensión en modo desarrollo. |
| CI/CD | **GitHub Actions** | Lint, typecheck, tests, build y validación de migraciones. |
| Despliegue beta | **DigitalOcean App Platform (API + proceso worker) + PostgreSQL gestionado** | Un entorno pequeño y mantenible. Una alternativa equivalente es válida si conserva worker persistente y base de datos. |

**Versiones:** fijar las versiones exactas compatibles mediante el lockfile al iniciar el proyecto; las anteriores son familias/selecciones de tecnología, no una obligación de usar versiones futuras. No usar servicios de datos ni búsqueda sin definir presupuesto y términos.

**Razones de diseño:** WXT tiene plantilla React y entrypoints para contenido/background; `chrome.sidePanel` es la API oficial para el panel; Drizzle gestiona migraciones PostgreSQL y pg-boss ejecuta trabajos persistentes desde la misma base de datos. Ver referencias en §17.

### 10.2 Arquitectura funcional

```text
YouTube (página / reproductor)
       |
       v
Content script WXT ── chrome.runtime messaging ── Side panel React
  [videoId, tiempo, play/seek]                        |
  [NO captura libre de subtítulos]                    | HTTPS
                                                      v
                                             API NestJS REST
                                               |      |
                           catálogo + claims  |      | crear/consultar job
                                               v      v
                                          PostgreSQL  pg-boss
                                               ^      |
                                               |      v
                                        Evidencias <- Worker de investigación
                                                     |
                           Fact Check Tools / INE / corpus permitido / LLM
```

- **Content script:** lee solo `videoId`, `currentTime`, estado de reproducción y eventos de navegación; no inspecciona otras pestañas. Los datos del vídeo se obtienen del corpus autorizado del servidor, no de interfaces internas de YouTube.
- **Side panel:** identifica el vídeo activo, consulta disponibilidad, muestra claims sincronizadas y resultados; usa mensajes tipados con `videoId`, `tabId` y `requestId` para prevenir cruces cuando cambia el vídeo.
- **API:** consulta catálogo, autoriza operaciones según cuotas y crea investigaciones; devuelve `202 Accepted` para trabajos pendientes.
- **Worker:** investigación por etapas con límite de gasto, validación de evidencia y almacenamiento de estados/versiones. Ejecuta como proceso persistente; no depender de background service workers de Chrome ni de funciones serverless con timeout.
- **Base de datos:** misma instalación PostgreSQL para productos, evidencias, feedback y cola; índices sobre `youtubeId`, `(claimId, revision)`, `status` y claves de caché; **sin embeddings P0**.

### 10.3 Estructura del repositorio

```text
apps/
  extension/
    entrypoints/
      background.ts           # contexto de pestaña, side panel y mensajes
      youtube.content.ts      # videoId, HTMLVideoElement, navegación SPA
      sidepanel/              # React: lista, investigación, fuentes, estados
    src/
      components/
      hooks/
      lib/chrome-bridge.ts
      lib/api-client.ts
  api/
    src/
      modules/videos/
      modules/claims/
      modules/investigations/
      modules/feedback/
      modules/sources/
      worker/                 # consumidor pg-boss: ejecución persistente
      db/                     # esquema Drizzle + repositorios
    drizzle/                  # migraciones SQL versionadas
packages/
  contracts/                  # schemas Zod / tipos / errores / mensajes
  investigation/              # interfaz LLM, pipeline y políticas de evidencia
  connectors/                 # Fact Check Tools, INE, corpus autorizado
  evaluation/                 # fixtures, etiquetas, script de métricas
scripts/
  import-transcripts/         # CLI SRT/VTT + declaración de derechos
infra/
  docker-compose.yml
  github-actions-notes.md
```

No añadir una web de marketing, dashboard de operadores, app móvil, login ni estructura multitenant a este monorepo durante P0. El CLI de ingesta basta para gestionar el catálogo beta.

### 10.4 Servicios, modelos y estrategia LLM

Implementar interfaces tipadas `ClaimExtractor`, `EvidenceRetriever`, `EvidenceVerifier` y `ExplanationGenerator`; pueden compartir proveedor/modelo, pero deben evaluarse por separado.

1. **Extracción/normalización:** salida JSON validada con Zod: literal, contexto, timestamps, entidades, lugar, periodo, métrica, checkability. Se rechazan claims que no estén respaldadas por un tramo de transcripción.
2. **Recuperación determinista primero:** coincidencias de fact-check ya existente, consultas INE con parámetros explícitos y pasajes de documentos incluidos en el corpus. **La búsqueda abierta es fallback P1**, no dependencia para tener resultados beta.
3. **Comprobación evidencia-claim:** por cada fuente debe existir localizador y extracto pertinente; validar valores, ámbito, tiempo y correspondencia semántica. Si no se puede localizar, no generar `SUPPORTED`/`CONTRADICTED`.
4. **Síntesis:** resultado corto, estructurado en qué aporta la evidencia / contexto / limitaciones, citando IDs de evidencias persistidas. El modelo no puede crear URLs o citas fuera de las recuperadas.
5. **Modelo configurable:** seleccionar uno económico para extracción y uno de mayor capacidad solo cuando el benchmark indique una mejora material; registrar versión/modelo/prompt/coste. No comprometerse a una marca o modelo concreto antes de comparar precisión y coste con el dataset (§12).

**Límites por job (configurables, no precios prometidos):** máximo de tokens, número de documentos, llamadas externas, reintentos y tiempo. `PENDING → RUNNING → COMPLETED | INSUFFICIENT_EVIDENCE | FAILED | CANCELED`. Ante fallo de una fuente, degradar elegantemente a «sin evidencia suficiente» solo cuando corresponda; los errores operativos se distinguen de resultados investigados.

### 10.5 Contratos API P0

```http
GET  /v1/videos/:videoId/availability
GET  /v1/videos/:videoId/claims
POST /v1/investigations          # body: claimId | manualClaim; idempotencyKey
GET  /v1/investigations/:id     # polling acotado; incluye estado y resultado
POST /v1/investigations/:id/feedback
GET  /health
```

- Cargas y respuestas descritas con schemas compartidos y OpenAPI generado desde backend; no `any` ni respuesta libre de LLM en el borde HTTP.
- El cliente envía `claimId` para vídeos incluidos; el servidor recupera el contexto original y no confía en fragmentos de transcripción inventados por el navegador.
- API sin login **no** significa API abierta sin límites: rate limit por origen/identificador anónimo e IP (con cautelas de privacidad), límites de coste global y por sesión, timeouts, presupuesto diario y protección antiabuso. **El ID de una extensión o una clave incrustada en ella no son autenticación segura.**
- La extensión nunca contiene claves de LLM, Search o fuentes de pago. CORS no sustituye autenticación/antifraude.
- Polling cada pocos segundos mientras está pendiente, con backoff, parada en estados terminales y cancelación local al cambiar de vídeo; no implementar websockets/SSE en P0.

### 10.6 Modelo de datos mínimo

- `Video`: `youtubeId`, metadatos públicos permitidos, `corpusStatus`, idioma, `publishedAt`.
- `Transcript`: segmentos `{startMs,endMs,text}`, procedencia, base de derechos/licencia, fecha de importación, hash de revisión.
- `Claim`: literal y contexto **inmutables**, timestamp, tipo, interpretación normalizada, entidad, territorio, periodo, estado de verificabilidad.
- `Investigation`: claim/manual, versión, estados, conclusión, síntesis, limitaciones, `checkedAt`, `expiresAt`, pipeline/modelo, coste y latencia.
- `Source`: URL canónica, editorial/organismo, fecha de publicación/acceso, procedencia, condiciones de uso.
- `Evidence`: `sourceId`, localizador (página/tabla/serie), fragmento realmente localizado, relación con la afirmación, fechas, estado de comprobación.
- `Feedback`: tipo de incidencia, investigación, fecha, estado de resolución. No guardar más datos personales que los indispensables.

Cada afirmación, dato y evidencia mantiene procedencia auditable. No reutilizar investigaciones de claims similares sin validar entidad, unidad, geografía, periodo y actualización de la fuente.

### 10.7 Calidad técnica, seguridad y operaciones

- **Estándares:** TypeScript estricto; ESLint/Prettier; Conventional Commits opcional; PRs pequeños; ADR breve para decisiones irreversibles.
- **Unitarios:** parser SRT/VTT y timestamps, normalización de claims, comparaciones estadísticas y deduplicación de fuentes.
- **Integración:** conectores con mocks y fixtures reales autorizados, base de datos de prueba, migraciones, reintentos/timeout/partial failure, idempotencia.
- **Extensión E2E:** Chrome real con extensión cargada, navegación SPA de YouTube, seek, cambio de pestaña, cierre/apertura del panel, vídeo no admitido y fallo de API. Usar fixtures reproducibles; no depender de la presencia de un vídeo público volátil para toda la suite.
- **Seguridad:** sanitizar HTML/documentos, impedir SSRF en URL remotas, delimitar permisos de extensión, validar tokens/schemas y aislar material no fiable frente a prompt injection.
- **Observabilidad:** `investigationId` y `correlationId` en toda etapa; logs sin textos completos innecesarios; métricas de recuperación, abstención, errores, latencia, coste y fuentes utilizadas.
- **Release:** build reproducible, artefacto MV3 firmado/distribuido según la modalidad beta aplicable, rollback de API, migraciones revisadas y alertas simples.

**No incluir hasta demostrar necesidad:** Redis, BullMQ, Elasticsearch, Pinecone, embeddings, LangChain/Graph, agentes autónomos, event bus, microservicios, analítica de comportamiento detallada, panel de administración o facturación.

## 11. Privacidad, seguridad y cumplimiento

- Activación iniciada por el usuario; acceso limitado a pestañas de YouTube necesarias para la experiencia.
- Antes de enviar una frase, mostrar de forma clara qué contenido se transmite a qué servicio y para qué fin.
- Sin cuenta obligatoria en beta, sin publicidad personalizada, sin análisis de preferencias electorales ni lectura de navegación ajena a la función.
- Almacenar lo mínimo; retención propuesta para logs técnicos de 14 días y eventos de producto agregados de 30 días, pendiente de evaluación legal y operativa.
- Política de privacidad, contacto para rectificaciones, gestión de eliminación y acuerdos de tratamiento de datos con proveedores cuando corresponda.
- API con autenticación de extensión/cliente apropiada, cuotas por usuario/IP, límites de tamaño, sanitización de URLs, mitigación SSRF, aislamiento de HTML extraído y secretos en servidor.
- Tratar títulos, textos y documentos como entrada no confiable. No ejecutar instrucciones embebidas en material recuperado.
- Revisar requisitos de Chrome Web Store, normativa de protección de datos, licencias de contenidos y condiciones de YouTube antes de distribución pública.

## 12. Métricas y validación

**Unidad de valor:** investigación útil con evidencia consultable por el usuario.

| Dimensión | Métrica | Objetivo inicial de validación (hipótesis) |
|---|---|---|
| Uso | % usuarios beta que ejecutan ≥1 investigación voluntaria | ≥40 % |
| Repetición | % usuarios activos que vuelven a investigar en otra sesión en 14 días | ≥25 % |
| Utilidad | % resultados valorados como «útiles» | ≥70 % |
| Calidad de fuentes | % referencias cuya URL y pasaje soportan lo atribuido | ≥95 % en muestra auditada |
| Citas inventadas | Citas o pasajes inexistentes detectados en revisión | 0 en muestra de salida a beta |
| Contexto | % resultados estadísticos con periodo, unidad y territorio correctos | ≥90 % en muestra auditada |
| Abstención | Incidencia de conclusiones tajantes sin evidencia pertinente | 0 en muestra de salida a beta |
| Sincronización | Diferencia entre timestamp y frase reproducida | ≤2 s en corpus validado |
| Latencia | Resultado de caché / investigación nueva | p95 <2 s / objetivo p95 <45 s, medido en beta |
| Coste | Coste por investigación nueva | Medir desde día 1; objetivo provisional ≤0,25 € |

**Importante:** umbrales de producto propuestos, no evidencia de demanda ni garantías técnicas. Si los umbrales no se alcanzan, registrar causas y revisar alcance antes de escalar.

### Dataset de evaluación

- 12–20 vídeos autorizados, variedad de oradores y formatos, con trazabilidad de derechos.
- ≥100 afirmaciones etiquetadas manualmente; mezcla de cifras comprobables, contexto ambiguo, afirmaciones ya verificadas, opiniones y evidencia insuficiente.
- Etiquetado de referencia por al menos dos revisores cuando sea posible, con desacuerdos documentados.
- Casos de regresión: fechas desactualizadas, homónimos, geografía distinta, magnitudes nominales vs. reales, medios que citan la misma fuente, falsa atribución de procedencia y cambio de partido/orador con frase idéntica.
- Evaluación **por etapa**: extracción, selección, recuperación, correspondencia evidencia-afirmación, síntesis, integridad de citas y abstención.
- Registro de coste/modelo/prompt/tiempo por ejemplo para comparar cambios de proveedores sin degradar calidad.

## 13. Fases de desarrollo y validación

Las etapas son **secuenciales por dependencia**, no compromisos de calendario. Cada una entrega software ejecutable, evidencia de funcionamiento y una decisión de **GO / ITERAR / NO-GO**. No avanzar si la puerta anterior falla. P0 = MVP funcional y beta cerrada; P1 = ampliación condicionada a resultados.

### Fase D0 — Viabilidad legal, fuentes y prototipo Chrome (P0; gate bloqueante)

**Objetivo:** confirmar que se puede entregar una experiencia real sobre contenido utilizado legítimamente, sin basarse en scraping.

**Construir/probar:**
- [ ] Prototipo WXT/React que abra `chrome.sidePanel` desde el icono y detecte `youtube.com/watch`, `videoId`, `currentTime` y navegación SPA.
- [ ] Seleccionar 12–20 vídeos y registrar propietario, URL, idioma, licencia/permiso, transcripción, derecho de uso y almacenamiento.
- [ ] Ingestar dos SRT/VTT autorizados de prueba; validar timestamps y reproducción sincronizada.
- [ ] Consultar manualmente Google Fact Check Tools e INE con 10 afirmaciones representativas; documentar cobertura y límites.
- [ ] Identificar restricciones de YouTube, Chrome Web Store y tratamiento de datos; documentar lo aprobado y lo pendiente de revisión.

**Validar:** demo en Chrome con vídeo y timestamps reales; muestra de transcripciones legalmente utilizables; proveedores accesibles con resultados identificables.

**Gate G0:** `GO` solo si existe una ruta lícita y repetible de entrada de contenido para el catálogo beta. Si no, pivotar a investigación manual / corpus propio antes de construir el motor sobre vídeos.

### Fase D1 — Vertical slice de producto sin IA (P0)

**Objetivo:** verificar UX, sincronización y contratos antes de asumir el coste de investigación.

**Construir:**
- [ ] Monorepo, CI, Docker Compose, migraciones PostgreSQL, Zod, NestJS y WXT.
- [ ] API `availability/claims` + importador CLI SRT/VTT con metadatos de derechos.
- [ ] Side panel: vídeo compatible/no compatible, lista de afirmaciones **fixture**, seek, carga, errores y «Pegar afirmación».
- [ ] Flujo `POST/GET investigations` con worker simulado claramente marcado **DEMO**, jobs y polling.
- [ ] Eventos mínimos (`panel_opened`, `investigation_requested`, `result_opened`) sin identidad política ni rastreo general.

**Validar:** E2E con dos vídeos del corpus, cambio entre vídeos/tabs, buscar/saltar al timestamp, red caída y estados de error. Los fixtures jamás se muestran como verificaciones auténticas.

**Gate G1:** experiencia completa y sincronizada sin datos cruzados entre vídeos; API y cola no bloquean la UI; instalación en Chrome repetible.

### Fase D2 — Motor de afirmaciones y corpus de evaluación (P0)

**Objetivo:** identificar correctamente afirmaciones verificables, dejando fuera opiniones y frases vagas.

**Construir:**
- [ ] Segmentar transcripciones; extraer claims atómicas con texto literal, contexto y timestamps.
- [ ] Clasificar estadística / hecho concreto / opinión / predicción / no verificable.
- [ ] Seleccionar 3–10 afirmaciones relevantes por vídeo usando criterios no partidistas.
- [ ] Crear dataset versionado de ≥100 ejemplos revisados, incluidos negativos, casos ambiguos y equivalencias.
- [ ] Script que reporte por separado precisión/recobrado de extracción y errores de contexto/timestamp.

**Validar:** revisión de una muestra por dos personas cuando sea viable; pruebas de invariancia al nombre/partido/orador; misma claim no recibe prioridad distinta por autor.

**Gate G2:** alcanzar umbrales preliminares del dataset de §12 o reducir el tipo de afirmaciones admitidas; nunca ocultar errores con una gran cantidad de tarjetas.

### Fase D3 — Motor de evidencias y explicaciones verificables (P0)

**Objetivo:** ofrecer investigaciones reales de alcance acotado y abstenerse ante incertidumbre.

**Construir:**
- [ ] Conectores reales a Fact Check Tools y API INE, más documentos permitidos de un corpus pequeño.
- [ ] Buscar evidencia, deduplicar fuentes dependientes y conservar localizadores de pasaje/tabla/serie.
- [ ] Validar pertinencia antes de concluir; calcular cifras básicas con código determinista.
- [ ] Generar explicación corta, contexto y limitaciones mediante salida estructurada validada.
- [ ] Historial/versionado, caché contextual, estados terminales y límites globales/de petición de coste.
- [ ] Diferenciar **fuente citada por el orador**, **fuente localizada** y **origen desconocido**.

**Validar:** evaluación offline de ≥100 casos, auditoría manual de **cada referencia** en muestra de aceptación, negativos sin evidencia, fuentes contradictorias, cambio de fecha/territorio/unidad y URLs caídas. Comparar al menos una configuración de modelo económico contra una alternativa de mayor capacidad sobre el mismo corpus.

**Gate G3:** ninguna cita fabricada ni conclusión categórica sin respaldo en la muestra de salida, correspondencia de fuentes ≥95 % en muestra auditada, contexto estadístico ≥90 % y errores críticos corregidos. Si no se alcanza, limitar cobertura, aumentar abstención o iterar antes de invitar usuarios.

### Fase D4 — Integración end-to-end, seguridad y beta técnica (P0)

**Objetivo:** sustituir la demo por el flujo real sin comprometer fiabilidad ni privacidad.

**Construir:**
- [ ] Conectar UI con job real, polling/backoff, fuente original enlazable y marca «comprobado el…».
- [ ] Modo manual utilizable, feedback de incidencia, pantalla de cobertura y explicación de límites.
- [ ] Rate limits, presupuestos máximos, alertas básicas, logs estructurados y diagnóstico por etapa.
- [ ] Tests E2E y de integración (SPA, tabs, seek, proveedores caídos, idempotencia y errores).
- [ ] Revisión de permisos, política de privacidad, licencias y distribución de beta cerrada.

**Validar:** smoke tests con Chrome + backend desplegado, pruebas de estrés pequeñas para evitar jobs duplicados, auditoría de permisos y regresión completa.

**Gate G4:** Definition of Done (§14) cumplida, sistema desplegable y control de costes efectivo; no distribuir hasta resolver riesgos legales y fallos críticos.

### Fase V1 — Pruebas de usabilidad moderadas (validación de problema/UX)

**Muestra sugerida:** 5–8 personas con perfiles distintos, sin seleccionarlas según afinidad política.

**Tareas sin guía:** encontrar una afirmación, investigarla, abrir el pasaje que sustenta la respuesta, explicar qué queda sin probar, volver al vídeo y probar una afirmación manual.

**Registrar:** éxito de tarea, tiempo, dónde se atascan, si confunden «evidencia localizada» con «fuente usada por el orador», comprensión de incertidumbre y comentarios literales.

**Gate V1:** corregir problemas que impidan comprender o comprobar una investigación antes de abrir la beta. No ampliar funcionalidades para compensar mensajes confusos.

### Fase V2 — Beta cerrada instrumentada (validación de utilidad y repetición)

**Muestra sugerida:** 15–25 participantes durante un periodo fijo de prueba, con catálogo de 12–20 vídeos autorizados y entrada manual.

**Medir (§12):** activación, primera investigación, retorno en una sesión posterior, clic en fuentes originales, utilidad percibida, coste, latencia, fallos, abstenciones y reportes. Comparar una tarea de investigación manual con la extensión en parte de la muestra.

**Preguntas de cierre:** ¿qué información les faltaba?, ¿en qué situación volverían a usarla?, ¿qué hicieron cuando la herramienta se abstuvo?, ¿qué herramienta sustituye o complementa? Evitar preguntar solo «¿te gusta?».

**Gate V2:** `GO` a ampliar corpus solo si se observa uso voluntario repetido, resultados entendibles y calidad/coste controlados. Si falla uso pero no calidad: revisar propuesta y UX. Si falla calidad: detener expansión del corpus.

### Fase V3 — Validación comercial (antes de monetizar)

**Muestra sugerida:** 5–10 profesionales que contrasten discursos (periodistas, investigadores o creadores), además de usuarios generales recurrentes.

**Experimento:** enseñar una oferta concreta de ahorro de tiempo y trazabilidad (p. ej. exportación de evidencias y lote de vídeos), pedir casos reales y explorar disposición a pagar con una acción verificable (lista de espera cualificada, piloto o carta de intención), **sin construir pagos**.

**Gate V3:** decidir entre consumidor gratuito, herramienta profesional o pausa de monetización a partir de comportamiento y demanda real; no inferir negocio de instalaciones o respuestas positivas.

### 13.1 Matriz de entregables y puertas

| Etapa | Entregable demostrable | Gate principal |
|---|---|---|
| D0 | Prototipo Chrome + corpus y permisos documentados | Viabilidad real de contenido |
| D1 | Vertical slice funcional con datos **DEMO** explícitos | Integración navegador/API estable |
| D2 | Claims atómicas + dataset etiquetado + métricas | Extracción sin sesgo ni confusiones |
| D3 | Investigador con evidencias reales, citas y abstención | Fiabilidad auditada |
| D4 | Extensión desplegable + seguridad y observabilidad | Beta técnica lista |
| V1 | Informe breve de observación de tareas + correcciones | Comprensión y facilidad de uso |
| V2 | Datos de uso y repetición en beta | Utilidad real |
| V3 | Evidencia comercial cualitativa y conductual | Decisión de negocio |

### 13.2 Orden recomendado para el backlog

**Épica A — Viabilidad y corpus:** permisos, pruebas Chrome, importador autorizado.

**Épica B — UX y extensión:** identificación de vídeo, panel, timestamps, claims, modo manual, errores.

**Épica C — Evidencia:** extracción, conectores, verificabilidad, localizadores, síntesis.

**Épica D — Confianza:** auditoría automática de citas, abstención, revisión/feedback, pruebas de invariancia.

**Épica E — Operación y validación:** límites de coste, observabilidad, dataset, pruebas y beta.

**Dependencias críticas:** A antes de automatización de vídeos; B vertical slice antes de integrar IA real; C y D antes de cualquier beta externa; E transversal desde el inicio.

### 13.3 Decisiones de continuación

| Señal observada | Decisión recomendada |
|---|---|
| No hay ruta autorizada para el corpus | `NO-GO` para análisis automático sobre YouTube; conservar modo manual o cambiar canal |
| Extracción funciona pero referencias no sostienen conclusiones | Reducir ámbito, corregir recuperación, aumentar abstención; **no lanzar** |
| Calidad adecuada pero pocos usuarios activan el producto | Mejorar onboarding y propuesta de valor, no añadir 20 nuevas funciones |
| Uso repetido pero costes impredecibles | Endurecer límites/caché y probar reducción de coste antes de abrir a más usuarios |
| Uso recurrente y demanda profesional verificable | Probar exportación y flujos de investigación por lotes como P1 |

## 14. Criterios de aceptación globales / Definition of Done

El MVP estará listo para beta cerrada únicamente si:

1. Se puede instalar y ejecutar la extensión en una versión soportada de Chrome sin errores críticos.
2. Hay al menos un conjunto útil de vídeos autorizados; los no compatibles se gestionan honestamente.
3. El usuario puede llegar desde el minuto de una frase hasta sus evidencias sin salir de YouTube.
4. Las fuentes se abren en documentos reales y las citas relevantes se pueden localizar.
5. Ninguna conclusión categórica de la muestra de aceptación carece de evidencia pertinente; se permite abstención.
6. Los fallos de red, permisos, proveedores y falta de evidencia no generan respuestas inventadas.
7. La experiencia no obstaculiza reproducción ni fuerza pausas; funciona con navegación SPA.
8. Existen tests automatizados y conjunto de regresión con ejemplos de distintos oradores.
9. Cumple las condiciones de acceso al contenido y los requisitos mínimos de privacidad y seguridad de su modalidad de beta.
10. Están instrumentados utilidad, repetición, latencia, coste y errores para tomar una decisión posterior.

## 15. Riesgos y decisiones abiertas (no bloquean el diseño, salvo fase 0)

| Riesgo | Impacto | Mitigación / decisión |
|---|---|---|
| Restricciones de acceso a YouTube | Crítico | Corpus autorizado, entrada manual y gate jurídico/técnico |
| Fuentes que parecen relevantes pero no demuestran | Crítico | Comprobación de pasajes + abstención + auditoría de muestra |
| Errores al interpretar estadísticas | Alto | Conectores estructurados, cálculo determinista, controles de periodo/unidad |
| Coste por investigación | Alto | Bajo demanda, caché contextual, límites de búsquedas y tokens |
| Sesgos o tratamiento desigual | Alto | Mismos criterios por afirmación; dataset transversal y tests de invariancia |
| Escasa demanda / disposición de pago | Alto | Beta instrumentalizada y entrevistas de uso; no construir pagos aún |
| Cambios de interfaz SPA en YouTube | Medio | Adaptador DOM aislado, pruebas E2E y fallbacks visibles |

**Decisiones por defecto:** español y España; Chrome de escritorio; sin login; sin directos; sólo vídeos autorizados y afirmaciones manuales; fuentes oficiales priorizadas; investigación bajo demanda; sin «nota de fiabilidad» de actores políticos; sin infraestructura compleja.

## 16. Plan de ejecución para Codex / Claude Code

**Modo de ejecución recomendado:** implementar por fases D0 → D4, cada una en PR independiente con tests y demostración reproducible. No encadenar agentes realizando cambios transversales sin control de versiones; mantener una rama de trabajo o PR por hito.

**Instrucción de arranque:** «Lee este PRD íntegramente. Empieza por D0. Antes de codificar enumera los riesgos bloqueantes y confirma qué APIs/derechos de acceso son viables; no inventes una ruta de transcripciones. Para cada fase, implementa únicamente el alcance marcado, escribe pruebas, ejecuta build/typecheck/tests, muestra evidencia de cumplimiento del gate y detente si aparece un bloqueo». Esto es una instrucción para el agente de desarrollo, no una solicitud de informes de estrategia adicionales.

**Para cada PR/hito entregar:**

1. Cambios funcionales y decisiones técnicas relevantes (ADR breve solo si son difíciles de revertir).
2. Tests y comandos ejecutados, con resultados reales y limitaciones.
3. Demo o pasos reproducibles para el flujo completo y los estados de error.
4. Referencias exactas a requisitos FR-xx cubiertos y gate correspondiente.
5. Problemas pendientes clasificados como bloqueante / no bloqueante, sin ampliar alcance por iniciativa propia.

**Secuencia de commits orientativa:** scaffold → Chrome spike → corpus/ingesta → claims → cola/API → recuperadores → validación/síntesis → UI final → seguridad/observabilidad → evaluación y beta.

**No aceptar como completado:** verificaciones generadas sin fuentes localizables, resultados ficticios sin etiqueta DEMO, dependencias de scraping, claves secretas en la extensión, rankings de políticos, modelos que deducen intenciones ni creación de sistemas complejos no requeridos.

## 17. Documentación técnica oficial y referencias

- WXT: [instalación y plantilla React](https://wxt.dev/guide/installation), [entrypoints](https://wxt.dev/guide/essentials/entrypoints), [testing](https://wxt.dev/guide/essentials/e2e-testing).
- Chrome: [Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [Chrome Extensions MV3](https://developer.chrome.com/docs/extensions/develop), [Tab Capture API, solo investigación futura](https://developer.chrome.com/docs/extensions/reference/api/tabCapture).
- Chrome Web Store: [Limited Use / datos de usuario](https://developer.chrome.com/docs/webstore/program-policies/limited-use).
- YouTube: [captions.download: requiere permiso de edición](https://developers.google.com/youtube/data/reference/rest/v3/captions/download), [políticas para desarrolladores](https://developers.google.com/youtube/terms/developer-policies).
- Fuentes: [Google Fact Check Tools — claims.search](https://developers.google.com/fact-check/tools/api/reference/rest/v1alpha1/claims/search), [API JSON del INE](https://ine.es/dyngs/DAB/es/index.htm?cid=1100).
- Persistencia / jobs: [migraciones Drizzle](https://orm.drizzle.team/docs/migrations), [pg-boss](https://pgboss.io/introduction).
- Test y validación: [Playwright](https://playwright.dev/docs/intro), [Vitest](https://vitest.dev/guide/).

---

**Resultado que buscamos:** una extensión que, sobre un catálogo autorizado de vídeos, permita seleccionar una afirmación, contrastarla con evidencia real y reconocer honestamente lo que todavía no sabemos. **El MVP termina en una decisión respaldada por métricas de uso y calidad, no en un número de funcionalidades implementadas.**
