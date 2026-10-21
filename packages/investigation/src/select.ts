import type { Checkability, ClaimType, NormalizedClaim } from '@polifamia/contracts';
import { normalizeText } from './cache-key.js';

/** Solo los campos que pueden influir en la selección: nunca orador ni partido (FR-019). */
export interface Selectable {
  literal: string;
  claimType: ClaimType;
  checkability: Checkability;
  normalized: NormalizedClaim;
  declaredSource: string | null;
  startMs: number;
}

/** Áreas beta del PRD: economía, empleo y presupuestos. Términos temáticos, nunca políticos. */
const BETA_AREA =
  /\b(paro|desempleo|empleo|emple\w*|afiliad\w*|afiliaci[oó]n|salario\w*|sueldo\w*|pib|crecimiento|inflaci[oó]n|ipc|precios?|d[eé]ficit|deuda|presupuesto\w*|gasto|impuesto\w*|recaudaci[oó]n|pensi[oó]n\w*|pensionistas|vivienda|alquiler\w*|exportaci[oó]n\w*|inversi[oó]n|contrat\w*|hogares)\b/i;

export const SELECTION_VERSION = 'select-v1';

/** Puntuación de especificidad y contrastabilidad. Determinista y explicable. */
export function scoreClaim(c: Selectable): number {
  const n = c.normalized;
  let score = 0;
  if (/\d/.test(c.literal) || n.value != null) score += 3;
  if (n.period) score += 2;
  if (n.territory) score += 1;
  if (n.metric) score += 1;
  if (n.unit) score += 1;
  if (BETA_AREA.test(c.literal) || (n.metric && BETA_AREA.test(n.metric))) score += 2;
  if (c.declaredSource) score += 1;
  if (c.claimType === 'statistic') score += 1;
  return score;
}

function sameMeasurement(a: NormalizedClaim, b: NormalizedClaim): boolean {
  return (
    a.metric != null &&
    a.value != null &&
    a.metric === b.metric &&
    a.value === b.value &&
    a.period === b.period &&
    a.territory === b.territory
  );
}

/**
 * Selecciona hasta `max` afirmaciones verificables: puntuación desc., luego orden de aparición.
 * Deduplicación conservadora: solo texto normalizado idéntico o misma medición completa.
 */
export function selectClaims<T extends Selectable>(candidates: T[], max = 10): (T & { rank: number })[] {
  const ranked = candidates
    .filter((c) => c.checkability === 'CHECKABLE')
    .map((c) => ({ c, score: scoreClaim(c) }))
    .sort((a, b) => b.score - a.score || a.c.startMs - b.c.startMs);
  const kept: T[] = [];
  for (const { c } of ranked) {
    if (kept.length >= max) break;
    const dup = kept.some(
      (k) =>
        normalizeText(k.literal) === normalizeText(c.literal) || sameMeasurement(k.normalized, c.normalized),
    );
    if (!dup) kept.push(c);
  }
  return kept.map((c, i) => ({ ...c, rank: i + 1 }));
}
