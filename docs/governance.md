# Gobernanza y neutralidad

Polifamia muestra qué se afirmó, qué fuentes hay y qué prueban. Que se pueda auditar es parte del producto: este
documento explica quién decide y con qué criterios.

## Quién decide

Mantiene el proyecto [@nacorga](https://github.com/nacorga), que decide los merges, la incorporación de fuentes y las
enmiendas a la [constitución](../.specify/memory/constitution.md). Las decisiones que cambian el comportamiento de las
investigaciones se registran como ADR en [`docs/adr/`](adr/) para que el razonamiento quede a la vista.

## Criterios para añadir una fuente

Una fuente solo puede sostener `SUPPORTED`/`CONTRADICTED` si cumple todo esto:

1. **Primaria e institucional**: publica el dato original (INE, BOE, AIReF…), no un resumen de medios.
2. **Reutilizable**: tiene condiciones de reutilización documentadas, que se añaden a
   [`DATA-LICENSE.md`](../DATA-LICENSE.md).
3. **Determinista**: un conector que consulta un localizador exacto (serie, periodo, artículo) por `safe-fetch`
   con el host en la whitelist, nunca búsqueda libre.
4. **Probada**: una respuesta real grabada como fixture y tests del conector.

Dónde se registra: las series del INE en `packages/connectors/src/ine/registry.ts` y los documentos institucionales
en `corpus/documents/` (`pnpm --filter @polifamia/connectors record:fixtures`). Cualquier otro origen necesita un ADR.
Las verificaciones de terceros (Fact Check Tools) cuentan como contexto, nunca como certificación
([ADR 0002](adr/0002-politica-de-evidencia.md)).

Para proponer una fuente, usa la plantilla [«Proponer fuente»](https://github.com/nacorga/polifamia/issues/new?template=proponer-fuente.yml).

## Cómo se disputa un resultado

- Desde la extensión, con «Hay un problema con esta investigación».
- En GitHub, con la plantilla [«Resultado incorrecto»](https://github.com/nacorga/polifamia/issues/new?template=resultado-incorrecto.yml),
  indicando la afirmación, la evidencia citada y qué falla.

Si el error se debe a datos, código o política, se corrige y se genera una **versión nueva** de la investigación.
Las anteriores no se borran: quedan marcadas como sustituidas. Un desacuerdo sin evidencia nueva no cambia un
resultado.

## Lo que nunca se acepta

- Lógica que dependa del orador, del partido o de la identidad política, o rankings y notas de políticos.
- Que el LLM decida la conclusión o introduzca URLs, citas o cifras que no estén en la evidencia recuperada.
- Scraping de YouTube o contenido sin derechos documentados.
- Datos simulados sin la etiqueta DEMO.
- Financiación o colaboraciones que condicionen qué se investiga o cómo se presenta. Si existe alguna, se declarará
  en este documento.
