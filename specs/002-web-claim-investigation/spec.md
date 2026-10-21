# Feature Specification: Investigar afirmaciones mientras navegas (artículos y vídeos)

**Feature Branch**: `002-web-claim-investigation`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Que la extensión del navegador no solo sirva para vídeos de YouTube, también para
artículos, noticias, etc. Evolución de producto hacia una extensión que permite investigar y contrastar las afirmaciones
que encuentras mientras navegas, con fuentes originales, contexto y evidencias verificables. La política sigue siendo el
primer ámbito de especialización; YouTube pasa a ser uno de los canales de entrada. Seleccionar cualquier frase de una
noticia y hacer clic en «Investigar esta afirmación». Activación explícita, permisos temporales, sin acceso permanente a
la navegación. MVP centrado en afirmaciones factuales contrastables, con un mismo motor de evidencias para artículos y
vídeos, sin PDFs, redes sociales, análisis de imágenes ni chat general."

**Relación con 001**: esta spec amplía el producto construido en `specs/001-youtube-claim-investigation/`. El flujo de
YouTube, la política de evidencia, las conclusiones, la caché, el versionado y el feedback de 001 se mantienen; aquí solo
se especifica lo nuevo y lo que cambia. Requiere la constitución v1.1.0 (principios II, III y IV ampliados).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Investigar una frase seleccionada en un artículo (Priority: P1)

Una persona lee una noticia en cualquier web. Selecciona una frase («El paro bajó un 10 % en 2025»), abre el menú
contextual y elige **«Investigar esta afirmación»**. Se abre el panel lateral con la frase, el medio de origen y un aviso
de qué se va a enviar. Al confirmar, ve el progreso y después el resultado con el mismo formato que en vídeo: afirmación
literal → qué muestran las evidencias → contexto y limitaciones → fuentes.

**Why this priority**: Es la nueva entrada principal del producto. Funciona en cualquier página de noticias, no depende
del acceso a subtítulos y valida la propuesta de valor con un coste menor que el vídeo.

**Independent Test**: En una página de noticias de prueba, seleccionar una frase con dato, invocar la acción, aceptar el
aviso y obtener un resultado con fuentes abribles, marcado «texto seleccionado por ti en <medio>», sin timestamp.

**Acceptance Scenarios**:

1. **Given** una frase seleccionada en una página web, **When** se elige «Investigar esta afirmación» en el menú contextual, **Then** el panel se abre mostrando la frase, el medio (dominio) y la dirección de la página sin parámetros.
2. **Given** el panel con la frase, **When** aún no se ha confirmado, **Then** no se ha enviado nada al servicio y se muestra exactamente qué se enviará y para qué.
3. **Given** la confirmación, **When** termina la investigación, **Then** el resultado sigue el orden y los estados de 001 (`SUPPORTED`, `CONTRADICTED`, `NEEDS_CONTEXT`, `INSUFFICIENT_EVIDENCE`) y cada conclusión categórica cita evidencia con localizador y fragmento.
4. **Given** un resultado de un artículo, **Then** se indica «texto seleccionado por ti en <medio>» y no aparece minuto ni enlace a vídeo.
5. **Given** una página en la que no se ha invocado la extensión, **Then** la extensión no lee su contenido ni envía nada sobre ella.

---

### User Story 2 - Un mismo motor para artículos y vídeos (Priority: P1)

La persona puede seguir usando la extensión en vídeos de YouTube del catálogo como en 001. Una misma afirmación
investigada desde un artículo o desde un vídeo da el mismo resultado, y lo que ya se investigó por una vía se reutiliza
por la otra.

**Why this priority**: Evita dos productos distintos (riesgo de dispersión) y abarata cada investigación nueva al
compartir la caché entre canales.

**Independent Test**: Investigar una afirmación del vídeo DEMO; después seleccionar la misma frase en una página de
prueba e investigarla; el segundo resultado se reutiliza al instante y coincide en conclusión y fuentes.

**Acceptance Scenarios**:

1. **Given** el flujo de YouTube de 001, **When** se usa tras esta feature, **Then** todas sus pruebas de aceptación siguen pasando sin cambios.
2. **Given** una investigación válida de una afirmación en vídeo, **When** se investiga la misma afirmación desde un artículo, **Then** se reutiliza el resultado sin nueva investigación.
3. **Given** la misma frase seleccionada en dos medios distintos, **Then** la clasificación, la prioridad y el resultado son idénticos.

---

