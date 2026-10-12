import { IMAGE_MAX_BYTES, type PhotoUpload } from '@calorie-donate/api';

/** Long edge recommended for Claude vision; larger images only add latency. */
const MAX_EDGE = 1568;

/** Downscale a photo in the browser and encode it for upload. */
export async function prepareImage(
  file: File,
): Promise<PhotoUpload & { previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not supported.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const imageBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if ((imageBase64.length * 3) / 4 > IMAGE_MAX_BYTES) {
    throw new Error('Image is too large.');
  }
  return { mediaType: 'image/jpeg', imageBase64, previewUrl: dataUrl };
}
