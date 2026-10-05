// Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAP, SCORE } from '../config';
import { buildingCode, searchBuildings, type Building } from './buildings';
import { buildClusters, groupReports, isFlooded, lowFactor, scoreCluster } from './cluster';
import { destination, distanceM, insidePolygon, type LngLat } from './geo';
import { expiresAt, isActive, postScore, postWeight, voteMultiplier } from './post';
import { rainScore, summarizeRain } from './rain';
import { insideArea, parseReportForm } from './report-input';
import { watchCircles } from './watch';
import { dayAlerts, forecastDays, weatherInfo, type DayInput } from './weather';
import { blockedAhead, buildSteps, googleMapsUrl, incidentsAlong, insertVia, keepFaster, nearestIndex, parseRouteQuery, pickRoutes, routeEnds, summarize, type PathSegment } from './route';
import { chainLengthM, toggleSegment, type ChainSegment } from './road-chain';
import { segmentStatuses } from './segments';
import { spamCheck } from './spam';
import { parseIncidents, tileRange } from './traffic';
import { classesOn, nextClass, validateEntry, whenLabel, type ClassEntry } from './timetable';
import type { Report } from './types';
import { EMPTY_USER_DATA, isSaved, newer, readUserData, toggleSaved } from './user-data';

const NOW = new Date('2026-09-27T07:00:00Z'); // 14:00 in Bangkok
const HOUR = 3_600_000;
const ORIGIN: LngLat = [102.8173, 16.4617];

