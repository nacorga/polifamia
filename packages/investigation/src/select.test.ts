import { describe, expect, it } from 'vitest';
import { scoreClaim, selectClaims, type Selectable } from './select.js';

const c = (literal: string, extra: Partial<Selectable> = {}): Selectable => ({
  literal,
  claimType: 'statistic',
  checkability: 'CHECKABLE',
  normalized: {},
  declaredSource: null,
  startMs: 0,
  ...extra,
});

describe('selectClaims', () => {
  it('ranks specific, beta-area claims first and excludes non-checkable ones', () => {
    const vague = c('Hemos hecho muchas cosas', { claimType: 'fact', startMs: 1 });
    const precise = c('El paro bajó al 11,2 % en 2024', {
      normalized: { metric: 'tasa de paro', period: '2024', territory: 'España', unit: '%', value: 11.2 },
      startMs: 2,
    });
    const opinion = c('Es el mejor gobierno', { claimType: 'opinion', checkability: 'NOT_CHECKABLE' });
    const r = selectClaims([vague, opinion, precise]);
    expect(r.map((x) => [x.literal, x.rank])).toEqual([
      [precise.literal, 1],
      [vague.literal, 2],
    ]);
  });

  it('caps the list, breaks ties by order of appearance and can return an empty list', () => {
    const cands = Array.from({ length: 15 }, (_, i) => c(`Dato ${i} del PIB`, { startMs: 15 - i }));
    const r = selectClaims(cands, 10);
    expect(r).toHaveLength(10);
    expect(r[0]!.literal).toBe('Dato 14 del PIB');
    expect(selectClaims([c('opinión', { checkability: 'NOT_CHECKABLE' })])).toEqual([]);
  });

  it('deduplicates conservatively (same text or same full measurement only)', () => {
    const n = { metric: 'tasa de paro', value: 11.2, period: '2024', territory: 'España' };
    const r = selectClaims([
      c('El paro está en el 11,2 %', { normalized: n, startMs: 1 }),
      c('el paro está en el 11,2 %.', { startMs: 2 }),
      c('La tasa de paro es del 11,2 %', { normalized: n, startMs: 3 }),
      c('La tasa de paro es del 11,2 % en Andalucía', {
        normalized: { ...n, territory: 'Andalucía' },
        startMs: 4,
      }),
    ]);
    expect(r.map((x) => x.startMs)).toEqual([1, 4]);
  });
});

describe('speaker/party invariance (FR-019, SC-008)', () => {
  const pairs: [string, string][] = [
    [
      'El Gobierno del PSOE subió las pensiones un 3,8 % en 2024',
      'El Gobierno del PP subió las pensiones un 3,8 % en 2024',
    ],
    ['Con Vox en el Gobierno el paro bajó al 9 %', 'Con Sumar en el Gobierno el paro bajó al 9 %'],
    [
      'Pedro Sánchez dijo que la deuda supera el 105 % del PIB',
      'Alberto Núñez Feijóo dijo que la deuda supera el 105 % del PIB',
    ],
  ];
  const n = { metric: 'x', period: '2024', unit: '%' };

  it.each(pairs)('same score regardless of party or politician named: %s', (a, b) => {
    expect(scoreClaim(c(a, { normalized: n }))).toBe(scoreClaim(c(b, { normalized: n })));
  });

  it('same ranks when only speaker metadata changes', () => {
    const base = pairs.map(([a], i) => c(a, { normalized: n, startMs: i }));
    const withSpeakers = (sp: string) => base.map((x) => ({ ...x, speaker: sp, party: sp }));
    const ranks = (xs: Selectable[]) => selectClaims(xs).map((x) => [x.literal, x.rank]);
    expect(ranks(withSpeakers('Ponente A'))).toEqual(ranks(withSpeakers('Ponente B')));
    expect(ranks(withSpeakers('Ponente A'))).toEqual(ranks(base));
  });
});
