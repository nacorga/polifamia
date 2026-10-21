import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

/** Documento institucional autorizado con pasajes copiados literalmente de la fuente (`corpus/documents`). */
export const CorpusDocument = z.object({
  id: z.string(),
  url: z.url().startsWith('https://'),
  title: z.string(),
  publisher: z.string(),
  publishedAt: z.string().nullable(),
  fetchedAt: z.string(),
  terms: z.string(),
  passages: z.array(z.object({ locator: z.string(), text: z.string().min(20) })).min(1),
});
export type CorpusDocument = z.infer<typeof CorpusDocument>;

export interface CorpusHit {
  document: CorpusDocument;
  locator: string;
  text: string;
  score: number;
}

export async function loadCorpus(dir: string): Promise<CorpusDocument[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (f) => CorpusDocument.parse(JSON.parse(await readFile(join(dir, f), 'utf8')))),
  );
}

const STOPWORDS = new Set(
  'el la los las un una unos unas de del al a en y o que se por para con su sus es son lo como más mas este esta ese esa ya no ni le les fue ha han'.split(
    ' ',
  ),
);

/** Tokens de contenido: minúsculas, sin acentos; las cifras se normalizan (1.134 → 1134, 3,1 → 3.1). */
export function tokens(text: string): Set<string> {
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/(\d)\.(\d{3})/g, '$1$2')
    .replace(/(\d),(\d)/g, '$1.$2')
    .split(/[^\p{L}\p{N}.]+/u)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(t);
}

/**
 * Búsqueda léxica simple sobre los pasajes (sin embeddings, research R6). La puntuación es la fracción
 * de tokens de la afirmación presentes en el pasaje; las cifras pesan doble.
 */
export function searchCorpus(docs: CorpusDocument[], query: string, minScore = 0.3, limit = 3): CorpusHit[] {
  const q = tokens(query);
  if (q.size === 0) return [];
  const weight = (w: string) => (/\d/.test(w) ? 2 : 1);
  const total = [...q].reduce((s, w) => s + weight(w), 0);
  const hits: CorpusHit[] = [];
  for (const document of docs) {
    for (const p of document.passages) {
      const pt = tokens(p.text);
      const score = [...q].reduce((s, w) => s + (pt.has(w) ? weight(w) : 0), 0) / total;
      if (score >= minScore) hits.push({ document, locator: p.locator, text: p.text, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
