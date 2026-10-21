import { createFetcher, FACTCHECK_HOST, INE_HOST } from '@polifamia/connectors';
import { AnthropicLlmClient, DEFAULT_MODELS } from '@polifamia/investigation';
import {
  investigationMetrics,
  loadInvestigationCases,
  offlineDeps,
  runCase,
  type CaseDeps,
  type CaseOutcome,
} from './investigation.js';

/**
 * Evalúa el motor de evidencias sobre el dataset de casos.
 *   (por defecto) offline: respuestas INE reales grabadas, Fact Check sintético de forma y LLM guionizado
 *     por caso. Mide la parte determinista (política, cálculo, validación de citas); NO la calidad del modelo.
 *   --real  LLM y fuentes en vivo (requiere ANTHROPIC_API_KEY; FACTCHECK_API_KEY opcional; gasta dinero).
 */
const real = process.argv.includes('--real');
const datasetArg = process.argv.find((a) => a.endsWith('.jsonl'));
const cases = await loadInvestigationCases(datasetArg);

let liveDeps: (Omit<CaseDeps, 'factCheckKey'> & { factCheckKey?: string }) | null = null;
if (real) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('--real requires ANTHROPIC_API_KEY. No metrics produced.');
    process.exit(2);
  }
  liveDeps = {
    llm: new AnthropicLlmClient(),
    ineFetcher: createFetcher([INE_HOST]),
    factCheckFetcher: createFetcher([FACTCHECK_HOST]),
    factCheckKey: process.env.FACTCHECK_API_KEY || undefined,
    models: {
      extract: process.env.LLM_MODEL_EXTRACT || DEFAULT_MODELS.extract,
      synth: process.env.LLM_MODEL_SYNTH || DEFAULT_MODELS.synth,
    },
  };
}

const results: CaseOutcome[] = [];
for (const c of cases) {
  // En modo real se omiten los casos que simulan fallos o fuentes sintéticas: no son reproducibles en vivo.
  if (
    liveDeps &&
    (c.sources.ine === 'down' || c.sources.factcheck === 'synthetic' || c.llm.explain === 'fabricated')
  )
    continue;
  results.push(await runCase(c, liveDeps ?? offlineDeps(c)));
}

const reviewed = cases.filter((c) => c.reviewStatus === 'reviewed').length;
const outcomes = results.flatMap((r) => (r.outcome ? [r.outcome] : []));
console.log(
  JSON.stringify(
    {
      mode: real ? 'real' : 'offline-scripted',
      warning: real
        ? undefined
        : 'Offline mode: the LLM is scripted per case. These numbers check the deterministic pipeline (evidence policy, statistics, citation validation) only — they are NOT model-quality metrics. G3 needs --real plus a human audit of every reference.',
      dataset: { cases: cases.length, reviewed, unreviewedSeed: cases.length - reviewed },
      cost: {
        costEur: Math.round(outcomes.reduce((s, o) => s + o.costEur, 0) * 10000) / 10000,
        tokensIn: outcomes.reduce((s, o) => s + o.tokensIn, 0),
        tokensOut: outcomes.reduce((s, o) => s + o.tokensOut, 0),
      },
      ...investigationMetrics(results),
    },
    null,
    2,
  ),
);
