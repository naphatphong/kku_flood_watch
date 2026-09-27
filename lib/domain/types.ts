import type { Passability, RoadStatus, StatusTag, Vehicle, WaterLevel } from '../config';
import type { LngLat } from './geo';

export type ReportKind = 'area' | 'road';
export type ReportStatus = 'pending' | 'approved' | 'rejected' | 'hidden' | 'deleted';

/** A flood report as the scoring logic needs it (subset of the `reports` row). */
export interface Report {
  id: number;
  kind: ReportKind;
  position: LngLat;
  radiusM: number | null; // area posts only
  waterLevel: WaterLevel;
  statusTags: StatusTag[];
  passability: Partial<Record<Vehicle, Passability>>;
  createdAt: Date;
  lastStillVoteAt: Date | null;
  votes: { still: number; receded: number };
  elevationM: number | null;
}

export interface RainSummary {
  at: Date;
  r1: number;
  r3: number;
  r24: number;
  r72: number;
  rainyDays: number;
  forecast3h: number;
  hourly: number[]; // last 12 hours, oldest first (for the panel sparkline)
}

export interface Cluster {
  id: string;
  center: LngLat;
  radiusM: number;
  reportIds: number[];
  lowFactor: number;
  base: number; // % from rain x low-lying factor
  report: number; // % from posts
  c: number; // how much the posts are trusted, 0..max
  final: number;
  weightSum: number;
}

export type SegmentStatuses = Record<Vehicle, RoadStatus>;
