import { ExtractionOutput, joinSegments, type LlmRequest } from '@polifamia/investigation';
import { toSegments, type ExtractionExample } from './dataset.js';

/** Responde con las etiquetas de referencia del ejemplo cuyo texto aparece en el prompt. */
export function oracleResponder(dataset: ExtractionExample[]) {
  const byText = new Map(dataset.map((ex) => [joinSegments(toSegments(ex)), ex]));
  return (req: LlmRequest<unknown>): ExtractionOutput => {
    const ex = [...byText].find(([text]) => req.user.includes(text))?.[1];
    return {
      claims: (ex?.expected ?? []).map((e) => ({
        literal: e.literal,
        claimType: e.claimType,
        metric: null,
        entity: null,
        territory: null,
        period: null,
        unit: null,
        value: null,
        comparison: null,
        declaredSource: null,
      })),
    };
  };
}
