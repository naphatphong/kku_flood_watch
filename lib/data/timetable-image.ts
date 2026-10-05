import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { REG_IMPORT } from '../config';
import { regClassesFrom, type RegClass } from '../domain/reg-import';

/** Screenshot reading is on once the owner sets ANTHROPIC_API_KEY (SETUP.md). */
export const imageImportEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

export class ImageReadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const SYSTEM = `You read class timetables from screenshots of the Khon Kaen University registrar (reg.kku.ac.th) for students who want them in a campus map app.
The timetable is usually a grid: one row per weekday (Mon-Sun, or Thai จันทร์-อาทิตย์), columns are times (hour slots such as 8:00-9:00, often split into quarter hours). Each class is a block spanning its time, with text like "SC401201 (3) 1, SC8304 SC8": course code, credits in brackets, section, then room and building. "- -" means no room.
Return every class block. Read start and end from where the block's left and right edges fall against the time header; classes can start or end on quarter hours, such as 10:00-11:45. Use 24-hour HH:MM. Copy codes exactly as written and use "" for anything not shown. If the image is not a timetable, return no classes.`;

const text = { type: 'string' };
const SCHEMA = {
  type: 'object',
  properties: {
    classes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          course: text,
          section: text,
          day: { type: 'string', enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
          start: { type: 'string', description: 'HH:MM' },
          end: { type: 'string', description: 'HH:MM' },
          room: text,
          building: text,
        },
        required: ['course', 'section', 'day', 'start', 'end', 'room', 'building'],
        additionalProperties: false,
      },
    },
  },
  required: ['classes'],
  additionalProperties: false,
};

/** Classes Claude reads from a timetable screenshot; the visitor reviews them before saving. */
export async function readTimetableImage(file: File): Promise<RegClass[]> {
  if (file.size > REG_IMPORT.maxImageMB * 1024 * 1024) throw new ImageReadError(413, `ภาพใหญ่เกิน ${REG_IMPORT.maxImageMB} MB`);
  let jpeg: Buffer;
  try {
    // Re-encoding also proves it is an image and drops its metadata.
    jpeg = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: REG_IMPORT.imageEdgePx, height: REG_IMPORT.imageEdgePx, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    throw new ImageReadError(400, 'เปิดไฟล์ภาพนี้ไม่ได้ ใช้ภาพ PNG หรือ JPG');
  }

  let res: Anthropic.Beta.BetaMessage;
  try {
    res = await new Anthropic().beta.messages.create({
      model: REG_IMPORT.model,
      max_tokens: 16000,
      // A safety-classifier decline is retried on Anthropic's recommended model instead of failing.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: REG_IMPORT.effort, format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } },
            { type: 'text', text: 'Read the classes in this timetable.' },
          ],
        },
      ],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new ImageReadError(503, 'ระบบอ่านภาพไม่ว่าง ลองใหม่ในอีกสักครู่');
    if (e instanceof Anthropic.APIError) {
      console.error('Claude API', e.status, e.message);
      throw new ImageReadError(502, 'อ่านภาพไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
    throw e;
  }

  if (res.stop_reason === 'refusal') throw new ImageReadError(422, 'อ่านภาพนี้ไม่ได้ ลองวางตารางแทน');
  const out = res.content.find((b) => b.type === 'text');
  try {
    return regClassesFrom(JSON.parse(out?.type === 'text' ? out.text : ''));
  } catch {
    console.error('Claude timetable output', res.stop_reason, out);
    throw new ImageReadError(502, 'อ่านภาพไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
}
