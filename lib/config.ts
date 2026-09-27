// Default values from docs/PLAN.md. Tune here; don't hard-code them elsewhere.

export const MAP = {
  // TODO(owner): exact center and radius are still an open question (PLAN §12).
  center: [102.8173, 16.4617] as [number, number], // KKU campus, [lng, lat]
  radiusKm: 5,
  zoom: 13.4,
  style: 'https://tiles.openfreemap.org/styles/positron',
};

export const VEHICLES = [
  { id: 'motorcycle', label: 'มอเตอร์ไซค์' },
  { id: 'car', label: 'รถเก๋ง' },
  { id: 'pickup', label: 'กระบะ' },
  { id: 'walk', label: 'เดินเท้า' },
] as const;
export type Vehicle = (typeof VEHICLES)[number]['id'];

// Road colors (PLAN §4): green ok, yellow hard, red blocked, grey no data.
export const ROAD_STATUS = {
  ok: { label: 'ผ่านได้', color: '#34C759' },
  hard: { label: 'ผ่านยาก', color: '#F5B800' },
  blocked: { label: 'ผ่านไม่ได้', color: '#FF3B30' },
  unknown: { label: 'ไม่มีข้อมูล', color: '#AEAEB2' },
} as const;
export type RoadStatus = keyof typeof ROAD_STATUS;

// Water-level tag scores (PLAN §4).
export const WATER_LEVELS = {
  dry: { label: 'แห้ง/ผ่านได้', score: 0 },
  puddle: { label: 'น้ำขังเล็กน้อย', score: 30 },
  ankle: { label: 'ท่วมตาตุ่ม', score: 50 },
  knee: { label: 'ท่วมเข่า', score: 75 },
  waist: { label: 'ท่วมเอวขึ้นไป', score: 95 },
} as const;
export type WaterLevel = keyof typeof WATER_LEVELS;

// Zone risk levels (PLAN §5): 0–29 low, 30–59 medium, 60–79 high, 80–100 danger.
// `text` is a darker shade that passes contrast on white.
export const ZONE_LEVELS = [
  { min: 80, label: 'อันตราย', color: '#FF3B30', text: '#D70015' },
  { min: 60, label: 'สูง', color: '#FF9500', text: '#C93400' },
  { min: 30, label: 'ปานกลาง', color: '#FFCC00', text: '#9A6700' },
  { min: 0, label: 'ต่ำ', color: '#34C759', text: '#248A3D' },
] as const;
export const zoneLevel = (pct: number) => ZONE_LEVELS.find((l) => pct >= l.min)!;
