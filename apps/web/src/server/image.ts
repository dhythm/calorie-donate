import 'server-only';
import type { PhotoUpload } from '@calorie-donate/api';

const startsWith = (data: Uint8Array, bytes: number[], offset = 0) =>
  bytes.every((byte, i) => data[offset + i] === byte);

/** Image type from file signature; null when it is not a supported image. */
export function detectImageType(
  data: Uint8Array,
): PhotoUpload['mediaType'] | null {
  if (startsWith(data, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(data, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (
    startsWith(data, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  return null;
}
