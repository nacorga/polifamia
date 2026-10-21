import 'reflect-metadata';
import { Module, type DynamicModule } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import type { Config } from './config.js';
import { createDb } from './db/client.js';
import { ErrorFilter, rateLimit, requestLogger } from './http.js';
import { ClaimsController } from './modules/claims/claims.controller.js';
import { EventsController } from './modules/events/events.controller.js';
import { FeedbackController } from './modules/feedback/feedback.controller.js';
import { HealthController } from './modules/health/health.controller.js';
import { InvestigationsController } from './modules/investigations/investigations.controller.js';
import { InvestigationsService } from './modules/investigations/investigations.service.js';
import { VideosController } from './modules/videos/videos.controller.js';
import { startBoss } from './queue.js';
import { BOSS, CONFIG, DB } from './tokens.js';

@Module({})
class AppModule {}

export async function createApp(config: Config) {
  const { db, pool } = createDb(config.DATABASE_URL);
  const boss = await startBoss(config.DATABASE_URL, config.JOB_RETRY_LIMIT, config.JOB_TIMEOUT_MS);
  const root: DynamicModule = {
    module: AppModule,
    controllers: [
      HealthController,
      VideosController,
      ClaimsController,
      InvestigationsController,
      FeedbackController,
      EventsController,
    ],
    providers: [
      { provide: DB, useValue: db },
      { provide: BOSS, useValue: boss },
      { provide: CONFIG, useValue: config },
      InvestigationsService,
    ],
  };
  const app = await NestFactory.create<NestExpressApplication>(root, {
    logger: ['error', 'warn'],
    bodyParser: false,
  });
  app.set('trust proxy', config.TRUST_PROXY);
  app.useBodyParser('json', { limit: '16kb' });
  app.use(requestLogger);
  // Solo las operaciones que cuestan (investigar) o escriben (feedback) se limitan; el polling no.
  const limiter = rateLimit(config.RATE_LIMIT_PER_MINUTE);
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.method === 'POST' && /^\/v1\/investigations(\/[^/]+\/feedback)?\/?$/.test(req.path)
      ? limiter(req, res, next)
      : next(),
  );
  app.useGlobalFilters(new ErrorFilter());
  // Solo la extensión llama a la API desde el navegador. CORS no es autenticación (PRD §10.5).
  app.enableCors({ origin: /^chrome-extension:\/\/[a-p]{32}$/, exposedHeaders: ['X-Correlation-Id'] });
  app.enableShutdownHooks();
  const close = app.close.bind(app);
  app.close = async () => {
    await close();
    await boss.stop({ graceful: false });
    await pool.end();
  };
  return app;
}
