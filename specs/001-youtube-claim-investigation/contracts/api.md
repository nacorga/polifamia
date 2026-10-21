# API Contract — v1

Fuente de verdad: schemas Zod en `packages/contracts/src`. `GET /openapi.json` se genera desde ellos
(`z.toJSONSchema`). Todas las respuestas de error: `{ error: { code, message } }` con
`code ∈ unsupported_video | transcript_unavailable | rate_limited | source_unavailable | validation | not_found | internal`.
Cabeceras: `X-Install-Id` (UUID anónimo de la extensión), `X-Correlation-Id` (opcional, se devuelve).

| Método | Ruta | Request | Response |
|---|---|---|---|
| GET | `/health` | — | `200 {status:"ok", db:boolean}` |
| GET | `/v1/videos/:videoId/availability` | `videoId` regex `^[A-Za-z0-9_-]{11}$` | `200 {videoId, status: "claims_ready"\|"preparing_claims"\|"transcript_unavailable"\|"unsupported_video", isDemo, title?, rights?: {holder, basis}}` |
| GET | `/v1/videos/:videoId/claims` | — | `200 {videoId, claims: Claim[]}` · `404 unsupported_video` |
| POST | `/v1/investigations` | `{ claimId: uuid, idempotencyKey } \| { manualClaim: string(10..500), idempotencyKey }` | `200 Investigation` (caché válida) · `202 Investigation` (PENDING/RUNNING) · `429 rate_limited` |
| GET | `/v1/investigations/:id` | — | `200 Investigation` |
| POST | `/v1/investigations/:id/feedback` | `{ reason, comment? }` | `201 {id, status:"open"}` |
| POST | `/v1/events` | `{ name, videoId?, investigationId? }` | `204` |

## Claim
`{ id, literal, context, startMs, endMs, claimType, checkability, normalized, declaredSource|null, rank, isDemo }`
(sin `speaker` en la API para no inducir sesgo visual; FR-019).

## Investigation
```
{ id, version, status, conclusion|null, isDemo,
  claim: { kind: "video", claimId, literal, startMs } | { kind: "manual", text },
  summary|null, context|null, limitations|null, stats|null,
  evidence: [{ id, relation, provenance, locator, excerpt, dataDate|null, accessedAt, checkStatus,
               source: { url, title, publisher, publishedAt|null, kind } }],
  failureReason|null, checkedAt|null, expiresAt|null, createdAt }
```

## Mensajes extensión (`packages/contracts/src/messages.ts`)
- content → background/panel: `video:state { tabId, videoId|null, currentTime, paused }`,
  `video:navigated { tabId, videoId|null }`.
- panel → content: `video:seek { requestId, videoId, seconds }` → respuesta `{ requestId, ok, currentTime }`
  (se ignora si `videoId` ya no es el activo).
- panel → content: `video:getState { requestId }`.
