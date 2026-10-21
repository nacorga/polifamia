# Privacidad y tratamiento de datos (beta cerrada)

> Borrador técnico para revisión jurídica (PRD §11). No es todavía la política de privacidad pública.

## Qué hace la extensión

- Solo actúa cuando la invocas: el icono de la extensión (abre el panel en cualquier pestaña) o el menú
  contextual «Investigar esta afirmación» sobre un texto seleccionado. Nunca analiza páginas por su cuenta.
- Permisos: `activeTab`, `contextMenus`, `sidePanel`, `storage` y acceso permanente solo a `youtube.com` y al
  servidor de Polifamia. **No** pide `tabs` ni acceso a otras webs: no puede leer la URL ni el contenido de
  pestañas que no sean de YouTube salvo en la pestaña donde usas el menú, y solo en ese momento.
- Fuera de YouTube, al usar el menú obtiene únicamente el texto seleccionado, la dirección de la página
  reducida a origen y ruta (sin parámetros ni fragmento) y su título. No lee el resto de la página, otras
  pestañas ni el historial. Esa selección se guarda en memoria del navegador (`storage.session`) hasta que la
  envías, la cancelas o cierras la pestaña.
- En YouTube lee solo el identificador del vídeo (de la URL) y el estado del reproductor (tiempo, pausa)
  para sincronizar las afirmaciones. No lee subtítulos, comentarios ni tu cuenta.
- Nunca pausa el vídeo ni dibuja sobre el reproductor.

## Qué se envía al servidor y para qué

| Dato | Cuándo | Para qué |
|---|---|---|
| ID del vídeo de YouTube | al abrir el panel en un vídeo | saber si está en el catálogo autorizado |
| ID de la afirmación elegida | al pulsar «Investigar» | investigarla (el servidor usa su propia copia del texto) |
| Texto que pegas | al enviar «Pegar una afirmación», tras aviso | investigarlo; queda marcado como aportado por el usuario |
| Texto que seleccionas en una web (posiblemente editado) y la marca `web_selection` | al pulsar «Investigar» en el panel, tras aviso | investigarlo; queda marcado como selección web |
| Motivo y comentario opcional | al reportar un problema | revisar la investigación |
| `installId` anónimo (UUID aleatorio local) | en cada petición | cuotas de uso y métricas agregadas; no es una cuenta |
| Eventos `panel_opened`, `investigation_requested`, `result_opened`, `source_clicked`, `feedback_sent`, `selection_investigated` | al ocurrir | métricas de uso del §12; nunca llevan dirección, título ni texto |

El medio, la dirección y el título de la página donde seleccionas el texto **no se envían**: solo se muestran
en el panel. Una investigación puede reutilizarse para otros usuarios con la misma afirmación, así que no
puede llevar datos de tu navegación. El servidor nunca descarga ni rastrea la página de origen.

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
| Texto manual pegado o seleccionado | con su investigación | pendiente de decisión legal (propuesta: 90 días) |
| Reportes de problema | hasta su resolución | sin datos personales salvo lo que se escriba en el comentario |

La IP se usa solo en memoria para el rate limit (ventana de 1 minuto) y no se persiste.

## Contacto y derechos

- Rectificaciones de investigaciones: «Hay un problema con esta investigación» en el panel.
- Contacto de privacidad y eliminación: **pendiente de definir** por el responsable del tratamiento.

## Pendiente de revisión humana

- Base jurídica, responsable del tratamiento y contacto (RGPD).
- Requisitos de Chrome Web Store (Limited Use) y formulario de prácticas de privacidad, incluida la
  justificación de `contextMenus` y `activeTab`.
- Retención definitiva de texto manual e investigaciones.
