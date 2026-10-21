// Integración contra PostgreSQL real (polifamia_test). Usa el build de dist/ porque NestJS
// necesita los metadatos de decoradores que emite tsc.
import { Investigation } from '@polifamia/contracts';
import { loadCorpus, type Fetcher } from '@polifamia/connectors';
import {
  DefaultEvidenceRetriever,
  DemoInvestigator,
  EXPLAIN_PROMPT_VERSION,
  EXTRACTION_PROMPT_VERSION,
  FakeLlmClient,
  InvestigationFailure,
  LlmEvidenceVerifier,
  LlmExplanationGenerator,
  NoLlmKeyInvestigator,
  RealInvestigator,
  type Investigator,
} from '@polifamia/investigation';
import { eq, sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../dist/app.js';
import { loadConfig } from '../dist/config.js';
import { createDb } from '../dist/db/client.js';
import { runMigrations } from '../dist/db/migrate.js';
import { claims, investigations, transcripts, videos } from '../dist/db/schema.js';
import { processInvestigation } from '../dist/worker/process.js';

const DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://polifamia:polifamia@localhost:5432/polifamia_test';
const config = loadConfig({ DATABASE_URL, INVESTIGATION_MODE: 'demo' });
const limits = { timeoutMs: 2000, maxLlmCalls: 1, maxTokens: 1, maxDocuments: 1 };
const { db, pool } = createDb(DATABASE_URL);

let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
let checkableId: string;
let opinionId: string;

const api = (path: string, init?: RequestInit) =>
  fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
const post = (path: string, body: unknown, headers?: Record<string, string>) =>
  api(path, { method: 'POST', body: JSON.stringify(body), headers });
// Las respuestas de investigación se validan contra el contrato compartido.
const inv = async (r: Response | Promise<Response>) => Investigation.parse(await (await r).json());
const run = (id: string, investigator: Investigator = new DemoInvestigator(0), lastAttempt = true) =>
  processInvestigation(db, investigator, id, { limits, lastAttempt });

beforeAll(async () => {
  await runMigrations(DATABASE_URL);
  app = await createApp(config);
  await app.listen(0);
  base = await app.getUrl();
  base = base.replace('[::1]', 'localhost');
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE events, feedback, evidence, sources, investigations, claims, transcripts, videos CASCADE`,
  );
  const [v] = await db
    .insert(videos)
    .values({
      youtubeId: 'TESTvideo01',
      title: 'T',
      language: 'es',
      corpusStatus: 'claims_ready',
      isDemo: true,
    })
    .returning();
  const [t] = await db
    .insert(transcripts)
    .values({
      videoId: v!.id,
      segments: [{ startMs: 0, endMs: 5000, text: 'El paro bajó un 5 % en 2024. Es lo mejor.' }],
      revisionHash: 'h1',
      rights: { holder: 'test', basis: 'demo-fixture', scope: 'test', importedBy: 'test' },
      sourceFormat: 'srt',
    })
    .returning();
  const common = { videoId: v!.id, transcriptId: t!.id, context: 'ctx', endMs: 5000, extractor: 'fixture' };
  const rows = await db
    .insert(claims)
    .values([
      {
        ...common,
        literal: 'Es lo mejor.',
        startMs: 0,
        claimType: 'opinion',
        checkability: 'NOT_CHECKABLE',
        rank: 1,
        speaker: 'X',
      },
      {
        ...common,
        literal: 'El paro bajó un 5 % en 2024.',
        startMs: 0,
        claimType: 'statistic',
        checkability: 'CHECKABLE',
        rank: 2,
        normalized: { metric: 'tasa de paro', period: '2024' },
        speaker: 'X',
      },
    ])
    .returning();
  opinionId = rows[0]!.id;
  checkableId = rows[1]!.id;
});

describe('catalog', () => {
  it('reports availability for catalogued, unknown and invalid ids', async () => {
    expect(await (await api('/v1/videos/TESTvideo01/availability')).json()).toMatchObject({
      status: 'claims_ready',
      isDemo: true,
      rights: { basis: 'demo-fixture' },
    });
    expect(await (await api('/v1/videos/dQw4w9WgXcQ/availability')).json()).toMatchObject({
      status: 'unsupported_video',
    });
    const bad = await api('/v1/videos/nope/availability');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: 'validation' } });
  });

  it('lists checkable claims first and never exposes the speaker', async () => {
    const body = (await (await api('/v1/videos/TESTvideo01/claims')).json()) as {
      claims: Record<string, unknown>[];
    };
    expect(body.claims.map((c) => c.checkability)).toEqual(['CHECKABLE', 'NOT_CHECKABLE']);
    expect(body.claims[0]).not.toHaveProperty('speaker');
    const missing = await api('/v1/videos/dQw4w9WgXcQ/claims');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: 'unsupported_video' } });
  });
});

describe('investigations', () => {
  it('creates, processes and then reuses a cached result', async () => {
    const res = await post('/v1/investigations', { claimId: checkableId, idempotencyKey: 'key-00001' });
    expect(res.status).toBe(202);
    const created = Investigation.parse(await res.json());
    expect(created).toMatchObject({ status: 'PENDING', isDemo: true, claim: { kind: 'video', startMs: 0 } });

    await run(created.id);
    const done = await inv(api(`/v1/investigations/${created.id}`));
    expect(done).toMatchObject({ status: 'COMPLETED', conclusion: 'NEEDS_CONTEXT', isDemo: true });
    expect(done.evidence[0]).toMatchObject({ source: { publisher: 'DEMO' }, locator: expect.any(String) });
    expect(done.checkedAt).not.toBeNull();

    const again = await post('/v1/investigations', { claimId: checkableId, idempotencyKey: 'key-00002' });
    expect(again.status).toBe(200);
    expect(Investigation.parse(await again.json()).id).toBe(created.id);
  });

  it('is idempotent per idempotencyKey', async () => {
    const a = await inv(post('/v1/investigations', { claimId: checkableId, idempotencyKey: 'same-key-1' }));
    const b = await inv(post('/v1/investigations', { claimId: checkableId, idempotencyKey: 'same-key-1' }));
    expect(b.id).toBe(a.id);
  });

  it('deduplicates concurrent requests for the same claim into one investigation', async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        post('/v1/investigations', { claimId: checkableId, idempotencyKey: `concurrent-${i}` }),
      ),
    );
    const ids = new Set(
      await Promise.all(responses.map(async (r) => Investigation.parse(await r.json()).id)),
    );
    expect(responses.every((r) => r.status === 202)).toBe(true);
    expect(ids.size).toBe(1);
  });

  it('refuses to investigate opinions and unknown claims', async () => {
    const op = await post('/v1/investigations', { claimId: opinionId, idempotencyKey: 'opinion-1' });
    expect(op.status).toBe(400);
    const unknown = await post('/v1/investigations', {
      claimId: '00000000-0000-4000-8000-000000000000',
      idempotencyKey: 'unknown-1',
    });
    expect(unknown.status).toBe(404);
  });

  it('accepts manual claims without timestamp and validates their length', async () => {
    const res = await post('/v1/investigations', {
      manualClaim: 'Texto pegado sin cifras',
      idempotencyKey: 'manual-1',
    });
    const created = Investigation.parse(await res.json());
    expect(created.claim).toEqual({ kind: 'manual', text: 'Texto pegado sin cifras' });
    await run(created.id);
    expect(await (await api(`/v1/investigations/${created.id}`)).json()).toMatchObject({
      status: 'INSUFFICIENT_EVIDENCE',
      conclusion: 'INSUFFICIENT_EVIDENCE',
    });
    expect(
      (await post('/v1/investigations', { manualClaim: 'corto', idempotencyKey: 'manual-2' })).status,
    ).toBe(400);
    expect(
      (
        await post('/v1/investigations', {
          manualClaim: 'x'.repeat(10),
          claimId: checkableId,
          idempotencyKey: 'manual-3',
        })
      ).status,
    ).toBe(400);
  });

  it('marks operational failures as FAILED with a reason, never with a conclusion', async () => {
    const created = await inv(
      post('/v1/investigations', { manualClaim: 'El PIB creció un 2 %', idempotencyKey: 'failure-1' }),
    );
    await run(created.id, {
      investigate: () => Promise.reject(new InvestigationFailure('source_unavailable', 'down')),
    });
    expect(await (await api(`/v1/investigations/${created.id}`)).json()).toMatchObject({
      status: 'FAILED',
      conclusion: null,
      failureReason: 'source_unavailable',
    });

    const slow = await inv(
      post('/v1/investigations', { manualClaim: 'El PIB creció un 3 %', idempotencyKey: 'failure-2' }),
    );
    await run(slow.id, { investigate: () => new Promise(() => {}) });
    expect(await (await api(`/v1/investigations/${slow.id}`)).json()).toMatchObject({
      status: 'FAILED',
      failureReason: 'timeout',
    });

    const crash = await inv(
      post('/v1/investigations', { manualClaim: 'El PIB creció un 4 %', idempotencyKey: 'failure-3' }),
    );
    const boom = { investigate: () => Promise.reject(new Error('boom')) };
    await expect(run(crash.id, boom, false)).rejects.toThrow('boom'); // pg-boss reintentará
    await run(crash.id, boom, true);
    expect(await (await api(`/v1/investigations/${crash.id}`)).json()).toMatchObject({
      failureReason: 'provider_error',
    });
  });

  it('returns 404 for unknown investigation and 400 for malformed id', async () => {
    expect((await api('/v1/investigations/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await api('/v1/investigations/abc')).status).toBe(400);
  });
});

describe('real mode (S4)', () => {
  const realLimits = { timeoutMs: 5000, maxLlmCalls: 6, maxTokens: 40_000, maxDocuments: 12 };

  it('without an LLM key fails each job with no_llm_key', async () => {
    const created = await inv(
      post('/v1/investigations', { manualClaim: 'El PIB creció un 2 %', idempotencyKey: 'nokey-001' }),
    );
    await run(created.id, new NoLlmKeyInvestigator());
    expect(await inv(api(`/v1/investigations/${created.id}`))).toMatchObject({
      status: 'FAILED',
      conclusion: null,
      failureReason: 'no_llm_key',
      evidence: [],
    });
  });

  it('persists real-pipeline evidence with locator, provenance and stats (fake LLM, recorded INE response)', async () => {
    const literal = 'La inflación interanual cerró 2023 en el 3,1 %.';
    const recorded = JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL('../../../packages/connectors/fixtures/ine/IPC251856.2023-12.json', import.meta.url),
        ),
        'utf8',
      ),
    );
    const ineFetcher: Fetcher = async (url) => {
      expect(url).toBe(recorded._recorded.url);
      return { url, status: 200, text: recorded.body };
    };
    const llm = new FakeLlmClient((req) => {
      if (req.promptVersion === EXTRACTION_PROMPT_VERSION)
        return {
          claims: [
            {
              literal,
              claimType: 'statistic',
              metric: 'inflación interanual',
              entity: null,
              territory: 'España',
              period: 'diciembre de 2023',
              unit: '%',
              value: 3.1,
              comparison: null,
              declaredSource: null,
            },
          ],
        };
      if (req.promptVersion === EXPLAIN_PROMPT_VERSION)
        return {
          summary: 'El INE registra un 3,1 % en 2023-12.',
          context: null,
          limitations: 'Dato de diciembre.',
          citedEvidenceIds: ['E1'],
        };
      return { assessments: [] };
    });
    const real = new RealInvestigator({
      llm,
      models: { extract: 'cheap', synth: 'capable' },
      retriever: new DefaultEvidenceRetriever({
        ineFetcher,
        factCheckFetcher: async () => {
          throw new Error('no key: must not be called');
        },
        corpus: await loadCorpus(fileURLToPath(new URL('../../../corpus/documents', import.meta.url))),
      }),
      verifier: (l) => new LlmEvidenceVerifier(l, 'capable'),
      explainer: (l) => new LlmExplanationGenerator(l, 'capable'),
    });
    const created = await inv(
      post('/v1/investigations', { manualClaim: literal, idempotencyKey: 'real-0001' }),
    );
    await processInvestigation(db, real, created.id, { limits: realLimits, lastAttempt: true });
    const done = await inv(api(`/v1/investigations/${created.id}`));
    expect(done).toMatchObject({
      status: 'COMPLETED',
      conclusion: 'SUPPORTED',
      isDemo: false,
      claim: { kind: 'manual' },
      stats: { unit: '%', territory: 'España', period: '2023-12' },
    });
    expect(done.evidence).toHaveLength(1);
    expect(done.evidence[0]).toMatchObject({
      relation: 'supports',
      provenance: 'retrieved_evidence',
      locator: recorded._recorded.url,
      dataDate: '2023-12',
      source: { publisher: 'Instituto Nacional de Estadística (INE)', kind: 'primary' },
    });
    expect(done.limitations).toMatch(/Texto aportado por el usuario/);
    expect(new Date(done.expiresAt!).getTime() - new Date(done.checkedAt!).getTime()).toBe(
      30 * 24 * 3600 * 1000,
    );
  });

  it('a new version after expiry supersedes the previous one without deleting it', async () => {
    const first = await inv(
      post('/v1/investigations', { claimId: checkableId, idempotencyKey: 'ver-00001' }),
    );
    await run(first.id);
    await db
      .update(investigations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(investigations.id, first.id));
    const res = await post('/v1/investigations', { claimId: checkableId, idempotencyKey: 'ver-00002' });
    expect(res.status).toBe(202);
    const second = Investigation.parse(await res.json());
    expect(second).toMatchObject({ version: 2 });
    await run(second.id);
    const rows = await db
      .select()
      .from(investigations)
      .where(
        eq(
          investigations.cacheKey,
          (await db.query.investigations.findFirst({ where: eq(investigations.id, first.id) }))!.cacheKey,
        ),
      );
    expect(rows.find((r) => r.id === first.id)?.supersededBy).toBe(second.id);
    expect(rows.find((r) => r.id === second.id)?.supersededBy).toBeNull();
    expect((await inv(api(`/v1/investigations/${first.id}`))).version).toBe(1); // sigue consultable
  });
});

describe('feedback and events', () => {
  it('stores feedback without altering the investigation', async () => {
    const created = await inv(
      post('/v1/investigations', { claimId: checkableId, idempotencyKey: 'feedback-1' }),
    );
    await run(created.id);
    const before = await (await api(`/v1/investigations/${created.id}`)).json();
    const fb = await post(`/v1/investigations/${created.id}/feedback`, {
      reason: 'outdated',
      comment: 'dato viejo',
    });
    expect(fb.status).toBe(201);
    expect(await fb.json()).toMatchObject({ status: 'open' });
    expect(await (await api(`/v1/investigations/${created.id}`)).json()).toEqual(before);
    expect((await post(`/v1/investigations/${created.id}/feedback`, { reason: 'because' })).status).toBe(400);
  });

  it('records allowed events only, with an install id', async () => {
    const installId = { 'x-install-id': '0b6f6f9e-7a0e-4f4c-9d0e-2b8f3c1d5a6e' };
    expect(
      (await post('/v1/events', { name: 'panel_opened', videoId: 'TESTvideo01' }, installId)).status,
    ).toBe(204);
    expect((await post('/v1/events', { name: 'panel_opened' })).status).toBe(400);
    expect((await post('/v1/events', { name: 'page_viewed' }, installId)).status).toBe(400);
  });
});

describe('platform', () => {
  it('serves health, openapi, correlation ids and rejects oversized bodies', async () => {
    const h = await api('/health', { headers: { 'x-correlation-id': 'test-corr-1' } });
    expect(await h.json()).toEqual({ status: 'ok', db: true });
    expect(h.headers.get('x-correlation-id')).toBe('test-corr-1');
    const doc = (await (await api('/openapi.json')).json()) as { paths: object };
    expect(Object.keys(doc.paths)).toContain('/v1/investigations');
    const big = await post('/v1/investigations', {
      manualClaim: 'x'.repeat(20_000),
      idempotencyKey: 'big-1',
    });
    expect(big.status).toBe(413);
    expect(await big.json()).toMatchObject({ error: { code: 'validation' } });
  });
});
