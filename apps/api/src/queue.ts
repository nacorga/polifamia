import { PgBoss } from 'pg-boss';

export const INVESTIGATE_QUEUE = 'investigate';

export interface InvestigateJob {
  investigationId: string;
  correlationId?: string;
}

export async function startBoss(url: string, retryLimit: number, timeoutMs: number): Promise<PgBoss> {
  const boss = new PgBoss(url);
  boss.on('error', (err) => console.error(err));
  await boss.start();
  // `short`: como mucho un job en cola por singletonKey (= cacheKey).
  await boss.createQueue(INVESTIGATE_QUEUE, {
    policy: 'short',
    retryLimit,
    retryDelay: 2,
    retryBackoff: true,
    expireInSeconds: Math.ceil(timeoutMs / 1000) + 30,
  });
  return boss;
}
