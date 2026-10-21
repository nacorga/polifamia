import { readFile } from 'node:fs/promises';
import { ClaimType } from '@polifamia/contracts';
import type { Segment } from '@polifamia/investigation';
import { z } from 'zod';

/** `unreviewed-seed`: etiquetado por el equipo de desarrollo; `reviewed`: ≥2 revisores humanos (gate G2). */
export const ReviewStatus = z.enum(['unreviewed-seed', 'reviewed']);

export const ExtractionExample = z.strictObject({
  id: z.string(),
  reviewStatus: ReviewStatus,
  /** Cada frase se convierte en un segmento de 5 s; varias frases = varios cues. */
  sentences: z.array(z.string().min(1)).min(1),
  expected: z.array(z.strictObject({ literal: z.string(), claimType: ClaimType })),
  tags: z.array(z.string()),
  /** Mismo texto salvo orador/partido: debe recibir idéntica clasificación y puntuación. */
  group: z.string().optional(),
  speaker: z.string().optional(),
});
export type ExtractionExample = z.infer<typeof ExtractionExample>;

export const SEGMENT_MS = 5000;

export function toSegments(ex: ExtractionExample): Segment[] {
  return ex.sentences.map((text, i) => ({ startMs: i * SEGMENT_MS, endMs: (i + 1) * SEGMENT_MS, text }));
}

export const DEFAULT_DATASET = new URL('../data/extraction.seed.jsonl', import.meta.url);

export async function loadDataset(path: string | URL = DEFAULT_DATASET): Promise<ExtractionExample[]> {
  const lines = (await readFile(path, 'utf8')).split('\n').filter((l) => l.trim());
  return lines.map((l, i) => {
    const parsed = ExtractionExample.safeParse(JSON.parse(l));
    if (!parsed.success) throw new Error(`line ${i + 1}: ${z.prettifyError(parsed.error)}`);
    return parsed.data;
  });
}
