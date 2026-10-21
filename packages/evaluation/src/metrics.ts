import type { ClaimType } from '@polifamia/contracts';
import {
  checkabilityOf,
  locateClaim,
  normalizeText,
  scoreClaim,
  type ExtractedCandidate,
} from '@polifamia/investigation';
import { toSegments, type ExtractionExample } from './dataset.js';

const tokens = (s: string) => new Set(normalizeText(s).split(' ').filter(Boolean));

/** Similitud entre literales: contención o Jaccard de tokens. */
export function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const ta = tokens(a);
  const tb = tokens(b);
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return inter / (ta.size + tb.size - inter || 1);
}

export const MATCH_THRESHOLD = 0.6;
export const TIMESTAMP_TOLERANCE_MS = 2000;

export interface ExampleOutcome {
  example: ExtractionExample;
  candidates: ExtractedCandidate[];
  rejected: number;
}

const ratio = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 1000);

/** Métricas por etapa (PRD §12): extracción, verificabilidad, clasificación, timestamps, invariancia. */
export function computeMetrics(outcomes: ExampleOutcome[]) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let checkTp = 0;
  let checkFp = 0;
  let checkFn = 0;
  let typeCorrect = 0;
  let timestampErrors = 0;
  let rejected = 0;
  const confusions: { id: string; literal: string; expected: ClaimType; got: ClaimType }[] = [];
  const falsePositives: { id: string; literal: string }[] = [];
  const misses: { id: string; literal: string }[] = [];

  for (const { example, candidates, rejected: rej } of outcomes) {
    rejected += rej;
    const segments = toSegments(example);
    const free = new Set(candidates.map((_, i) => i));
    for (const exp of example.expected) {
      let best = -1;
      let bestSim = MATCH_THRESHOLD;
      for (const i of free) {
        const s = similarity(exp.literal, candidates[i]!.literal);
        if (s >= bestSim) [best, bestSim] = [i, s];
      }
      const expCheckable = checkabilityOf(exp.claimType) === 'CHECKABLE';
      if (best === -1) {
        fn++;
        if (expCheckable) checkFn++;
        misses.push({ id: example.id, literal: exp.literal });
        continue;
      }
      free.delete(best);
      const got = candidates[best]!;
      tp++;
      if (got.claimType === exp.claimType) typeCorrect++;
      else
        confusions.push({
          id: example.id,
          literal: exp.literal,
          expected: exp.claimType,
          got: got.claimType,
        });
      const gotCheckable = got.checkability === 'CHECKABLE';
      if (expCheckable && gotCheckable) checkTp++;
      else if (expCheckable) checkFn++;
      else if (gotCheckable) checkFp++;
      const expStart = locateClaim(segments, exp.literal)?.startMs;
      if (expStart == null || Math.abs(got.startMs - expStart) > TIMESTAMP_TOLERANCE_MS) timestampErrors++;
    }
    for (const i of free) {
      fp++;
      if (candidates[i]!.checkability === 'CHECKABLE') checkFp++;
      falsePositives.push({ id: example.id, literal: candidates[i]!.literal });
    }
  }

  // Invariancia: dentro de cada grupo, misma firma (tipo + puntuación de selección) por claim.
  const groups = new Map<string, string[]>();
  for (const { example, candidates } of outcomes) {
    if (!example.group) continue;
    const sig = candidates
      .map((c) => `${c.claimType}:${scoreClaim(c)}`)
      .sort()
      .join('|');
    groups.set(example.group, [...(groups.get(example.group) ?? []), sig]);
  }
  const inconsistentGroups = [...groups].filter(([, sigs]) => new Set(sigs).size > 1).map(([g]) => g);

  return {
    examples: outcomes.length,
    expectedClaims: tp + fn,
    extraction: { tp, fp, fn, precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn) },
    checkable: {
      tp: checkTp,
      fp: checkFp,
      fn: checkFn,
      precision: ratio(checkTp, checkTp + checkFp),
      recall: ratio(checkTp, checkTp + checkFn),
    },
    classification: { matched: tp, correct: typeCorrect, accuracy: ratio(typeCorrect, tp), confusions },
    timestamps: { matched: tp, errors: timestampErrors, toleranceMs: TIMESTAMP_TOLERANCE_MS },
    rejectedNotLiteral: rejected,
    invariance: { groups: groups.size, inconsistent: inconsistentGroups },
    falsePositives,
    misses,
  };
}
