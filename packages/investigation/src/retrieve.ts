import type { EvidenceRelation, NormalizedClaim, StatsContext } from '@polifamia/contracts';
import {
  fetchIneSeries,
  findSeries,
  searchCorpus,
  searchFactChecks,
  SourceError,
  territoryMatches,
  tokens,
  type CorpusDocument,
  type Fetcher,
} from '@polifamia/connectors';
import { compareClaimToObservation } from './stats.js';
import type { FoundEvidence, InvestigationInput } from './types.js';

export type Origin = 'ine' | 'factcheck' | 'corpus';

/** Evidencia candidata antes de decidir su relación con la afirmación. `id` es estable dentro del job. */
export interface Candidate {
  id: string;
  origin: Origin;
  evidence: Omit<FoundEvidence, 'relation'>;
  /** Relación fijada por código determinista (cifras INE); el LLM no la toca. */
  fixedRelation?: EvidenceRelation;
  stats?: StatsContext;
  note?: string | null;
}

export interface RetrievalResult {
  candidates: Candidate[];
  /** Fuentes consultadas que fallaron (red, HTTP, forma inesperada). */
  failures: { origin: Origin; message: string }[];
  /** Fuentes no consultadas y por qué (p. ej. sin clave). */
  skipped: { origin: Origin; reason: string }[];
}

export interface EvidenceRetriever {
  retrieve(
    input: InvestigationInput,
    normalized: NormalizedClaim,
    maxDocuments: number,
  ): Promise<RetrievalResult>;
}

const QUARTERS: Record<string, number> = { primer: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4 };
const MONTHS =
  'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split(' ');

/** «tercer trimestre de 2024» → 2024T3; «diciembre de 2023» → 2023-12; formatos canónicos se respetan. */
export function canonicalPeriod(period: string | undefined): string | undefined {
  if (!period) return undefined;
  const p = period.trim().toLowerCase();
  if (/^\d{4}(t[1-4]|-\d{2})?$/.test(p)) return p.toUpperCase();
  const year = p.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!year) return period;
  const q = p.match(/\b(primer|segundo|tercer|tercero|cuarto)\s+trimestre/);
  if (q) return `${year}T${QUARTERS[q[1]!]}`;
  const tq = p.match(/\bt([1-4])\b/);
  if (tq) return `${year}T${tq[1]}`;
  const m = MONTHS.findIndex((name) => p.includes(name));
  if (m >= 0) return `${year}-${String(m + 1).padStart(2, '0')}`;
  return /^\D*\d{4}\D*$/.test(p) ? year : period;
}

/** Fuente declarada por el orador ≈ esta fuente, si todos los tokens de alguno de sus nombres aparecen. */
export function matchesDeclared(declared: string | null, names: string[]): boolean {
  if (!declared) return false;
  const d = tokens(declared);
  return names.some((n) => {
    const t = tokens(n);
    return t.size > 0 && [...t].every((w) => d.has(w));
  });
}

/** URL canónica para deduplicar fuentes dependientes (misma reseña/documento por varias vías). */
export function canonicalUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/.test(k)) u.searchParams.delete(k);
  u.pathname = u.pathname.replace(/\/+$/, '') || '/';
  return u.href;
}

/** Frase del pasaje con más solape con la afirmación: el extracto mostrado es literal de la fuente. */
function bestSentence(passage: string, query: string): string {
  const q = tokens(query);
  const sentences = passage.split(/(?<=[.;:])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/u);
  let best = passage;
  let bestScore = -1;
  for (const s of sentences) {
    const st = tokens(s);
    const score = [...q].filter((w) => st.has(w)).length;
    if (score > bestScore) [best, bestScore] = [s, score];
  }
  return best.trim();
}

export interface RetrieverDeps {
  ineFetcher: Fetcher;
  factCheckFetcher: Fetcher;
  factCheckKey?: string;
  corpus: CorpusDocument[];
}

/**
 * Recuperación determinista primero (PRD §10.4): verificaciones existentes → INE (registro aprobado) →
 * corpus institucional. Sin búsqueda web abierta en P0. Las fuentes caídas se registran, no se ocultan.
 */
