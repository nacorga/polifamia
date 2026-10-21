import { z } from 'zod';

const int = (def: number) => z.coerce.number().int().positive().default(def);

const Env = z.object({
  DATABASE_URL: z.string().url(),
  PORT: int(3100),
  INVESTIGATION_MODE: z.enum(['demo', 'real']).default('demo'),
  JOB_TIMEOUT_MS: int(60_000),
  JOB_MAX_LLM_CALLS: int(6),
  JOB_MAX_TOKENS: int(40_000),
  JOB_MAX_DOCUMENTS: int(12),
  JOB_RETRY_LIMIT: z.coerce.number().int().min(0).default(2),
  DAILY_BUDGET_EUR: z.coerce.number().positive().default(5),
  RATE_LIMIT_PER_MINUTE: int(20),
  DEMO_DELAY_MS: z.coerce.number().int().min(0).default(1500),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL_EXTRACT: z.string().default('claude-haiku-5-5'),
  LLM_MODEL_SYNTH: z.string().default('claude-opus-5-5'),
  /** Documentos institucionales autorizados; por defecto `corpus/documents` del repositorio. */
  CORPUS_DIR: z.string().optional(),
  FACTCHECK_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}
