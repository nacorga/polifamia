import { Inject, Injectable } from '@nestjs/common';
import type { CreateInvestigation, Investigation } from '@polifamia/contracts';
import { cacheKey } from '@polifamia/investigation';
import { and, desc, eq, gt, gte, inArray, isNull, max, sum } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import type { Config } from '../../config.js';
import type { Db } from '../../db/client.js';
import { claims, evidence, investigations, sources } from '../../db/schema.js';
import { ApiError } from '../../http.js';
import { INVESTIGATE_QUEUE, type InvestigateJob } from '../../queue.js';
import { BOSS, CONFIG, DB } from '../../tokens.js';

type Row = typeof investigations.$inferSelect;
export interface CreateResult {
  investigation: Investigation;
  /** 200 = resultado reutilizable; 202 = en curso. */
  httpStatus: 200 | 202;
}

const isDone = (r: Row) => r.status !== 'PENDING' && r.status !== 'RUNNING';

@Injectable()
export class InvestigationsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(BOSS) private readonly boss: PgBoss,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  async create(body: CreateInvestigation, correlationId: string): Promise<CreateResult> {
    const byKey = await this.findByIdempotencyKey(body.idempotencyKey);
    if (byKey) return this.result(byKey);

    let literal: string;
    let normalized = {};
    if ('claimId' in body) {
      // El servidor usa su propia copia del claim; no confía en texto enviado por el navegador.
      const claim = await this.db.query.claims.findFirst({ where: eq(claims.id, body.claimId) });
      if (!claim) throw new ApiError('not_found', 'Claim not found', 404);
      if (claim.checkability !== 'CHECKABLE')
        throw new ApiError('validation', 'Claim is not checkable as fact', 400);
      literal = claim.literal;
      normalized = claim.normalized;
    } else {
      literal = body.manualClaim;
    }
    const key = cacheKey(literal, normalized, this.config.INVESTIGATION_MODE);

    const reusable = await this.db.query.investigations.findFirst({
      where: and(
        eq(investigations.cacheKey, key),
        inArray(investigations.status, ['COMPLETED', 'INSUFFICIENT_EVIDENCE']),
        gt(investigations.expiresAt, new Date()),
        isNull(investigations.supersededBy),
      ),
      orderBy: desc(investigations.version),
    });
    if (reusable) return this.result(reusable);

    const inflight = await this.findInflight(key);
    if (inflight) return this.result(inflight);

    // Presupuesto global diario (FR-016): la caché y lo ya en curso se sirven; lo nuevo, no.
    if ((await this.spentToday()) >= this.config.DAILY_BUDGET_EUR)
      throw new ApiError('budget_exceeded', 'Daily investigation budget exhausted', 429);

    const [prev] = await this.db
      .select({ v: max(investigations.version) })
      .from(investigations)
      .where(eq(investigations.cacheKey, key));
    const [created] = await this.db
      .insert(investigations)
      .values({
        claimId: 'claimId' in body ? body.claimId : null,
        manualText: 'manualClaim' in body ? body.manualClaim : null,
        version: (prev?.v ?? 0) + 1,
        idempotencyKey: body.idempotencyKey,
        cacheKey: key,
        isDemo: this.config.INVESTIGATION_MODE === 'demo',
      })
      .onConflictDoNothing()
      .returning();
    if (!created) {
      // Carrera con otra petición (misma idempotencyKey o misma clave en curso).
      const winner = (await this.findByIdempotencyKey(body.idempotencyKey)) ?? (await this.findInflight(key));
      if (!winner) throw new ApiError('internal', 'Could not create investigation', 500);
      return this.result(winner);
    }

    try {
      const job: InvestigateJob = { investigationId: created.id, correlationId };
      await this.boss.send(INVESTIGATE_QUEUE, job, { singletonKey: key });
    } catch (err) {
      await this.db
        .update(investigations)
        .set({ status: 'FAILED', failureReason: 'provider_error' })
        .where(eq(investigations.id, created.id));
      throw err;
    }
    return this.result(created);
  }

  async get(id: string): Promise<Investigation> {
    const row = await this.db.query.investigations.findFirst({ where: eq(investigations.id, id) });
    if (!row) throw new ApiError('not_found', 'Investigation not found', 404);
    return this.serialize(row);
  }

  /** Coste persistido desde las 00:00 UTC. ponytail: los jobs en curso aún no suman; margen = 1 job. */
  async spentToday(): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const [row] = await this.db
      .select({ total: sum(investigations.costEur) })
      .from(investigations)
      .where(gte(investigations.createdAt, start));
    return Number(row?.total ?? 0);
  }

  private findByIdempotencyKey(k: string) {
    return this.db.query.investigations.findFirst({ where: eq(investigations.idempotencyKey, k) });
  }

  private findInflight(key: string) {
    return this.db.query.investigations.findFirst({
      where: and(eq(investigations.cacheKey, key), inArray(investigations.status, ['PENDING', 'RUNNING'])),
    });
  }

  private async result(row: Row): Promise<CreateResult> {
    return { investigation: await this.serialize(row), httpStatus: isDone(row) ? 200 : 202 };
  }

  private async serialize(row: Row): Promise<Investigation> {
    const claim = row.claimId
      ? await this.db.query.claims.findFirst({ where: eq(claims.id, row.claimId) })
      : null;
    const ev = await this.db
      .select()
      .from(evidence)
      .innerJoin(sources, eq(evidence.sourceId, sources.id))
      .where(eq(evidence.investigationId, row.id));
    return {
      id: row.id,
      version: row.version,
      status: row.status,
      conclusion: row.conclusion,
      isDemo: row.isDemo,
      claim: claim
        ? { kind: 'video', claimId: claim.id, literal: claim.literal, startMs: claim.startMs }
        : { kind: 'manual', text: row.manualText ?? '' },
      summary: row.summary,
      context: row.context,
      limitations: row.limitations,
      stats: row.stats,
      evidence: ev.map(({ evidence: e, sources: s }) => ({
        id: e.id,
        relation: e.relation,
        provenance: e.provenance,
        locator: e.locator,
        excerpt: e.excerpt,
        dataDate: e.dataDate,
        accessedAt: e.accessedAt.toISOString(),
        checkStatus: e.checkStatus,
        source: {
          url: s.canonicalUrl,
          title: s.title,
          publisher: s.publisher,
          publishedAt: s.publishedAt,
          kind: s.kind,
        },
      })),
      failureReason: row.failureReason,
      checkedAt: row.checkedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
