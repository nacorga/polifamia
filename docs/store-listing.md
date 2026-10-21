# Chrome Web Store — ficha y envío (beta privada)

Visibilidad recomendada: **Privada** (solo los emails de «testers de confianza») durante la beta; después se cambia a
pública en la misma ficha, sin reinstalar. Ver `docs/gates.md` (G4, G5) antes de hacerla pública.

## Antes de enviar (tú)

- [ ] Cuenta de desarrollador de Chrome Web Store (pago único de 5 $) y email de contacto verificado.
- [ ] API desplegada con su URL definitiva (`docs/deploy.md`) y zip generado con esa URL.
- [ ] Política de privacidad publicada: completar en `docs/privacy.md` responsable del tratamiento y contacto
      (hoy «pendiente de definir»). URL a usar: `https://github.com/nacorga/polifamia/blob/main/docs/privacy.md`.
- [ ] Icono definitivo: `apps/extension/public/icon/{16,32,48,128}.png` son **provisionales** (lupa sobre azul). Al sustituirlos, copiar el de 32 px a `site/favicon.png`.
- [ ] Capturas 1280×800 (mínimo 1): panel con una selección en un artículo y un resultado con fuentes.

## Ficha

- **Nombre**: Polifamia — investigar afirmaciones
- **Resumen** (≤132 caracteres): Selecciona una frase de una noticia y contrástala con fuentes originales y datos
  oficiales. Solo actúa cuando la invocas.
- **Categoría**: Herramientas / Productividad
- **Idioma**: español
- **Descripción**:

  > Polifamia te ayuda a contrastar afirmaciones factuales sobre política española (economía, empleo, presupuestos)
  > mientras lees. Selecciona una frase en cualquier noticia, haz clic derecho y elige «Investigar esta afirmación».
  > El panel lateral te muestra qué dicen las evidencias, el contexto que falta y las fuentes originales (verificaciones
  > publicadas, INE, documentos institucionales), con enlace a cada una.
  >
  > - Solo actúa cuando la invocas: nunca analiza páginas por su cuenta.
  > - Solo envía el texto de la frase; el medio, la dirección y el título de la página no salen de tu navegador.
  > - No evalúa medios ni personas, solo la afirmación. Las opiniones y predicciones se marcan como no verificables.
  > - Beta: los resultados pueden contener errores; usa «Hay un problema con esta investigación» para avisarnos.

## Prácticas de privacidad (formulario)

**Propósito único**: investigar afirmaciones factuales que el usuario elige (texto seleccionado o pegado) y mostrar la
evidencia y las fuentes en el panel lateral.

**Justificación de permisos**:

| Permiso | Justificación |
|---|---|
| `contextMenus` | Añade «Investigar esta afirmación» al menú contextual solo cuando hay texto seleccionado. Es la forma de invocar la extensión en un artículo. |
| `activeTab` | Al usar ese menú o el icono, da acceso temporal a la pestaña invocada para mostrar en el panel el título de la página. No se lee el contenido de la página ni otras pestañas. |
| `sidePanel` | La interfaz (texto a investigar, progreso, resultado y fuentes) se muestra en el panel lateral. |
| `storage` | Guarda un identificador anónimo de instalación (cuotas de uso) y, en memoria de sesión, la selección hasta que el usuario la envía o la cancela. |
| Host `*://*.youtube.com/*` | En vídeos de YouTube lee el identificador del vídeo y el tiempo del reproductor para mostrar y sincronizar las afirmaciones de vídeos autorizados. No lee subtítulos, comentarios ni la cuenta. |
| Host del API de Polifamia | Envía la afirmación elegida y recibe la investigación. |
| Código remoto | No. Todo el código va en el paquete; CSP `script-src 'self'`. |

**Datos recogidos** (marcar en el formulario): «Contenido del sitio web» → solo el texto que el usuario selecciona o
pega y envía de forma explícita. No se recogen datos de identificación personal, salud, finanzas, autenticación,
comunicaciones personales, ubicación, historial web ni actividad del usuario más allá de eventos de uso anónimos
(`docs/privacy.md`).

**Certificaciones**: no se venden datos a terceros; no se usan para fines ajenos al propósito único; no se usan para
determinar solvencia ni préstamos.

## Envío

1. Developer Dashboard → «Add new item» → sube el zip.
2. Rellena ficha, prácticas de privacidad y distribución (Privada + emails de testers).
3. Envía a revisión (habitualmente de 1 a varios días; los permisos de host pueden alargarla).
4. Al aprobarse, comparte el enlace de la ficha con los testers.
