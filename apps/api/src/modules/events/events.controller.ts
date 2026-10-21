import { Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { CreateEvent } from '@polifamia/contracts';
import type { Db } from '../../db/client.js';
import { events } from '../../db/schema.js';
import { ApiError, InstallId, ZodPipe } from '../../http.js';
import { DB } from '../../tokens.js';

@Controller('v1/events')
export class EventsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Eventos mínimos de producto (FR-017): sin URL, sin texto, sin identidad política. */
  @Post()
  @HttpCode(204)
  async create(
    @Headers('x-install-id') installId: string | undefined,
    @Body(new ZodPipe(CreateEvent)) body: CreateEvent,
  ) {
    if (!InstallId.safeParse(installId).success)
      throw new ApiError('validation', 'X-Install-Id header required', 400);
    await this.db.insert(events).values({ ...body, installId: installId! });
  }
}
