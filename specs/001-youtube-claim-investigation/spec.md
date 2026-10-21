# Feature Specification: Investigación de afirmaciones en vídeos de YouTube (MVP P0)

**Feature Branch**: `001-mvp`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Construir MVP en base a prd.md" — PRD v1.1 (`/prd.md`), alcance P0 (§4).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver afirmaciones de un vídeo compatible y saltar al minuto (Priority: P1)

Una persona abre un vídeo de YouTube del catálogo autorizado y activa la extensión. El panel lateral
reconoce el vídeo, indica si hay análisis disponible y lista entre 3 y 10 afirmaciones verificables
con su minuto y texto literal. Al pulsar una, el vídeo salta a ese instante sin pausarse.

**Why this priority**: Es el vertical slice que valida UX, sincronización y catálogo (D0/D1) antes
de asumir el coste de investigar. Sin él no existe el producto en YouTube.

**Independent Test**: Con dos vídeos del catálogo cargados, abrir el panel, comprobar lista,
pulsar una afirmación y verificar que el reproductor está a ≤2 s del timestamp; navegar a otro vídeo
(sin recarga) y comprobar que la lista se reinicia sin mezclar datos.

**Acceptance Scenarios**:

1. **Given** un vídeo del catálogo, **When** se abre el panel, **Then** muestra «Análisis disponible» y la lista de afirmaciones con minuto y texto literal.
2. **Given** la lista visible, **When** se pulsa una afirmación, **Then** el vídeo se sitúa en su instante (desfase ≤2 s) y no se pausa ni se cubre el reproductor.
3. **Given** el panel abierto en el vídeo A, **When** se navega al vídeo B dentro de YouTube, **Then** el panel muestra solo datos de B.
4. **Given** un vídeo fuera del catálogo, **When** se abre el panel, **Then** indica «Vídeo todavía no compatible» y ofrece «Pegar una afirmación».

---

### User Story 2 - Investigar una afirmación y consultar la evidencia (Priority: P1)

Al elegir una afirmación, la persona pulsa **Investigar**. Si existe un resultado válido se muestra al
instante; si no, ve el progreso hasta obtenerlo. El resultado muestra, en este orden: afirmación
literal → qué muestran las evidencias → contexto/limitaciones → fuentes (con URL, publicador, fechas,
fragmento y si la fuente la citó el orador o la localizó el sistema), además de «comprobado el…».

**Why this priority**: Es la propuesta de valor (H1–H3). Sin evidencia trazable no hay producto.

**Independent Test**: Investigar una afirmación con evidencia disponible y otra sin ella; la primera
muestra fuentes abribles con fragmento; la segunda termina en «evidencia insuficiente» sin inventar.

**Acceptance Scenarios**:

1. **Given** una afirmación sin investigación previa, **When** se pulsa Investigar, **Then** se inicia una única investigación con indicador de progreso y el resultado aparece al terminar.
2. **Given** una investigación válida existente, **When** otra persona pulsa Investigar en la misma afirmación, **Then** se reutiliza el resultado sin nueva investigación.
3. **Given** que no se localiza evidencia pertinente, **When** termina la investigación, **Then** el estado es `INSUFFICIENT_EVIDENCE` con explicación de límites, nunca `CONTRADICTED`.
4. **Given** una fuente caída o presupuesto agotado, **When** falla la investigación, **Then** se muestra un error operativo recuperable distinto de un resultado investigado.
5. **Given** un resultado `SUPPORTED`/`CONTRADICTED`, **Then** cada afirmación del resultado referencia una evidencia con localizador y fragmento.

---

### User Story 3 - Pegar una afirmación manual (Priority: P2)

En un vídeo no compatible (o en cualquiera), la persona pega una frase y la investiga. El sistema avisa
qué texto se enviará y a qué servicio, marca el texto como aportado por el usuario y no le asigna
timestamp.

**Why this priority**: Mantiene utilidad fuera del catálogo y es el fallback si el gate legal falla.

**Independent Test**: En un vídeo no catalogado, pegar una frase, aceptar el aviso y obtener un
resultado marcado «texto aportado por el usuario», sin minuto.

**Acceptance Scenarios**:

1. **Given** el modo manual, **When** se envía una frase, **Then** antes del envío se muestra qué se transmite y para qué.
2. **Given** un resultado manual, **Then** se indica «texto aportado por el usuario» y no aparece timestamp ni enlace al minuto.
3. **Given** un texto vacío o mayor que el límite, **When** se intenta enviar, **Then** se rechaza con mensaje claro.

