import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  Checkability,
  CheckStatus,
  ClaimType,
  Conclusion,
  CorpusStatus,
  EventName,
  EvidenceRelation,
  FailureReason,
  FeedbackReason,
  JobStatus,
  Provenance,
  SourceKind,
  type NormalizedClaim,
  type StatsContext,
} from '@polifamia/contracts';

const enumOf = <T extends string>(name: string, e: { options: T[] }) =>
  pgEnum(name, e.options as [T, ...T[]]);

export const corpusStatus = enumOf('corpus_status', CorpusStatus);
export const claimType = enumOf('claim_type', ClaimType);
export const checkability = enumOf('checkability', Checkability);
export const jobStatus = enumOf('job_status', JobStatus);
export const conclusion = enumOf('conclusion', Conclusion);
export const failureReason = enumOf('failure_reason', FailureReason);
export const sourceKind = enumOf('source_kind', SourceKind);
export const evidenceRelation = enumOf('evidence_relation', EvidenceRelation);
export const provenance = enumOf('provenance', Provenance);
export const checkStatus = enumOf('check_status', CheckStatus);
export const feedbackReason = enumOf('feedback_reason', FeedbackReason);
export const eventName = enumOf('event_name', EventName);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export interface Segment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface Rights {
  holder: string;
  basis: string;
  scope: string;
  importedBy: string;
  licenseUrl?: string;
  evidenceUrl?: string;
  notes?: string;
}

export const videos = pgTable('videos', {
  id: uuid().primaryKey().defaultRandom(),
  youtubeId: text('youtube_id').notNull().unique(),
  title: text(),
  channel: text(),
  language: text().notNull(),
  publishedAt: date('published_at'),
  corpusStatus: corpusStatus('corpus_status').notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: createdAt(),
});

export const transcripts = pgTable(
  'transcripts',
  {
    id: uuid().primaryKey().defaultRandom(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id),
    segments: jsonb().$type<Segment[]>().notNull(),
    revisionHash: text('revision_hash').notNull(),
    rights: jsonb().$type<Rights>().notNull(),
    sourceFormat: text('source_format', { enum: ['srt', 'vtt'] }).notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('transcripts_video_revision_uq').on(t.videoId, t.revisionHash)],
);

export const claims = pgTable(
  'claims',
  {
    id: uuid().primaryKey().defaultRandom(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id),
    transcriptId: uuid('transcript_id')
      .notNull()
      .references(() => transcripts.id),
    literal: text().notNull(),
    context: text().notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    speaker: text(),
    claimType: claimType('claim_type').notNull(),
    checkability: checkability().notNull(),
    normalized: jsonb().$type<NormalizedClaim>().notNull().default({}),
    declaredSource: text('declared_source'),
    rank: integer().notNull(),
    extractor: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('claims_video_idx').on(t.videoId, t.rank)],
);

export const investigations = pgTable(
  'investigations',
  {
    id: uuid().primaryKey().defaultRandom(),
    claimId: uuid('claim_id').references(() => claims.id),
    manualText: text('manual_text'),
    // Solo auditoría; nunca se serializa (spec 002 FR-008).
    manualOrigin: text('manual_origin', { enum: ['web_selection'] }),
    version: integer().notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    cacheKey: text('cache_key').notNull(),
    status: jobStatus().notNull().default('PENDING'),
    conclusion: conclusion(),
    summary: text(),
    context: text(),
    limitations: text(),
    stats: jsonb().$type<StatsContext>(),
    failureReason: failureReason('failure_reason'),
    isDemo: boolean('is_demo').notNull(),
    pipelineVersion: text('pipeline_version'),
    models: jsonb().$type<Record<string, string>>(),
    costEur: numeric('cost_eur', { precision: 10, scale: 5, mode: 'number' }).notNull().default(0),
    latencyMs: integer('latency_ms'),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    supersededBy: uuid('superseded_by'),
    createdAt: createdAt(),
  },
  (t) => [
    check('investigations_claim_xor_manual', sql`(${t.claimId} IS NULL) <> (${t.manualText} IS NULL)`),
    index('investigations_claim_version_idx').on(t.claimId, t.version),
    index('investigations_status_idx').on(t.status),
    index('investigations_cache_key_idx').on(t.cacheKey),
    // Deduplicación de peticiones concurrentes: una sola investigación en curso por clave.
    uniqueIndex('investigations_inflight_uq')
      .on(t.cacheKey)
      .where(sql`${t.status} IN ('PENDING', 'RUNNING')`),
  ],
);

export const sources = pgTable('sources', {
  id: uuid().primaryKey().defaultRandom(),
  canonicalUrl: text('canonical_url').notNull().unique(),
  title: text().notNull(),
  publisher: text().notNull(),
  publishedAt: text('published_at'),
  kind: sourceKind().notNull(),
  terms: text(),
  createdAt: createdAt(),
});

export const evidence = pgTable('evidence', {
  id: uuid().primaryKey().defaultRandom(),
  investigationId: uuid('investigation_id')
    .notNull()
    .references(() => investigations.id),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id),
  locator: text().notNull(),
  excerpt: text().notNull(),
  relation: evidenceRelation().notNull(),
  provenance: provenance().notNull(),
  dataDate: text('data_date'),
  accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull(),
  checkStatus: checkStatus('check_status').notNull().default('unverified'),
});

export const feedback = pgTable('feedback', {
  id: uuid().primaryKey().defaultRandom(),
  investigationId: uuid('investigation_id')
    .notNull()
    .references(() => investigations.id),
  investigationVersion: integer('investigation_version').notNull(),
  reason: feedbackReason().notNull(),
  comment: text(),
  status: text({ enum: ['open', 'resolved'] })
    .notNull()
    .default('open'),
  createdAt: createdAt(),
});

export const events = pgTable(
  'events',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: eventName().notNull(),
    installId: text('install_id').notNull(),
    videoId: text('video_id'),
    investigationId: uuid('investigation_id'),
    createdAt: createdAt(),
  },
  (t) => [index('events_created_idx').on(t.createdAt)],
);
