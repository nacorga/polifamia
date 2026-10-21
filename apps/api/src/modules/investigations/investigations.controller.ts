import { Body, Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { CreateInvestigation, type Investigation } from '@polifamia/contracts';
import type { Response } from 'express';
import { z } from 'zod';
import { type CorrelatedRequest, ZodPipe } from '../../http.js';
import { InvestigationsService } from './investigations.service.js';

@Controller('v1/investigations')
export class InvestigationsController {
  constructor(@Inject(InvestigationsService) private readonly service: InvestigationsService) {}

  @Post()
  async create(
    @Body(new ZodPipe(CreateInvestigation)) body: CreateInvestigation,
    @Req() req: CorrelatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Investigation> {
    const { investigation, httpStatus } = await this.service.create(body, req.correlationId);
    res.status(httpStatus);
    return investigation;
  }

  @Get(':id')
  get(@Param('id', new ZodPipe(z.uuid())) id: string): Promise<Investigation> {
    return this.service.get(id);
  }
}