---

### User Story 4 - Reportar un problema con una investigación (Priority: P2)

Desde un resultado, la persona pulsa «Hay un problema con esta investigación», elige un motivo y,
opcionalmente, añade un comentario. El reporte queda registrado sin alterar la conclusión publicada.

**Why this priority**: Requisito de confianza y rectificación (FR-11), barato de construir.

**Independent Test**: Enviar un reporte y comprobar que se persiste con referencia a la versión de
la investigación y que el resultado visible no cambia.

**Acceptance Scenarios**:

1. **Given** un resultado, **When** se envía un reporte con motivo, **Then** se confirma la recepción y la conclusión no cambia.

---

### User Story 5 - Operador importa transcripciones autorizadas (Priority: P1)

El operador importa un `.srt`/`.vtt` asociado a un ID de YouTube junto con la declaración de derechos
(titular, licencia/permiso, alcance, idioma, fecha). El sistema valida timestamps, registra la versión
y prepara las afirmaciones del vídeo.

**Why this priority**: Sin catálogo autorizado no hay User Story 1 (gate D0).

**Independent Test**: Importar un SRT y un VTT válidos; rechazar uno sin declaración de derechos o con
timestamps inválidos; reimportar el mismo fichero no duplica.

**Acceptance Scenarios**:

1. **Given** un fichero válido con declaración de derechos, **When** se importa, **Then** el vídeo pasa a disponible con su transcripción versionada.
2. **Given** un fichero sin declaración de derechos, **When** se importa, **Then** se rechaza.
3. **Given** un fichero ya importado, **When** se reimporta sin cambios, **Then** no se crea una nueva versión.

---

### Edge Cases

- Vídeo catalogado cuya preparación de afirmaciones está en curso → estado «Preparando afirmaciones».
- Vídeo catalogado con lista de afirmaciones vacía → mensaje explícito, no error.
- Cambio de vídeo o pestaña con una investigación en curso → la respuesta tardía no se muestra en el vídeo nuevo.
- Peticiones concurrentes de la misma afirmación → una sola investigación (deduplicación/idempotencia).
- Backend inaccesible → estado `error` recuperable con reintento.
- Límite de peticiones excedido → estado `rate_limited` con mensaje comprensible.
- Fuente con instrucciones embebidas («ignora lo anterior…») → se trata como texto, sin efecto.
- Misma frase atribuida a oradores distintos → misma clasificación y prioridad.
- Afirmación de opinión o predicción → `NOT_CHECKABLE`, no se investiga como hecho.
- Resultado caducado (`expiresAt` vencido) o fuente actualizada → se marca y se permite reinvestigar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST identificar el vídeo activo, su tiempo actual y estado de reproducción, y detectar cambios de vídeo sin recarga de página.
- **FR-002**: Users MUST be able to saltar al instante de una afirmación (desfase ≤2 s) sin que el vídeo se pause automáticamente.
- **FR-003**: El sistema MUST extraer afirmaciones atómicas contrastables conservando frase literal, contexto y timestamp respaldados por un tramo de la transcripción, excluyendo opiniones y predicciones; la lista puede estar vacía y se limita a un máximo configurable (3–10 por defecto).
- **FR-004**: Cada acción «Investigar» MUST generar como máximo una investigación, con progreso visible, posibilidad de abandonar la espera y reintentos limitados.
- **FR-005**: Cada afirmación factual de un resultado MUST referenciar una evidencia concreta (pasaje/serie/tabla); si falta, el resultado expresa incertidumbre.
- **FR-006**: Cada fuente MUST mostrar URL, título, publicador, fecha disponible, fecha de consulta, fragmento justificativo y tipo (citada por el orador / localizada por el sistema / origen desconocido; original / secundaria).
- **FR-007**: Cuando aplique, el sistema MUST identificar indicador, unidad, ámbito geográfico, periodo y base de comparación, sin inventar campos ausentes.
- **FR-008**: Las conclusiones MUST limitarse a `SUPPORTED`, `CONTRADICTED`, `NEEDS_CONTEXT`, `INSUFFICIENT_EVIDENCE`; solo las dos primeras con evidencia pertinente localizada; nunca se presentan como insignia aislada.
- **FR-009**: Vídeo no soportado, transcripción no disponible, proveedor caído, límite de uso y ausencia de fuentes MUST tener estados comprensibles y recuperables: `idle`, `unsupported_video`, `transcript_unavailable`, `preparing_claims`, `claims_ready`, `investigation_pending`, `investigation_ready`, `insufficient_evidence`, `rate_limited`, `source_unavailable`, `error`.
- **FR-010**: El sistema MUST reutilizar una investigación solo si coinciden significado normalizado, entidad, territorio, periodo y versión de fuentes, y no ha caducado.
- **FR-011**: Users MUST be able to reportar un problema con motivo; el reporte referencia la versión de la investigación y no altera la conclusión.
- **FR-012**: La extensión MUST actuar solo al invocarse en páginas de vídeo de YouTube, comunicar qué envía al backend y no acceder a otras páginas ni al historial.
- **FR-013**: El operador MUST poder importar transcripciones `.srt`/`.vtt` solo con declaración de derechos, procedencia, idioma y huella de versión.
- **FR-014**: Users MUST be able to investigar texto pegado, marcado como aportado por el usuario y sin timestamp.
- **FR-015**: Las investigaciones MUST ser versionadas, con «comprobado el…», caducidad, pipeline/modelo, coste y latencia registrados.
- **FR-016**: El sistema MUST respetar límites configurables por investigación (llamadas, tokens, documentos, tiempo) y un presupuesto global diario; al agotarse, termina con salida honesta.
- **FR-017**: El sistema MUST registrar eventos mínimos de producto (`panel_opened`, `investigation_requested`, `result_opened`, `source_clicked`, `feedback_sent`) sin identidad política ni navegación ajena.
- **FR-018**: Los datos simulados MUST mostrarse etiquetados como DEMO.
- **FR-019**: La clasificación, selección y prioridad de afirmaciones MUST ser invariantes al orador o partido.