const report = (over: Partial<Report> & { id: number }): Report => ({
  kind: 'area',
  category: 'flood',
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
  assert.equal(parseReportForm(form({ ...area, water_level: 'toString' })).ok, false); // inherited keys don't count
  assert.equal(parseReportForm(form({ ...area, status_tags: 'constructor' })).ok, false);
  assert.equal(parseReportForm(form({ ...area, status_tags: 'rising,flying' })).ok, false);
  assert.equal(parseReportForm(form({ ...area, passability: '{"boat":"ok"}' })).ok, false);
  assert.equal(parseReportForm(form({ ...area, passability: '{"car":"unknown"}' })).ok, false);
  const far = destination(ORIGIN, 6000, 0);
  assert.equal(parseReportForm(form({ ...area, lng: String(far[0]), lat: String(far[1]) })).ok, false);

  // Incident posts: no water level; closures block every vehicle, other incidents leave road status alone.
  const { water_level: _w, status_tags: _t, passability: _p, ...place } = area;
  const accident = parseReportForm(form({ ...place, category: 'accident', water_level: 'waist', passability: '{"car":"blocked"}' }));
  assert.ok(accident.ok);
  assert.deepEqual(accident.ok && [accident.input.category, accident.input.waterLevel, accident.input.statusTags, accident.input.passability], ['accident', null, [], {}]);
  const closure = parseReportForm(form({ ...place, category: 'closure' }));
  assert.deepEqual(closure.ok && closure.input.passability, { motorcycle: 'blocked', car: 'blocked', pickup: 'blocked', walk: 'blocked' });
  assert.equal(parseReportForm(form({ ...place, category: 'meteor' })).ok, false);
  assert.equal(parseReportForm(form({ ...place, category: 'flood' })).ok, false); // floods still need a water level

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

// ---- Navigation -----------------------------------------------------------------

const seg = (id: number, name: string | null, from: LngLat, to: LngLat, over: Partial<PathSegment> = {}): PathSegment => ({
  id,
  name,
  lengthM: distanceM(from, to),
  speedKmh: 36, // 10 m/s
  status: 'unknown',
  risky: false,
  coords: [from, to],
  ...over,
});

test('route query validation', () => {
  const q = (s: string) => parseRouteQuery(new URLSearchParams(s));
  const ok = q('from=102.81,16.46&to=102.82,16.47&vehicle=car');
  assert.ok(ok.ok && ok.query.avoid === 'blocked' && ok.query.via.length === 0);
  assert.equal(q('from=102.81,16.46&to=102.82,16.47&vehicle=boat').ok, false);
  assert.equal(q('from=102.81,16.46&vehicle=car').ok, false);
  assert.equal(q('from=102.81,16.46&to=102.82,16.47&vehicle=car&avoid=all').ok, false);
  const via = q('from=102.81,16.46&to=102.82,16.47&vehicle=walk&via=102.815,16.465;102.816,16.466');
  assert.deepEqual(via.ok && via.query.via, [[102.815, 16.465], [102.816, 16.466]]);
  assert.equal(q('from=102.81,16.46&to=102.82,16.47&vehicle=car&via=103.5,16.46').ok, false); // via outside
});

test('route ends: a destination outside the area hands off at the edge', () => {
  const far = destination(MAP.center, 0, -20_000);
  const ends = routeEnds(ORIGIN, far)!;
  assert.deepEqual(ends.handoff, far);
  assert.ok(insideArea(ends.end));
  close(distanceM(ends.end, MAP.center), MAP.radiusKm * 1000 - 150, 1);
  assert.equal(routeEnds(far, destination(MAP.center, 0, 20_000)), null);
  assert.equal(routeEnds(ORIGIN, ORIGIN)!.handoff, null);
});

test('turn list: name changes and sharp turns on unnamed roads', () => {
  const a = ORIGIN;
  const b = destination(a, 50, 0);
  const c = destination(a, 100, 0);
  const d = destination(c, 0, 80); // heading east, then north = left
  const e = destination(d, 60, 0); // then east = right, same (null) name
  const steps = buildSteps([seg(1, 'ถนนเอ', a, b), seg(2, 'ถนนเอ', b, c), seg(3, null, c, d), seg(4, null, d, e)]);
  assert.deepEqual(
    steps.map((s) => s.text),
    ['ออกเดินทางตามถนนเอ', 'เลี้ยวซ้ายเข้าถนนไม่มีชื่อ', 'เลี้ยวขวาเข้าถนนไม่มีชื่อ', 'ถึงปลายทาง'],
  );
  assert.deepEqual(steps.map((s) => s.distanceM), [100, 80, 60, 0]);
  assert.deepEqual(steps.map((s) => s.index), [0, 2, 3, 4]);

  // A 15 m unnamed jog gets no step; an unnamed straight piece joins the road around it.
  const f = destination(ORIGIN, 0, 300);
  const g = destination(f, 15, 0);
  const h = destination(g, 0, 200); // north again
  const i = destination(h, 0, 100);
  const j = destination(i, 0, 100);
  const k = destination(j, -100, 0); // west = left
  const jog = buildSteps([seg(1, 'ถนนเอ', ORIGIN, f), seg(2, null, f, g), seg(3, '105', g, h), seg(4, null, h, i), seg(5, '105', i, j), seg(6, 'ซอยบี', j, k)]);
  assert.deepEqual(
    jog.map((s) => [s.text, s.distanceM]),
    [['ออกเดินทางตามถนนเอ', 315], ['ตรงไปตามถนนหมายเลข 105', 400], ['เลี้ยวซ้ายเข้าซอยบี', 100], ['ถึงปลายทาง', 0]],
  );
});

test('route summary: time per vehicle, flood exposure and spots', () => {
  const a = ORIGIN;
  const b = destination(a, 100, 0);
  const c = destination(a, 200, 0);
  const d = destination(a, 300, 0);
  const path = [seg(1, 'x', a, b, { status: 'hard' }), seg(2, 'x', b, c, { status: 'hard', risky: true }), seg(3, 'y', c, d, { status: 'blocked' })];
  const r = summarize(path, 'car');
  assert.equal(r.distanceM, 300);
  assert.equal(r.durationS, 30);
  assert.deepEqual([r.hard, r.blocked, r.risky], [2, 1, 1]);
  assert.deepEqual(r.spots.map((s) => [s.status, s.name]), [['hard', 'x'], ['blocked', 'y']]);
  assert.equal(r.coords.length, 4);
  assert.deepEqual(r.segments.map((s) => [s.start, s.end]), [[0, 1], [1, 2], [2, 3]]);
  assert.equal(summarize(path, 'walk').durationS, Math.round(300 / (5 / 3.6)));
});

test('route cards: safest, balanced if faster, shortest if faster, else merged', () => {
  const line = (id: number, meters: number) => [seg(id, null, ORIGIN, destination(ORIGIN, meters, 0))];
  const kinds = (rs: ReturnType<typeof pickRoutes>) => rs.map((r) => r.kinds.join('+'));
  assert.deepEqual(kinds(pickRoutes([line(1, 6000), line(2, 5000), line(3, 5900)], line(4, 4000), 'car')), [
    'safest',
    'balanced',
    'shortest',
  ]);
  assert.deepEqual(kinds(pickRoutes([line(1, 6000), line(2, 5900)], line(4, 5800), 'car')), ['safest+shortest']);
  assert.deepEqual(kinds(pickRoutes([], line(4, 4000), 'car')), ['shortest']);
  assert.deepEqual(pickRoutes([], null, 'car'), []);

  // Traffic: a jammed safest path makes room for an "avoid traffic" card; times count the jam.
  const jammed = [seg(1, null, ORIGIN, destination(ORIGIN, 3000, 0), { trafficLevel: 0.25 })];
  const around = line(5, 4000);
  const rs = pickRoutes([jammed], null, 'car', around);
  assert.deepEqual(kinds(rs), ['safest', 'traffic']);
  assert.ok(rs[0].durationS > rs[1].durationS);
  assert.deepEqual(kinds(pickRoutes([line(1, 3000)], null, 'car', around)), ['safest']); // no jam, no card
  assert.equal(pickRoutes([jammed], null, 'walk')[0].durationS, Math.round(3000 / (5 / 3.6))); // walkers ignore traffic

  // Live times can undo a card: TomTom says the "avoid traffic" path is slower after all.
  const timed = (durationS: number, kind: 'safest' | 'traffic' | 'shortest') => ({ ...rs[0], kinds: [kind], durationS });
  assert.deepEqual(kinds(keepFaster([timed(800, 'safest'), timed(820, 'traffic'), timed(600, 'shortest')])), ['safest', 'shortest']);
  assert.deepEqual(kinds(keepFaster([timed(800, 'safest'), timed(700, 'traffic')])), ['safest', 'traffic']);
});

test('Google Maps link follows the route through waypoints', () => {
  const coords = [ORIGIN, destination(ORIGIN, 1000, 0), destination(ORIGIN, 1000, 1000)];
  const url = new URL(googleMapsUrl(coords, coords[2], 'walk'));
  assert.equal(url.searchParams.get('travelmode'), 'walking');
  assert.equal(url.searchParams.get('waypoints')!.split('|').length, 3);
  assert.equal(url.searchParams.get('origin'), null);
  const beyond = destination(ORIGIN, 1000, 9000);
  const handoff = new URL(googleMapsUrl(coords, beyond, 'car', ORIGIN));
  const wps = handoff.searchParams.get('waypoints')!.split('|');
  assert.equal(wps.length, 3);
  assert.equal(wps[2], `${coords[2][1].toFixed(6)},${coords[2][0].toFixed(6)}`); // the edge point
  assert.ok(handoff.searchParams.get('origin'));
  assert.equal(new URL(googleMapsUrl([], beyond, 'car')).searchParams.get('waypoints'), null); // no route yet
});

test('progress and newly blocked roads ahead', () => {
  const pts = [0, 100, 200, 300].map((m) => destination(ORIGIN, m, 0));
  const route = { kinds: ['safest'], ...summarize([seg(1, null, pts[0], pts[1]), seg(2, null, pts[1], pts[2]), seg(3, null, pts[2], pts[3])], 'car') } as const;
  const here = nearestIndex(route.coords, destination(ORIGIN, 110, 12));
  assert.equal(here.index, 1);
  assert.ok(here.distanceM < 20);
  assert.equal(blockedAhead({ ...route, kinds: ['safest'] }, 1, new Map([[1, 'blocked']])), false); // behind us
  assert.equal(blockedAhead({ ...route, kinds: ['safest'] }, 1, new Map([[3, 'blocked']])), true);

  const v1 = destination(ORIGIN, 250, 50);
  const v2 = destination(ORIGIN, 60, -40);
  assert.deepEqual(insertVia([v1], route.coords, v2, 1), [v2, v1]); // grabbed before v1 on the route
});

test('watch circles: rain × low-lying factor of each spot, not inside reported circles', () => {
  const [t1, t2] = SCORE.elevationTercilesM;
  const spot = (id: string, elevationM: number, center = ORIGIN) => ({ id, name: null, center, radiusM: 400, elevationM });
  const spots = [spot('high', t2 + 5, destination(ORIGIN, 3000, 0)), spot('low', t1 - 5), spot('mid', (t1 + t2) / 2, destination(ORIGIN, 0, 3000))];
  assert.deepEqual(watchCircles(spots, 0), []); // dry: nothing
  const heavy = watchCircles(spots, 0.5); // low 65%, mid 50%, high 30%
  assert.deepEqual(heavy.map((w) => [w.id, w.pct]), [['low', 65], ['mid', 50], ['high', 30]]);
  assert.deepEqual(watchCircles(spots, 0.25).map((w) => w.id), ['low']); // 33% / 25% / 15%
  assert.deepEqual(watchCircles(spots, 0.5, [{ center: ORIGIN, radiusM: 500 }]).map((w) => w.id), ['mid', 'high']);
});

test('weather: labels, alerts and per-day rain scores for watch circles', () => {
  assert.equal(weatherInfo(95).kind, 'storm');
  assert.equal(weatherInfo(2).label, 'มีเมฆบางส่วน');
  assert.deepEqual(dayAlerts({ code: 3, rainMm: 5, gustMax: 20, tMax: 33 }), []);
  assert.deepEqual(
    dayAlerts({ code: 99, rainMm: 95, gustMax: 80, tMax: 41 }).map((a) => [a.kind, a.severe]),
    [['rain', true], ['storm', true], ['wind', true], ['heat', false]],
  );

  const hours = (mm: number[]) => mm.map((rainMm, h) => ({ time: `x${h}`, temp: 30, rainProb: 50, rainMm, code: 61, isDay: true, windKmh: 5, gustKmh: 10 }));
  const day = (date: string, rainMm: number, hourly = hours([rainMm])): DayInput => ({
    date, code: 61, tMin: 24, tMax: 31, rainMm, rainProb: 80, windMax: 10, gustMax: 20, uvMax: 8, sunrise: '', sunset: '', hours: hourly,
  });
  const days = [day('d1', 12), day('d2', 15), day('d3', 50, hours([0, 20, 20, 5, 5, 0])), day('d4', 0)];
  const [d3, d4] = forecastDays(days, 'd3');
  close(d3.rainScore, 0.5 * (45 / 50) + 0.3 * (50 / 90) + 0.2 * (2 / 5)); // wettest 3 h = 45 mm, 2 wet days before
  assert.equal(d3.alerts[0].kind, 'rain');
  close(d4.rainScore, 0.2 * (3 / 5)); // dry day after 3 wet days
});

test('traffic incidents: Thai label, start point, place and delay', () => {
  const [line, point] = parseIncidents({
    incidents: [
      {
        geometry: { type: 'LineString', coordinates: [[102.8, 16.4], [102.81, 16.41]] },
        properties: { id: 'a', iconCategory: 8, events: [{ description: 'ปิด' }, { description: 'ปิด' }], from: 'A', to: 'B', delay: 300 },
      },
      { geometry: { type: 'Point', coordinates: [102.82, 16.42] }, properties: { id: 'b', iconCategory: 13, roadNumbers: ['2'] } },
    ],
  });
  assert.deepEqual(line, { id: 'a', category: 8, label: 'ปิดถนน', text: 'ปิด', road: 'A → B', delayS: 300, at: [102.8, 16.4] });
  assert.deepEqual(point, { id: 'b', category: 13, label: 'เหตุบนถนน', text: 'เหตุบนถนน', road: '2', delayS: null, at: [102.82, 16.42] });
  assert.deepEqual(parseIncidents({}), []);
});

test('incident posts expire sooner; route warnings list incidents near the route in order', () => {
  const created = new Date('2026-09-27T03:00:00Z');
  assert.equal(expiresAt(created, null, 'accident').toISOString(), '2026-09-27T05:00:00.000Z');
  assert.equal(expiresAt(created, null, 'flood').toISOString(), '2026-09-27T09:00:00.000Z');
  const soon = new Date('2026-09-27T04:00:00Z');
  const votes = (still: number, receded: number) => ({ createdAt: created, lastStillVoteAt: null, votes: { still, receded } });
  assert.equal(isActive({ ...votes(0, 1), category: 'accident' }, soon), true); // one "cleared" vs the poster
  assert.equal(isActive({ ...votes(0, 2), category: 'accident' }, soon), false);
  assert.equal(isActive({ ...votes(1, 2), category: 'closure' }, soon), true);
  assert.equal(isActive({ ...votes(0, 5), category: 'flood' }, soon), true); // floods fade by weight instead

  const line: LngLat[] = [ORIGIN, destination(ORIGIN, 1000, 0)];
  const near = (east: number, north: number, label: string) => ({ label, at: destination(ORIGIN, east, north) });
  assert.deepEqual(
    incidentsAlong(line, [near(800, 20, 'b'), near(500, 200, 'far'), near(100, -30, 'a')]).map((i) => i.label),
    ['a', 'b'],
  );
});

test('building codes and search: Thai, English, codes with or without zeros', () => {
  assert.equal(buildingCode('อาคารเรียนรวมและปฏิบัติการ SC. 09'), 'SC09');
  assert.equal(buildingCode('HS.2'), 'HS02');
  assert.equal(buildingCode('หอพักนักศึกษาที่ 26'), null);

  const b = (id: string, name: string, code: string | null = null, kind: Building['kind'] = 'building'): Building => ({
    id, name, nameEn: null, code, kind, levels: null, center: ORIGIN, polygon: null,
  });
  const list = [
    b('a', 'อาคารเรียนรวมและปฏิบัติการ SC. 09', 'SC09'),
    b('b', 'SC. 03', 'SC03'),
    b('c', 'คณะวิศวกรรมศาสตร์', null, 'faculty'),
    b('d', 'หอพักนักศึกษาที่ 9', null, 'dorm'),
  ];
  assert.deepEqual(searchBuildings(list, 'sc9').map((x) => x.id), ['a']);
  assert.deepEqual(searchBuildings(list, 'ตึก SC 09').map((x) => x.id), ['a']); // "ตึก" is ignored
  assert.deepEqual(searchBuildings(list, 'คณะวิศวะ').map((x) => x.id), ['c']);
  assert.deepEqual(searchBuildings(list, 'sc').map((x) => x.id).sort(), ['a', 'b']);
  assert.deepEqual(searchBuildings(list, 'ไม่มีตึกนี้'), []);
  assert.deepEqual(searchBuildings(list, '  '), []);
});

test('saved places and device/account copies', () => {
  const sq: LngLat[] = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  assert.equal(insidePolygon([0.5, 0.5], sq), true);
  assert.equal(insidePolygon([1.5, 0.5], sq), false);

  const p = { id: 'w1', name: 'SC09', center: ORIGIN };
  const saved = toggleSaved([], p);
  assert.equal(isSaved(saved, { ...p, name: 'renamed' }), true); // same building id
  assert.deepEqual(toggleSaved(saved, p), []);
  const pin = { id: null, name: 'จุดนัด', center: ORIGIN };
  assert.equal(isSaved(toggleSaved([], pin), { ...pin }), true);

  assert.deepEqual(readUserData('junk'), EMPTY_USER_DATA);
  assert.deepEqual(readUserData({ saved: [p], classes: 'x', updatedAt: 5 }), { saved: [p], classes: [], updatedAt: 5 });
  const a = { ...EMPTY_USER_DATA, updatedAt: 10 };
  const c = { ...EMPTY_USER_DATA, saved: [p], updatedAt: 20 };
  assert.equal(newer(a, c), c);
  assert.equal(newer(c, a), c);
});

test('timetable: validation, the day list and the next class (Bangkok time)', () => {
  const place = { id: 'w1', name: 'SC09', center: ORIGIN };
  const base = { course: ' sc313002 ', title: '  ', day: 1, start: '09:00', end: '12:00', place, room: ' 1102 ' };
  const ok = validateEntry(base);
  assert.ok(ok.ok);
  assert.deepEqual(ok.ok && [ok.entry.course, ok.entry.title, ok.entry.room], ['SC313002', null, '1102']);
  assert.equal(validateEntry({ ...base, end: '08:00' }).ok, false);
  assert.equal(validateEntry({ ...base, start: '9:00' }).ok, false);
  assert.equal(validateEntry({ ...base, day: 7 }).ok, false);
  assert.equal(validateEntry({ ...base, course: '' }).ok, false);

  const c = (id: string, day: number, start: string, end: string): ClassEntry => ({ ...base, id, course: id, title: null, room: null, day, start, end });
  const week = [c('mon-pm', 1, '13:00', '16:00'), c('mon-am', 1, '09:00', '12:00'), c('wed', 3, '08:00', '10:00')];
  assert.deepEqual(classesOn(week, 1).map((x) => x.id), ['mon-am', 'mon-pm']);

  const monday = (hhmm: string) => new Date(`2026-10-05T${hhmm}:00+07:00`); // 5 Oct 2026 is a Monday
  assert.deepEqual(nextClass(week, monday('08:30')), { entry: week[1], inMinutes: 30 });
  assert.deepEqual(nextClass(week, monday('10:00')), { entry: week[1], inMinutes: -60 }); // in class
  assert.deepEqual(nextClass(week, monday('16:30')), { entry: week[2], inMinutes: 2 * 1440 + 480 - 990 });
  assert.equal(nextClass([], monday('10:00')), null);

  assert.equal(whenLabel(30, 1, 1), 'อีก 30 นาที');
  assert.equal(whenLabel(125, 1, 1), 'อีก 2 ชม. 5 นาที');
  assert.equal(whenLabel(120, 1, 1), 'อีก 2 ชม.');
  assert.equal(whenLabel(-5, 1, 1), 'กำลังเรียน');
  assert.equal(whenLabel(900, 2, 1), 'พรุ่งนี้');
  assert.equal(whenLabel(3000, 3, 1), 'วันพุธ');
});

test('flow tiles covering the area', () => {
  // z14 tiles over a 1 km box around the campus: a few tiles, all within the box's corners.
  const tiles = tileRange([102.81, 16.45, 102.82, 16.46], 14);
  assert.ok(tiles.length >= 1 && tiles.length <= 4);
  assert.deepEqual(tileRange([102.8173, 16.4617, 102.8173, 16.4617], 14), [[12871, 7432]]);
});
