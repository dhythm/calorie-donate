import 'server-only';
import { apiErrorSchema, type ApiErrorCode } from '@calorie-donate/api';
import { databaseConfigFromEnv, openDatabase } from './db/client';
import { createEstimator, type CalorieEstimator } from './estimator';
import { createService, ServiceError, type Service } from './service';

// Kept on globalThis so dev hot reloads reuse one pool / PGlite instance
// (a PGlite data directory can only be opened once per process).
const cache = globalThis as typeof globalThis & {
  calorieDonateService?: Promise<Service>;
};
let estimator: CalorieEstimator | undefined;

/** Process-wide service on the configured database, migrated on first use. */
export function getService(): Promise<Service> {
  cache.calorieDonateService ??= openDatabase(databaseConfigFromEnv(), {
    migrate: process.env.DATABASE_AUTO_MIGRATE !== 'false',
  }).then(
    ({ db }) => createService(db),
    (error: unknown) => {
      cache.calorieDonateService = undefined;
      throw error;
    },
  );
  return cache.calorieDonateService;
}

export function getEstimator(): CalorieEstimator {
  estimator ??= createEstimator();
  return estimator;
}

export function errorResponse(
  code: ApiErrorCode,
  status: number,
  message: string,
) {
  return Response.json(apiErrorSchema.parse({ error: { code, message } }), {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** Run a handler, mapping service errors onto the shared error contract. */
export async function handle(run: () => Promise<unknown>, status = 200) {
  try {
    const body = await run();
    return Response.json(body, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.code, error.status, error.message);
    }
    console.error(error);
    return errorResponse('INTERNAL_ERROR', 500, 'Unexpected server error.');
  }
}

/** Parse a JSON request body; malformed JSON becomes a 400. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ServiceError('INVALID_REQUEST', 400, 'Body must be valid JSON.');
  }
}