### User Story 3 - Revisar y ajustar la selección antes de enviar (Priority: P2)

Antes de confirmar, la persona puede recortar o corregir el texto seleccionado (por ejemplo, quitar media frase que
sobra) y decidir no enviar la dirección de la página.

**Why this priority**: Las selecciones suelen ser imprecisas; ajustar el texto mejora la calidad y da control sobre qué se
comparte.

**Independent Test**: Seleccionar un párrafo largo, recortarlo a la afirmación, desmarcar «incluir dirección de la
página» y comprobar que solo se envía el texto final.

**Acceptance Scenarios**:

1. **Given** la frase en el panel, **When** se edita, **Then** se investiga el texto editado, que queda registrado como aportado por el usuario.
2. **Given** la opción de no incluir la dirección, **When** se confirma, **Then** solo se envía el texto y el resultado muestra «texto seleccionado por ti» sin medio.
3. **Given** un texto vacío, demasiado corto o mayor que el límite, **When** se intenta enviar, **Then** se rechaza con un mensaje claro y la opción de recortar.
4. **Given** una opinión o predicción, **When** se envía, **Then** se marca `NOT_CHECKABLE` con explicación y no se investiga como hecho.

---

### User Story 4 - Abrir el panel en cualquier página (Priority: P2)

Desde el botón de la extensión, en cualquier página, la persona abre el panel. Si no está en un vídeo compatible, el
panel explica cómo seleccionar una frase y ofrece «Pegar una afirmación» (el modo manual de 001, ahora disponible en
cualquier página).

**Why this priority**: Hace descubrible la acción principal y mantiene el modo manual como alternativa.

**Independent Test**: En una página sin selección, pulsar el botón; el panel muestra la guía y el campo de pegar texto;
investigar una frase pegada.

**Acceptance Scenarios**:

1. **Given** una página que no es un vídeo compatible, **When** se pulsa el botón de la extensión, **Then** el panel muestra «Selecciona una frase y elige Investigar esta afirmación» y «Pegar una afirmación».
2. **Given** un vídeo compatible, **When** se pulsa el botón, **Then** el panel se comporta como en 001.

---

### Edge Cases

- Páginas internas del navegador, tienda de extensiones, visor de PDF o ficheros locales → la acción no está disponible o el panel explica que esa página no es compatible.
- Selección que contiene varias afirmaciones → se pide recortar a una; no se investigan varias a la vez.
- Selección con instrucciones embebidas («ignora lo anterior…») → se trata como texto, sin efecto.
- Dirección de la página con parámetros, identificadores de sesión o fragmentos → nunca se envían; solo origen y ruta.
- Cambio de pestaña o nueva selección con una investigación en curso → el resultado tardío no se mezcla con la nueva selección.
- Afirmación sin periodo o territorio explícitos en la frase → `NEEDS_CONTEXT` con explicación de qué falta, no se inventa.
- Misma frase en dos medios o atribuida a oradores distintos → misma clasificación, prioridad y resultado.
- Ventana privada o perfil sin permisos → la extensión solo actúa si el usuario lo ha permitido en el navegador.
- Backend inaccesible, límite de uso o presupuesto agotado → mismos estados recuperables de 001.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to investigar una frase seleccionada en cualquier página web compatible mediante la acción «Investigar esta afirmación» del menú contextual.
- **FR-002**: La extensión MUST actuar solo por invocación explícita del usuario (menú contextual sobre texto seleccionado o botón de la extensión); nunca analiza páginas automáticamente ni en segundo plano.
- **FR-003**: El acceso a una página MUST ser temporal y limitado a la pestaña donde el usuario invoca la acción; la extensión no obtiene acceso permanente a la navegación salvo a las páginas de vídeo compatibles ya cubiertas por 001.
- **FR-004**: La extensión MUST obtener únicamente el texto seleccionado, la dirección (origen y ruta, sin parámetros ni fragmento) y el título de la página; nunca el cuerpo de la página, otras pestañas ni el historial.
- **FR-005**: Antes de cualquier envío, el panel MUST mostrar exactamente qué se transmite y para qué, y permitir editar el texto y excluir la dirección y el título.
- **FR-006**: El texto a investigar MUST tener entre 10 y 500 caracteres; fuera de ese rango se rechaza con mensaje claro.
- **FR-007**: El servicio MUST NOT descargar, rastrear ni almacenar el contenido de la página de origen; la dirección solo se guarda como procedencia y se muestra al usuario.
- **FR-008**: Cada afirmación seleccionada MUST registrarse con procedencia «selección web» (texto, medio, dirección, título, fecha), sin timestamp, y mostrarse como «texto seleccionado por ti en <medio>».
- **FR-009**: Artículos y vídeos MUST usar el mismo proceso de investigación, la misma política de evidencia y las mismas conclusiones de 001 (FR-005 a FR-008, FR-015, FR-016 de 001).
- **FR-010**: Una investigación válida MUST reutilizarse entre canales cuando coincidan significado normalizado, entidad, territorio, periodo y versión de fuentes (FR-010 de 001), con independencia del canal o del medio.
- **FR-011**: La clasificación, prioridad y resultado MUST ser invariantes al orador, al partido y al medio o dominio de origen.
- **FR-012**: Opiniones y predicciones seleccionadas MUST marcarse `NOT_CHECKABLE` y no investigarse como hechos.
- **FR-013**: El panel MUST abrirse desde el botón de la extensión en cualquier página, mostrando la guía de selección y «Pegar una afirmación» cuando no hay vídeo compatible.
- **FR-014**: En páginas no compatibles (internas del navegador, tienda, visor de PDF, ficheros locales) la acción MUST no ofrecerse o explicar por qué no está disponible.
- **FR-015**: El flujo de YouTube de 001 MUST seguir funcionando sin cambios de comportamiento.
- **FR-016**: Los eventos de producto MUST limitarse a los de 001 más `selection_investigated`, sin dirección ni título de la página ni identidad política.
- **FR-017**: El feedback «Hay un problema con esta investigación» de 001 MUST estar disponible también en resultados de artículos.
- **FR-018**: Los datos simulados MUST mostrarse etiquetados como DEMO, incluidas las páginas de prueba.
- **FR-019**: Quedan fuera de alcance y MUST NOT ofrecerse: análisis automático de páginas, PDFs, redes sociales, análisis de imágenes, chat general y lectura del párrafo circundante.

