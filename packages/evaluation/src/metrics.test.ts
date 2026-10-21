import { FakeLlmClient, LlmClaimExtractor, locateClaim } from '@polifamia/investigation';
import { describe, expect, it } from 'vitest';
import { loadDataset, toSegments, type ExtractionExample } from './dataset.js';
import { computeMetrics, similarity } from './metrics.js';
import { oracleResponder } from './oracle.js';

const dataset = await loadDataset();

describe('seed dataset', () => {
  it('is valid, marked unreviewed, and every gold literal is in its transcript', () => {
    expect(dataset.length).toBeGreaterThanOrEqual(40);
    expect(new Set(dataset.map((d) => d.id)).size).toBe(dataset.length);
    for (const ex of dataset) {
      expect(ex.reviewStatus).toBe('unreviewed-seed');
      for (const e of ex.expected)
        expect(locateClaim(toSegments(ex), e.literal), `${ex.id}: ${e.literal}`).not.toBeNull();
    }
  });
  it('covers negatives, injection and speaker-invariance groups', () => {
    const tags = new Set(dataset.flatMap((d) => d.tags));
    for (const t of [
      'negative',
      'injection',
      'invariance',
      'declared_source',
      'ambiguous_period',
      'territory',
    ])
      expect(tags).toContain(t);
    expect(new Set(dataset.filter((d) => d.group).map((d) => d.group)).size).toBeGreaterThanOrEqual(3);
  });
});

describe('similarity', () => {
  it('matches containment and near-identical spans, not unrelated claims', () => {
    expect(similarity('El IPC subió un 3,1 % en 2023', 'el IPC subió un 3,1 % en 2023.')).toBe(1);
    expect(similarity('El IPC subió un 3,1 %', 'El IPC subió un 3,1 % en 2023')).toBe(0.9);
    expect(similarity('El IPC subió un 3,1 % en 2023', 'El paro bajó al 11 %')).toBeLessThan(0.6);
  });
});

describe('computeMetrics', () => {
  it('oracle run is perfect (harness sanity) and invariance groups are consistent', async () => {
    const extractor = new LlmClaimExtractor(new FakeLlmClient(oracleResponder(dataset)), 'oracle');
    const outcomes = [];
    for (const example of dataset) {
      const r = await extractor.extract(toSegments(example));
      outcomes.push({ example, candidates: r.candidates, rejected: r.rejected.length });
    }
    const m = computeMetrics(outcomes);
    expect(m.extraction).toMatchObject({ fp: 0, fn: 0, precision: 1, recall: 1 });
    expect(m.classification.accuracy).toBe(1);
    expect(m.timestamps.errors).toBe(0);
    expect(m.invariance.inconsistent).toEqual([]);
  });

  it('counts misses, false positives, confusions, timestamp errors and invariance breaks', () => {
    const ex = (id: string, sentences: string[], group?: string): ExtractionExample => ({
      id,
      reviewStatus: 'unreviewed-seed',
      sentences,
      expected: [{ literal: sentences.at(-1)!, claimType: 'statistic' }],
      tags: [],
      group,
    });
    const cand = (literal: string, claimType: 'statistic' | 'opinion', startMs = 0) => ({
      literal,
      context: literal,
      startMs,
      endMs: startMs + 5000,
      claimType,
      checkability: claimType === 'statistic' ? ('CHECKABLE' as const) : ('NOT_CHECKABLE' as const),
      normalized: {},
      declaredSource: null,
    });
    const a = ex('a', ['Hola.', 'El paro bajó al 11 %'], 'g');
    const b = ex('b', ['Hola.', 'El paro bajó al 11 %'], 'g');
    const m = computeMetrics([
      {
        example: a,
        candidates: [cand('El paro bajó al 11 %', 'statistic', 0), cand('Hola', 'opinion')],
        rejected: 1,
      },
      { example: b, candidates: [cand('El paro bajó al 11 %', 'opinion', 5000)], rejected: 0 },
    ]);
    expect(m.extraction).toMatchObject({ tp: 2, fp: 1, fn: 0 });
    expect(m.checkable).toMatchObject({ tp: 1, fn: 1, fp: 0 });
    expect(m.classification.confusions).toHaveLength(1);
    expect(m.timestamps.errors).toBe(1); // 'a' started at 0 ms instead of 5000 ms
    expect(m.rejectedNotLiteral).toBe(1);
    expect(m.invariance.inconsistent).toEqual(['g']);
  });
});