### Key Entities

- **Vídeo**: ID de YouTube, metadatos públicos permitidos, estado de catálogo, idioma, fecha.
- **Transcripción**: segmentos con inicio/fin y texto, procedencia, base de derechos, fecha de importación, huella de versión.
- **Afirmación (Claim)**: literal y contexto inmutables, timestamp, tipo, interpretación normalizada, entidad, territorio, periodo, verificabilidad; o texto manual del usuario.
- **Investigación**: afirmación o texto manual, versión, estado, conclusión, síntesis, limitaciones, fechas de comprobación/caducidad, pipeline/modelo, coste y latencia.
- **Fuente**: URL canónica, publicador/organismo, fechas de publicación/acceso, procedencia, condiciones de uso.
- **Evidencia**: fuente, localizador, fragmento localizado, relación con la afirmación, fechas, tipo (declarada/localizada), estado de comprobación.
- **Reporte (Feedback)**: motivo, investigación y versión, fecha, estado de resolución.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde la frase en el vídeo hasta ver sus fuentes en ≤3 interacciones, sin salir de YouTube.
- **SC-002**: Desfase entre timestamp de la afirmación y posición del reproductor ≤2 s en el corpus validado.
- **SC-003**: Resultado en caché visible en <2 s (p95); investigación nueva con objetivo p95 <45 s.
- **SC-004**: 0 citas o pasajes inexistentes y 0 conclusiones categóricas sin evidencia pertinente en la muestra de aceptación.
- **SC-005**: ≥95 % de referencias cuya URL y pasaje soportan lo atribuido, y ≥90 % de resultados estadísticos con periodo, unidad y territorio correctos (muestra auditada).
- **SC-006**: 0 casos de datos cruzados entre vídeos en la suite E2E de navegación.
- **SC-007**: Coste por investigación nueva medido desde el día 1 (objetivo provisional ≤0,25 €).
- **SC-008**: Tests de invariancia de orador: 100 % de pares con misma clasificación y prioridad.

## Assumptions

- La ruta legal del catálogo (gate D0) la cierra el propietario del producto; hasta entonces el catálogo usa transcripciones de demostración redactadas por el equipo, marcadas DEMO.
- El proveedor LLM se encapsula tras interfaces; por defecto se usa un modelo de Anthropic configurable, y sin clave el sistema se abstiene o usa el modo DEMO explícito.
- Las claves de Google Fact Check Tools y del LLM las aporta el operador en el servidor; el INE es de acceso público.
- Validaciones con usuarios (V1–V3), dataset etiquetado por dos revisores y despliegue público quedan fuera de lo que puede cerrar el desarrollo y se documentan como pendientes.
- Chrome de escritorio, español, España; sin login, sin directos.
