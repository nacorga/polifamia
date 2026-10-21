# Política de seguridad

## Cómo reportar una vulnerabilidad

**No abras una issue pública.** Usa el reporte privado de GitHub:
[Security → Report a vulnerability](https://github.com/nacorga/polifamia/security/advisories/new).

Incluye los pasos para reproducirla, el impacto y la versión o commit afectado. Plazos orientativos: acuse de recibo
en 5 días laborables y una primera evaluación en 15. Publicaremos el aviso y el crédito, si lo quieres, cuando haya
una corrección.

## Alcance

Nos interesan especialmente:

- **Abuso de la API**: saltarse el rate limit por IP o `X-Install-Id`, o el presupuesto diario
  ([ADR 0004](docs/adr/0004-rate-limit-y-presupuesto.md)).
- **SSRF**: peticiones a hosts fuera de la whitelist de `packages/connectors/src/safe-fetch.ts`.
- **Secretos en la extensión**: claves o configuración del servidor en el bundle que
  `apps/extension/scripts/check-bundle.mjs` no detecte.
- **Integridad de la evidencia**: inyección de prompt (transcripciones, documentos o texto pegado) que haga aparecer
  citas, URLs o cifras fabricadas, o que fuerce `SUPPORTED`/`CONTRADICTED` sin evidencia primaria.
- **Privacidad**: datos de navegación, de otras pestañas o identificadores personales que lleguen al backend.

Fuera de alcance: resultados discutibles que no se deban a un fallo de seguridad. Esos se reportan como
[resultado incorrecto](https://github.com/nacorga/polifamia/issues/new?template=resultado-incorrecto.yml).

## Versiones soportadas

Solo la rama `main`. Todavía no hay versiones publicadas.
