import { z } from 'zod';

/** Estados UX obligatorios del panel (PRD §5, FR-009). */
export const UxState = z.enum([
  'idle',
  'unsupported_video',
  'transcript_unavailable',
  'preparing_claims',
  'claims_ready',
  'investigation_pending',
  'investigation_ready',
  'insufficient_evidence',
  'rate_limited',
  'source_unavailable',
  'error',
]);
export type UxState = z.infer<typeof UxState>;

export const CorpusStatus = z.enum(['preparing_claims', 'claims_ready', 'transcript_unavailable']);
export type CorpusStatus = z.infer<typeof CorpusStatus>;

export const AvailabilityStatus = z.enum([...CorpusStatus.options, 'unsupported_video']);
export type AvailabilityStatus = z.infer<typeof AvailabilityStatus>;

export const Conclusion = z.enum(['SUPPORTED', 'CONTRADICTED', 'NEEDS_CONTEXT', 'INSUFFICIENT_EVIDENCE']);
export type Conclusion = z.infer<typeof Conclusion>;

export const JobStatus = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'INSUFFICIENT_EVIDENCE',
  'FAILED',
  'CANCELED',
]);
export type JobStatus = z.infer<typeof JobStatus>;
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  'COMPLETED',
  'INSUFFICIENT_EVIDENCE',
  'FAILED',
  'CANCELED',
];

export const ClaimType = z.enum(['statistic', 'fact', 'opinion', 'prediction', 'uncheckable']);
export type ClaimType = z.infer<typeof ClaimType>;

export const Checkability = z.enum(['CHECKABLE', 'NOT_CHECKABLE']);
export type Checkability = z.infer<typeof Checkability>;

export const EvidenceRelation = z.enum(['supports', 'contradicts', 'context', 'irrelevant']);
export type EvidenceRelation = z.infer<typeof EvidenceRelation>;

export const Provenance = z.enum(['declared_source', 'retrieved_evidence', 'unknown_origin']);
export type Provenance = z.infer<typeof Provenance>;

export const SourceKind = z.enum(['primary', 'secondary', 'factcheck']);
export type SourceKind = z.infer<typeof SourceKind>;

export const CheckStatus = z.enum(['verified', 'unverified', 'link_failed']);
export type CheckStatus = z.infer<typeof CheckStatus>;

export const FailureReason = z.enum([
  'source_unavailable',
  'budget_exceeded',
  'provider_error',
  'no_llm_key',
  'timeout',
]);
export type FailureReason = z.infer<typeof FailureReason>;

export const FeedbackReason = z.enum(['wrong_source', 'wrong_context', 'outdated', 'misquote', 'other']);
export type FeedbackReason = z.infer<typeof FeedbackReason>;

export const EventName = z.enum([
  'panel_opened',
  'investigation_requested',
  'result_opened',
  'source_clicked',
  'feedback_sent',
]);
export type EventName = z.infer<typeof EventName>;

export const ErrorCode = z.enum([
  'unsupported_video',
  'transcript_unavailable',
  'rate_limited',
  'budget_exceeded',
  'source_unavailable',
  'validation',
  'not_found',
  'internal',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;
