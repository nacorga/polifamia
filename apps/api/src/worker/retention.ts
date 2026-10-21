import { lt } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { events } from '../db/schema.js';

export const RETENTION_QUEUE = 'retention-purge';
/** PRD §11: eventos de producto 30 días. Los logs técnicos (14 días) los retiene la plataforma. */
export const EVENTS_RETENTION_DAYS = 30;

export async function purgeExpired(db: Db, now = new Date()) {
  const cutoff = new Date(now.getTime() - EVENTS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db.delete(events).where(lt(events.createdAt, cutoff)).returning({ id: events.id });
  return { eventsDeleted: deleted.length };
}
