import {
  AnthropicLlmClient,
  DEFAULT_MODELS,
  FakeLlmClient,
  LlmClaimExtractor,
  type LlmClient,
  type LlmUsage,
} from '@polifamia/investigation';
import { loadDataset, toSegments } from './dataset.js';
import { computeMetrics, type ExampleOutcome } from './metrics.js';
import { oracleResponder } from './oracle.js';

/**
 * Evalúa la extracción por etapas sobre el dataset.
 *   --real   llama al modelo (requiere ANTHROPIC_API_KEY; gasta dinero)
 *   (por defecto) modo offline «oracle»: el LLM falso devuelve las etiquetas esperadas. Solo valida el
 *   arnés y la validación determinista (literal/timestamps/selección); NO mide la calidad de ningún modelo.
 */
const real = process.argv.includes('--real');
const datasetArg = process.argv.find((a) => a.endsWith('.jsonl'));
const dataset = await loadDataset(datasetArg);

let llm: LlmClient;
let model: string;
if (real) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('--real requires ANTHROPIC_API_KEY. No metrics produced.');
    process.exit(2);
  }
  llm = new AnthropicLlmClient();
  model = process.env.LLM_MODEL_EXTRACT || DEFAULT_MODELS.extract;
} else {
  llm = new FakeLlmClient(oracleResponder(dataset));
  model = 'oracle';
}

const extractor = new LlmClaimExtractor(llm, model);
const outcomes: ExampleOutcome[] = [];
const usage: LlmUsage[] = [];
for (const example of dataset) {
  const r = await extractor.extract(toSegments(example));
  usage.push(...r.usage);
  outcomes.push({ example, candidates: r.candidates, rejected: r.rejected.length });
}

const reviewed = dataset.filter((d) => d.reviewStatus === 'reviewed').length;
const report = {
  mode: real ? 'real' : 'offline-oracle',
  warning: real
    ? undefined
    : 'Offline oracle mode: the fake LLM returns the gold labels. These numbers check the harness and deterministic validation only — they are NOT model-quality metrics. Run with --real and an API key for G2.',
  model,
  dataset: { examples: dataset.length, reviewed, unreviewedSeed: dataset.length - reviewed },
  cost: {
    calls: usage.length,
    tokensIn: usage.reduce((s, u) => s + u.tokensIn, 0),
    tokensOut: usage.reduce((s, u) => s + u.tokensOut, 0),
    costEur: Math.round(usage.reduce((s, u) => s + u.costEur, 0) * 10000) / 10000,
  },
  ...computeMetrics(outcomes),
};
console.log(JSON.stringify(report, null, 2));
