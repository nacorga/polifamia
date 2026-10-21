import type { Conclusion, EvidenceRelation, SourceKind } from '@polifamia/contracts';

export interface PolicyEvidence {
  relation: EvidenceRelation;
  locator: string;
  excerpt: string;
  kind: SourceKind;
}

export interface PolicyDecision {
  status: 'COMPLETED' | 'INSUFFICIENT_EVIDENCE';
  conclusion: Conclusion;
  /** Motivo legible para «limitaciones»; null si la decisión es directa. */
  note: string | null;
}

/**
 * Política de evidencia determinista (research R7, constitución I). La conclusión la decide este código,
 * nunca el LLM:
 * - Solo cuenta evidencia con localizador y extracto realmente recuperado.
 * - Solo fuentes primarias pueden sostener SUPPORTED/CONTRADICTED; una verificación de terceros es un
 *   índice (PRD §9.2), así que su valoración cuenta como contexto.
 * - Apoyo y contradicción a la vez → NEEDS_CONTEXT. Solo contexto → NEEDS_CONTEXT.
 * - Nada pertinente → INSUFFICIENT_EVIDENCE (que no implica «falso»).
 */
export function decideConclusion(items: readonly PolicyEvidence[]): PolicyDecision {
  const usable = items.filter((e) => e.relation !== 'irrelevant' && e.locator.trim() && e.excerpt.trim());
  const decisive = (r: EvidenceRelation) => usable.some((e) => e.relation === r && e.kind === 'primary');
  const supports = decisive('supports');
  const contradicts = decisive('contradicts');

  if (supports && contradicts)
    return {
      status: 'COMPLETED',
      conclusion: 'NEEDS_CONTEXT',
      note: 'Hay fuentes primarias que apoyan y otras que contradicen la afirmación.',
    };
  if (supports) return { status: 'COMPLETED', conclusion: 'SUPPORTED', note: null };
  if (contradicts) return { status: 'COMPLETED', conclusion: 'CONTRADICTED', note: null };
  if (usable.length > 0) {
    const onlyThirdParty = usable.every((e) => e.kind !== 'primary');
    return {
      status: 'COMPLETED',
      conclusion: 'NEEDS_CONTEXT',
      note: onlyThirdParty
        ? 'Solo se han localizado verificaciones o fuentes secundarias; no se ha comprobado contra la fuente primaria.'
        : 'La evidencia localizada aporta contexto pero no permite confirmar ni descartar la afirmación tal como se formula.',
    };
  }
  return {
    status: 'INSUFFICIENT_EVIDENCE',
    conclusion: 'INSUFFICIENT_EVIDENCE',
    note: 'No se ha localizado evidencia pertinente en las fuentes consultadas. Esto no significa que la afirmación sea falsa.',
  };
}
