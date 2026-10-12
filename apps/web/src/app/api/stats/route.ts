import 'server-only';
import { getService, handle } from '@/server/http';

export async function GET(request: Request) {
  const days = Number(new URL(request.url).searchParams.get('days') ?? 84);
  return handle(async () =>
    (await getService()).stats(Number.isFinite(days) ? days : 84),
  );
}
