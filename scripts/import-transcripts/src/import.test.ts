import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb, runMigrations, videos } from '@polifamia/api/db';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { importDir } from './import.js';

const DB_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://polifamia:polifamia@localhost:5432/polifamia_test';
const CORPUS = new URL('../../../corpus/videos', import.meta.url).pathname;
const { db, pool } = createDb(DB_URL);
let dir: string;

beforeAll(() => runMigrations(DB_URL));
afterAll(() => pool.end());
beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE events, feedback, evidence, sources, investigations, claims, transcripts, videos CASCADE`,
  );
  dir = await mkdtemp(join(tmpdir(), 'polifamia-import-'));
  await cp(CORPUS, dir, { recursive: true });
  return () => rm(dir, { recursive: true, force: true });
});

describe('importDir', () => {
  it('imports the DEMO corpus once and is idempotent', async () => {
    const first = await importDir(db, dir);
    expect(first.errors).toEqual([]);
    expect(first.results).toEqual([
      { youtubeId: 'DEMOvideo01', transcript: 'created', claims: 7 },
      { youtubeId: 'DEMOvideo02', transcript: 'created', claims: 6 },
    ]);
    const second = await importDir(db, dir);
    expect(second.results.every((r) => r.transcript === 'unchanged' && r.claims === 'unchanged')).toBe(true);
    const rows = await db.select().from(videos);
    expect(rows.map((v) => [v.youtubeId, v.corpusStatus, v.isDemo])).toEqual([
      ['DEMOvideo01', 'claims_ready', true],
      ['DEMOvideo02', 'claims_ready', true],
    ]);
  });

  it('rejects a transcript without a valid rights declaration', async () => {
    await writeFile(
      join(dir, 'demo-01.rights.json'),
      JSON.stringify({ youtubeId: 'DEMOvideo01', title: 'x' }),
    );
    const { errors, results } = await importDir(db, dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^demo-01:/);
    expect(results.map((r) => r.youtubeId)).toEqual(['DEMOvideo02']);
  });

  it('rejects claims that are not literally in the transcript, importing nothing for that video', async () => {
    await writeFile(
      join(dir, 'demo-02.claims.json'),
      JSON.stringify([
        { literal: 'El PIB de España creció un 9 % en 2023.', claimType: 'statistic', rank: 1 },
      ]),
    );
    const { errors } = await importDir(db, dir);
    expect(errors[0]).toMatch(/not found literally/);
    const rows = await db.select().from(videos);
    expect(rows.map((v) => v.youtubeId)).toEqual(['DEMOvideo01']);
  });

  it('creates a new transcript revision when the file changes', async () => {
    await importDir(db, dir);
    await writeFile(join(dir, 'demo-02.claims.json'), '[]');
    await writeFile(join(dir, 'demo-02.vtt'), 'WEBVTT\n\n00:00.000 --> 00:02.000\nNueva revisión.\n');
    const { results } = await importDir(db, dir);
    expect(results[1]).toEqual({ youtubeId: 'DEMOvideo02', transcript: 'created', claims: 'unchanged' });
  });
});
