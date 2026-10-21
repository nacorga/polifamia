import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { CreateFeedback } from '@polifamia/contracts';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client.js';
import { feedback, investigations } from '../../db/schema.js';
import { ApiError, ZodPipe } from '../../http.js';
import { DB } from '../../tokens.js';

@Controller('v1/investigations')
export class FeedbackController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Registra el reporte; nunca modifica la investigación (FR-011). */
  @Post(':id/feedback')
  @HttpCode(201)
  async create(
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @Body(new ZodPipe(CreateFeedback)) body: CreateFeedback,
  ) {
    const inv = await this.db.query.investigations.findFirst({ where: eq(investigations.id, id) });
    if (!inv) throw new ApiError('not_found', 'Investigation not found', 404);
    const [row] = await this.db
      .insert(feedback)
      .values({
        investigationId: id,
        investigationVersion: inv.version,
        reason: body.reason,
        comment: body.comment,
      })
      .returning({ id: feedback.id });
    return { id: row!.id, status: 'open' as const };
  }
}