### Key Entities

- **Afirmación de página (selección web)**: texto final (editado o no), medio (dominio), dirección sin parámetros, título, fecha de selección, indicador de que el usuario excluyó la dirección; inmutable una vez enviada.
- **Investigación**: la de 001, cuyo origen puede ser ahora afirmación de vídeo, texto pegado o selección web.
- **Fuente, Evidencia, Reporte**: sin cambios respecto a 001. La página de origen nunca es una fuente de evidencia.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde la frase seleccionada hasta iniciar la investigación en ≤2 interacciones (menú + confirmar).
- **SC-002**: 0 accesos o envíos sobre páginas donde el usuario no invocó la extensión (suite E2E de navegación).
- **SC-003**: La extensión no pide acceso permanente a sitios distintos de los de 001 (comprobación automática de los permisos declarados).
- **SC-004**: 100 % de pares «misma afirmación desde vídeo y desde artículo» reutilizan la misma investigación válida.
- **SC-005**: 100 % de pares «misma frase, distinto medio» con igual clasificación, prioridad y resultado.
- **SC-006**: 0 envíos de parámetros o fragmentos de la dirección de la página en la suite de pruebas.
- **SC-007**: Se mantienen los umbrales de calidad de 001 (SC-003, SC-004, SC-005, SC-007, SC-008) para afirmaciones de artículos.
- **SC-008**: En validación con usuarios (objetivo provisional), ≥70 % de participantes completan sin ayuda la investigación de una frase de una noticia (gate humano, se documenta como pendiente).

## Assumptions

- Chrome de escritorio, español, España. Ámbito: política española; las primeras fuentes conectadas siguen siendo las de 001 (verificaciones existentes, INE, corpus institucional) sobre economía, empleo y presupuestos.
- El acceso temporal se basa en el permiso que el navegador concede al invocar la extensión en una pestaña (`activeTab`), junto con el menú contextual; el texto seleccionado llega con la propia acción del usuario, sin inyectar código en la página.
- El panel se abre como respuesta directa al gesto del usuario en el menú contextual o el botón.
- Sin el párrafo circundante, muchas afirmaciones terminarán en `NEEDS_CONTEXT`; leer contexto adicional de la página es candidato a P1 tras validar.
- El resultado de un artículo no evalúa al medio ni al artículo, solo la afirmación seleccionada.
- Validación con usuarios, auditoría de calidad y revisión legal de la ampliación se documentan como gates pendientes en `docs/gates.md`.
