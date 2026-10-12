import 'server-only';
import { estimateRequestSchema } from '@calorie-donate/api';
import { getEstimator, handle, readJson } from '@/server/http';
import { ServiceError } from '@/server/service';

/** Estimate calories from a meal photo. Nothing is saved until confirmed. */
export async function POST(request: Request) {
  return handle(async () => {
    const input = estimateRequestSchema.safeParse(await readJson(request));
    if (!input.success) {
      throw new ServiceError(
        'INVALID_REQUEST',
        400,
        'Send a JPEG, PNG, WebP or GIF image of at most 5 MB as base64.',
      );
    }
    return getEstimator().estimate(input.data);
  });
}
