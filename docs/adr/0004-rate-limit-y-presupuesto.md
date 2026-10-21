# ADR 0004 — Rate limit en memoria + presupuesto diario en PostgreSQL

- **Estado**: aceptada (2026-10-21).
- **Contexto**: API sin login; el `installId` de la extensión es falsificable y no es autenticación.
- **Decisión**: ventana fija por minuto en memoria, por IP y por `installId` por separado, solo en
  `POST /v1/investigations` y feedback (el polling no se limita). Presupuesto global diario calculado sobre
  `investigations.cost_eur` del día: al agotarse, `429 budget_exceeded` para trabajo nuevo; la caché se sirve.
  Límites por job (llamadas, tokens, documentos, tiempo) en el worker.
- **Consecuencias**: válido con **una** instancia de API (beta). Con varias instancias, mover el contador a
  PostgreSQL. Los jobs en curso no cuentan hasta terminar: el gasto puede exceder el presupuesto en ≤1 job.
