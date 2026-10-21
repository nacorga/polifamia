import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { claims, transcripts, videos, type Db } from '@polifamia/api/db';
import { ClaimType, NormalizedClaim, YoutubeId } from '@polifamia/contracts';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { locateClaim, parseSubtitles } from './parse.js';

/** Bases de derechos admitidas. `demo-fixture` = texto redactado por el equipo, se etiqueta DEMO. */
export const RightsBasis = z.enum(['own-content', 'explicit-permission', 'open-license', 'demo-fixture']);

export const RightsFile = z.strictObject({
  youtubeId: YoutubeId,
  title: z.string().min(1),
  channel: z.string().optional(),
  language: z.literal('es'),
  publishedAt: z.iso.date().optional(),
  holder: z.string().min(1),
  basis: RightsBasis,
  scope: z.string().min(1),
  licenseUrl: z.url().optional(),
  evidenceUrl: z.url().optional(),
  notes: z.string().optional(),
  importedBy: z.string().min(1),
});

export const ClaimsFile = z.array(
  z.strictObject({
    literal: z.string().min(5),
    claimType: ClaimType,
    normalized: NormalizedClaim.default({}),
    declaredSource: z.string().nullable().default(null),
    speaker: z.string().optional(),
    rank: z.number().int().positive(),
  }),
);

const CHECKABLE_TYPES = new Set(['statistic', 'fact']);

export interface ImportResult {
  youtubeId: string;
  transcript: 'created' | 'unchanged';
  claims: number | 'unchanged';
}

async function exists(path: string) {
  return readFile(path).then(
    () => true,
    () => false,
  );
}

/** Importa un vídeo a partir de `<base>.rights.json` + `<base>.srt|vtt` (+ `<base>.claims.json`). */
export async function importOne(db: Db, dir: string, base: string): Promise<ImportResult> {
  const rights = RightsFile.parse(JSON.parse(await readFile(join(dir, `${base}.rights.json`), 'utf8')));
  const format = (await exists(join(dir, `${base}.vtt`))) ? 'vtt' : 'srt';
  const raw = await readFile(join(dir, `${base}.${format}`), 'utf8');
  const segments = parseSubtitles(raw, format);
  const revisionHash = createHash('sha256').update(raw).digest('hex');

  const claimsPath = join(dir, `${base}.claims.json`);
  const claimRows = (await exists(claimsPath))
    ? ClaimsFile.parse(JSON.parse(await readFile(claimsPath, 'utf8'))).map((c) => {
        const located = locateClaim(segments, c.literal);
        if (!located) throw new Error(`${base}: claim not found literally in transcript: "${c.literal}"`);
        return { ...c, ...located };
      })
    : [];

  return db.transaction(async (tx) => {
    const meta = {
      title: rights.title,
      channel: rights.channel,
      language: rights.language,
      publishedAt: rights.publishedAt,
      isDemo: rights.basis === 'demo-fixture',
    };
    const [video] = await tx
      .insert(videos)
      .values({ youtubeId: rights.youtubeId, corpusStatus: 'preparing_claims', ...meta })
      .onConflictDoUpdate({ target: videos.youtubeId, set: meta })
      .returning();

    let transcript = await tx.query.transcripts.findFirst({
      where: and(eq(transcripts.videoId, video!.id), eq(transcripts.revisionHash, revisionHash)),
    });
    const transcriptStatus = transcript ? 'unchanged' : 'created';
    if (!transcript) {
      const { holder, basis, scope, importedBy, licenseUrl, evidenceUrl, notes } = rights;
      [transcript] = await tx
        .insert(transcripts)
        .values({
          videoId: video!.id,
          segments,
          revisionHash,
          rights: { holder, basis, scope, importedBy, licenseUrl, evidenceUrl, notes },
          sourceFormat: format,
        })
        .returning();
    }

    const existing = await tx.query.claims.findMany({ where: eq(claims.transcriptId, transcript!.id) });
    let claimCount: number | 'unchanged' = 'unchanged';
    if (existing.length === 0 && claimRows.length > 0) {
      // Literal y contexto son inmutables: solo se insertan una vez por revisión de transcripción.
      await tx.insert(claims).values(
        claimRows.map((c) => ({
          videoId: video!.id,
          transcriptId: transcript!.id,
          literal: c.literal,
          context: c.context,
          startMs: c.startMs,
          endMs: c.endMs,
          speaker: c.speaker,
          claimType: c.claimType,
          checkability: CHECKABLE_TYPES.has(c.claimType)
            ? ('CHECKABLE' as const)
            : ('NOT_CHECKABLE' as const),
          normalized: c.normalized,
          declaredSource: c.declaredSource,
          rank: c.rank,
          extractor: 'fixture',
        })),
      );
      claimCount = claimRows.length;
    }
    const hasClaims = existing.length > 0 || claimRows.length > 0;
    await tx
      .update(videos)
      .set({ corpusStatus: hasClaims ? 'claims_ready' : 'preparing_claims' })
      .where(eq(videos.id, video!.id));
    return { youtubeId: rights.youtubeId, transcript: transcriptStatus, claims: claimCount };
  });
}

export async function importDir(db: Db, dir: string) {
  const bases = (await readdir(dir))
    .filter((f) => f.endsWith('.rights.json'))
    .map((f) => f.slice(0, -'.rights.json'.length));
  const results: ImportResult[] = [];
  const errors: string[] = [];
  for (const base of bases.sort()) {
    try {
      results.push(await importOne(db, dir, base));
    } catch (err) {
      errors.push(`${base}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { results, errors };
}
