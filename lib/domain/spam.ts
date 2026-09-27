import { POST, SPAM, WATER_LEVELS, type WaterLevel } from '../config';
import type { ReportStatus } from './types';

export type SpamReason = keyof typeof SPAM.points;

export const SPAM_REASON_LABELS: Record<SpamReason, string> = {
  newAccount: 'บัญชีอายุน้อยกว่า 24 ชม.',
  noGps: 'ไม่ได้ส่งตำแหน่ง GPS',
  implausibleDepth: 'รายงานน้ำลึก แต่ฝน 24 ชม. น้อยมาก',
  nearLimit: 'รัศมีหรือความยาวถนนเกือบเต็มลิมิต',
  linkOrBannedWord: 'มีลิงก์หรือคำต้องห้าม',
  repeatOffender: 'เคยถูกปฏิเสธหรือถูกซ่อนบ่อยใน 30 วัน',
  trusted: 'ผู้ใช้ที่เชื่อถือได้',
};

export interface SpamInput {
  accountCreatedAt: Date;
  posterDistanceM: number | null; // null when the poster sent no GPS
  waterLevel: WaterLevel;
  rain24Mm: number;
  radiusM: number | null;
  roadLengthM: number | null;
  note: string | null;
  penalties30d: number; // own posts rejected or hidden in the last 30 days
  approvedCount: number;
  rejectedCount: number;
}

const LINK = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|info|xyz|top|bet|io|co|me|link|site|online|ly|th)\b/i;

export function hasLinkOrBannedWord(note: string | null): boolean {
  if (!note) return false;
  const text = note.toLowerCase();
  return LINK.test(text) || SPAM.bannedWords.some((w) => w && text.includes(w.toLowerCase()));
}

/** Rule-based spam score (PLAN §7): < 50 approved, 50–79 pending, >= 80 rejected. */
export function spamCheck(input: SpamInput, now: Date) {
  const reasons: SpamReason[] = [];
  const ageHours = (now.getTime() - input.accountCreatedAt.getTime()) / 3_600_000;
  if (ageHours < SPAM.newAccountHours) reasons.push('newAccount');
  if (input.posterDistanceM == null) reasons.push('noGps');
  if (
    WATER_LEVELS[input.waterLevel].score >= WATER_LEVELS[SPAM.implausibleDepth.fromLevel].score &&
    input.rain24Mm < SPAM.implausibleDepth.maxRain24Mm
  )
    reasons.push('implausibleDepth');
  if (
    (input.radiusM ?? 0) >= SPAM.nearLimitRatio * POST.radiusM.max ||
    (input.roadLengthM ?? 0) >= SPAM.nearLimitRatio * POST.roadMaxLengthM
  )
    reasons.push('nearLimit');
  if (hasLinkOrBannedWord(input.note)) reasons.push('linkOrBannedWord');
  if (input.penalties30d >= SPAM.repeatOffender.count) reasons.push('repeatOffender');
  if (input.approvedCount >= SPAM.trustedMinApproved && input.rejectedCount === 0) reasons.push('trusted');

  const score = reasons.reduce((s, r) => s + SPAM.points[r], 0);
  const status: ReportStatus = score >= SPAM.rejectAt ? 'rejected' : score >= SPAM.pendingAt ? 'pending' : 'approved';
  return { score, reasons, status };
}
