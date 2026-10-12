import 'server-only';
import type { MealInput } from '@calorie-donate/api';
import { getService, handle, readJson } from '@/server/http';

export async function POST(request: Request) {
  return handle(
    async () =>
      (await getService()).createMeal((await readJson(request)) as MealInput),
    201,
  );
}
