import { POST, STATUS_TAGS, WATER_LEVELS } from '../config';
import type { Report } from './types';

const HOUR_MS = 3_600_000;

/** When a post stops counting: expiryHours after posting or after the latest "still flooded" vote. */
export function expiresAt(createdAt: Date, lastStillVoteAt: Date | null): Date {
  const from = Math.max(createdAt.getTime(), lastStillVoteAt?.getTime() ?? 0);
  return new Date(from + POST.expiryHours * HOUR_MS);
}

export const isActive = (r: Pick<Report, 'createdAt' | 'lastStillVoteAt'>, now: Date) =>
  expiresAt(r.createdAt, r.lastStillVoteAt) > now;

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
  const raw = WATER_LEVELS[r.waterLevel].score + r.statusTags.reduce((s, t) => s + STATUS_TAGS[t].delta, 0);
  return Math.min(100, Math.max(0, raw));
}
