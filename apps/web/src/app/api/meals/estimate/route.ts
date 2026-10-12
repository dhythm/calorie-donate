import 'server-only';
import { estimateRequestSchema } from '@calorie-donate/api';
import { getEstimator, getService, handle, readJson } from '@/server/http';
import { ServiceError } from '@/server/service';

/** Estimate calories from an uploaded meal photo. Nothing is saved. */
export async function POST(request: Request) {
  return handle(async () => {
    const input = estimateRequestSchema.safeParse(await readJson(request));
    if (!input.success) {
      throw new ServiceError(
        'INVALID_REQUEST',
        400,
        'photoId must be the id of an uploaded photo.',
      );
    }
    const photo = await (await getService()).photo(input.data.photoId);
    return getEstimator().estimate({
      mediaType: photo.contentType,
      imageBase64: photo.data.toString('base64'),
    });
  });
}
