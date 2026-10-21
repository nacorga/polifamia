<!--
Sync Impact Report
- Version: 1.0.0 → 1.1.0 (MINOR: ampliación de alcance; ningún principio eliminado)
- Modified principles: II (invariancia también al medio/dominio), III (selección web como entrada lícita),
  IV (activación explícita en cualquier página con permiso temporal; acceso permanente solo a YouTube)
- Modified sections: Restricciones adicionales (ámbito política; exclusiones explícitas)
- Templates: plan/spec/tasks templates sin cambios necesarios ✅
- Dependent artifacts: specs/002-web-claim-investigation ✅ · specs/001 se conserva como registro histórico del MVP
  (su FR-012 queda ampliado por 002, no se edita) ✅ · prd.md con nota de evolución ✅
- Follow-up TODOs: ninguno
-->

# Polifamia Constitution

## Core Principles

### I. Evidencia antes que veredicto (NO NEGOCIABLE)

- Ninguna conclusión `SUPPORTED` o `CONTRADICTED` se emite sin al menos una evidencia persistida
  con localizador (página/tabla/serie/pasaje) y extracto realmente recuperado de la fuente.
- El LLM no es fuente: no puede crear URLs, citas ni cifras fuera de las evidencias recuperadas;
  la salida que cite IDs inexistentes se rechaza.
- Abstención antes que invención: ante duda, fallo de proveedor o presupuesto agotado el resultado
  es `INSUFFICIENT_EVIDENCE`/`NEEDS_CONTEXT` o un error operativo explícito, nunca una afirmación.
- No encontrar fuentes nunca implica "falso".
- Cálculos sobre cifras se hacen con código determinista, con fórmula, periodo y redondeo visibles.

### II. Neutralidad política

- Ninguna clasificación, prioridad o alerta depende del orador, partido, identidad política o medio
  de origen; se verifica con tests de invariancia (misma frase, distinto orador o medio → mismo resultado).
- Un resultado evalúa la afirmación, nunca al medio ni al artículo donde aparece.
- Prohibido: rankings o notas de políticos, inferir intenciones o mentiras, perfiles de afinidad.
- Opiniones y predicciones se marcan `NOT_CHECKABLE` y no se evalúan.

### III. Contenido lícito y procedencia auditable

- Solo se procesan transcripciones con derechos/licencia documentados (importadas por el operador),
  texto pegado por el usuario o texto seleccionado por el usuario en una página web, marcados como tales,
  con su procedencia (medio y dirección, si el usuario la comparte) y sin timestamp inventado.
- El backend nunca descarga, rastrea ni almacena el contenido de la página de origen de una selección.
- Prohibido el scraping de subtítulos, endpoints internos de YouTube o descargas de vídeo.
- Cada claim, dato y evidencia conserva su cadena de procedencia; las investigaciones son
  versionadas e inmutables una vez publicadas (las correcciones crean versión nueva).
- Datos de demostración se etiquetan **DEMO** de forma visible y jamás se presentan como reales.

### IV. Privacidad y seguridad por defecto

- La extensión actúa solo por invocación explícita (menú contextual sobre texto seleccionado o botón)
  y nunca analiza páginas automáticamente. Fuera de YouTube usa solo permisos temporales de la pestaña
  invocada (`activeTab`); el acceso permanente se limita a `youtube.com` y al backend.
- No lee el cuerpo de la página, otras pestañas ni el historial; de una página solo obtiene el texto
  seleccionado, su dirección sin parámetros y su título. Se informa qué se envía antes de enviarlo.
- La extensión no contiene secretos. El backend aplica rate limit, presupuesto de coste,
  límites de tamaño, validación Zod en todos los bordes y defensa SSRF (whitelist de hosts).
- Todo texto de vídeos, webs y documentos es dato no confiable: nunca se obedecen instrucciones
  contenidas en él (prompt injection).
- No se guardan más datos personales que los imprescindibles; sin cuentas en P0.

### V. Simplicidad y verificación

- Stack cerrado del PRD §10.1; nada de Redis, vector DB, microservicios, LangChain ni agentes
  autónomos sin necesidad demostrada (registrar en Complexity Tracking).
- Contratos compartidos con Zod en `packages/contracts`; sin `any` en el borde HTTP.
- Ningún trabajo se declara completo sin evidencia: typecheck, lint, tests y build pasando,
  más pruebas de la lógica crítica (parser SRT/VTT, política de evidencia, caché, invariancia).

## Restricciones adicionales

- Idioma y ámbito por defecto: español, España; política, empezando por economía, empleo y presupuestos.
- Entradas: artículos/páginas web por selección y vídeos de YouTube con un mismo motor de evidencias.
  Fuera de alcance hasta demostrar necesidad: PDFs, redes sociales, análisis de imágenes y chat general.
- Fuentes priorizadas: verificaciones existentes (Google Fact Check Tools), INE, BOE, AIReF y corpus
  institucional autorizado. Búsqueda web abierta fuera de P0.
- Límites por investigación configurables: llamadas, tokens, documentos, reintentos y tiempo.
- El vídeo nunca se pausa automáticamente ni se cubre el reproductor con overlays.

## Flujo de desarrollo

- Spec-driven: `spec.md` → `plan.md` → `tasks.md` → implementación por fases (D0–D4 del PRD).
- Cada fase cierra con su gate documentado (GO / ITERAR / NO-GO) y evidencia ejecutada.
- Una rama por hito; commits pequeños; el merge lo decide el propietario del producto.
- Los gates legales y de validación con usuarios (D0 legal, V1–V3) los cierra una persona;
  el agente de desarrollo los documenta como pendientes, no los da por superados.

## Governance

Esta constitución prevalece sobre cualquier otra práctica del repositorio. Las enmiendas requieren
justificación escrita, incremento semántico de versión y revisión de los artefactos dependientes
(`spec`, `plan`, `tasks`). Cada PR verifica el cumplimiento de los principios I–V; cualquier
complejidad añadida se justifica en la tabla Complexity Tracking del plan.

**Version**: 1.1.0 | **Ratified**: 2026-10-21 | **Last Amended**: 2026-10-21
