'use client';

import { useEffect, useState } from 'react';
import { BuildingSearch } from '@/components/home/BuildingSearch';
import { Field } from '@/components/ui/Field';
import { PillButton } from '@/components/ui/Pill';
import { Segmented } from '@/components/ui/Segmented';
import type { Building } from '@/lib/domain/buildings';
import { DAY_SHORT, validateEntry, WEEK, type ClassEntry, type EntryInput } from '@/lib/domain/timetable';
import { placeRef, type PlaceRef } from '@/lib/domain/user-data';

const DAY_TABS = WEEK.map((d) => ({ id: String(d), label: DAY_SHORT[d] }));
const input = 'h-11 w-full rounded-xl bg-white/80 px-3 text-[16px] ring-1 ring-separator outline-none focus:ring-2 focus:ring-accent';

/**
 * Add or edit one class. The building comes from search, or from a tap on the map
 * (`mapPick` is the last tapped place, offered while `picking`).
 */
export function ClassForm({
  initial,
  buildings,
  picking,
  onPickOnMap,
  mapPick,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: EntryInput;
  buildings: Building[];
  picking: boolean;
  onPickOnMap: (on: boolean) => void;
  mapPick: PlaceRef | null;
  onSave: (e: ClassEntry) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<EntryInput>) => setV((cur) => ({ ...cur, ...patch }));
  const place = v.place;

  // A tap on the map while picking sets the place and ends picking.
  useEffect(() => {
    if (!picking || !mapPick) return;
    setV((cur) => ({ ...cur, place: mapPick }));
    onPickOnMap(false);
  }, [mapPick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white/90 p-4 shadow-sm">
      <h2 className="text-[15px] font-bold">{initial.id ? 'แก้วิชา' : 'เพิ่มวิชา'}</h2>
      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        <input aria-label="รหัสวิชา" placeholder="รหัสวิชา" value={v.course} onChange={(e) => set({ course: e.target.value })} className={input} />
        <input aria-label="ชื่อวิชา" placeholder="ชื่อวิชา (ไม่บังคับ)" value={v.title ?? ''} onChange={(e) => set({ title: e.target.value })} className={input} />
      </div>

      <Field label="วัน">
        <Segmented label="วัน" options={DAY_TABS} value={String(v.day)} onChange={(d) => set({ day: Number(d) })} />
      </Field>

      <Field label="เวลา">
        <div className="flex items-center gap-2">
          <input type="time" aria-label="เวลาเริ่ม" value={v.start} onChange={(e) => set({ start: e.target.value })} className={input} />
          <span className="text-secondary">–</span>
          <input type="time" aria-label="เวลาเลิก" value={v.end} onChange={(e) => set({ end: e.target.value })} className={input} />
        </div>
      </Field>

      <Field label="ตึกที่เรียน">
        {place ? (
          <div className="flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2.5 text-[15px] font-semibold text-link">
            <span className="min-w-0 grow truncate">{place.name || 'จุดที่เลือกบนแผนที่'}</span>
            <button type="button" onClick={() => set({ place: null })} className="shrink-0 text-[13px] font-normal">
              เปลี่ยน
            </button>
          </div>
        ) : (
          <>
            <BuildingSearch buildings={buildings} onPick={(b) => set({ place: placeRef(b) })} />
            <PillButton variant="plain" aria-pressed={picking} onClick={() => onPickOnMap(!picking)} className="w-full">
              {picking ? 'แตะตึกบนแผนที่…' : 'ไม่มีในรายการ? แตะตึกบนแผนที่'}
            </PillButton>
          </>
        )}
        {place && !place.id && (
          <input
            aria-label="ชื่อสถานที่"
            placeholder="ตั้งชื่อสถานที่ เช่น ตึกคณะ"
            value={place.name}
            onChange={(e) => set({ place: { ...place, name: e.target.value } })}
            className={input}
          />
        )}
        <input aria-label="ห้อง" placeholder="ห้อง (ไม่บังคับ)" value={v.room ?? ''} onChange={(e) => set({ room: e.target.value })} className={input} />
      </Field>

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <PillButton
          onClick={() => {
            const r = validateEntry(v);
            if (!r.ok) return setError(r.error);
            onPickOnMap(false);
            onSave(r.entry);
          }}
          className="flex-auto"
        >
          บันทึก
        </PillButton>
        <PillButton variant="plain" onClick={() => (onPickOnMap(false), onCancel())} className="flex-auto">
          ยกเลิก
        </PillButton>
        {onDelete && (
          <PillButton variant="plain" onClick={onDelete} className="flex-none text-danger">
            ลบ
          </PillButton>
        )}
      </div>
    </section>
  );
}
