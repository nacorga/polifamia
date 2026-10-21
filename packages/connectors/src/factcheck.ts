import { z } from 'zod';
import { SourceError, type Fetcher } from './safe-fetch.js';

export const FACTCHECK_HOST = 'factchecktools.googleapis.com';
const ENDPOINT = `https://${FACTCHECK_HOST}/v1alpha1/claims:search`;

/** Forma documentada de `claims.search` (developers.google.com/fact-check/tools/api/reference/rest/v1alpha1/claims/search). */
const FactCheckResponse = z.object({
  claims: z
    .array(
      z.object({
        text: z.string().optional(),
        claimant: z.string().optional(),
        claimDate: z.string().optional(),
        claimReview: z
          .array(
            z.object({
              publisher: z.object({ name: z.string().optional(), site: z.string().optional() }).optional(),
              url: z.string(),
              title: z.string().optional(),
              reviewDate: z.string().optional(),
              textualRating: z.string().optional(),
              languageCode: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

/** Una reseña publicada por un verificador: es un índice de verificaciones, no una certificación. */
export interface FactCheckReview {
  claimText: string;
  claimant: string | null;
  claimDate: string | null;
  publisher: string;
  url: string;
  title: string;
  reviewDate: string | null;
  textualRating: string;
}

export function factCheckQueryUrl(query: string, apiKey: string, pageSize = 5): string {
  const q = new URLSearchParams({ query, languageCode: 'es', pageSize: String(pageSize), key: apiKey });
  return `${ENDPOINT}?${q}`;
}

/** URL sin la clave, apta para guardar como localizador o en logs. */
export const redactKey = (url: string) => url.replace(/([?&]key=)[^&]+/, '$1REDACTED');

export function parseFactCheckResponse(body: string, queryUrl: string): FactCheckReview[] {
  let parsed;
  try {
    parsed = FactCheckResponse.parse(JSON.parse(body));
  } catch {
    throw new SourceError('unexpected Fact Check Tools response shape', redactKey(queryUrl));
  }
  const out: FactCheckReview[] = [];
  for (const c of parsed.claims) {
    for (const r of c.claimReview) {
      if (!r.url.startsWith('https://') || !c.text || !r.textualRating) continue;
      out.push({
        claimText: c.text,
        claimant: c.claimant ?? null,
        claimDate: c.claimDate ?? null,
        publisher: r.publisher?.name ?? r.publisher?.site ?? new URL(r.url).hostname,
        url: r.url,
        title: r.title ?? c.text,
        reviewDate: r.reviewDate ?? null,
        textualRating: r.textualRating,
      });
    }
  }
  return out;
}

export async function searchFactChecks(
  fetcher: Fetcher,
  query: string,
  apiKey: string,
): Promise<FactCheckReview[]> {
  const url = factCheckQueryUrl(query.slice(0, 300), apiKey);
  const res = await fetcher(url);
  if (res.status !== 200) throw new SourceError(`Fact Check Tools HTTP ${res.status}`, redactKey(url));
  return parseFactCheckResponse(res.text, url);
}
