import 'server-only';
import { healthSchema } from '@calorie-donate/api';
export function GET() {
  return Response.json(
    healthSchema.parse({ status: 'ok', service: 'calorie-donate-api' }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
