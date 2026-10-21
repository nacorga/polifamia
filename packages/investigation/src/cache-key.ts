import { createHash } from 'node:crypto';
import type { NormalizedClaim } from '@polifamia/contracts';

/** Versión del registro de fuentes/conectores; incrementar al cambiar fuentes (FR-010, research R8). */
export const SOURCES_REVISION = 'ine3-boe1-factcheck1@2026-10-21';

/** Minúsculas, sin puntuación, espacios colapsados. Conserva acentos y cifras. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%,.\s]/gu, ' ')
    .replace(/(?<!\d)[.,]|[.,](?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clave de reutilización: solo coincide si el texto normalizado y todos los campos de contexto
 * (métrica, entidad, territorio, periodo, unidad) y la revisión de fuentes son idénticos.
 * Sin similitud aproximada: preferimos reinvestigar a reutilizar mal.
 */
export function cacheKey(
  literal: string,
  normalized: NormalizedClaim,
  mode: 'demo' | 'real',
  sourcesRevision = SOURCES_REVISION,
): string {
  const parts = [
    normalizeText(literal),
    normalized.metric ?? '',
    normalized.entity ?? '',
    normalized.territory ?? '',
    normalized.period ?? '',
    normalized.unit ?? '',
    sourcesRevision,
    mode,
  ];
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}
