import 'server-only';
import { dateKeySchema } from '@calorie-donate/api';
import { errorResponse, getService, handle } from '@/server/http';

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date');
  if (date !== null && !dateKeySchema.safeParse(date).success) {
    return errorResponse('INVALID_REQUEST', 400, 'date must be YYYY-MM-DD.');
  }
  return handle(async () => (await getService()).overview(date ?? undefined));
}
