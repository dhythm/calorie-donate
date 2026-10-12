import 'server-only';
import { sql } from 'drizzle-orm';
import type { Database } from './client';

/** Test helper: empty every table. Never called by the app. */
export async function truncateAll(db: Database) {
  await db.execute(
    sql`truncate table meals, meal_photos, settlements, profiles`,
  );
}
