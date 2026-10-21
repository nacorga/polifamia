import { describe, expect, it } from 'vitest';
import { cacheKey, normalizeText } from './cache-key.js';
import { DemoInvestigator } from './demo.js';

describe('normalizeText', () => {
  it('ignores case, punctuation and whitespace but keeps numbers and accents', () => {
    expect(normalizeText('  El PARO bajó   un 5,2 %… ¡en 2024!  ')).toBe('el paro bajó un 5,2 % en 2024');
  });
});

describe('cacheKey', () => {
  const n = { metric: 'tasa de paro', territory: 'España', period: '2024' };
  it('is stable across cosmetic differences', () => {
    expect(cacheKey('El paro bajó un 5 %.', n, 'real')).toBe(cacheKey('el paro  bajó un 5 %', n, 'real'));
  });
  it('changes with territory, period, entity, unit, mode or sources revision', () => {
    const k = cacheKey('El paro bajó un 5 %', n, 'real');
    expect(cacheKey('El paro bajó un 5 %', { ...n, territory: 'Andalucía' }, 'real')).not.toBe(k);
    expect(cacheKey('El paro bajó un 5 %', { ...n, period: '2023' }, 'real')).not.toBe(k);
    expect(cacheKey('El paro bajó un 5 %', { ...n, entity: 'INE' }, 'real')).not.toBe(k);
    expect(cacheKey('El paro bajó un 5 %', { ...n, unit: 'personas' }, 'real')).not.toBe(k);
    expect(cacheKey('El paro bajó un 5 %', n, 'demo')).not.toBe(k);
    expect(cacheKey('El paro bajó un 5 %', n, 'real', 'other-rev')).not.toBe(k);
  });
  it('distinguishes different numbers', () => {
    expect(cacheKey('El paro bajó un 5 %', n, 'real')).not.toBe(cacheKey('El paro bajó un 6 %', n, 'real'));
    expect(cacheKey('creció un 1,5 %', {}, 'real')).not.toBe(cacheKey('creció un 15 %', {}, 'real'));
  });
});

describe('DemoInvestigator', () => {
  const input = { kind: 'manual' as const, context: null, normalized: {}, declaredSource: null };
  it('never emits a categorical conclusion and always flags DEMO', async () => {
    const inv = new DemoInvestigator(0);
    for (const literal of ['El paro bajó un 5 %', 'España va bien']) {
      const r = await inv.investigate({ ...input, literal });
      expect(r.isDemo).toBe(true);
      expect(['SUPPORTED', 'CONTRADICTED']).not.toContain(r.conclusion);
      expect(r.summary).toMatch(/DEMO/);
    }
  });
});
