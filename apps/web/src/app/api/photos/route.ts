import 'server-only';
import type { PhotoUpload } from '@calorie-donate/api';
import { getService, handle, readJson } from '@/server/http';

/** Store a meal photo (base64 JSON). Attach it to a meal with `photoId`. */
export async function POST(request: Request) {
  return handle(
    async () =>
      (await getService()).uploadPhoto(
        (await readJson(request)) as PhotoUpload,
      ),
    201,
  );
}
