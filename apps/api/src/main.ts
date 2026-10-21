import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';

const config = loadConfig();
const app = await createApp(config);
await app.listen(config.PORT);
logger.info({ port: config.PORT, mode: config.INVESTIGATION_MODE }, 'api listening');
