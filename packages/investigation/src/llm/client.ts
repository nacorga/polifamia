import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { InvestigationFailure } from '../types.js';

export interface LlmRequest<T> {
  model: string;
  promptVersion: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

/** Registro por llamada (FR-015): modelo, versión de prompt, tokens y coste. */
export interface LlmUsage {
  model: string;
  promptVersion: string;
  tokensIn: number;
  tokensOut: number;
  costEur: number;
}

export interface LlmClient {
  complete<T>(req: LlmRequest<T>): Promise<{ data: T; usage: LlmUsage }>;
}

/** USD por millón de tokens (entrada, salida). Tarifas públicas de Anthropic, 2026-10. */
const PRICES_USD_PER_MTOK: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
};
// ponytail: tipo de cambio fijo; usar uno diario si el coste se factura en EUR con precisión.
const USD_TO_EUR = 0.92;

export function costEur(model: string, tokensIn: number, tokensOut: number): number {
  const price = PRICES_USD_PER_MTOK[model];
  if (!price) throw new Error(`No price configured for model "${model}" (cost must be measured)`);
  return ((tokensIn * price[0] + tokensOut * price[1]) / 1_000_000) * USD_TO_EUR;
}

export const DEFAULT_MODELS = { extract: 'claude-haiku-5-5', synth: 'claude-opus-5-5' } as const;

/** Implementación por defecto: SDK de Anthropic con salida estructurada validada por Zod. */
export class AnthropicLlmClient implements LlmClient {
  constructor(private readonly client = new Anthropic()) {}

  async complete<T>(req: LlmRequest<T>): Promise<{ data: T; usage: LlmUsage }> {
    let response;
    try {
      response = await this.client.messages.parse({
        model: req.model,
        max_tokens: req.maxTokens ?? 8000,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
        output_config: { format: zodOutputFormat(req.schema) },
      });
    } catch (err) {
      throw new InvestigationFailure('provider_error', `LLM call failed: ${(err as Error).message}`);
    }
    if (response.stop_reason === 'refusal' || response.parsed_output == null) {
      throw new InvestigationFailure(
        'provider_error',
        `LLM returned no valid output (${response.stop_reason})`,
      );
    }
    const { input_tokens: tokensIn, output_tokens: tokensOut } = response.usage;
    return {
      // Segunda validación: el borde con el modelo nunca se da por bueno.
      data: req.schema.parse(response.parsed_output),
      usage: {
        model: req.model,
        promptVersion: req.promptVersion,
        tokensIn,
        tokensOut,
        costEur: costEur(req.model, tokensIn, tokensOut),
      },
    };
  }
}

/** Cliente determinista para tests y evaluación offline: nunca llama a la red. */
export class FakeLlmClient implements LlmClient {
  readonly calls: LlmRequest<unknown>[] = [];
  constructor(private readonly respond: (req: LlmRequest<unknown>) => unknown) {}

  async complete<T>(req: LlmRequest<T>): Promise<{ data: T; usage: LlmUsage }> {
    this.calls.push(req as LlmRequest<unknown>);
    return {
      data: req.schema.parse(this.respond(req as LlmRequest<unknown>)),
      usage: {
        model: `fake:${req.model}`,
        promptVersion: req.promptVersion,
        tokensIn: 0,
        tokensOut: 0,
        costEur: 0,
      },
    };
  }
}
