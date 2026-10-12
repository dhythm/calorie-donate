import 'server-only';
import { getService, handle } from '@/server/http';

export async function GET(request: Request) {
  const days = Number(new URL(request.url).searchParams.get('days') ?? 14);
  return handle(() => getService().history(Number.isFinite(days) ? days : 14));
}
