'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { placeHighlight } from '@/components/map/place-layer';
import { ChevronIcon, PlusIcon } from '@/components/ui/icons';
import { Panel } from '@/components/ui/Panel';
import { PillButton } from '@/components/ui/Pill';
import { Segmented } from '@/components/ui/Segmented';
import { placeRef, type PlaceRef } from '@/lib/domain/user-data';
import { insidePolygon, type LngLat } from '@/lib/domain/geo';
import { bangkokClock, classesOn, DAY_NAMES, DAY_SHORT, WEEK, type EntryInput } from '@/lib/domain/timetable';
import { useBuildings } from '@/lib/hooks/useBuildings';
import { useNow } from '@/lib/hooks/useNow';
import { updateUserData, useUserData } from '@/lib/hooks/useUserData';
import { ClassForm } from './ClassForm';
import { ClassRow } from './ClassRow';
import { NextClass } from './NextClass';

const CampusMap = dynamic(() => import('@/components/map/CampusMap'), { ssr: false });
const DAY_TABS = WEEK.map((d) => ({ id: String(d), label: DAY_SHORT[d] }));

/** /timetable: classes by day, their buildings on the 3D map, add and edit. */
export function TimetableView() {
  const buildings = useBuildings();
  const { classes } = useUserData();
  const now = useNow();
  const [day, setDay] = useState(() => bangkokClock(new Date()).day);
  const [editing, setEditing] = useState<EntryInput | null>(null);
  const [picking, setPicking] = useState(false);
  const [mapPick, setMapPick] = useState<PlaceRef | null>(null);
  const [expanded, setExpanded] = useState(false);

  // `/timetable?place=<building id>` (from a building card) opens a new class there.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('place');
    const b = id && buildings.find((x) => x.id === id);
    if (b) setEditing(blank(day, placeRef(b)));
  }, [buildings]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => classesOn(classes, day), [classes, day]);
  const highlights = useMemo(
    () => [
      ...list.map((c, i) => placeHighlight(c.place, buildings, String(i + 1), c.id)),
      ...(editing?.place ? [placeHighlight(editing.place, buildings, null, 'editing')] : []),
    ],
    [list, buildings, editing],
  );

  const onMapClick = (p: LngLat) => {
    if (!picking) return;
    const b = buildings.find((x) => x.polygon && insidePolygon(p, x.polygon));
    setMapPick(b ? placeRef(b) : { id: null, name: '', center: p });
  };

  return (
    <main className="relative h-dvh overflow-hidden">
      <CampusMap highlights={highlights} fitKey={day} onMapClick={onMapClick} />
      <Panel
        expanded={expanded || !!editing}
        onToggle={() => setExpanded((e) => !e)}
        scrollKey={editing ? 'form' : day}
        footer={
          editing ? (
            <p className="text-center text-[13px] text-secondary">{picking ? 'แตะตึกบนแผนที่เพื่อเลือก' : 'กรอกแล้วกดบันทึก'}</p>
          ) : (
            <PillButton onClick={() => setEditing(blank(day, null))} className="w-full">
              <PlusIcon size={16} />
              เพิ่มวิชา
            </PillButton>
          )
        }
      >
        <header className="flex items-center gap-2">
          <Link href="/" aria-label="กลับไปที่แผนที่" className="grid size-9 place-items-center rounded-full bg-fill hover:bg-fill-strong">
            <ChevronIcon size={16} className="rotate-180" />
          </Link>
          <h1 className="grow text-[19px] font-bold tracking-tight">ตารางเรียน</h1>
        </header>

        {editing ? (
          <ClassForm
            key={editing.id ?? 'new'}
            initial={editing}
            buildings={buildings}
            picking={picking}
            onPickOnMap={(on) => {
              setPicking(on);
              setMapPick(null);
            }}
            mapPick={mapPick}
            onCancel={() => setEditing(null)}
            onSave={(entry) => {
              updateUserData((d) => ({ ...d, classes: [...d.classes.filter((c) => c.id !== entry.id), entry] }));
              setDay(entry.day);
              setEditing(null);
            }}
            onDelete={
              editing.id
                ? () => {
                    updateUserData((d) => ({ ...d, classes: d.classes.filter((c) => c.id !== editing.id) }));
                    setEditing(null);
                  }
                : undefined
            }
          />
        ) : (
          <>
            <NextClass classes={classes} now={now} />
            <Segmented label="วัน" options={DAY_TABS} value={String(day)} onChange={(d) => setDay(Number(d))} />
            <section>
              <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-secondary">
                วัน{DAY_NAMES[day]} · {list.length ? `${list.length} วิชา` : 'ไม่มีเรียน'}
              </h2>
              {list.length > 0 && (
                <ul className="rounded-2xl bg-card px-3 shadow-sm">
                  {list.map((c, i) => (
                    <ClassRow key={c.id} entry={c} n={i + 1} onEdit={() => setEditing(c)} />
                  ))}
                </ul>
              )}
            </section>
            <p className="px-1 text-[13px] text-secondary">
              ตารางเก็บไว้ในเครื่องนี้ ล็อกอินเพื่อใช้ตารางเดียวกันทุกเครื่อง · แตะวิชาเพื่อแก้หรือลบ
            </p>
          </>
        )}
      </Panel>
    </main>
  );
}

const blank = (day: number, place: PlaceRef | null): EntryInput => ({
  course: '',
  title: null,
  day,
  start: '09:00',
  end: '12:00',
  place,
  room: null,
});
