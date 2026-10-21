import { Controller, Get, Inject, Param } from '@nestjs/common';
import { YoutubeId, type Availability } from '@polifamia/contracts';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { transcripts, videos } from '../../db/schema.js';
import { ZodPipe } from '../../http.js';
import { DB } from '../../tokens.js';

@Controller('v1/videos')
export class VideosController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get(':videoId/availability')
  async availability(@Param('videoId', new ZodPipe(YoutubeId)) videoId: string): Promise<Availability> {
    const video = await this.db.query.videos.findFirst({ where: eq(videos.youtubeId, videoId) });
    if (!video) return { videoId, status: 'unsupported_video', isDemo: false };
    const transcript = await this.db.query.transcripts.findFirst({
      where: eq(transcripts.videoId, video.id),
      orderBy: desc(transcripts.importedAt),
    });
    return {
      videoId,
      status: transcript ? video.corpusStatus : 'transcript_unavailable',
      isDemo: video.isDemo,
      title: video.title ?? undefined,
      rights: transcript ? { holder: transcript.rights.holder, basis: transcript.rights.basis } : undefined,
    };
  }
}