export class DefaultEvidenceRetriever implements EvidenceRetriever {
  constructor(private readonly deps: RetrieverDeps) {}

  async retrieve(
    input: InvestigationInput,
    normalized: NormalizedClaim,
    maxDocuments: number,
  ): Promise<RetrievalResult> {
    const out: RetrievalResult = { candidates: [], failures: [], skipped: [] };
    const seen = new Set<string>();
    const add = (c: Omit<Candidate, 'id'>) => {
      const key = `${canonicalUrl(c.evidence.source.url)}#${c.evidence.locator}`;
      if (seen.has(key) || out.candidates.length >= maxDocuments) return;
      seen.add(key);
      out.candidates.push({ ...c, id: `E${out.candidates.length + 1}` });
    };
    const fail = (origin: Origin, err: unknown) => {
      if (!(err instanceof SourceError)) throw err;
      out.failures.push({ origin, message: err.message });
    };

    // 1. Verificaciones existentes (índice, no certificación).
    if (!this.deps.factCheckKey)
      out.skipped.push({ origin: 'factcheck', reason: 'sin clave de Fact Check Tools' });
    else {
      try {
        for (const r of await searchFactChecks(
          this.deps.factCheckFetcher,
          input.literal,
          this.deps.factCheckKey,
        )) {
          add({
            origin: 'factcheck',
            evidence: {
              source: {
                url: r.url,
                title: r.title,
                publisher: r.publisher,
                publishedAt: r.reviewDate,
                kind: 'factcheck',
              },
              locator: r.url,
              excerpt: `Afirmación revisada: «${r.claimText}»${r.claimant ? ` (${r.claimant})` : ''}. Calificación de ${r.publisher}: «${r.textualRating}».`,
              provenance: matchesDeclared(input.declaredSource, [r.publisher])
                ? 'declared_source'
                : 'retrieved_evidence',
              dataDate: r.claimDate,
            },
          });
        }
      } catch (err) {
        fail('factcheck', err);
      }
    }

    // 2. Estadística oficial (solo series aprobadas; cálculo determinista).
    const series = findSeries(normalized.metric);
    if (series) {
      const period = canonicalPeriod(normalized.period);
      const territoryOk = territoryMatches(normalized.territory);
      try {
        const r = await fetchIneSeries(this.deps.ineFetcher, series, period);
        const obs = period
          ? (r.observations.find((o) => o.period === period) ?? null)
          : (r.observations.at(-1) ?? null);
        if (obs) {
          const cmp = compareClaimToObservation({ ...normalized, period }, series, obs, territoryOk);
          add({
            origin: 'ine',
            fixedRelation: cmp.relation,
            stats: cmp.stats,
            note: cmp.notComparable,
            evidence: {
              source: {
                url: series.publicUrl,
                title: `${series.operation}: ${r.name}`,
                publisher: 'Instituto Nacional de Estadística (INE)',
                publishedAt: null,
                kind: 'primary',
              },
              locator: r.queryUrl,
              excerpt: `${r.name} ${obs.period}: ${String(obs.value).replace('.', ',')} ${series.unit}`,
              provenance: matchesDeclared(input.declaredSource, ['INE', series.operation])
                ? 'declared_source'
                : 'retrieved_evidence',
              dataDate: obs.period,
            },
          });
        }
      } catch (err) {
        fail('ine', err);
      }
    }

    // 3. Corpus institucional autorizado (búsqueda léxica sobre pasajes literales).
    const query = [input.literal, normalized.metric].filter(Boolean).join(' ');
    for (const hit of searchCorpus(this.deps.corpus, query)) {
      add({
        origin: 'corpus',
        evidence: {
          source: {
            url: hit.document.url,
            title: hit.document.title,
            publisher: hit.document.publisher,
            publishedAt: hit.document.publishedAt,
            kind: 'primary',
          },
          locator: hit.locator,
          excerpt: bestSentence(hit.text, query),
          provenance: matchesDeclared(input.declaredSource, [hit.document.publisher, hit.document.id, 'BOE'])
            ? 'declared_source'
            : 'retrieved_evidence',
          dataDate: hit.document.publishedAt,
        },
      });
    }
    return out;
  }
}
