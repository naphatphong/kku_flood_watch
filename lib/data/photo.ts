import 'server-only';
import sharp from 'sharp';
import { POST } from '../config';

/**
 * Re-encodes an uploaded photo as JPEG: applies EXIF rotation, then drops all metadata
 * (GPS, device) as sharp does by default, and caps the size (PLAN §7).
 */
export async function processPhoto(file: File): Promise<Buffer> {
  if (file.size > POST.photo.maxUploadMb * 1024 * 1024) throw new Error('too large');
  const { maxDimensionPx, jpegQuality } = POST.photo;
  return sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize(maxDimensionPx, maxDimensionPx, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: Math.round(jpegQuality * 100), mozjpeg: true })
    .toBuffer();
}
