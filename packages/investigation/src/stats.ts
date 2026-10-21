import type { EvidenceRelation, NormalizedClaim, StatsContext } from '@polifamia/contracts';

/** Cálculos deterministas (PRD §9.2): fórmula, periodo y redondeo explícitos; nunca los hace el LLM. */

export const round = (x: number, decimals = 2) => {
  const f = 10 ** decimals;
  return Math.round((x + Number.EPSILON) * f) / f;
};

/** Formato español: coma decimal, sin separador de miles para no confundir con decimales. */
export const fmt = (x: number, decimals = 2) => String(round(x, decimals)).replace('.', ',');

export const absoluteChange = (from: number, to: number) => to - from;
export const percentChange = (from: number, to: number) => {
  if (from === 0) throw new Error('percent change from 0 is undefined');
  return ((to - from) / Math.abs(from)) * 100;
};
/** Diferencia en puntos porcentuales: solo entre magnitudes que ya son porcentajes. */
export const pointsChange = (fromPct: number, toPct: number) => toPct - fromPct;

const UNIT_ALIASES: Record<string, string> = {
  '%': '%',
  'por ciento': '%',
  porcentaje: '%',
  tasa: '%',
};
const normUnit = (u: string) => {
  const k = u.toLowerCase().trim();
  return UNIT_ALIASES[k] ?? k;
};

export interface SeriesMeta {
  indicator: string;
  unit: string;
  territory: string;
}

export type Direction = 'below' | 'above' | 'equal';

/** Dirección de la comparación afirmada; por defecto «igual a» (con tolerancia de redondeo). */
export function directionOf(comparison: string | undefined): Direction {
  const c = (comparison ?? '').toLowerCase();
  if (/(por debajo|menos de|menor|inferior|bajó del|bajo del)/.test(c)) return 'below';
  if (/(por encima|más de|mas de|mayor|superior|superó|supero)/.test(c)) return 'above';
  return 'equal';
}

/** Mitad de la última cifra significativa del valor afirmado: 12 → ±0,5; 3,1 → ±0,05. */
export function roundingTolerance(value: number): number {
  const s = String(value);
  const decimals = s.includes('.') ? s.split('.')[1]!.length : 0;
  return 0.5 * 10 ** -decimals;
}

export interface StatComparison {
  relation: EvidenceRelation;
  stats: StatsContext;
  /** Motivo por el que no se comparó (heterogeneidad o falta de datos), para «limitaciones». */
  notComparable: string | null;
}

/**
 * Compara la cifra afirmada con una observación oficial. Solo emite supports/contradicts si coinciden
 * indicador (por registro), unidad, territorio y periodo exacto; en otro caso la evidencia es «context».
 */
export function compareClaimToObservation(
  claim: NormalizedClaim,
  series: SeriesMeta,
  obs: { period: string; value: number } | null,
  territoryOk: boolean | null,
): StatComparison {
  const unit = series.unit;
  const base: StatsContext = {
    indicator: series.indicator,
    unit,
    territory: series.territory,
    period: obs?.period ?? claim.period ?? 'no indicado',
    comparisonBase: null,
    formula: null,
    result: obs ? `Dato oficial ${obs.period}: ${fmt(obs.value)} ${unit}.` : null,
  };
  const context = (why: string): StatComparison => ({ relation: 'context', stats: base, notComparable: why });

  if (!obs) return context('No hay observación oficial para el periodo indicado.');
  if (territoryOk === false)
    return context('La afirmación se refiere a otro territorio que la serie consultada.');
  if (territoryOk === null) return context('La afirmación no indica territorio; la serie es nacional.');
  if (!claim.period) return context('La afirmación no indica periodo; se muestra el último dato disponible.');
  if (claim.period !== obs.period)
    return context(`El periodo afirmado (${claim.period}) no coincide con el dato.`);
  if (claim.value == null) return context('La afirmación no contiene una cifra comparable.');
  if (claim.unit && normUnit(claim.unit) !== normUnit(unit))
    return context(`Unidades distintas (afirmación: ${claim.unit}; serie: ${unit}).`);

  const dir = directionOf(claim.comparison);
  const isPct = normUnit(unit) === '%';
  const diff = absoluteChange(claim.value, obs.value);
  const formula = isPct
    ? `${fmt(obs.value)} − ${fmt(claim.value)} = ${fmt(diff)} pp`
    : `(${fmt(obs.value)} − ${fmt(claim.value)}) / ${fmt(claim.value)} × 100 = ${fmt(percentChange(claim.value, obs.value))} %`;
  let holds: boolean;
  let comparisonBase: string;
  if (dir === 'below') {
    holds = obs.value < claim.value;
    comparisonBase = `por debajo de ${fmt(claim.value)} ${unit}`;
  } else if (dir === 'above') {
    holds = obs.value > claim.value;
    comparisonBase = `por encima de ${fmt(claim.value)} ${unit}`;
  } else {
    const tol = roundingTolerance(claim.value);
    holds = Math.abs(diff) <= tol + 1e-9;
    comparisonBase = `${fmt(claim.value)} ${unit} (tolerancia de redondeo ±${fmt(tol, 4)})`;
  }
  return {
    relation: holds ? 'supports' : 'contradicts',
    notComparable: null,
    stats: {
      ...base,
      period: obs.period,
      comparisonBase: `Afirmado: ${comparisonBase}`,
      formula: `Diferencia: ${formula} (redondeo a 2 decimales)`,
      result: `Dato oficial ${obs.period}: ${fmt(obs.value)} ${unit}.`,
    },
  };
}
