// Every tunable number lives here (PLAN §4–7 and §0). Change values here, never inline.

export const SITE = {
  name: 'KKU Flood Watch',
  tagline: 'น้ำท่วมรอบ มข. จากรายงานของชุมชน',
  description: 'แผนที่จุดน้ำท่วม สถานะถนนแยกตามประเภทรถ และเส้นทางหลบน้ำรอบมหาวิทยาลัยขอนแก่น',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kku-flood-watch.vercel.app',
  timeZone: 'Asia/Bangkok',
};

// Sign-in buttons. LINE is a Supabase custom OAuth provider named `custom:line` (SETUP.md).
// Set NEXT_PUBLIC_AUTH_PROVIDERS=google,custom:line once each provider is configured.
export const AUTH_PROVIDERS = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? 'google')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

export const MAP = {
  center: [102.8173, 16.4617] as [number, number], // KKU campus, [lng, lat]
  radiusKm: 5,
  zoom: 13.4,
  style: 'https://tiles.openfreemap.org/styles/positron',
};

// ---- Posts (PLAN §4) -------------------------------------------------------

export const VEHICLES = [
  { id: 'motorcycle', label: 'มอเตอร์ไซค์', short: 'มอไซค์' },
  { id: 'car', label: 'รถเก๋ง', short: 'เก๋ง' },
  { id: 'pickup', label: 'กระบะ/รถสูง', short: 'กระบะ' },
  { id: 'walk', label: 'เดินเท้า', short: 'เดิน' },
] as const;
export type Vehicle = (typeof VEHICLES)[number]['id'];
export const DEFAULT_VEHICLE: Vehicle = 'motorcycle';

export const WATER_LEVELS = {
  dry: { label: 'แห้ง/ผ่านได้', score: 0 },
  puddle: { label: 'น้ำขังเล็กน้อย', score: 30 },
  ankle: { label: 'ท่วมตาตุ่ม', score: 50 },
  knee: { label: 'ท่วมเข่า', score: 75 },
  waist: { label: 'ท่วมเอวขึ้นไป', score: 95 },
} as const;
export type WaterLevel = keyof typeof WATER_LEVELS;

export const STATUS_TAGS = {
  raining: { label: 'ฝนกำลังตก', delta: 0 },
  rising: { label: 'น้ำกำลังขึ้น', delta: 10 },
  receding: { label: 'น้ำกำลังลด', delta: -15 },
  drain_overflow: { label: 'ท่อระบายไม่ทัน', delta: 0 },
} as const;
export type StatusTag = keyof typeof STATUS_TAGS;

// Road colors, Google Maps style: green ok, yellow hard, red blocked, grey no data.
export const ROAD_STATUS = {
  ok: { label: 'ผ่านได้', color: '#34C759' },
  hard: { label: 'ผ่านยาก', color: '#F5B800' },
  blocked: { label: 'ผ่านไม่ได้', color: '#FF3B30' },
  unknown: { label: 'ไม่มีข้อมูล', color: '#AEAEB2' },
} as const;
export type RoadStatus = keyof typeof ROAD_STATUS;
export type Passability = Exclude<RoadStatus, 'unknown'>;

export const FLAG_REASONS = {
  false: 'ข้อมูลเท็จ',
  spam: 'สแปม',
  inappropriate: 'ไม่เหมาะสม',
  duplicate: 'ซ้ำ',
} as const;
export type FlagReason = keyof typeof FLAG_REASONS;

export const POST = {
  radiusM: { min: 20, max: 300, default: 100 },
  roadMaxLengthM: 500,
  halfLifeHours: 2, // weight = 0.5 ^ (hours / halfLife)
  expiryHours: 6, // after posting or the latest "still flooded" vote
  vote: { stillFactor: 1.2, stillMaxFactor: 2, recededFactor: 0.6 },
  flagsToHide: 3, // unique users
  noteMaxLength: 500,
  photo: { maxDimensionPx: 1600, jpegQuality: 0.82, maxUploadMb: 10 },
};

// ---- Risk % (PLAN §5, clusters per §0) -------------------------------------

export const SCORE = {
  rain: {
    r3: { capMm: 50, weight: 0.5 },
    r24: { capMm: 90, weight: 0.3 },
    rainyDays: { cap: 5, weight: 0.2 },
    rainyDayMm: 10,
  },
  lowFactor: { high: 0.6, normal: 1.0, low: 1.3 },
  // Tercile cut points of ground elevation over the area (scripts/elevation-terciles.ts).
  elevationTercilesM: [164, 181] as [number, number], // 1253 points, 150–219 m (27 Sep 2026)
  confidence: { perWeight: 0.16, max: 0.8 }, // c = min(max, perWeight * Σw)
  refreshMinutes: 15,
};

