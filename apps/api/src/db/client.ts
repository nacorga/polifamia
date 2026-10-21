import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

/**
 * Opciones de conexión. Con `DATABASE_CA_CERT` (PEM; App Platform lo inyecta como `${db.CA_CERT}`) se verifica
 * el certificado contra esa CA. Se quita `sslmode` de la URL porque `pg` la trata como `verify-full` contra las
 * CA públicas y, al venir en la URL, sobrescribe la opción `ssl`.
 */
export function pgConnection(url: string, ca = process.env.DATABASE_CA_CERT) {
  if (!ca) return { connectionString: url };
  const u = new URL(url);
  u.searchParams.delete('sslmode');
  return { connectionString: u.toString(), ssl: { ca } };
}

export function createDb(url: string) {
  const pool = new pg.Pool({ ...pgConnection(url), max: 10 });
  return { db: drizzle(pool, { schema }), pool };
}

export type Db = ReturnType<typeof createDb>['db'];
