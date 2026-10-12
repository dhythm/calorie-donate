import 'server-only';
import type { ProfileInput } from '@calorie-donate/api';
import { getService, handle, readJson } from '@/server/http';

export async function PUT(request: Request) {
  return handle(async () =>
    (await getService()).saveProfile((await readJson(request)) as ProfileInput),
  );
}
