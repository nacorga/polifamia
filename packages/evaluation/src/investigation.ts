import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Conclusion, EvidenceRelation, NormalizedClaim } from '@polifamia/contracts';
import { loadCorpus, type Fetcher } from '@polifamia/connectors';
import {
  DefaultEvidenceRetriever,
  EXPLAIN_PROMPT_VERSION,
  EXTRACTION_PROMPT_VERSION,
  FakeLlmClient,
  InvestigationFailure,
  LlmEvidenceVerifier,
  LlmExplanationGenerator,
  RealInvestigator,
  VERIFY_PROMPT_VERSION,
  type InvestigationOutcome,
  type LlmClient,
} from '@polifamia/investigation';
import { z } from 'zod';
import { ReviewStatus } from './dataset.js';

const FABRICATED = 'según https://inventado.example el dato es 9,99';

export const InvestigationCase = z.strictObject({
  id: z.string(),
  reviewStatus: ReviewStatus,
  tags: z.array(z.string()),
  input: z.strictObject({
    kind: z.enum(['video', 'manual']),
    literal: z.string(),
    normalized: NormalizedClaim,
    declaredSource: z.string().nullable(),
  }),
  /** Fuentes en modo offline: respuestas reales grabadas, caída simulada o fixture sintético de forma. */
  sources: z.strictObject({ ine: z.enum(['recorded', 'down']), factcheck: z.enum(['none', 'synthetic']) }),
  /** Comportamiento del LLM falso (solo offline): qué relación propone y si la síntesis inventa. */
  llm: z.strictObject({
    verify: EvidenceRelation,
    verifyExtraIds: z.array(z.string()).default([]),
    explain: z.enum(['faithful', 'fabricated']),
    normalizeTo: NormalizedClaim.optional(),
  }),
  expected: z.strictObject({
    outcome: z.union([Conclusion, z.literal('FAILED:source_unavailable')]),
    stats: z.strictObject({ unit: z.string(), territory: z.string(), period: z.string() }).optional(),
  }),
});
export type InvestigationCase = z.infer<typeof InvestigationCase>;

export const DEFAULT_INVESTIGATION_DATASET = new URL('../data/investigation.seed.jsonl', import.meta.url);

export async function loadInvestigationCases(path: string | URL = DEFAULT_INVESTIGATION_DATASET) {
  const lines = (await readFile(path, 'utf8')).split('\n').filter((l) => l.trim());
  return lines.map((l, i) => {
    const parsed = InvestigationCase.safeParse(JSON.parse(l));
    if (!parsed.success) throw new Error(`line ${i + 1}: ${z.prettifyError(parsed.error)}`);
    return parsed.data;
  });
}

const FIXTURES = fileURLToPath(new URL('../../connectors/fixtures/', import.meta.url));
const CORPUS = fileURLToPath(new URL('../../../corpus/documents', import.meta.url));

/** Sirve respuestas INE reales grabadas por URL exacta. */
export function recordedIneFetcher(): Fetcher {
  const byUrl = new Map<string, string>();
  for (const f of readdirSync(`${FIXTURES}ine`)) {
    const r = JSON.parse(readFileSync(`${FIXTURES}ine/${f}`, 'utf8'));
    byUrl.set(r._recorded.url, r.body);
  }
  return async (url) => {
    const body = byUrl.get(url);
    return body ? { url, status: 200, text: body } : { url, status: 404, text: '' };
  };
}

const syntheticFactCheck: Fetcher = async (url) => ({
  url,
  status: 200,
  text: JSON.stringify(JSON.parse(readFileSync(`${FIXTURES}factcheck.synthetic-shape.json`, 'utf8')).body),
});

/** LLM falso guiado por el caso: permite medir la parte determinista del pipeline sin red ni clave. */
export function scriptedLlm(c: InvestigationCase): LlmClient {
  return new FakeLlmClient((req) => {
    if (req.promptVersion === VERIFY_PROMPT_VERSION) {
      const ids = [...req.user.matchAll(/<evidencia id="(E\d+)">/g)].map((m) => m[1]!);
      return {
        assessments: [...ids, ...c.llm.verifyExtraIds].map((id) => ({
          id,
          relation: c.llm.verify,
          rationale: 'eval',
        })),
      };
    }
    if (req.promptVersion === EXPLAIN_PROMPT_VERSION) {
      const ids = [...req.user.matchAll(/id=(E\d+)/g)].map((m) => m[1]!);
      return c.llm.explain === 'faithful'
        ? {
            summary: 'La evidencia citada recoge el dato.',
            context: null,
            limitations: 'Solo fuentes enumeradas.',
            citedEvidenceIds: ids,
          }
        : { summary: FABRICATED, context: null, limitations: 'x', citedEvidenceIds: [...ids, 'E42'] };
    }
    if (req.promptVersion === EXTRACTION_PROMPT_VERSION) {
      const n = c.llm.normalizeTo ?? {};
      return {
        claims: [
          {
            literal: c.input.literal,
            claimType: 'statistic',
            metric: n.metric ?? null,
            entity: n.entity ?? null,
            territory: n.territory ?? null,
            period: n.period ?? null,
            unit: n.unit ?? null,
            value: n.value ?? null,
            comparison: n.comparison ?? null,
            declaredSource: null,
          },
        ],
      };
    }
    throw new Error(`unexpected prompt ${req.promptVersion}`);
  });
}

