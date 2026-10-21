import type { NormalizedClaim } from '@polifamia/contracts';
import { decideConclusion } from './evidence-policy.js';
import { templateExplanation, type ExplanationGenerator } from './explain.js';
import { LlmClaimExtractor } from './extract.js';
import type { LlmClient, LlmRequest, LlmUsage } from './llm/client.js';
import type { Candidate, EvidenceRetriever, Origin } from './retrieve.js';
import {
  InvestigationFailure,
  type FoundEvidence,
  type InvestigationInput,
  type InvestigationLimits,
  type InvestigationOutcome,
  type Investigator,
} from './types.js';
import type { EvidenceVerifier } from './verify.js';

export const PIPELINE_VERSION = 'real-1';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Validez por origen: el dato estadístico se revisa antes que una norma publicada. */
const TTL_MS: Record<Origin, number> = { ine: 30 * DAY_MS, factcheck: 90 * DAY_MS, corpus: 180 * DAY_MS };
const INSUFFICIENT_TTL_MS = 7 * DAY_MS;

const ORIGIN_ES: Record<Origin, string> = {
  ine: 'estadística oficial del INE',
  factcheck: 'verificaciones existentes (Google Fact Check Tools)',
  corpus: 'corpus de documentos institucionales',
};

/**
 * Límites por job (FR-016): llamadas y tokens de LLM se cuentan en cada llamada; al superarse el job
 * termina FAILED/budget_exceeded en vez de devolver una conclusión a medias.
 */
export class JobBudget implements LlmClient {
  readonly usage: LlmUsage[] = [];
  private readonly deadline: number;
  constructor(
    private readonly llm: LlmClient,
    private readonly limits: InvestigationLimits,
    now = Date.now(),
  ) {
    this.deadline = now + limits.timeoutMs;
  }

  get tokens() {
    return this.usage.reduce((s, u) => s + u.tokensIn + u.tokensOut, 0);
  }

  checkTime() {
    if (Date.now() > this.deadline)
      throw new InvestigationFailure('timeout', 'Investigation time limit reached');
  }

  async complete<T>(req: LlmRequest<T>) {
    this.checkTime();
    if (this.usage.length >= this.limits.maxLlmCalls)
      throw new InvestigationFailure(
        'budget_exceeded',
        `LLM call limit (${this.limits.maxLlmCalls}) reached`,
      );
    if (this.tokens >= this.limits.maxTokens)
      throw new InvestigationFailure('budget_exceeded', `Token limit (${this.limits.maxTokens}) reached`);
    const res = await this.llm.complete(req);
    this.usage.push(res.usage);
    if (this.tokens > this.limits.maxTokens)
      throw new InvestigationFailure('budget_exceeded', `Token limit (${this.limits.maxTokens}) exceeded`);
    return res;
  }
}

export interface RealInvestigatorDeps {
  llm: LlmClient;
  models: { extract: string; synth: string };
  retriever: EvidenceRetriever;
  /** Fábricas para inyectar el cliente con presupuesto del job. */
  verifier: (llm: LlmClient) => EvidenceVerifier;
  explainer: (llm: LlmClient) => ExplanationGenerator;
}

/** Investigador real por etapas (PRD §9.1): normalizar → recuperar → verificar → decidir → sintetizar. */
export class RealInvestigator implements Investigator {
  constructor(private readonly deps: RealInvestigatorDeps) {}

