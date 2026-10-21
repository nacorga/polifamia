import type {
  Conclusion,
  EvidenceRelation,
  FailureReason,
  NormalizedClaim,
  Provenance,
  SourceKind,
  StatsContext,
} from '@polifamia/contracts';

/** Lo que el worker entrega al investigador. Texto no confiable: se trata como datos. */
export interface InvestigationInput {
  kind: 'video' | 'manual';
  literal: string;
  context: string | null;
  normalized: NormalizedClaim;
  declaredSource: string | null;
}

export interface InvestigationLimits {
  timeoutMs: number;
  maxLlmCalls: number;
  maxTokens: number;
  maxDocuments: number;
}

export interface FoundEvidence {
  source: { url: string; title: string; publisher: string; publishedAt: string | null; kind: SourceKind };
  locator: string;
  excerpt: string;
  relation: EvidenceRelation;
  provenance: Provenance;
  dataDate: string | null;
}

export interface InvestigationOutcome {
  status: 'COMPLETED' | 'INSUFFICIENT_EVIDENCE';
  conclusion: Conclusion;
  summary: string;
  context: string | null;
  limitations: string;
  stats: StatsContext | null;
  evidence: FoundEvidence[];
  isDemo: boolean;
  pipelineVersion: string;
  models: Record<string, string>;
  costEur: number;
  tokensIn: number;
  tokensOut: number;
  /** Validez del resultado antes de considerarlo caducado. */
  ttlMs: number;
}

/** Observabilidad por etapa (PRD §10.7): solo métricas y recuentos, nunca textos de la afirmación. */
export type StageTrace = (stage: string, data: Record<string, number | string | boolean>) => void;

export interface Investigator {
  investigate(
    input: InvestigationInput,
    limits: InvestigationLimits,
    trace?: StageTrace,
  ): Promise<InvestigationOutcome>;
}

/** Error operativo: el job termina FAILED con este motivo, nunca con una conclusión inventada. */
export class InvestigationFailure extends Error {
  constructor(
    readonly reason: FailureReason,
    message: string,
  ) {
    super(message);
  }
}
