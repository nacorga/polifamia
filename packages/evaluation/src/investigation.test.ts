import { describe, expect, it } from 'vitest';
import { investigationMetrics, loadInvestigationCases, offlineDeps, runCase } from './investigation.js';

describe('investigation eval harness (offline)', () => {
  it('runs every seed case with the expected outcome and no integrity or abstention violations', async () => {
    const cases = await loadInvestigationCases();
    expect(cases.length).toBeGreaterThanOrEqual(20);
    const results = [];
    for (const c of cases) results.push(await runCase(c, offlineDeps(c)));
    const m = investigationMetrics(results);
    expect(m.mismatches).toEqual([]);
    expect(m.citationIntegrityViolations).toEqual([]);
    expect(m.categoricalWithoutPrimaryEvidence).toEqual([]);
    expect(m.statsContext.rate).toBe(1);
  });

  it('detects a categorical conclusion without primary evidence', () => {
    const c = { id: 'x', expected: { outcome: 'SUPPORTED' } } as never;
    const outcome = {
      conclusion: 'SUPPORTED',
      evidence: [],
      summary: '',
      context: null,
      limitations: '',
      stats: null,
    } as never;
    expect(
      investigationMetrics([{ case: c, outcome, failure: null }]).categoricalWithoutPrimaryEvidence,
    ).toEqual(['x']);
  });
});
