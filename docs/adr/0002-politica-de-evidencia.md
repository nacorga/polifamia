# ADR 0002 — La conclusión la decide código determinista, no el LLM

- **Estado**: aceptada (2026-10-21).
- **Contexto**: el principal riesgo del producto es una conclusión tajante sin respaldo o con citas inventadas.
- **Decisión**: `packages/investigation/src/evidence-policy.ts` fija la conclusión a partir de evidencias
  persistidas con localizador y extracto. Solo fuentes primarias (INE, corpus institucional) pueden sostener
  `SUPPORTED`/`CONTRADICTED`; las verificaciones de terceros son contexto. Las cifras INE se comparan con
  `stats.ts` (homogeneidad de indicador, unidad, territorio y periodo). El LLM solo propone relaciones por
  `evidenceId` y redacta; su texto se valida (IDs existentes, sin URLs, sin cifras ajenas) o se sustituye por
  una plantilla. Ante fallo de fuente o presupuesto: `FAILED` con motivo, nunca conclusión.
- **Consecuencias**: más abstenciones (`INSUFFICIENT_EVIDENCE`/`NEEDS_CONTEXT`) a cambio de 0 citas inventadas;
  ampliar cobertura exige añadir conectores y series, no relajar la política.
