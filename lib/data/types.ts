// Shapes the API returns and the UI consumes.
import type { Category, Passability, StatusTag, Vehicle, WaterLevel } from '../config';
import type { ReportKind } from '../domain/types';

export interface ClusterDTO {
  id: string;
  name: string | null;
  lng: number;
  lat: number;
  radiusM: number;
  reportCount: number;
  base: number;
  report: number;
  c: number;
  final: number;
  lowFactor: number;
}

export interface ReportPin {
  id: number;
  kind: ReportKind;
  category: Category;
  lng: number;
  lat: number;
  radiusM: number | null;
  waterLevel: WaterLevel | null; // flood posts only
  statusTags: StatusTag[];
  passability: Partial<Record<Vehicle, Passability>>;
  note: string | null;
  photoUrl: string | null;
  createdAt: string;
  stillVotes: number;
  recededVotes: number;
}

export interface RainDTO {
  at: string;
  r1: number;
  r3: number;
  r24: number;
  r72: number;
  rainyDays: number;
  forecast3h: number;
  hourly: number[];
}

/** Watch circle: low ground that the current rain may flood (no posts needed). */
export interface WatchDTO {
  id: string;
  name: string | null;
  lng: number;
  lat: number;
  radiusM: number;
  elevationM: number;
  pct: number;
}

export interface ZonesResponse {
  clusters: ClusterDTO[]; // flooded circles only, riskiest first
  watch: WatchDTO[]; // watch circles from rain × low ground, riskiest first
  rain: RainDTO | null;
  rainScore: number;
  updatedAt: string;
  demo: boolean;
}

export interface ReportsResponse {
  reports: ReportPin[];
  demo: boolean;
}

export type BBox = [west: number, south: number, east: number, north: number];
