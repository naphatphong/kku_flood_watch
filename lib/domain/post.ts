import { INCIDENT_POST, INCIDENTS, POST, STATUS_TAGS, WATER_LEVELS, zoneLevel, type Category, type WaterLevel } from '../config';
import type { Report } from './types';

const HOUR_MS = 3_600_000;

/** When a post stops counting: expiryHours (flood or incident) after posting or after the latest "still" vote. */
export function expiresAt(createdAt: Date, lastStillVoteAt: Date | null, category: Category = 'flood'): Date {
  const from = Math.max(createdAt.getTime(), lastStillVoteAt?.getTime() ?? 0);
  return new Date(from + (category === 'flood' ? POST.expiryHours : INCIDENT_POST.expiryHours) * HOUR_MS);
}

/**
 * A post counts until it expires. An incident also stops counting once "cleared" votes outnumber
 * "still there" votes, with the poster counted as one "still there".
 */
export const isActive = (
  r: Pick<Report, 'createdAt' | 'lastStillVoteAt'> & { category?: Category; votes?: Report['votes'] },
  now: Date,
) =>
  expiresAt(r.createdAt, r.lastStillVoteAt, r.category) > now &&
  !(r.category && r.category !== 'flood' && r.votes && r.votes.receded > r.votes.still + 1);

/** Headline of a post and its colors: the water level, or the incident category. */
export function postLabel(p: { category?: Category; waterLevel: WaterLevel | null }) {
  if (p.category && p.category !== 'flood') {
    const c = INCIDENTS[p.category];
    return { label: c.label, color: c.color, text: c.color };
  }
  const w = WATER_LEVELS[p.waterLevel ?? 'dry'];
  const z = zoneLevel(w.score);
  return { label: w.label, color: z.color, text: z.text };
}

/** Vote button labels: flood posts recede, incidents get cleared. */
export const voteLabels = (category: Category = 'flood') =>
  category === 'flood' ? { still: 'ยังท่วม', receded: 'ลดแล้ว' } : { still: 'ยังอยู่', receded: 'เคลียร์แล้ว' };

/** Vote multiplier: x1.2 per "still" (capped at x2), x0.6 per "receded". */
export function voteMultiplier({ still, receded }: Report['votes']): number {
  const { stillFactor, stillMaxFactor, recededFactor } = POST.vote;
  return Math.min(stillMaxFactor, stillFactor ** still) * recededFactor ** receded;
}

/** Weight of a post right now: half-life decay since posting x vote multiplier. */
export function postWeight(r: Pick<Report, 'createdAt' | 'votes'>, now: Date): number {
  const ageHours = Math.max(0, now.getTime() - r.createdAt.getTime()) / HOUR_MS;
  return 0.5 ** (ageHours / POST.halfLifeHours) * voteMultiplier(r.votes);
}

/** Post score 0..100: water level + status tags. */
export function postScore(r: Pick<Report, 'waterLevel' | 'statusTags'>): number {
  const raw = (r.waterLevel ? WATER_LEVELS[r.waterLevel].score : 0) + r.statusTags.reduce((s, t) => s + STATUS_TAGS[t].delta, 0);
  return Math.min(100, Math.max(0, raw));
}
