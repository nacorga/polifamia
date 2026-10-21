import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/** Backend real (modo DEMO) sobre una BD propia de E2E, para no tocar la de desarrollo ni la de tests. */
export const E2E_PORT = 3199;
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const ADMIN_URL = process.env.DATABASE_URL_ADMIN ?? 'postgres://polifamia:polifamia@localhost:5432/polifamia';
const DATABASE_URL = ADMIN_URL.replace(/\/[^/]+$/, '/polifamia_e2e');

function run(cmd: string, args: string[], env: Record<string, string>) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'inherit' });
    p.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} → ${code}`)),
    );
  });
}

export default async function globalSetup() {
  const admin = new pg.Client(ADMIN_URL);
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'polifamia_e2e'");
  if (!exists.rowCount) await admin.query('CREATE DATABASE polifamia_e2e');
  await admin.end();

  // Estado limpio: cada ejecución parte del corpus DEMO sin investigaciones previas en caché.
  const db = new pg.Client(DATABASE_URL);
  await db.connect();
  await db.query(
    'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE; CREATE SCHEMA public',
  );
  await db.end();

  const env = { DATABASE_URL, PORT: String(E2E_PORT), INVESTIGATION_MODE: 'demo', DEMO_DELAY_MS: '1500' };
  await run('node', ['apps/api/dist/db/migrate.js'], env);
  await run('node', ['scripts/import-transcripts/dist/cli.js', `${ROOT}corpus/videos`], env);

  const procs: ChildProcess[] = ['apps/api/dist/main.js', 'apps/api/dist/worker/main.js'].map((file) =>
    spawn('node', [file], { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'ignore' }),
  );
  for (let i = 0; ; i++) {
    const ok = await fetch(`http://localhost:${E2E_PORT}/health`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) break;
    if (i > 50) throw new Error('API de E2E no arranca');
    await new Promise((r) => setTimeout(r, 200));
  }
  return () => procs.forEach((p) => p.kill());
}
