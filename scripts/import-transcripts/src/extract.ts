import { claims, transcripts, videos, type Db } from '@polifamia/api/db';
import { selectClaims, type ClaimExtractor, type LlmUsage } from '@polifamia/investigation';
import { desc, eq } from 'drizzle-orm';

export interface ExtractClaimsResult {
  youtubeId: string;
  claims: number | 'unchanged';
  rejected: number;
  usage: LlmUsage[];
}

/**
 * Extrae y selecciona claims de la última transcripción de un vídeo y las persiste.
 * Literal y contexto son inmutables: si esa revisión ya tiene claims, no se tocan.
 */
export async function extractVideoClaims(
  db: Db,
  youtubeId: string,
  extractor: ClaimExtractor & { id: string },
  max = 10,
): Promise<ExtractClaimsResult> {
  const video = await db.query.videos.findFirst({ where: eq(videos.youtubeId, youtubeId) });
  if (!video) throw new Error(`${youtubeId}: not in catalog (import the transcript first)`);
  const transcript = await db.query.transcripts.findFirst({
    where: eq(transcripts.videoId, video.id),
    orderBy: desc(transcripts.importedAt),
  });
  if (!transcript) {
    await db.update(videos).set({ corpusStatus: 'transcript_unavailable' }).where(eq(videos.id, video.id));
    throw new Error(`${youtubeId}: no transcript`);
  }
  const existing = await db.query.claims.findFirst({ where: eq(claims.transcriptId, transcript.id) });
  if (existing) return { youtubeId, claims: 'unchanged', rejected: 0, usage: [] };

  const { candidates, rejected, usage } = await extractor.extract(transcript.segments);
  const selected = selectClaims(candidates, max);
  await db.transaction(async (tx) => {
    if (selected.length > 0) {
      await tx.insert(claims).values(
        selected.map((c) => ({
          videoId: video.id,
          transcriptId: transcript.id,
          literal: c.literal,
          context: c.context,
          startMs: c.startMs,
          endMs: c.endMs,
          claimType: c.claimType,
          checkability: c.checkability,
          normalized: c.normalized,
          declaredSource: c.declaredSource,
          rank: c.rank,
          extractor: extractor.id,
        })),
      );
    }
    // Lista vacía es un resultado válido (FR-003): el vídeo queda listo sin afirmaciones.
    await tx.update(videos).set({ corpusStatus: 'claims_ready' }).where(eq(videos.id, video.id));
  });
  return { youtubeId, claims: selected.length, rejected: rejected.length, usage };
}