export interface CaseDeps {
  llm: LlmClient;
  ineFetcher: Fetcher;
  factCheckFetcher: Fetcher;
  factCheckKey?: string;
  models: { extract: string; synth: string };
}

export function offlineDeps(c: InvestigationCase): CaseDeps {
  return {
    llm: scriptedLlm(c),
    ineFetcher:
      c.sources.ine === 'down' ? async (url) => ({ url, status: 503, text: '' }) : recordedIneFetcher(),
    factCheckFetcher: syntheticFactCheck,
    factCheckKey: c.sources.factcheck === 'synthetic' ? 'offline' : undefined,
    models: { extract: 'offline', synth: 'offline' },
  };
}

export type CaseOutcome = {
  case: InvestigationCase;
  outcome: InvestigationOutcome | null;
  failure: string | null;
};

export async function runCase(c: InvestigationCase, deps: CaseDeps): Promise<CaseOutcome> {
  const investigator = new RealInvestigator({
    llm: deps.llm,
    models: deps.models,
    retriever: new DefaultEvidenceRetriever({
      ineFetcher: deps.ineFetcher,
      factCheckFetcher: deps.factCheckFetcher,
      factCheckKey: deps.factCheckKey,
      corpus: await loadCorpus(CORPUS),
    }),
    verifier: (l) => new LlmEvidenceVerifier(l, deps.models.synth),
    explainer: (l) => new LlmExplanationGenerator(l, deps.models.synth),
  });
  try {
    const outcome = await investigator.investigate(
      { ...c.input, context: null },
      { timeoutMs: 60_000, maxLlmCalls: 6, maxTokens: 40_000, maxDocuments: 12 },
    );
    return { case: c, outcome, failure: null };
  } catch (err) {
    if (err instanceof InvestigationFailure) return { case: c, outcome: null, failure: err.reason };
    throw err;
  }
}

/** Métricas por etapa (PRD §12): integridad de citas, abstención y contexto estadístico. */
export function investigationMetrics(results: CaseOutcome[]) {
  const label = (r: CaseOutcome) => (r.outcome ? r.outcome.conclusion : `FAILED:${r.failure}`);
  const integrityViolations: string[] = [];
  const categoricalWithoutPrimary: string[] = [];
  let statsTotal = 0;
  let statsCorrect = 0;
  for (const r of results) {
    const o = r.outcome;
    if (!o) continue;
    for (const e of o.evidence)
      if (!e.locator.trim() || !e.excerpt.trim() || !e.source.url.startsWith('https://'))
        integrityViolations.push(`${r.case.id}: evidence without locator/excerpt/https`);
    if ([o.summary, o.context, o.limitations].join(' ').includes('inventado.example'))
      integrityViolations.push(`${r.case.id}: fabricated synthesis accepted`);
    if (
      (o.conclusion === 'SUPPORTED' || o.conclusion === 'CONTRADICTED') &&
      !o.evidence.some(
        (e) =>
          e.source.kind === 'primary' &&
          e.relation === (o.conclusion === 'SUPPORTED' ? 'supports' : 'contradicts'),
      )
    )
      categoricalWithoutPrimary.push(r.case.id);
    const exp = r.case.expected.stats;
    if (exp) {
      statsTotal++;
      if (
        o.stats &&
        o.stats.unit === exp.unit &&
        o.stats.territory === exp.territory &&
        o.stats.period === exp.period
      )
        statsCorrect++;
    }
  }
  const mismatches = results
    .filter((r) => label(r) !== r.case.expected.outcome)
    .map((r) => ({ id: r.case.id, expected: r.case.expected.outcome, got: label(r) }));
  return {
    cases: results.length,
    outcomeAccuracy: (results.length - mismatches.length) / results.length,
    citationIntegrityViolations: integrityViolations,
    categoricalWithoutPrimaryEvidence: categoricalWithoutPrimary,
    statsContext: {
      evaluated: statsTotal,
      correct: statsCorrect,
      rate: statsTotal ? statsCorrect / statsTotal : null,
    },
    abstentions: results.filter((r) => r.outcome?.conclusion === 'INSUFFICIENT_EVIDENCE').length,
    operationalFailures: results.filter((r) => !r.outcome).length,
    mismatches,
  };
}
