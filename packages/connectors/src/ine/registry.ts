/**
 * Registro de series INE aprobadas (research R6). Solo estas series se consultan; añadir una exige
 * comprobar código, unidad y territorio en `SERIE/{cod}?det=1` e incrementar SOURCES_REVISION.
 * Verificado contra la API Tempus3 el 2026-10-21.
 */
export interface IneSeries {
  code: string;
  /** Nombre de la serie tal como lo devuelve el INE. */
  indicator: string;
  /** Términos (normalizados) que identifican la métrica en una afirmación. */
  aliases: string[];
  unit: string;
  territory: string;
  periodicity: 'monthly' | 'quarterly';
  operation: string;
  /** Página pública de la operación estadística (fuente enlazable para el usuario). */
  publicUrl: string;
}

export const INE_SERIES: readonly IneSeries[] = [
  {
    code: 'EPA452434',
    indicator: 'Tasa de paro de la población. Ambos sexos. Total Nacional. Total.',
    aliases: ['tasa de paro', 'tasa de desempleo', 'paro epa'],
    unit: '%',
    territory: 'España',
    periodicity: 'quarterly',
    operation: 'Encuesta de Población Activa (EPA)',
    publicUrl:
      'https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736176918&idp=1254735976595',
  },
  {
    code: 'IPC251856',
    indicator: 'Nacional. Índice general. Variación anual.',
    aliases: ['ipc variación interanual', 'inflación interanual', 'inflación', 'ipc variación anual'],
    unit: '%',
    territory: 'España',
    periodicity: 'monthly',
    operation: 'Índice de Precios de Consumo (IPC)',
    publicUrl:
      'https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736176802&idp=1254735976607',
  },
  {
    code: 'CNTR6597',
    indicator:
      'Total Nacional. Datos ajustados de estacionalidad y calendario. Producto interior bruto a precios de mercado. Dato base. Precios corrientes.',
    aliases: ['pib trimestral precios corrientes', 'producto interior bruto trimestral'],
    unit: 'millones de euros (precios corrientes)',
    territory: 'España',
    periodicity: 'quarterly',
    operation: 'Contabilidad Nacional Trimestral de España: Principales Agregados',
    publicUrl:
      'https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736164439&idp=1254735576581',
  },
];

const TERRITORY_ALIASES = ['españa', 'nacional', 'total nacional'];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();

/** Serie aprobada cuyo alias coincide con la métrica, o null. Sin coincidencias aproximadas. */
export function findSeries(metric: string | undefined): IneSeries | null {
  if (!metric) return null;
  const m = norm(metric);
  return INE_SERIES.find((s) => s.aliases.some((a) => m === norm(a) || m.includes(norm(a)))) ?? null;
}

/** null = territorio no indicado; false = otro territorio (la serie nacional no sirve). */
export function territoryMatches(territory: string | undefined): boolean | null {
  if (!territory) return null;
  return TERRITORY_ALIASES.some((a) => norm(a) === norm(territory));
}
