import 'server-only';
import { getService, handle } from '@/server/http';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return handle(async () =>
    (await getService()).periodHistory({
      period: (params.get('period') ?? 'week') as 'week' | 'month' | 'year',
      anchor: params.get('anchor') ?? undefined,
    }),
  );
}
