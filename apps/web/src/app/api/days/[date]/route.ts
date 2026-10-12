import 'server-only';
import { dateKeySchema } from '@calorie-donate/api';
import { errorResponse, getService, handle } from '@/server/http';

export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/days/[date]'>,
) {
  const { date } = await params;
  if (!dateKeySchema.safeParse(date).success) {
    return errorResponse('INVALID_REQUEST', 400, 'date must be YYYY-MM-DD.');
  }
  return handle(async () => (await getService()).day(date));
}
