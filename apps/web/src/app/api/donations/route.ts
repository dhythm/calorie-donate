import 'server-only';
import { getService, handle } from '@/server/http';

export async function GET() {
  return handle(() => getService().donations());
}
