import {
  InvestigationFailure,
  type InvestigationLimits,
  type InvestigationOutcome,
  type Investigator,
} from '@polifamia/investigation';
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { claims as claimsTable, evidence, investigations, sources } from '../db/schema.js';
import { logger } from '../logger.js';

export interface ProcessOptions {
  limits: InvestigationLimits;
  /** Si es el último intento, un error inesperado deja el job en FAILED en vez de reintentar. */
  lastAttempt: boolean;
  correlationId?: string;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new InvestigationFailure('timeout', `Investigation exceeded ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export async function processInvestigation(
  db: Db,
  investigator: Investigator,
  investigationId: string,
  opts: ProcessOptions,
): Promise<void> {
  const log = logger.child({ investigationId, correlationId: opts.correlationId });
  const inv = await db.query.investigations.findFirst({ where: eq(investigations.id, investigationId) });
  if (!inv || (inv.status !== 'PENDING' && inv.status !== 'RUNNING')) {
    log.warn({ status: inv?.status }, 'skip: not pending');
    return;
  }
  const claim = inv.claimId
    ? await db.query.claims.findFirst({ where: eq(claimsTable.id, inv.claimId) })
    : null;
  await db.update(investigations).set({ status: 'RUNNING' }).where(eq(investigations.id, inv.id));
  const started = performance.now();
  log.info({ stage: 'start' }, 'investigation started');

  let outcome: InvestigationOutcome;
  try {
    outcome = await withTimeout(
      investigator.investigate(
        {
          kind: claim ? 'video' : 'manual',
          literal: claim?.literal ?? inv.manualText ?? '',
          context: claim?.context ?? null,
          normalized: claim?.normalized ?? {},
          declaredSource: claim?.declaredSource ?? null,
        },
        opts.limits,
      ),
      opts.limits.timeoutMs,
    );
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    if (err instanceof InvestigationFailure) {
      log.warn({ stage: 'failed', reason: err.reason, latencyMs }, 'investigation failed');
      await db
        .update(investigations)
        .set({ status: 'FAILED', failureReason: err.reason, latencyMs })
        .where(eq(investigations.id, inv.id));
      return;
    }
    if (opts.lastAttempt) {
      log.error({ stage: 'failed', err, latencyMs }, 'investigation crashed on last attempt');
      await db
        .update(investigations)
        .set({ status: 'FAILED', failureReason: 'provider_error', latencyMs })
        .where(eq(investigations.id, inv.id));
      return;
    }
    throw err; // pg-boss reintenta
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const ev of outcome.evidence) {
      const [src] = await tx
        .insert(sources)
        .values({
          canonicalUrl: ev.source.url,
          title: ev.source.title,
          publisher: ev.source.publisher,
          publishedAt: ev.source.publishedAt,
          kind: ev.source.kind,
        })
        .onConflictDoUpdate({ target: sources.canonicalUrl, set: { title: ev.source.title } })
        .returning({ id: sources.id });
      await tx.insert(evidence).values({
        investigationId: inv.id,
        sourceId: src!.id,
        locator: ev.locator,
        excerpt: ev.excerpt,
        relation: ev.relation,
        provenance: ev.provenance,
        dataDate: ev.dataDate,
        accessedAt: now,
      });
    }
    await tx
      .update(investigations)
      .set({
        status: outcome.status,
        conclusion: outcome.conclusion,
        summary: outcome.summary,
        context: outcome.context,
        limitations: outcome.limitations,
        stats: outcome.stats,
        isDemo: outcome.isDemo,
        pipelineVersion: outcome.pipelineVersion,
        models: outcome.models,
        costEur: outcome.costEur,
        tokensIn: outcome.tokensIn,
        tokensOut: outcome.tokensOut,
        latencyMs: Math.round(performance.now() - started),
        checkedAt: now,
        expiresAt: new Date(now.getTime() + outcome.ttlMs),
      })
      .where(eq(investigations.id, inv.id));
    // Versionado (FR-015): la nueva versión sustituye a las anteriores de la misma clave; no se borran.
    await tx
      .update(investigations)
      .set({ supersededBy: inv.id })
      .where(
        and(
          eq(investigations.cacheKey, inv.cacheKey),
          lt(investigations.version, inv.version),
          isNull(investigations.supersededBy),
          inArray(investigations.status, ['COMPLETED', 'INSUFFICIENT_EVIDENCE']),
        ),
      );
  });
  log.info(
    {
      stage: 'done',
      status: outcome.status,
      costEur: outcome.costEur,
      latencyMs: Math.round(performance.now() - started),
    },
    'investigation finished',
  );
}