  async investigate(input: InvestigationInput, limits: InvestigationLimits): Promise<InvestigationOutcome> {
    const budget = new JobBudget(this.deps.llm, limits);
    const models: Record<string, string> = { verify: this.deps.models.synth, synth: this.deps.models.synth };

    // 1. Normalización: las afirmaciones manuales no traen campos estructurados.
    let normalized: NormalizedClaim = input.normalized;
    if (input.kind === 'manual' && Object.keys(normalized).length === 0) {
      models.normalize = this.deps.models.extract;
      const r = await new LlmClaimExtractor(budget, this.deps.models.extract).extract([
        { startMs: 0, endMs: 0, text: input.literal },
      ]);
      normalized = r.candidates[0]?.normalized ?? {};
    }

    // 2. Recuperación determinista.
    budget.checkTime();
    const retrieval = await this.deps.retriever.retrieve(input, normalized, limits.maxDocuments);
    const notes: string[] = [];
    for (const s of retrieval.skipped)
      notes.push(`No se han consultado ${ORIGIN_ES[s.origin]} (${s.reason}).`);
    for (const f of retrieval.failures)
      notes.push(`${cap(ORIGIN_ES[f.origin])}: no disponible durante la consulta.`);
    if (input.kind === 'manual')
      notes.push('Texto aportado por el usuario; no procede de una transcripción del vídeo.');

    if (retrieval.candidates.length === 0) {
      // Sin evidencia porque una fuente falló ≠ sin evidencia tras consultar: no fingimos haber buscado.
      if (retrieval.failures.length > 0)
        throw new InvestigationFailure(
          'source_unavailable',
          retrieval.failures.map((f) => f.message).join('; '),
        );
      return this.insufficient(input, notes, budget, models);
    }

    // 3. Relación evidencia–afirmación: código para cifras INE, LLM validado para el resto.
    const toJudge = retrieval.candidates.filter((c) => !c.fixedRelation);
    const verification = await this.deps.verifier(budget).verify(input.literal, input.context, toJudge);
    const judged = retrieval.candidates.map((c) => ({
      ...c,
      relation: c.fixedRelation ?? verification.relations.get(c.id) ?? 'irrelevant',
    }));
    const relevant = judged.filter((c) => c.relation !== 'irrelevant');
    for (const c of relevant) if (c.note) notes.push(c.note);
    const stats = relevant.find((c) => c.stats)?.stats ?? null;

    // 4. Conclusión determinista.
    const decision = decideConclusion(
      relevant.map((c) => ({ ...c.evidence, relation: c.relation, kind: c.evidence.source.kind })),
    );
    if (decision.note) notes.push(decision.note);
    if (decision.status === 'INSUFFICIENT_EVIDENCE') return this.insufficient(input, notes, budget, models);

    // 5. Síntesis con citas validadas (o plantilla).
    const exp = await this.deps.explainer(budget).explain({
      literal: input.literal,
      conclusion: decision.conclusion,
      evidence: relevant,
      stats,
      notes,
    });
    if (exp.rejected.length) models.synthRejected = exp.rejected.join(',');
    return {
      ...this.base(budget, models),
      status: 'COMPLETED',
      conclusion: decision.conclusion,
      summary: exp.explanation.summary,
      context: exp.explanation.context,
      limitations: exp.explanation.limitations,
      stats,
      evidence: relevant.map(toFound),
      ttlMs: Math.min(...relevant.map((c) => TTL_MS[c.origin])),
    };
  }

  private base(budget: JobBudget, models: Record<string, string>) {
    return {
      isDemo: false,
      pipelineVersion: PIPELINE_VERSION,
      models,
      costEur: budget.usage.reduce((s, u) => s + u.costEur, 0),
      tokensIn: budget.usage.reduce((s, u) => s + u.tokensIn, 0),
      tokensOut: budget.usage.reduce((s, u) => s + u.tokensOut, 0),
    };
  }

  private insufficient(
    input: InvestigationInput,
    notes: string[],
    budget: JobBudget,
    models: Record<string, string>,
  ): InvestigationOutcome {
    const t = templateExplanation({
      literal: input.literal,
      conclusion: 'INSUFFICIENT_EVIDENCE',
      evidence: [],
      stats: null,
      notes,
    });
    if (!notes.some((n) => n.includes('no significa que la afirmación sea falsa')))
      t.limitations += ' Esto no significa que la afirmación sea falsa.';
    return {
      ...this.base(budget, models),
      status: 'INSUFFICIENT_EVIDENCE',
      conclusion: 'INSUFFICIENT_EVIDENCE',
      summary: t.summary,
      context: null,
      limitations: t.limitations,
      stats: null,
      evidence: [],
      ttlMs: INSUFFICIENT_TTL_MS,
    };
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toFound(c: Candidate & { relation: FoundEvidence['relation'] }): FoundEvidence {
  return { ...c.evidence, relation: c.relation };
}

/** Modo real sin clave LLM: falla honestamente cada job en vez de inventar (constitución I). */
export class NoLlmKeyInvestigator implements Investigator {
  async investigate(): Promise<InvestigationOutcome> {
    throw new InvestigationFailure(
      'no_llm_key',
      'INVESTIGATION_MODE=real requires ANTHROPIC_API_KEY on the server',
    );
  }
}
