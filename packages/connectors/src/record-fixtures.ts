/**
 * Graba respuestas REALES para tests y corpus (red necesaria). Nada de lo que escribe se edita a mano.
 *   pnpm --filter @polifamia/connectors record:fixtures
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createFetcher } from './safe-fetch.js';
import { INE_HOST, ineQueryUrl } from './ine/client.js';
import { INE_SERIES } from './ine/registry.js';
import type { CorpusDocument } from './corpus.js';

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
const fetchedAt = new Date().toISOString();

// 1. INE: últimas observaciones de cada serie + periodos usados en tests/eval.
const ine = createFetcher([INE_HOST]);
const inePeriods: Record<string, (string | undefined)[]> = {
  EPA452434: [undefined, '2024T3'],
  IPC251856: [undefined, '2023-12'],
  CNTR6597: [undefined],
};
await mkdir(root('packages/connectors/fixtures/ine'), { recursive: true });
for (const series of INE_SERIES) {
  for (const period of inePeriods[series.code] ?? [undefined]) {
    const url = ineQueryUrl(series, period);
    const res = await ine(url);
    const file = `${series.code}.${period ?? 'latest'}.json`;
    await writeFile(
      root(`packages/connectors/fixtures/ine/${file}`),
      JSON.stringify({ _recorded: { url, fetchedAt, status: res.status }, body: res.text }, null, 1) + '\n',
    );
    console.log(`✓ ine ${file}`);
  }
}

// 2. Corpus: artículos del Real Decreto 145/2024 (SMI 2024), texto literal del BOE.
const BOE_ID = 'BOE-A-2024-2251';
const boeUrl = `https://www.boe.es/diario_boe/txt.php?id=${BOE_ID}`;
const boe = await createFetcher(['www.boe.es'])(boeUrl);
const plain = boe.text
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ');
const article = (n: number) => {
  const start = plain.indexOf(`Artículo ${n}.`);
  const end = plain.indexOf(`Artículo ${n + 1}.`, start);
  if (start < 0 || end < 0) throw new Error(`Artículo ${n} not found in ${BOE_ID}`);
  return plain.slice(start, end).trim();
};
const doc: CorpusDocument = {
  id: BOE_ID,
  url: boeUrl,
  title:
    'Real Decreto 145/2024, de 6 de febrero, por el que se fija el salario mínimo interprofesional para 2024.',
  publisher: 'Agencia Estatal Boletín Oficial del Estado',
  publishedAt: '2024-02-07',
  fetchedAt,
  terms:
    'Reutilización según el aviso legal del BOE (https://www.boe.es/informacion/aviso_legal/index.php); pendiente de revisión humana (G0).',
  passages: [
    { locator: `${BOE_ID}, artículo 1`, text: article(1) },
    { locator: `${BOE_ID}, artículo 3`, text: article(3) },
  ],
};
await mkdir(root('corpus/documents'), { recursive: true });
await writeFile(root(`corpus/documents/${BOE_ID}.json`), JSON.stringify(doc, null, 2) + '\n');
console.log(`✓ corpus ${BOE_ID}`);
