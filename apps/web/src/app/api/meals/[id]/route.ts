import 'server-only';
import type { MealInput } from '@calorie-donate/api';
import { getService, handle, readJson } from '@/server/http';

type Context = RouteContext<'/api/meals/[id]'>;

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return handle(async () => (await getService()).meal(id));
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  return handle(async () =>
    (await getService()).updateMeal(id, (await readJson(request)) as MealInput),
  );
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  return handle(async () => {
    await (await getService()).deleteMeal(id);
    return { deleted: true };
  });
}
