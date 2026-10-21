# ADR 0003 — Proveedor LLM encapsulado (Anthropic por defecto)

- **Estado**: aceptada provisionalmente (2026-10-21) · comparación de modelos pendiente (G3).
- **Contexto**: el PRD pide no comprometerse con un modelo antes de medir precisión y coste.
- **Decisión**: interfaz mínima `LlmClient` (salida estructurada validada con Zod, registro de modelo,
  `promptVersion`, tokens y coste). Implementación por defecto con el SDK de Anthropic; modelos por entorno
  (`LLM_MODEL_EXTRACT` económico, `LLM_MODEL_SYNTH` más capaz). Sin clave, `demo` o `FAILED/no_llm_key`.
- **Consecuencias**: cambiar de proveedor = una implementación nueva de `LlmClient`. Pendiente ejecutar
  `eval:extraction -- --real` y `eval:investigation -- --real` y elegir modelos con datos.
