'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { UserMenu } from '@/components/auth/UserMenu';
import type { Selection } from '@/components/map/FloodMap';
import { buildingHighlight, placeHighlight } from '@/components/map/place-layer';
import { Segmented } from '@/components/ui/Segmented';
import type { Viewer } from '@/lib/auth';
import { DEFAULT_VEHICLE, VEHICLES, type Vehicle } from '@/lib/config';
import { navigateHref, type Building } from '@/lib/domain/buildings';
import { insidePolygon } from '@/lib/domain/geo';
import { bangkokClock, classesOn } from '@/lib/domain/timetable';
import { useBuildings } from '@/lib/hooks/useBuildings';
import { useMapData } from '@/lib/hooks/useMapData';
import { useNow } from '@/lib/hooks/useNow';
import { useUserData } from '@/lib/hooks/useUserData';
import { ActionBar } from './ActionBar';
import { BuildingDetail } from './BuildingDetail';
import { BuildingSearch } from './BuildingSearch';
import { Panel } from '@/components/ui/Panel';
import { PanelHeader } from './PanelHeader';
import { IncidentList } from './IncidentList';
import { RainCard } from './RainCard';
import { ReportDetail } from './ReportDetail';
import { RoadLegend } from './RoadLegend';
import { SavedPlaces } from './SavedPlaces';
import { TodayClasses } from './TodayClasses';
import { ZoneDetail } from './ZoneDetail';
import { WatchDetail } from './WatchDetail';
import { WatchList } from './WatchList';
import { ZoneList } from './ZoneList';

const FloodMap = dynamic(() => import('@/components/map/FloodMap'), { ssr: false });
const VEHICLE_TABS = VEHICLES.map((v) => ({ id: v.id, label: v.short }));

export function HomeView({ viewer, warning }: { viewer: Viewer | null; warning: string | null }) {
  const { zones, reports, segments, error } = useMapData();
  const buildings = useBuildings();
  const { saved, classes } = useUserData();
  const now = useNow();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle>(DEFAULT_VEHICLE);
  const [selection, setSelection] = useState<Selection>(null);
  const [expanded, setExpanded] = useState(false);

  const clusters = zones?.clusters ?? [];
  const watch = zones?.watch ?? [];
  const pins = reports?.reports ?? [];
  const cluster = selection?.type === 'cluster' ? clusters.find((c) => c.id === selection.id) : undefined;
  const report = selection?.type === 'report' ? pins.find((r) => r.id === selection.id) : undefined;
  const watchSpot = selection?.type === 'watch' ? watch.find((w) => w.id === selection.id) : undefined;
  const building = selection?.type === 'building' ? buildings.find((b) => b.id === selection.id) : undefined;
  const today = useMemo(() => classesOn(classes, bangkokClock(now).day), [classes, now]);
  // The selected building, or else today's classes numbered in order.
  const highlights = useMemo(
    () => (building ? [buildingHighlight(building)] : today.flatMap((c, i) => (c.place ? [placeHighlight(c.place, buildings, String(i + 1), c.id)] : []))),
    [building, today, buildings],
  );
  const close = () => setSelection(null);
  const pick = (b: Building) => setSelection({ type: 'building', id: b.id });

  return (
    <main className="relative h-dvh overflow-hidden">
      <FloodMap
        clusters={clusters}
        watch={watch}
        reports={pins}
        segments={segments}
        vehicle={vehicle}
        highlights={highlights}
        selection={selection}
        onSelect={setSelection}
        onMapClick={(p) => {
          // A tap on a named building selects it; anywhere else clears the selection.
          const hit = buildings.find((b) => b.polygon && insidePolygon(p, b.polygon));
          setSelection(hit ? { type: 'building', id: hit.id } : null);
        }}
      />
      <Panel expanded={expanded} onToggle={() => setExpanded((e) => !e)} scrollKey={selection} footer={<ActionBar />}>
        <PanelHeader updatedAt={zones?.updatedAt} demo={zones?.demo} actions={<UserMenu viewer={viewer} />} />

        <BuildingSearch buildings={buildings} onPick={pick} />
        {building && <BuildingDetail building={building} onClose={close} />}
        {cluster && <ZoneDetail cluster={cluster} rain={zones?.rain ?? null} onClose={close} />}
        {report && <ReportDetail report={report} onClose={close} />}
        {watchSpot && <WatchDetail watch={watchSpot} rain={zones?.rain ?? null} onClose={close} />}
        {!building && <TodayClasses classes={classes} today={today} now={now} />}
        <SavedPlaces
          saved={saved}
          onPick={(p) => {
            const b = p.id && buildings.find((x) => x.id === p.id);
            if (b) pick(b);
            else router.push(navigateHref(p)); // a point picked on the map: go there
          }}
        />

        <h2 className="-mb-1.5 px-1 pt-1 text-[13px] font-semibold text-secondary">น้ำท่วมและจราจร</h2>
        <div className="flex flex-col gap-2">
          <Segmented label="ประเภทรถ" options={VEHICLE_TABS} value={vehicle} onChange={setVehicle} />
          <RoadLegend />
        </div>

        {warning && (
          <Link href="/weather" className="flex items-center gap-2 rounded-xl bg-[#FFF1CC] px-3 py-2 text-[13px] font-semibold text-[#7A5200]">
            <span aria-hidden>⚠️</span>
            <span className="grow">{warning}</span>
            <span className="shrink-0 font-normal">ดูพยากรณ์ ›</span>
          </Link>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-[#FDECEA] px-3 py-2 text-[13px] text-danger">
            โหลดข้อมูลไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ
          </p>
        )}
        {zones ? (
          <>
            <RainCard rain={zones.rain} />
            <ZoneList
              clusters={clusters}
              selectedId={cluster?.id ?? null}
              onSelect={(id) => setSelection({ type: 'cluster', id })}
            />
            <WatchList watch={watch} selectedId={watchSpot?.id ?? null} onSelect={(id) => setSelection({ type: 'watch', id })} />
            <IncidentList reports={pins} selectedId={report?.id ?? null} onSelect={(id) => setSelection({ type: 'report', id })} />
            <Link href="/about" className="px-1 text-center text-[13px] text-secondary hover:text-link">
              วิธีคำนวณ แหล่งข้อมูล และข้อจำกัด
            </Link>
          </>
        ) : (
          <div aria-busy className="flex flex-col gap-3">
            <div className="h-36 animate-pulse rounded-2xl bg-fill" />
            <div className="h-44 animate-pulse rounded-2xl bg-fill" />
          </div>
        )}
      </Panel>
    </main>
  );
}
