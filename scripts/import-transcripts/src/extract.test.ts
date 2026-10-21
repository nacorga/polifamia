import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claims, createDb, runMigrations, videos } from '@polifamia/api/db';
import { FakeLlmClient, LlmClaimExtractor } from '@polifamia/investigation';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { extractVideoClaims } from './extract.js';
import { importDir } from './import.js';

const DB_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://polifamia:polifamia@localhost:5432/polifamia_test';
const CORPUS = new URL('../../../corpus/videos', import.meta.url).pathname;
const { db, pool } = createDb(DB_URL);

const out = (literal: string, claimType: string, extra = {}) => ({
  literal,
  claimType,
  metric: null,
  entity: null,
  territory: null,
  period: null,
  unit: null,
  value: null,
  comparison: null,
  declaredSource: null,
  ...extra,
});

beforeAll(() => runMigrations(DB_URL));
afterAll(() => pool.end());
beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE events, feedback, evidence, sources, investigations, claims, transcripts, videos CASCADE`,
  );
  // Importa la transcripción DEMO 01 sin su fichero de claims curadas → queda preparing_claims.
  const dir = await mkdtemp(join(tmpdir(), 'polifamia-extract-'));
  await cp(join(CORPUS, 'demo-01.rights.json'), join(dir, 'demo-01.rights.json'));
  await cp(join(CORPUS, 'demo-01.srt'), join(dir, 'demo-01.srt'));
  await importDir(db, dir);
  return () => rm(dir, { recursive: true, force: true });
});

describe('extractVideoClaims', () => {
  it('persists only selected checkable literal claims, ranked, and marks the video ready', async () => {
    const llm = new FakeLlmClient(() => ({
      claims: [
        out('bajó del 12 % en el tercer trimestre de 2024', 'statistic', {
          metric: 'tasa de paro',
          period: '2024T3',
        }),
        out('este es el mejor gobierno de nuestra historia', 'opinion'),
        out('La tasa de paro bajó al 5 %', 'statistic'), // inventada
      ],
    }));
    const before = await db.query.videos.findFirst({ where: eq(videos.youtubeId, 'DEMOvideo01') });
    expect(before!.corpusStatus).toBe('preparing_claims');

    const r = await extractVideoClaims(db, 'DEMOvideo01', new LlmClaimExtractor(llm, 'claude-haiku-5-5'));
    expect(r).toMatchObject({ claims: 1, rejected: 1 });
    const rows = await db.select().from(claims);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      literal: 'bajó del 12 % en el tercer trimestre de 2024',
      startMs: 9500,
      rank: 1,
      checkability: 'CHECKABLE',
      extractor: 'claude-haiku-5-5@extract-v1',
      speaker: null,
    });
    const after = await db.query.videos.findFirst({ where: eq(videos.youtubeId, 'DEMOvideo01') });
    expect(after!.corpusStatus).toBe('claims_ready');

    // Inmutabilidad: una segunda ejecución no reescribe las claims de esa revisión.
    const again = await extractVideoClaims(db, 'DEMOvideo01', new LlmClaimExtractor(llm, 'm'));
    expect(again.claims).toBe('unchanged');
  });

  it('accepts an empty result and fails clearly for unknown videos', async () => {
    const llm = new FakeLlmClient(() => ({ claims: [] }));
    expect((await extractVideoClaims(db, 'DEMOvideo01', new LlmClaimExtractor(llm, 'm'))).claims).toBe(0);
    await expect(extractVideoClaims(db, 'zzzzzzzzzzz', new LlmClaimExtractor(llm, 'm'))).rejects.toThrow(
      /not in catalog/,
    );
  });
});
