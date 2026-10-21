import { z } from 'zod';
import {
  AvailabilityStatus,
  Checkability,
  CheckStatus,
  ClaimType,
  Conclusion,
  ErrorCode,
  EventName,
  EvidenceRelation,
  FailureReason,
  FeedbackReason,
  JobStatus,
  Provenance,
  SourceKind,
} from './enums.js';

export const YoutubeId = z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'invalid YouTube video id');
export const IsoDateTime = z.iso.datetime({ offset: true });

export const ErrorResponse = z.object({ error: z.object({ code: ErrorCode, message: z.string() }) });
export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const Health = z.object({ status: z.literal('ok'), db: z.boolean() });

export const NormalizedClaim = z
  .object({
    metric: z.string(),
    entity: z.string(),
    territory: z.string(),
    period: z.string(),
    unit: z.string(),
    value: z.number(),
    comparison: z.string(),
  })
  .partial();
export type NormalizedClaim = z.infer<typeof NormalizedClaim>;

export const Availability = z.object({
  videoId: YoutubeId,
  status: AvailabilityStatus,
  isDemo: z.boolean(),
  title: z.string().optional(),
  rights: z.object({ holder: z.string(), basis: z.string() }).optional(),
});
export type Availability = z.infer<typeof Availability>;

export const Claim = z.object({
  id: z.uuid(),
  literal: z.string(),
  context: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  claimType: ClaimType,
  checkability: Checkability,
  normalized: NormalizedClaim,
  declaredSource: z.string().nullable(),
  rank: z.number().int(),
  isDemo: z.boolean(),
});
export type Claim = z.infer<typeof Claim>;

export const ClaimsResponse = z.object({ videoId: YoutubeId, claims: z.array(Claim) });
export type ClaimsResponse = z.infer<typeof ClaimsResponse>;

export const MANUAL_CLAIM_MIN = 10;
export const MANUAL_CLAIM_MAX = 500;

const IdempotencyKey = z.string().min(8).max(128);
export const CreateInvestigation = z.union([
  z.strictObject({ claimId: z.uuid(), idempotencyKey: IdempotencyKey }),
  z.strictObject({
    manualClaim: z.string().trim().min(MANUAL_CLAIM_MIN).max(MANUAL_CLAIM_MAX),
    idempotencyKey: IdempotencyKey,
  }),
]);
export type CreateInvestigation = z.infer<typeof CreateInvestigation>;

export const StatsContext = z.object({
  indicator: z.string(),
  unit: z.string(),
  territory: z.string(),
  period: z.string(),
  comparisonBase: z.string().nullable(),
  formula: z.string().nullable(),
  result: z.string().nullable(),
});
export type StatsContext = z.infer<typeof StatsContext>;

export const Source = z.object({
  url: z.url(),
  title: z.string(),
  publisher: z.string(),
  publishedAt: z.string().nullable(),
  kind: SourceKind,
});
export type Source = z.infer<typeof Source>;

export const Evidence = z.object({
  id: z.uuid(),
  relation: EvidenceRelation,
  provenance: Provenance,
  locator: z.string(),
  excerpt: z.string(),
  dataDate: z.string().nullable(),
  accessedAt: IsoDateTime,
  checkStatus: CheckStatus,
  source: Source,
});
export type Evidence = z.infer<typeof Evidence>;

export const InvestigationClaim = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('video'), claimId: z.uuid(), literal: z.string(), startMs: z.number().int() }),
  z.object({ kind: z.literal('manual'), text: z.string() }),
]);

export const Investigation = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  status: JobStatus,
  conclusion: Conclusion.nullable(),
  isDemo: z.boolean(),
  claim: InvestigationClaim,
  summary: z.string().nullable(),
  context: z.string().nullable(),
  limitations: z.string().nullable(),
  stats: StatsContext.nullable(),
  evidence: z.array(Evidence),
  failureReason: FailureReason.nullable(),
  checkedAt: IsoDateTime.nullable(),
  expiresAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type Investigation = z.infer<typeof Investigation>;

export const CreateFeedback = z.strictObject({
  reason: FeedbackReason,
  comment: z.string().trim().max(1000).optional(),
});
export type CreateFeedback = z.infer<typeof CreateFeedback>;

export const FeedbackCreated = z.object({ id: z.uuid(), status: z.literal('open') });

export const CreateEvent = z.strictObject({
  name: EventName,
  videoId: YoutubeId.optional(),
  investigationId: z.uuid().optional(),
});
export type CreateEvent = z.infer<typeof CreateEvent>;
