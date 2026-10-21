# ADR 0001 — Ruta de contenido: catálogo autorizado + entrada manual

- **Estado**: aceptada (2026-10-21) · gate legal G0 pendiente.
- **Contexto**: `captions.download` exige permiso de edición y las políticas de YouTube limitan extracción y
  almacenamiento. El PRD §8 prohíbe scraping.
- **Decisión**: solo se procesan transcripciones `.srt`/`.vtt` importadas por el operador con `rights.json`
  obligatorio (titular, base, alcance) y texto pegado por el usuario, marcado como tal y sin timestamp.
  Hasta tener permisos reales, el catálogo son 2 vídeos DEMO etiquetados.
- **Consecuencias**: cobertura limitada y manual; sin dependencia de interfaces internas de YouTube.
  Ampliar cobertura requiere superar G0 con revisión jurídica.
