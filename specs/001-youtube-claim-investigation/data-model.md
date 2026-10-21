# Data Model — 001 MVP

PostgreSQL + Drizzle (`apps/api/src/db/schema.ts`). Tipos compartidos en `packages/contracts`.
Índices obligatorios: `videos.youtube_id`, `investigations(claim_id, version)`, `investigations.status`,
`investigations.cache_key`.

## videos
| campo | tipo | notas |
|---|---|---|
| id | uuid pk | |
| youtube_id | text unique | 11 chars `[A-Za-z0-9_-]` |
| title, channel | text | metadatos públicos permitidos |
| language | text | `es` |
| published_at | date null | |
| corpus_status | enum `preparing_claims \| claims_ready \| transcript_unavailable` | |
| is_demo | bool | fixtures DEMO |

## transcripts
| id uuid pk | video_id fk | segments jsonb `[{startMs,endMs,text}]` | revision_hash text (sha256 del fichero) |
| rights jsonb `{holder, basis, scope, licenseUrl?, evidenceUrl?, notes}` | source_format `srt\|vtt` | imported_at |
Único `(video_id, revision_hash)` → reimportar igual no duplica.

## claims (inmutables en literal/contexto)
| campo | tipo |
|---|---|
| id | uuid pk |
| video_id / transcript_id | fk |
| literal | text — subcadena de la transcripción |
| context | text — tramo circundante |
| start_ms, end_ms | int |
| speaker | text null (solo display; nunca entra en clasificación/prioridad) |
| claim_type | enum `statistic \| fact \| opinion \| prediction \| uncheckable` |
| checkability | enum `CHECKABLE \| NOT_CHECKABLE` |
| normalized | jsonb `{metric?, entity?, territory?, period?, unit?, value?, comparison?}` |
| declared_source | text null — solo si el orador cita fuente explícita |
| rank | int (selección 1..N) |
| extractor | text (`fixture` \| modelo+promptVersion) |

## investigations (versionadas)
| campo | tipo |
|---|---|
| id | uuid pk |
| claim_id | fk null |
| manual_text | text null (CHECK: exactamente uno de claim_id/manual_text) |
| version | int (1.. por claim/cacheKey) |
| idempotency_key | text unique |
| cache_key | text |
| status | `PENDING \| RUNNING \| COMPLETED \| INSUFFICIENT_EVIDENCE \| FAILED \| CANCELED` |
| conclusion | `SUPPORTED \| CONTRADICTED \| NEEDS_CONTEXT \| INSUFFICIENT_EVIDENCE` null |
| summary, context, limitations | text |
| stats | jsonb null `{indicator, unit, territory, period, comparisonBase, formula, result}` |
| failure_reason | text null (`source_unavailable \| budget_exceeded \| provider_error \| no_llm_key`) |
| is_demo | bool |
| pipeline_version, models | text / jsonb |
| cost_eur, latency_ms, tokens_in, tokens_out | numeric/int |
| checked_at, expires_at, created_at | timestamptz |
| superseded_by | uuid null (rectificaciones) |

## sources
| id | canonical_url unique | title | publisher | published_at null | kind `primary\|secondary\|factcheck` | terms text null |

## evidence
| id | investigation_id fk | source_id fk | locator text (página/tabla/serie/URL de consulta) | excerpt text |
| relation `supports\|contradicts\|context\|irrelevant` | provenance `declared_source\|retrieved_evidence\|unknown_origin` |
| data_date text null | accessed_at timestamptz | check_status `verified\|unverified\|link_failed` |

## feedback
| id | investigation_id fk | investigation_version int | reason `wrong_source\|wrong_context\|outdated\|misquote\|other` | comment text (≤1000) null | status `open\|resolved` | created_at |

## events
| id | name enum (FR-017) | install_id text | video_id text null | investigation_id uuid null | created_at |

## Transiciones
- Vídeo: import → `preparing_claims` → (extracción) → `claims_ready`; sin transcripción → `transcript_unavailable`.
- Investigación: `PENDING → RUNNING → COMPLETED | INSUFFICIENT_EVIDENCE | FAILED | CANCELED`.
  `COMPLETED` siempre trae `conclusion`; `FAILED` trae `failure_reason`.
