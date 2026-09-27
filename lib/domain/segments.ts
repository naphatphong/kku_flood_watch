import { VEHICLES, type Passability, type RoadStatus, type Vehicle } from '../config';
import { postWeight } from './post';
import type { Report, SegmentStatuses } from './types';

// On equal weight, the worse status wins (safer for navigation).
const SEVERITY: Passability[] = ['blocked', 'hard', 'ok'];

/**
 * Road status per segment and vehicle (PLAN §4): the status with the largest total weight
 * among active posts touching the segment. Segments missing from the result have no data.
 * `segmentsOf` maps a report id to the segment ids it covers (road posts: chosen segments;
 * area posts: segments inside the circle).
 */
export function segmentStatuses(
  reports: Report[],
  segmentsOf: Map<number, number[]>,
  now: Date,
): Map<number, SegmentStatuses> {
  const tally = new Map<number, Map<Vehicle, Map<Passability, number>>>();
  for (const r of reports) {
    const w = postWeight(r, now);
    for (const seg of segmentsOf.get(r.id) ?? []) {
      const byVehicle = tally.get(seg) ?? new Map();
      tally.set(seg, byVehicle);
      for (const [vehicle, status] of Object.entries(r.passability) as [Vehicle, Passability][]) {
        const byStatus = byVehicle.get(vehicle) ?? new Map();
        byVehicle.set(vehicle, byStatus);
        byStatus.set(status, (byStatus.get(status) ?? 0) + w);
      }
    }
  }

  const result = new Map<number, SegmentStatuses>();
  for (const [seg, byVehicle] of tally) {
    const statuses = {} as SegmentStatuses;
    for (const { id } of VEHICLES) {
      const byStatus = byVehicle.get(id);
      statuses[id] = byStatus
        ? SEVERITY.reduce<RoadStatus>(
            (best, s) => ((byStatus.get(s) ?? 0) > (byStatus.get(best as Passability) ?? 0) ? s : best),
            SEVERITY.find((s) => byStatus.has(s))!,
          )
        : 'unknown';
    }
    result.set(seg, statuses);
  }
  return result;
}
