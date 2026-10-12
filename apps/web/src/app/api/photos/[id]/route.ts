import 'server-only';
import { errorResponse, getService } from '@/server/http';
import { ServiceError } from '@/server/service';

export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/photos/[id]'>,
) {
  const { id } = await params;
  try {
    const photo = await (await getService()).photo(id);
    return new Response(new Uint8Array(photo.data), {
      headers: {
        'Content-Type': photo.contentType,
        // A photo id always refers to the same bytes.
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.code, error.status, error.message);
    }
    throw error;
  }
}
