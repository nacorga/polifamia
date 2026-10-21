import { DemoInvestigator, type Investigator } from '@polifamia/investigation';
import { loadConfig } from '../config.js';
import { createDb } from '../db/client.js';
import { logger } from '../logger.js';
import { INVESTIGATE_QUEUE, startBoss, type InvestigateJob } from '../queue.js';
import { processInvestigation } from './process.js';

const config = loadConfig();
const { db, pool } = createDb(config.DATABASE_URL);
const boss = await startBoss(config.DATABASE_URL, config.JOB_RETRY_LIMIT, config.JOB_TIMEOUT_MS);

function buildInvestigator(): Investigator {
  if (config.INVESTIGATION_MODE === 'demo') return new DemoInvestigator(config.DEMO_DELAY_MS);
  // ponytail: el investigador real llega en S4 (T063/T068); hasta entonces modo real se niega a arrancar.
  throw new Error('INVESTIGATION_MODE=real is not implemented yet (slice S4)');
}
const investigator = buildInvestigator();

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
  });
});
logger.info({ mode: config.INVESTIGATION_MODE }, 'worker started');

const shutdown = async () => {
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
