# Data and fixture licenses

The code in this repository is distributed under [AGPL-3.0-or-later](LICENSE). Data has its own licenses:

| Path | Origin | License |
|---|---|---|
| `corpus/videos/*` | **DEMO** transcripts and claims written by the project; they do not match any real video or speaker | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `packages/evaluation/data/*.jsonl` | Project evaluation datasets | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `packages/connectors/fixtures/factcheck.synthetic-shape.json` | Synthetic response with the documented Fact Check Tools shape | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `apps/extension/e2e/fixtures/video.webm` | Test pattern generated with `ffmpeg testsrc` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `corpus/documents/*` | Legal texts copied from the BOE | [BOE reuse terms](https://www.boe.es/informacion/aviso_legal/index.php) |
| `packages/connectors/fixtures/ine/*` | Recorded responses from the INE Tempus3 API | [INE legal notice](https://ine.es/dyngs/AYU/index.htm?cid=125) (CC BY 4.0) |

## Attribution of institutional sources

The source terms require these attributions, in Spanish:

- **BOE**: «Fuente de los datos: Agencia Estatal Boletín Oficial del Estado» (<https://www.boe.es>). Distorting the
  meaning of the information is prohibited.
- **INE**: «Fuente: Sitio web del INE: www.ine.es». If the data has been processed, «Elaboración propia con datos
  extraídos del sitio web del INE: www.ine.es». State the last update date when available.

Neither the BOE nor the INE takes part in, sponsors or endorses this project. Each corpus document keeps its source
URL, capture date and terms in its `terms` field.
