import { z } from 'zod';
import { SourceError, type Fetcher } from '../safe-fetch.js';
import type { IneSeries } from './registry.js';

export const INE_HOST = 'servicios.ine.es';
const BASE = `https://${INE_HOST}/wstempus/js/ES/DATOS_SERIE`;

const IneResponse = z.object({
  COD: z.string(),
  Nombre: z.string(),
  Data: z.array(
    z.object({ Fecha: z.number(), FK_Periodo: z.number(), Anyo: z.number(), Valor: z.number().nullable() }),
  ),
});

export interface IneObservation {
  /** `2024T3` (trimestral) o `2023-12` (mensual). */
  period: string;
  value: number;
}

export interface IneResult {
  series: IneSeries;
  /** URL exacta consultada: es el localizador reproducible de la evidencia. */
  queryUrl: string;
  name: string;
  observations: IneObservation[];
}

/** FK_Periodo de Tempus3: 1–12 meses; 19–22 trimestres T1–T4 (comprobado con fechas de inicio). */
function periodLabel(year: number, fk: number, periodicity: IneSeries['periodicity']): string | null {
  if (periodicity === 'monthly' && fk >= 1 && fk <= 12) return `${year}-${String(fk).padStart(2, '0')}`;
  if (periodicity === 'quarterly' && fk >= 19 && fk <= 22) return `${year}T${fk - 18}`;
  return null;
}

/** Rango de fechas `YYYYMMDD:YYYYMMDD` para un periodo `2024T3`, `2023-12` o `2023` (todo el año). */
export function periodRange(period: string): string | null {
  const ymd = (y: number, m: number, d: number) =>
    `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  let m: RegExpMatchArray | null;
  if ((m = period.match(/^(\d{4})T([1-4])$/))) {
    const y = Number(m[1]);
    const q = Number(m[2]);
    return `${ymd(y, q * 3 - 2, 1)}:${ymd(y, q * 3, lastDay(y, q * 3))}`;
  }
  if ((m = period.match(/^(\d{4})-(\d{2})$/))) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12) return null;
    return `${ymd(y, mo, 1)}:${ymd(y, mo, lastDay(y, mo))}`;
  }
  if ((m = period.match(/^(\d{4})$/))) return `${m[1]}0101:${m[1]}1231`;
  return null;
}

export function ineQueryUrl(series: IneSeries, period?: string): string {
  const range = period ? periodRange(period) : null;
  return range ? `${BASE}/${series.code}?date=${range}` : `${BASE}/${series.code}?nult=4`;
}

export function parseIneResponse(series: IneSeries, queryUrl: string, body: string): IneResult {
  let parsed;
  try {
    parsed = IneResponse.parse(JSON.parse(body));
  } catch {
    throw new SourceError('unexpected INE response shape', queryUrl);
  }
  if (parsed.COD !== series.code) throw new SourceError(`INE returned ${parsed.COD}`, queryUrl);
  const observations: IneObservation[] = [];
  for (const d of parsed.Data) {
    const period = periodLabel(d.Anyo, d.FK_Periodo, series.periodicity);
    if (period && d.Valor != null) observations.push({ period, value: d.Valor });
  }
  return { series, queryUrl, name: parsed.Nombre.trim(), observations };
}

/** Consulta reproducible: un periodo concreto si la afirmación lo da; si no, las últimas observaciones. */
export async function fetchIneSeries(
  fetcher: Fetcher,
  series: IneSeries,
  period?: string,
): Promise<IneResult> {
  const queryUrl = ineQueryUrl(series, period);
  const res = await fetcher(queryUrl);
  if (res.status !== 200) throw new SourceError(`INE HTTP ${res.status}`, queryUrl);
  return parseIneResponse(series, queryUrl, res.text);
}
