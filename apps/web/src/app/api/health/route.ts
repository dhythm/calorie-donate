import 'server-only';
import { healthSchema } from '@calorie-donate/api';
import { errorResponse, getService } from '@/server/http';

/** Ready once the database is open and migrated (the first call does that). */
export async function GET() {
  try {
    await getService();
  } catch (error) {
    console.error(error);
    return errorResponse('INTERNAL_ERROR', 503, 'Database is not ready.');
  }
  return Response.json(
    healthSchema.parse({ status: 'ok', service: 'calorie-donate-api' }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
