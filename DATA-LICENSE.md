# Licencias de datos y fixtures

El código de este repositorio se distribuye bajo [AGPL-3.0-or-later](LICENSE). Los datos tienen licencias propias:

| Ruta | Origen | Licencia |
|---|---|---|
| `corpus/videos/*` | Transcripciones y claims **DEMO** redactados por el proyecto; no corresponden a vídeos ni oradores reales | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es) |
| `packages/evaluation/data/*.jsonl` | Datasets de evaluación del proyecto | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es) |
| `packages/connectors/fixtures/factcheck.synthetic-shape.json` | Respuesta sintética con la forma documentada de Fact Check Tools | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es) |
| `apps/extension/e2e/fixtures/video.webm` | Patrón de prueba generado con `ffmpeg testsrc` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es) |
| `corpus/documents/*` | Textos legales copiados del BOE | [Condiciones de reutilización del BOE](https://www.boe.es/informacion/aviso_legal/index.php) |
| `packages/connectors/fixtures/ine/*` | Respuestas grabadas de la API Tempus3 del INE | [Aviso legal del INE](https://ine.es/dyngs/AYU/index.htm?cid=125) (CC BY 4.0) |

## Atribución de fuentes institucionales

- **BOE**: «Fuente de los datos: Agencia Estatal Boletín Oficial del Estado» (<https://www.boe.es>). Está prohibido
  desnaturalizar el sentido de la información.
- **INE**: «Fuente: Sitio web del INE: www.ine.es». Si los datos se han tratado, «Elaboración propia con datos
  extraídos del sitio web del INE: www.ine.es». Indicar la fecha de última actualización cuando conste.

Ni el BOE ni el INE participan en este proyecto, lo patrocinan o lo respaldan. Cada documento del corpus conserva
su URL de origen, la fecha de captura y sus condiciones en el campo `terms`.
