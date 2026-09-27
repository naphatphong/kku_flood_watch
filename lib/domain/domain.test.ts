// Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCORE } from '../config';
import { buildClusters, groupReports, isFlooded, lowFactor, scoreCluster } from './cluster';
import { destination, distanceM, type LngLat } from './geo';
import { expiresAt, postScore, postWeight, voteMultiplier } from './post';
import { rainScore, summarizeRain } from './rain';
import { parseReportForm } from './report-input';
import { chainLengthM, toggleSegment, type ChainSegment } from './road-chain';
import { segmentStatuses } from './segments';
import { spamCheck } from './spam';
import type { Report } from './types';

const NOW = new Date('2026-09-27T07:00:00Z'); // 14:00 in Bangkok
const HOUR = 3_600_000;
const ORIGIN: LngLat = [102.8173, 16.4617];

const report = (over: Partial<Report> & { id: number }): Report => ({
  kind: 'area',
  position: ORIGIN,
  radiusM: 50,
  waterLevel: 'knee',
  statusTags: [],
  passability: {},
  createdAt: NOW,
  lastStillVoteAt: null,
  votes: { still: 0, receded: 0 },
  elevationM: null,
  ...over,
});

const close = (actual: number, expected: number, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} !== ${expected}`);

test('geo: destination and distance agree', () => {
  close(distanceM(ORIGIN, destination(ORIGIN, 300, 400)), 500, 0.5);
});

test('rain score follows PLAN §5 step 1', () => {
  close(rainScore({ r3: 42, r24: 88, rainyDays: 3 }), 0.5 * 0.84 + 0.3 * (88 / 90) + 0.2 * 0.6);
  close(rainScore({ r3: 500, r24: 500, rainyDays: 30 }), 1); // capped
});

test('rain summary: sums, rainy days and forecast from hourly data', () => {
  // 3 local days of hourly data (UTC+7), 12 mm/day on day 1 and 2, today 1 mm/h since 10:00.
  const times: string[] = [];
  const precipitation: number[] = [];
  for (const day of ['2026-09-25', '2026-09-26', '2026-09-27']) {
    for (let h = 0; h < 24; h++) {
      times.push(`${day}T${String(h).padStart(2, '0')}:00`);
      precipitation.push(day === '2026-09-27' ? (h >= 10 ? 1 : 0) : h === 12 ? 12 : 0);
    }
  }
  const s = summarizeRain({ times, precipitation, utcOffsetSeconds: 7 * 3600 }, NOW);
  assert.equal(s.r1, 1);
  assert.equal(s.r3, 3);
  assert.equal(s.r24, 5); // 10:00..14:00 today; yesterday's 12:00 is 26 h ago
  assert.equal(s.rainyDays, 2); // today (5 mm so far) is skipped, then 2 rainy days
  assert.equal(s.forecast3h, 3);
  assert.equal(s.hourly.length, 12);
});

test('post weight: half-life decay and vote multipliers', () => {
  close(postWeight(report({ id: 1 }), NOW), 1);
  close(postWeight(report({ id: 1, createdAt: new Date(NOW.getTime() - 2 * HOUR) }), NOW), 0.5);
  close(voteMultiplier({ still: 5, receded: 0 }), 2); // 1.2^5 capped at 2
  close(voteMultiplier({ still: 1, receded: 1 }), 1.2 * 0.6);
});

test('expiry: 6 h after posting or after the latest still vote', () => {
  const created = new Date('2026-09-27T03:00:00Z');
  assert.equal(expiresAt(created, null).toISOString(), '2026-09-27T09:00:00.000Z');
  assert.equal(expiresAt(created, new Date('2026-09-27T06:00:00Z')).toISOString(), '2026-09-27T12:00:00.000Z');
});

test('post score: water level + tags, clamped to 0..100', () => {
  assert.equal(postScore({ waterLevel: 'knee', statusTags: ['rising'] }), 85);
  assert.equal(postScore({ waterLevel: 'dry', statusTags: ['receding'] }), 0);
  assert.equal(postScore({ waterLevel: 'waist', statusTags: ['rising'] }), 100);
});

test('clustering chains posts within eps and splits far ones', () => {
  const a = report({ id: 1 });
  const b = report({ id: 2, position: destination(ORIGIN, 250, 0) });
  const c = report({ id: 3, position: destination(ORIGIN, 500, 0) });
  const d = report({ id: 4, position: destination(ORIGIN, 2000, 0) });
  const groups = groupReports([a, b, c, d]).map((g) => g.map((r) => r.id).sort());
  assert.deepEqual(groups, [[1, 2, 3], [4]]);
});

test('low factor from elevation terciles', () => {
  const [t1, t2] = SCORE.elevationTercilesM;
  assert.equal(lowFactor([t1 - 1]), SCORE.lowFactor.low);
  assert.equal(lowFactor([t2 + 1]), SCORE.lowFactor.high);
  assert.equal(lowFactor([null]), SCORE.lowFactor.normal);
});

test('cluster score: final = (1 - c) * base + c * report', () => {
  const cl = scoreCluster(
    [report({ id: 7, waterLevel: 'knee' }), report({ id: 3, waterLevel: 'waist', position: destination(ORIGIN, 100, 0) })],
    0.5,
    NOW,
  );
  assert.equal(cl.id, 'c3');
  assert.equal(cl.report, 85);
  assert.equal(cl.c, 0.32);
  assert.equal(cl.base, 50);
  assert.equal(cl.final, 61.2); // 0.68 * 50 + 0.32 * 85
  assert.ok(cl.radiusM >= 100);
  assert.ok(isFlooded(cl));

  const many = Array.from({ length: 10 }, (_, i) => report({ id: i + 1, waterLevel: 'dry' }));
  const [dry] = buildClusters(many, 0.5, NOW);
  assert.equal(dry.c, SCORE.confidence.max);
  assert.equal(isFlooded(dry), false);
});

test('segment status: heaviest status wins, worse wins ties, no data is unknown', () => {
  const fresh = report({ id: 1, passability: { motorcycle: 'blocked', car: 'hard' } });
  const old = report({ id: 2, passability: { motorcycle: 'ok' }, createdAt: new Date(NOW.getTime() - 2 * HOUR) });
  const tie = report({ id: 3, passability: { pickup: 'ok' } });
  const tie2 = report({ id: 4, passability: { pickup: 'blocked' } });
  const s = segmentStatuses(
    [fresh, old, tie, tie2],
    new Map([
      [1, [10]],
      [2, [10]],
      [3, [10]],
      [4, [10]],
    ]),
    NOW,
  ).get(10)!;
  assert.deepEqual(s, { motorcycle: 'blocked', car: 'hard', pickup: 'blocked', walk: 'unknown' });
});

test('spam check thresholds (PLAN §7)', () => {
  const base = {
    accountCreatedAt: new Date(NOW.getTime() - 30 * 24 * HOUR),
    posterDistanceM: 100,
    waterLevel: 'ankle' as const,
    rain24Mm: 40,
    radiusM: 100,
    roadLengthM: null,
    note: null,
    penalties30d: 0,
    approvedCount: 0,
    rejectedCount: 0,
  };
  assert.equal(spamCheck(base, NOW).status, 'approved');
  const fresh = spamCheck({ ...base, accountCreatedAt: new Date(NOW.getTime() - HOUR), posterDistanceM: null }, NOW);
  assert.deepEqual([fresh.score, fresh.status], [70, 'pending']);
  const bad = spamCheck(
    { ...base, accountCreatedAt: NOW, posterDistanceM: null, note: 'ดูที่ https://example.com' },
    NOW,
  );
  assert.equal(bad.status, 'rejected');
  assert.ok(spamCheck({ ...base, waterLevel: 'knee', rain24Mm: 2 }, NOW).reasons.includes('implausibleDepth'));
  assert.equal(spamCheck({ ...base, approvedCount: 5 }, NOW).score, -40);
});

test('report form validation', () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  const area = {
    kind: 'area',
    lng: String(ORIGIN[0]),
    lat: String(ORIGIN[1]),
    radius_m: '120',
    water_level: 'knee',
    status_tags: 'rising,raining',
    passability: JSON.stringify({ motorcycle: 'blocked', car: 'hard' }),
    note: '  น้ำขึ้นเร็ว  ',
  };
  const ok = parseReportForm(form(area));
  assert.ok(ok.ok);
  assert.equal(ok.ok && ok.input.note, 'น้ำขึ้นเร็ว');
  assert.equal(ok.ok && ok.input.poster, null);

  assert.equal(parseReportForm(form({ ...area, radius_m: '301' })).ok, false);
  assert.equal(parseReportForm(form({ ...area, water_level: 'ocean' })).ok, false);
  assert.equal(parseReportForm(form({ ...area, status_tags: 'rising,flying' })).ok, false);
  assert.equal(parseReportForm(form({ ...area, passability: '{"boat":"ok"}' })).ok, false);
  assert.equal(parseReportForm(form({ ...area, passability: '{"car":"unknown"}' })).ok, false);
  const far = destination(ORIGIN, 6000, 0);
  assert.equal(parseReportForm(form({ ...area, lng: String(far[0]), lat: String(far[1]) })).ok, false);

  const road = parseReportForm(form({ ...area, kind: 'road', segment_ids: '5,6,6' }));
  assert.deepEqual(road.ok && road.input.segmentIds, [5, 6]);
  assert.equal(parseReportForm(form({ ...area, kind: 'road', segment_ids: '' })).ok, false);
});

test('road picker chain: extend at either end, remove ends, restart elsewhere', () => {
  const seg = (id: number, source: number, target: number): ChainSegment => ({ id, source, target, lengthM: 50, coords: [] });
  const a = seg(1, 10, 11);
  const b = seg(2, 11, 12);
  const c = seg(3, 9, 10);
  const far = seg(4, 50, 51);
  let chain = toggleSegment([], a);
  chain = toggleSegment(chain, b); // tail
  chain = toggleSegment(chain, c); // head
  assert.deepEqual(chain.map((s) => s.id), [3, 1, 2]);
  assert.equal(chainLengthM(chain), 150);
  assert.deepEqual(toggleSegment(chain, a).map((s) => s.id), [3, 1, 2]); // interior: unchanged
  assert.deepEqual(toggleSegment(chain, b).map((s) => s.id), [3, 1]); // remove tail
  assert.deepEqual(toggleSegment(chain, far).map((s) => s.id), [4]); // new chain
});
