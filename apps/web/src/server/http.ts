import 'server-only';
import path from 'node:path';
import { apiErrorSchema, type ApiErrorCode } from '@calorie-donate/api';
import { createEstimator, type CalorieEstimator } from './estimator';
import { createService, ServiceError, type Service } from './service';
import { createFileStore } from './store';

let service: Service | undefined;
let estimator: CalorieEstimator | undefined;

/** Process-wide service backed by the JSON data file. */
export function getService(): Service {
  service ??= createService(
    createFileStore(
      process.env.CALORIE_DONATE_DATA_FILE ||
        path.join(process.cwd(), '.data', 'calorie-donate.json'),
    ),
  );
  return service;
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
