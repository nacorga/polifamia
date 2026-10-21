# API Contract — cambios de 002

Base: `specs/001-youtube-claim-investigation/contracts/api.md`. Fuente de verdad: schemas Zod en `packages/contracts/src`.

## POST /v1/investigations

Request (unión estricta; campos extra → `400 validation`):

```
{ claimId: uuid, idempotencyKey }
| { manualClaim: string(10..500, trim), origin?: "web_selection", idempotencyKey }
```

Comportamiento añadido para `manualClaim`:

1. Si `normalizeText(manualClaim)` coincide con el literal normalizado de una afirmación del catálogo → se trata como
   `{ claimId }` de esa afirmación (caché de vídeo; la respuesta trae `claim.kind = "video"`).
2. Afirmación (directa o resuelta) con `checkability ≠ CHECKABLE` → `400 { error: { code: "not_checkable" } }`.
3. Sin coincidencia → flujo manual de 001; se guarda `origin` como `manual_origin`.

Respuesta: `Investigation` sin cambios. En modo real puede terminar `FAILED` con `failureReason = "not_checkable"`.

## Errores

`code ∈` los de 001 `| not_checkable`.

## POST /v1/events

`name ∈` los de 001 `| selection_investigated` (con `investigationId`). Sigue sin aceptar URL, título ni texto.

## Mensajes de la extensión

Sin mensajes nuevos: el background entrega la selección al panel vía `storage.session` (ver `data-model.md`).
