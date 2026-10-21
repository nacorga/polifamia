import { resolve } from 'node:path';
import { createDb } from '@polifamia/api/db';
import { importDir } from './import.js';

const dir = process.argv[2];
const url = process.env.DATABASE_URL;
if (!dir || !url) {
  console.error('usage: DATABASE_URL=... import-transcripts <dir-with-rights.json-files>');
  process.exit(2);
}
// pnpm --filter ejecuta en el directorio del paquete; las rutas relativas se resuelven desde el raíz.
const { db, pool } = createDb(url);
const { results, errors } = await importDir(db, resolve(process.env.INIT_CWD ?? process.cwd(), dir));
for (const r of results) console.log(`✓ ${r.youtubeId}: transcript ${r.transcript}, claims ${r.claims}`);
for (const e of errors) console.error(`✗ ${e}`);
await pool.end();
process.exit(errors.length ? 1 : 0);
