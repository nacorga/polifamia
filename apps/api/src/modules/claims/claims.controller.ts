import { Controller, Get, Inject, Param } from '@nestjs/common';
import { YoutubeId, type ClaimsResponse } from '@polifamia/contracts';
import { asc, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { claims, transcripts, videos } from '../../db/schema.js';
import { ApiError, ZodPipe } from '../../http.js';
import { DB } from '../../tokens.js';

@Controller('v1/videos')
export class ClaimsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Claims de la última transcripción: verificables primero por rank, luego las no verificables. */
  @Get(':videoId/claims')
  async list(@Param('videoId', new ZodPipe(YoutubeId)) videoId: string): Promise<ClaimsResponse> {
    const video = await this.db.query.videos.findFirst({ where: eq(videos.youtubeId, videoId) });
    if (!video) throw new ApiError('unsupported_video', 'Video not in authorized catalog', 404);
    const transcript = await this.db.query.transcripts.findFirst({
      where: eq(transcripts.videoId, video.id),
      orderBy: desc(transcripts.importedAt),
    });
    if (!transcript) return { videoId, claims: [] };
    const rows = await this.db.query.claims.findMany({
      where: eq(claims.transcriptId, transcript.id),
      orderBy: [asc(claims.checkability), asc(claims.rank)],
    });
    return {
      videoId,
      // `speaker` no se expone (FR-019).
      claims: rows.map((c) => ({
        id: c.id,
        literal: c.literal,
        context: c.context,
        startMs: c.startMs,
        endMs: c.endMs,
        claimType: c.claimType,
        checkability: c.checkability,
        normalized: c.normalized,
        declaredSource: c.declaredSource,
        rank: c.rank,
        isDemo: video.isDemo,
      })),
    };
  }
}
