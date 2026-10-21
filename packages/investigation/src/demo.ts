import type { InvestigationInput, InvestigationOutcome, Investigator } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Investigador simulado para el vertical slice D1. Todo lo que devuelve va etiquetado DEMO y
 * nunca emite SUPPORTED/CONTRADICTED: no hay evidencia real detrás.
 */
export class DemoInvestigator implements Investigator {
  constructor(private readonly delayMs = 1500) {}

  async investigate(input: InvestigationInput): Promise<InvestigationOutcome> {
    await new Promise((r) => setTimeout(r, this.delayMs));
    const base = {
      isDemo: true,
      pipelineVersion: 'demo-1',
      models: { investigator: 'demo' },
      costEur: 0,
      tokensIn: 0,
      tokensOut: 0,
      ttlMs: DAY_MS,
      stats: null,
    };
    if (!/\d/.test(input.literal)) {
      return {
        ...base,
        status: 'INSUFFICIENT_EVIDENCE',
        conclusion: 'INSUFFICIENT_EVIDENCE',
        summary: '[DEMO] Resultado simulado: no es una verificación real.',
        context: null,
        limitations: '[DEMO] Sin fuentes reales consultadas.',
        evidence: [],
      };
    }
    return {
      ...base,
      status: 'COMPLETED',
      conclusion: 'NEEDS_CONTEXT',
      summary: '[DEMO] Resultado simulado: no es una verificación real.',
      context: '[DEMO] Aquí aparecerá el indicador, la unidad, el territorio y el periodo de la cifra.',
      limitations: '[DEMO] La evidencia mostrada es ficticia y solo sirve para probar la interfaz.',
      evidence: [
        {
          source: {
            url: 'https://example.org/demo-source',
            title: '[DEMO] Fuente simulada',
            publisher: 'DEMO',
            publishedAt: null,
            kind: 'primary',
          },
          locator: '[DEMO] tabla 1',
          excerpt: '[DEMO] Fragmento simulado de una fuente.',
          relation: 'context',
          provenance: input.declaredSource ? 'declared_source' : 'retrieved_evidence',
          dataDate: null,
        },
      ],
    };
  }
}
