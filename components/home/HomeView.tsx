'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import type { Selection } from '@/components/map/FloodMap';
import { SearchIcon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/Segmented';
import { DEFAULT_VEHICLE, VEHICLES, type Vehicle } from '@/lib/config';
import { useMapData } from '@/lib/hooks/useMapData';
import { ActionBar } from './ActionBar';
import { Panel } from './Panel';
import { PanelHeader } from './PanelHeader';
import { RainCard } from './RainCard';
import { ReportDetail } from './ReportDetail';
import { RoadLegend } from './RoadLegend';
import { ZoneDetail } from './ZoneDetail';
import { ZoneList } from './ZoneList';

const FloodMap = dynamic(() => import('@/components/map/FloodMap'), { ssr: false });
const VEHICLE_TABS = VEHICLES.map((v) => ({ id: v.id, label: v.short }));

export function HomeView() {
  const { zones, reports, segments, error } = useMapData();
  const [vehicle, setVehicle] = useState<Vehicle>(DEFAULT_VEHICLE);
  const [selection, setSelection] = useState<Selection>(null);
  const [expanded, setExpanded] = useState(false);

  const clusters = zones?.clusters ?? [];
  const pins = reports?.reports ?? [];
  const cluster = selection?.type === 'cluster' ? clusters.find((c) => c.id === selection.id) : undefined;
  const report = selection?.type === 'report' ? pins.find((r) => r.id === selection.id) : undefined;
  const close = () => setSelection(null);

  return (
    <main className="relative h-dvh overflow-hidden">
      <FloodMap
        clusters={clusters}
        reports={pins}
        segments={segments}
        vehicle={vehicle}
        selection={selection}
        onSelect={setSelection}
      />
      <Panel expanded={expanded} onToggle={() => setExpanded((e) => !e)} scrollKey={selection} footer={<ActionBar />}>
        <PanelHeader updatedAt={zones?.updatedAt} demo={zones?.demo} />

        <Link
          href="/navigate"
          className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-fill px-3 text-[15px] text-secondary transition-colors hover:bg-fill-strong"
        >
          <SearchIcon size={16} />
          ค้นหาปลายทางเพื่อนำทางหลบน้ำ
        </Link>

        <div className="flex flex-col gap-2">
          <Segmented label="ประเภทรถ" options={VEHICLE_TABS} value={vehicle} onChange={setVehicle} />
          <RoadLegend />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-[#FDECEA] px-3 py-2 text-[13px] text-danger">
            โหลดข้อมูลไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ
          </p>
        )}
        {cluster && <ZoneDetail cluster={cluster} rain={zones?.rain ?? null} onClose={close} />}
        {report && <ReportDetail report={report} onClose={close} />}

        {zones ? (
          <>
            <RainCard rain={zones.rain} />
            <ZoneList
              clusters={clusters}
              selectedId={cluster?.id ?? null}
              onSelect={(id) => setSelection({ type: 'cluster', id })}
            />
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
