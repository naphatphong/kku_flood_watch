'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Panel } from '@/components/ui/Panel';
import { PillButton } from '@/components/ui/Pill';
import { Segmented } from '@/components/ui/Segmented';
import { ChevronIcon, PinIcon } from '@/components/ui/icons';
import { DEFAULT_VEHICLE, VEHICLES, type RoadStatus, type Vehicle } from '@/lib/config';
import type { RouteResponse } from '@/lib/data/route';
import { lineLengthM, type LngLat } from '@/lib/domain/geo';
import { blockedAhead, googleMapsUrl, nearestIndex, type Avoid } from '@/lib/domain/route';
import { useMapData } from '@/lib/hooks/useMapData';
import { NextStep } from './NextStep';
import { PlaceField, type Endpoint } from './PlaceField';
import { RouteCards } from './RouteCards';
import { StepList } from './StepList';

const NavigateMap = dynamic(() => import('./NavigateMap'), { ssr: false });
const VEHICLE_TABS = VEHICLES.map((v) => ({ id: v.id, label: v.short }));
const MAP_POINT = 'ตำแหน่งที่เลือกบนแผนที่';

function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger'; children: ReactNode }) {
  const styles = { info: 'bg-accent/10 text-[#004C99]', warn: 'bg-[#FFF1CC] text-[#7A5200]', danger: 'bg-[#FDECEA] text-[#8A0010]' };
  return <p className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${styles[tone]}`}>{children}</p>;
}

/** /navigate (PLAN §6): choose the ends, get flood-aware routes, follow one or hand off to Google Maps. */
export function NavigateView({ demo }: { demo: boolean }) {
  const { zones, segments } = useMapData();
  const [from, setFrom] = useState<Endpoint | null>({ kind: 'gps' });
  const [to, setTo] = useState<Endpoint | null>(null);
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [vias, setVias] = useState<LngLat[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle>(DEFAULT_VEHICLE);
  const [avoid, setAvoid] = useState<Avoid>('blocked');
  const [gps, setGps] = useState<LngLat | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const [result, setResult] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const [rerouteAsk, setRerouteAsk] = useState(false);
  const [reload, setReload] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  const gpsRef = useRef(gps);
  gpsRef.current = gps;
  const origin = from?.kind === 'gps' ? gps : (from?.position ?? null);
  const target = to?.kind === 'place' ? to.position : null;
  const routes = result?.routes ?? [];
  const route = routes[selected];

  // `/navigate?to=lng,lat&name=…` (building pages, saved places, the timetable) sets the destination.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const [lng, lat] = (q.get('to') ?? '').split(',').map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat) && q.get('to'))
      setTo({ kind: 'place', label: q.get('name') || 'ปลายทาง', position: [lng, lat] });
  }, []);

  // "My location" as origin: one fix up front; the map's locate button keeps it fresh.
  const needFix = from?.kind === 'gps' && !gps && !!to;
  useEffect(() => {
    if (!needFix) return;
    if (!navigator.geolocation) return setGpsError(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps([p.coords.longitude, p.coords.latitude]);
        setGpsError(false);
      },
      () => setGpsError(true),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }, [needFix]);

  // A new trip drops the old routes and via points, and folds the fields away (mobile).
  useEffect(() => {
    setResult(null);
    setError(null);
    setVias([]);
    setEditing(false);
  }, [from, to]);

  // Fetch routes when the trip or options change (not on every GPS fix).
  const hasOrigin = from?.kind === 'gps' ? gps !== null : !!from;
  useEffect(() => {
    if (demo || !target || !hasOrigin || !from) return;
    const start = from.kind === 'gps' ? gpsRef.current! : from.position;
    const qs = new URLSearchParams({ from: start.join(','), to: target.join(','), vehicle, avoid });
    if (vias.length) qs.set('via', vias.map((v) => v.join(',')).join(';'));
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/route?${qs}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'หาเส้นทางไม่สำเร็จ');
        setResult(body);
        setSelected(0);
        setRerouteAsk(false);
      })
      .catch((e) => e.name !== 'AbortError' && setError(e.message))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [demo, from, target, hasOrigin, vias, vehicle, avoid, reload]);

  // Progress along the selected route while navigating.
  const progress = navigating && route && gps ? nearestIndex(route.coords, gps).index : 0;
  const nav = useMemo(() => {
    if (!route) return null;
    const next = route.steps.find((s) => s.index > progress) ?? route.steps[route.steps.length - 1];
    const leftM = lineLengthM(route.coords.slice(progress));
    return {
      next,
      current: route.steps.findLastIndex((s) => s.index <= progress),
      inM: lineLengthM(route.coords.slice(progress, next.index + 1)),
      leftM,
      leftS: route.distanceM ? (route.durationS * leftM) / route.distanceM : 0,
    };
  }, [route, progress]);

  // Realtime: a road ahead just turned "blocked" → offer to reroute (PLAN §6).
  const watch = useRef({ route, progress, vehicle });
  watch.current = { route, progress, vehicle };
  useEffect(() => {
    const { route: r, progress: p, vehicle: v } = watch.current;
    if (!r || !segments) return;
    const status = new Map(segments.features.map((f) => [Number(f.properties?.id), f.properties?.[v] as RoadStatus]));
    if (blockedAhead(r, p, status)) setRerouteAsk(true);
  }, [segments]);

  const reroute = () => {
    setRerouteAsk(false);
    if (navigating && gps && from?.kind !== 'gps') setFrom({ kind: 'gps' });
    else setReload((n) => n + 1);
  };

  const onMapTap = (p: LngLat) => {
    const point: Endpoint = { kind: 'place', label: MAP_POINT, position: p };
    if (picking === 'from') setFrom(point);
    else if (picking === 'to' || !to) setTo(point);
    setPicking(null);
  };

  const mapsUrl =
    target &&
    googleMapsUrl(route?.coords ?? [], result?.handoff ?? target, vehicle, from?.kind === 'place' ? from.position : null);

  const compact = routes.length > 0 && !editing;
  const back = (
    <Link href="/" aria-label="กลับไปที่แผนที่" className="grid size-9 shrink-0 place-items-center rounded-full bg-fill hover:bg-fill-strong">
      <ChevronIcon size={16} className="rotate-180" />
    </Link>
  );

  const footer = navigating ? (
    <div className="flex gap-2.5">
      <PillButton variant="plain" className="flex-1" onClick={() => setNavigating(false)}>
        จบการนำทาง
      </PillButton>
      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noopener" className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-accent/12 text-[15px] font-semibold text-link">
          Google Maps
        </a>
      )}
    </div>
  ) : route ? (
    <div className="flex gap-2.5">
      <PillButton
        className="flex-1"
        onClick={() => {
          setNavigating(true);
          setExpanded(false);
        }}
      >
        เริ่มนำทาง
      </PillButton>
      <a
        href={mapsUrl!}
        target="_blank"
        rel="noopener"
        className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-accent/12 text-[15px] font-semibold text-link hover:bg-accent/18"
      >
        {result?.handoff ? 'ไปต่อใน Google Maps' : 'เปิดใน Google Maps'}
      </a>
    </div>
  ) : demo && mapsUrl ? (
    <a href={mapsUrl} target="_blank" rel="noopener" className="flex h-11 items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-white">
      นำทางด้วย Google Maps
    </a>
  ) : (
    <p className="py-2.5 text-center text-[13px] text-secondary">
      {picking ? 'แตะจุดบนแผนที่' : 'ค้นหาปลายทาง หรือแตะบนแผนที่'}
    </p>
  );

  return (
    <main data-navigating={navigating || undefined} className="relative h-dvh overflow-hidden">
      <NavigateMap
        clusters={zones?.clusters ?? []}
        watch={zones?.watch ?? []}
        segments={segments}
        vehicle={vehicle}
        routes={routes}
        selected={selected}
        origin={origin}
        target={target}
        vias={vias}
        tracking={navigating}
        onMapTap={onMapTap}
        onSelectRoute={setSelected}
        onViasChange={setVias}
        onPosition={setGps}
      />
      {navigating && nav && <NextStep step={nav.next} inM={nav.inM} leftM={nav.leftM} leftS={nav.leftS} />}

      <Panel expanded={expanded} onToggle={() => setExpanded((e) => !e)} scrollKey={result} footer={footer}>
        <header className={`items-center gap-2 ${compact ? 'hidden md:flex' : 'flex'}`}>
          {back}
          <h1 className="grow text-[19px] font-bold tracking-tight">นำทาง</h1>
        </header>
        {compact && (
          <div className="flex items-center gap-2 md:hidden">
            {back}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex h-10 min-w-0 grow items-center gap-2 rounded-xl bg-white/70 px-3 text-left text-[14px] ring-1 ring-separator"
            >
              <span className="truncate">{from?.kind === 'gps' ? 'ตำแหน่งของฉัน' : from?.label}</span>
              <ChevronIcon size={12} className="shrink-0 text-tertiary" />
              <span className="truncate font-semibold">{to?.kind === 'place' ? to.label : ''}</span>
            </button>
          </div>
        )}

        {rerouteAsk && (
          <div role="alert" className="flex items-center gap-2 rounded-2xl bg-[#FDECEA] p-3 text-[13px] text-[#8A0010]">
            <span className="grow">ถนนข้างหน้าเพิ่งมีรายงานว่าผ่านไม่ได้ คำนวณเส้นทางใหม่ไหม</span>
            <button type="button" onClick={reroute} className="shrink-0 rounded-full bg-danger px-3 py-1.5 font-semibold text-white">
              คำนวณใหม่
            </button>
            <button type="button" onClick={() => setRerouteAsk(false)} className="shrink-0 font-semibold">
              ไม่ต้อง
            </button>
          </div>
        )}

        <div className={`flex-col gap-2 ${compact ? 'hidden md:flex' : 'flex'}`}>
          <PlaceField
            value={from}
            onChange={setFrom}
            placeholder="ต้นทาง"
            marker={<span className="origin-dot scale-75" />}
            allowMyLocation
            onPickOnMap={() => setPicking('from')}
          />
          <PlaceField
            value={to}
            onChange={setTo}
            placeholder="ค้นหาปลายทาง"
            marker={<PinIcon size={17} className="text-[#FF3B30]" />}
            onPickOnMap={() => setPicking('to')}
          />
        </div>

        {!navigating && (
          <>
            <Segmented label="ประเภทรถ" options={VEHICLE_TABS} value={vehicle} onChange={setVehicle} />
            <button
              type="button"
              role="switch"
              aria-checked={avoid === 'hard'}
              onClick={() => setAvoid((a) => (a === 'hard' ? 'blocked' : 'hard'))}
              className="group flex shrink-0 items-center justify-between gap-3 px-1 text-left text-[14px]"
            >
              <span>
                เลี่ยงถนนที่ผ่านยากด้วย
                <span className="block text-[12px] text-secondary">ปกติเลี่ยงเฉพาะจุดที่ผ่านไม่ได้</span>
              </span>
              <span className="flex h-[26px] w-[44px] shrink-0 items-center rounded-full bg-fill-strong p-0.5 transition-colors group-aria-checked:bg-[#34C759]">
                <span className="size-[22px] rounded-full bg-white shadow transition-transform group-aria-checked:translate-x-[18px]" />
              </span>
            </button>
          </>
        )}
        {picking && <Notice>แตะบนแผนที่เพื่อเลือก{picking === 'from' ? 'ต้นทาง' : 'ปลายทาง'}</Notice>}
        {demo && (
          <Notice tone="warn">ระบบนำทางจะใช้ได้เมื่อเชื่อมฐานข้อมูลแล้ว ระหว่างนี้เลือกปลายทางแล้วเปิด Google Maps ได้</Notice>
        )}
        {gpsError && from?.kind === 'gps' && (
          <Notice tone="warn">หาตำแหน่งของคุณไม่ได้ เปิดสิทธิ์ตำแหน่ง (GPS) หรือเลือกต้นทางเอง</Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        {result?.handoff && <Notice>ปลายทางอยู่นอกพื้นที่ เส้นทางนี้พาไปถึงขอบพื้นที่ แล้วไปต่อด้วย Google Maps</Notice>}
        {result?.fromOutside && <Notice>ต้นทางอยู่นอกพื้นที่ เส้นทางเริ่มที่ขอบพื้นที่</Notice>}
        {result?.noSafeRoute && routes.length > 0 && (
          <Notice tone="danger">ไม่มีเส้นทางที่เลี่ยงจุดน้ำท่วมได้ เส้นทางที่เหลือผ่านจุดที่มีรายงานว่าผ่านไม่ได้</Notice>
        )}
        {result && !routes.length && !loading && <Notice tone="danger">ไม่พบเส้นทางระหว่างสองจุดนี้</Notice>}

        {vias.length > 0 && (
          <div className="flex items-center justify-between rounded-2xl bg-fill px-3.5 py-2 text-[13px]">
            <span>ปรับเส้นทางผ่าน {vias.length} จุด</span>
            <button type="button" onClick={() => setVias([])} className="font-semibold text-link">
              ล้างจุดแวะ
            </button>
          </div>
        )}

        {loading && !routes.length ? (
          <div aria-busy className="flex flex-col gap-2">
            <div className="h-20 animate-pulse rounded-2xl bg-fill" />
            <div className="h-20 animate-pulse rounded-2xl bg-fill" />
          </div>
        ) : (
          routes.length > 0 && (
            <div className={`flex flex-col gap-3 transition-opacity ${loading ? 'opacity-50' : ''}`}>
              {!navigating && (
                <>
                  <RouteCards routes={routes} selected={selected} onSelect={setSelected} />
                  <p className="text-[12px] text-secondary">ลากเส้นทางสีน้ำเงินบนแผนที่เพื่อปรับเส้นทางผ่านจุดที่ต้องการ</p>
                </>
              )}
              {route && <StepList steps={route.steps} current={navigating ? (nav?.current ?? 0) : null} />}
            </div>
          )
        )}
      </Panel>
    </main>
  );
}
