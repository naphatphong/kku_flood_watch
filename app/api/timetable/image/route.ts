import { getViewer } from '@/lib/auth';
import { ImageReadError, imageImportEnabled, readTimetableImage } from '@/lib/data/timetable-image';
import { errorJson, rateLimited } from '@/lib/http';

export const maxDuration = 90; // Claude may take tens of seconds on a full week

/** Read a timetable screenshot with Claude (multipart `image`). Signed-in users only: each read is paid. */
export async function POST(req: Request) {
  if (!imageImportEnabled()) return errorJson(503, 'ยังไม่เปิดใช้การอ่านภาพ ใช้วิธีคัดลอกตารางแทน');
  const viewer = await getViewer();
  if (!viewer) return errorJson(401, 'เข้าสู่ระบบก่อนใช้การอ่านภาพ');
  if (viewer.banned) return errorJson(403, 'บัญชีนี้ถูกระงับ');
  const limited = await rateLimited(req, 'imageReads', viewer.id);
  if (limited) return limited;

  const image = (await req.formData().catch(() => null))?.get('image');
  if (!(image instanceof File)) return errorJson(400, 'เลือกภาพตารางเรียน');
  try {
    return Response.json({ classes: await readTimetableImage(image) });
  } catch (e) {
    if (e instanceof ImageReadError) return errorJson(e.status, e.message);
    console.error(e);
    return errorJson(500, 'อ่านภาพไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
}
