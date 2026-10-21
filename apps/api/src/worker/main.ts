import { checkLink, createFetcher, FACTCHECK_HOST, INE_HOST, loadCorpus } from '@polifamia/connectors';
import {
  AnthropicLlmClient,
  DefaultEvidenceRetriever,
  DemoInvestigator,
  LlmEvidenceVerifier,
  LlmExplanationGenerator,
  NoLlmKeyInvestigator,
  RealInvestigator,
  type Investigator,
} from '@polifamia/investigation';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { createDb } from '../db/client.js';
import { logger } from '../logger.js';
import { INVESTIGATE_QUEUE, startBoss, type InvestigateJob } from '../queue.js';
import { processInvestigation, type ProcessOptions } from './process.js';
import { purgeExpired, RETENTION_QUEUE } from './retention.js';

const config = loadConfig();
const { db, pool } = createDb(config.DATABASE_URL);
const boss = await startBoss(config.DATABASE_URL, config.JOB_RETRY_LIMIT, config.JOB_TIMEOUT_MS);

let linkChecker: ProcessOptions['checkLink'];

async function buildInvestigator(): Promise<Investigator> {
  if (config.INVESTIGATION_MODE === 'demo') return new DemoInvestigator(config.DEMO_DELAY_MS);
  // Sin clave el worker arranca igualmente y cada job termina FAILED/no_llm_key: nunca se inventa.
  if (!config.ANTHROPIC_API_KEY) {
    logger.warn('INVESTIGATION_MODE=real without ANTHROPIC_API_KEY: jobs will fail with no_llm_key');
    return new NoLlmKeyInvestigator();
  }
  const corpusDir =
    config.CORPUS_DIR ?? fileURLToPath(new URL('../../../../corpus/documents', import.meta.url));
  const corpus = await loadCorpus(corpusDir);
  const timeoutMs = Math.min(15_000, config.JOB_TIMEOUT_MS);
  // Enlaces comprobables: hosts ya aprobados (INE + corpus). Las reseñas de terceros quedan `unverified`.
  const linkHosts = [INE_HOST, ...new Set(corpus.map((d) => new URL(d.url).hostname))];
  const linkFetcher = createFetcher(linkHosts, { timeoutMs: 5_000 });
  linkChecker = (url) => checkLink(url, linkHosts, linkFetcher);
  return new RealInvestigator({
    llm: new AnthropicLlmClient(),
    models: { extract: config.LLM_MODEL_EXTRACT, synth: config.LLM_MODEL_SYNTH },
    retriever: new DefaultEvidenceRetriever({
      ineFetcher: createFetcher([INE_HOST], { timeoutMs }),
      factCheckFetcher: createFetcher([FACTCHECK_HOST], { timeoutMs }),
      factCheckKey: config.FACTCHECK_API_KEY || undefined,
      corpus,
    }),
    verifier: (llm) => new LlmEvidenceVerifier(llm, config.LLM_MODEL_SYNTH),
    explainer: (llm) => new LlmExplanationGenerator(llm, config.LLM_MODEL_SYNTH),
  });
}
const investigator = await buildInvestigator();

await boss.work<InvestigateJob>(INVESTIGATE_QUEUE, async ([job]) => {
  if (!job) return;
  await processInvestigation(db, investigator, job.data.investigationId, {
    limits: {
      timeoutMs: config.JOB_TIMEOUT_MS,
      maxLlmCalls: config.JOB_MAX_LLM_CALLS,
      maxTokens: config.JOB_MAX_TOKENS,
      maxDocuments: config.JOB_MAX_DOCUMENTS,
    },
    lastAttempt: job.retryCount >= config.JOB_RETRY_LIMIT,
    correlationId: job.data.correlationId,
    checkLink: linkChecker,
  });
});

// Retención (PRD §11): eventos de producto 30 días; se ejecuta a diario desde la propia cola.
await boss.createQueue(RETENTION_QUEUE);
await boss.schedule(RETENTION_QUEUE, '17 3 * * *');
await boss.work(RETENTION_QUEUE, async () => {
  logger.info({ stage: 'retention', ...(await purgeExpired(db)) }, 'retention purge');
});
logger.info({ mode: config.INVESTIGATION_MODE }, 'worker started');

const shutdown = async () => {
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
