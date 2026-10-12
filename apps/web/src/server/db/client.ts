import 'server-only';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DatabaseHandle = {
  db: Database;
  driver: 'postgres' | 'pglite';
  close(): Promise<void>;
};

export type DatabaseConfig =
  /** Any PostgreSQL server: Docker locally, Neon (or similar) in production. */
  | { driver: 'postgres'; url: string }
  /** In-process PostgreSQL (WASM). `dataDir` omitted = in memory. */
  | { driver: 'pglite'; dataDir?: string };

const MIGRATIONS = path.join(process.cwd(), 'drizzle');

/**
 * `DATABASE_URL` selects a PostgreSQL server; without it the app runs on
 * PGlite so agents and quick checks need no database process.
 */
export function databaseConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): DatabaseConfig {
  if (env.DATABASE_URL) return { driver: 'postgres', url: env.DATABASE_URL };
  const dir =
    env.PGLITE_DATA_DIR ?? path.join(process.cwd(), '.data', 'pglite');
  return { driver: 'pglite', dataDir: dir === 'memory://' ? undefined : dir };
}

export async function openDatabase(
  config: DatabaseConfig,
  { migrate = true, migrationsFolder = MIGRATIONS } = {},
): Promise<DatabaseHandle> {
  if (config.driver === 'postgres') {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const pool = new Pool({ connectionString: config.url, max: 5 });
    const db = drizzle(pool, { schema });
    if (migrate) {
      const { migrate: run } =
        await import('drizzle-orm/node-postgres/migrator');
      await run(db, { migrationsFolder });
    }
    return { db, driver: 'postgres', close: () => pool.end() };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  // PGlite creates its data directory, but not missing parent directories.
  if (config.dataDir) {
    await mkdir(path.dirname(path.resolve(config.dataDir)), {
      recursive: true,
    });
  }
  const client = config.dataDir ? new PGlite(config.dataDir) : new PGlite();
  const db = drizzle(client, { schema });
  if (migrate) {
    const { migrate: run } = await import('drizzle-orm/pglite/migrator');
    await run(db, { migrationsFolder });
  }
  return { db, driver: 'pglite', close: () => client.close() };
}
