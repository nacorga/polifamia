import { createDb } from '@polifamia/api/db';
import { AnthropicLlmClient, DEFAULT_MODELS, LlmClaimExtractor } from '@polifamia/investigation';
import { extractVideoClaims } from './extract.js';

const youtubeId = process.argv[2];
const url = process.env.DATABASE_URL;
if (!youtubeId || !url) {
  console.error('usage: DATABASE_URL=... extract-claims <youtubeId>');
  process.exit(2);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is required for claim extraction (server-side .env). Nothing was changed.',
  );
  process.exit(2);
}
const model = process.env.LLM_MODEL_EXTRACT || DEFAULT_MODELS.extract;
const max = Number(process.env.CLAIMS_MAX ?? 10);
const { db, pool } = createDb(url);
try {
  const r = await extractVideoClaims(
    db,
    youtubeId,
    new LlmClaimExtractor(new AnthropicLlmClient(), model),
    max,
  );
  const cost = r.usage.reduce((s, u) => s + u.costEur, 0);
  const tokens = r.usage.reduce((s, u) => s + u.tokensIn + u.tokensOut, 0);
  console.log(
    `✓ ${r.youtubeId}: claims ${r.claims}, rejected (not literal) ${r.rejected}, calls ${r.usage.length}, tokens ${tokens}, cost €${cost.toFixed(4)} [${model}]`,
  );
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
