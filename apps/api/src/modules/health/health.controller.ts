import { Controller, Get, Inject } from '@nestjs/common';
import {
  Availability,
  ClaimsResponse,
  CreateEvent,
  CreateFeedback,
  CreateInvestigation,
  ErrorResponse,
  FeedbackCreated,
  Health,
  Investigation,
} from '@polifamia/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client.js';
import { DB } from '../../tokens.js';

const json = (schema: z.ZodType) => ({
  'application/json': { schema: z.toJSONSchema(schema, { io: 'input' }) },
});
const ok = (schema: z.ZodType, status = '200') => ({
  [status]: { description: 'OK', content: json(schema) },
});
const err = { default: { description: 'Error', content: json(ErrorResponse) } };
const videoId = [{ name: 'videoId', in: 'path', required: true, schema: { type: 'string' } }];
const id = [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }];

/** OpenAPI generado desde los schemas Zod de @polifamia/contracts. */
const openapi = {
  openapi: '3.1.0',
  info: { title: 'Polifamia API', version: '1' },
  paths: {
    '/health': { get: { responses: ok(Health) } },
    '/v1/videos/{videoId}/availability': {
      get: { parameters: videoId, responses: { ...ok(Availability), ...err } },
    },
    '/v1/videos/{videoId}/claims': {
      get: { parameters: videoId, responses: { ...ok(ClaimsResponse), ...err } },
    },
    '/v1/investigations': {
      post: {
        requestBody: { content: json(CreateInvestigation) },
        responses: { ...ok(Investigation), ...ok(Investigation, '202'), ...err },
      },
    },
    '/v1/investigations/{id}': { get: { parameters: id, responses: { ...ok(Investigation), ...err } } },
    '/v1/investigations/{id}/feedback': {
      post: {
        parameters: id,
        requestBody: { content: json(CreateFeedback) },
        responses: { ...ok(FeedbackCreated, '201'), ...err },
      },
    },
    '/v1/events': {
      post: {
        requestBody: { content: json(CreateEvent) },
        responses: { '204': { description: 'OK' }, ...err },
      },
    },
  },
};

@Controller()
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('health')
  async health() {
    const db = await this.db.execute(sql`select 1`).then(
      () => true,
      () => false,
    );
    return { status: 'ok' as const, db };
  }

  @Get('openapi.json')
  openapi() {
    return openapi;
  }
}
