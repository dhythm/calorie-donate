import 'server-only';
import { echoSchema, apiErrorSchema } from '@calorie-donate/api';
export async function POST(request: Request) {
  const input: unknown = await request.json().catch(() => null);
  const result = echoSchema.safeParse(input);
  if (!result.success) {
    return Response.json(
      apiErrorSchema.parse({
        error: {
          code: 'INVALID_REQUEST',
          message:
            'message must be a non-empty string of at most 200 characters.',
        },
      }),
      { status: 400 },
    );
  }
  return Response.json(echoSchema.parse(result.data), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
