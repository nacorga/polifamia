# Privacidad y tratamiento de datos (beta cerrada)

> Borrador técnico para revisión jurídica (PRD §11). No es todavía la política de privacidad pública.

## Qué hace la extensión

- Solo actúa cuando abres el panel lateral en una pestaña de YouTube. Permisos: `sidePanel`, `storage` y
  acceso a `youtube.com` y al servidor de Polifamia. **No** pide `tabs` ni acceso a otras webs: no puede
  leer la URL ni el contenido de pestañas que no sean de YouTube.
- En YouTube lee solo el identificador del vídeo (de la URL) y el estado del reproductor (tiempo, pausa)
  para sincronizar las afirmaciones. No lee subtítulos, comentarios ni tu cuenta.
- Nunca pausa el vídeo ni dibuja sobre el reproductor.

## Qué se envía al servidor y para qué

| Dato | Cuándo | Para qué |
|---|---|---|
| ID del vídeo de YouTube | al abrir el panel en un vídeo | saber si está en el catálogo autorizado |
| ID de la afirmación elegida | al pulsar «Investigar» | investigarla (el servidor usa su propia copia del texto) |
| Texto que pegas | al enviar «Pegar una afirmación», tras aviso | investigarlo; queda marcado como aportado por el usuario |
| Motivo y comentario opcional | al reportar un problema | revisar la investigación |
| `installId` anónimo (UUID aleatorio local) | en cada petición | cuotas de uso y métricas agregadas; no es una cuenta |
| Eventos `panel_opened`, `investigation_requested`, `result_opened`, `source_clicked`, `feedback_sent` | al ocurrir | métricas de uso del §12 |

No se envía historial de navegación, identidad, preferencias políticas ni texto de otras páginas.
El servidor no infiere afinidad política ni construye perfiles.

## Proveedores

- **LLM (Anthropic)**: recibe el texto de la afirmación y los extractos de fuentes públicas para normalizar,
  relacionar y redactar la explicación. No recibe `installId`, IP ni datos del usuario.
- **Google Fact Check Tools**: recibe la afirmación como consulta de búsqueda.
- **INE**: recibe consultas de series estadísticas públicas (sin datos del usuario).
- Pendiente: acuerdos de tratamiento de datos (DPA) con cada proveedor antes de la beta pública.

## Retención

| Dato | Retención | Mecanismo |
|---|---|---|
| Eventos de producto | 30 días | job programado `retention-purge` (pg-boss, diario 03:17 UTC) |
| Logs técnicos | 14 días | retención de logs de la plataforma (App Platform); los logs no incluyen textos ni IP |
| Investigaciones y evidencias | mientras el resultado sea publicable | versionadas; las correcciones crean versión nueva |
| Texto manual pegado | con su investigación | pendiente de decisión legal (propuesta: 90 días) |
| Reportes de problema | hasta su resolución | sin datos personales salvo lo que se escriba en el comentario |

La IP se usa solo en memoria para el rate limit (ventana de 1 minuto) y no se persiste.

## Contacto y derechos

- Rectificaciones de investigaciones: «Hay un problema con esta investigación» en el panel.
- Contacto de privacidad y eliminación: **pendiente de definir** por el responsable del tratamiento.

## Pendiente de revisión humana

- Base jurídica, responsable del tratamiento y contacto (RGPD).
- Requisitos de Chrome Web Store (Limited Use) y formulario de prácticas de privacidad.
- Retención definitiva de texto manual e investigaciones.