export const CLUSTER = {
  epsM: 300, // posts closer than this join one circle (DBSCAN)
  minRadiusM: 150,
  minReportToShow: 30, // only "flooded" circles are shown: puddle or deeper
};

// Watch circles: pockets of low ground that may flood when it rains, before anyone posts
// (owner request, 27 Sep 2026). Spots come from scripts/elevation-terciles.ts: re-run it after
// changing neighbourM, pocketDepthM, epsM or minPoints (minPct applies right away).
export const WATCH = {
  neighbourM: 750, // compare each 250 m grid point with the ground around it this far
  pocketDepthM: 4, // a pocket is at least this much lower than its surroundings
  epsM: 400, // pocket points within this distance form one spot
  minPoints: 3, // ignore single DEM points (noise)
  minPct: 30, // show when rain × low-lying factor (PLAN §5 base) reaches this %
};

// Weather page (owner request, 27 Sep 2026): Open-Meteo forecast for the area center.
export const WEATHER = {
  days: 10,
  cacheMinutes: 15,
  alerts: {
    heavyRainMm: 35, // Thai Meteorological Department: heavy 35.1–90 mm/day
    veryHeavyRainMm: 90, // very heavy > 90 mm/day
    gustKmh: 50, // strong gusts
    strongGustKmh: 75,
    heatC: 40, // TMD "ร้อนจัด"
  },
};

export const ZONE_LEVELS = [
  { min: 80, label: 'อันตราย', color: '#FF3B30', text: '#D70015' },
  { min: 60, label: 'สูง', color: '#FF9500', text: '#C93400' },
  { min: 30, label: 'ปานกลาง', color: '#FFCC00', text: '#9A6700' },
  { min: 0, label: 'ต่ำ', color: '#34C759', text: '#248A3D' },
] as const;
export const zoneLevel = (pct: number) => ZONE_LEVELS.find((l) => pct >= l.min)!;

// ---- Navigation (PLAN §6) --------------------------------------------------

export const ROUTING = {
  alternatives: 3, // pgr_KSP k
  costFactor: { ok: 1, unknown: 1, hard: 3 }, // blocked segments are removed
  riskyClusterMin: 60, // segments inside such circles cost +50%
  riskyClusterPenalty: 0.5,
  walkSpeedKmh: 5, // walking ignores one-way streets
  minSavingPct: 5, // "balanced"/"shortest" are shown only if this much faster than the routes before them
  maxVia: 3, // points added by dragging the route
  mapsWaypoints: 3, // Google Maps URLs honor 3 waypoints on mobile
  geocoderUrl: 'https://photon.komoot.io/api/', // place search on OpenStreetMap data, no key needed
  placeSearchKm: 40, // search places this far around the area (farther ones hand off to Google Maps)
  speedKmhByHighway: {
    trunk: 70,
    primary: 60,
    secondary: 50,
    tertiary: 40,
    unclassified: 30,
    residential: 30,
    living_street: 15,
    service: 20,
    default: 30,
  } as Record<string, number>,
};

// ---- Abuse limits and spam (PLAN §7) ---------------------------------------

export const LIMITS = {
  maxPosterDistanceKm: 2,
  postCooldownMinutes: 5,
  postsPerDay: 10,
  // Per IP, anonymous endpoints. The plan names no numbers; these are defaults.
  publicApi: { windowSeconds: 60, maxRequests: 120 },
  routeApi: { windowSeconds: 60, maxRequests: 20 },
  // Per user: every vote or flag triggers a recompute.
  userActions: { windowSeconds: 60, maxRequests: 20 },
};

export const SPAM = {
  points: {
    newAccount: 30,
    noGps: 40,
    implausibleDepth: 30,
    nearLimit: 10,
    linkOrBannedWord: 40,
    repeatOffender: 30,
    trusted: -40,
  },
  newAccountHours: 24,
  implausibleDepth: { fromLevel: 'knee' as WaterLevel, maxRain24Mm: 5 },
  nearLimitRatio: 0.9,
  repeatOffender: { count: 2, days: 30 },
  trustedMinApproved: 5,
  pendingAt: 50, // < 50 approved, 50–79 pending, >= 80 rejected
  rejectAt: 80,
  bannedWords: [] as string[], // TODO(owner): banned word list (PLAN §12)
};
