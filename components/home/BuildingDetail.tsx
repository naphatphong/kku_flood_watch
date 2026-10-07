'use client';

import Link from 'next/link';
import { CalendarIcon, RouteIcon, StarIcon } from '@/components/ui/icons';
import { PillButton, PillLink } from '@/components/ui/Pill';
import { KIND_LABELS, navigateHref, UNNAMED_BUILDING, type Building } from '@/lib/domain/buildings';
import { isSaved, placeRef, toggleSaved } from '@/lib/domain/user-data';
import { updateUserData, useUserData } from '@/lib/hooks/useUserData';
import { DetailCard } from './DetailCard';

/** A campus building: what it is, navigate there, save it. */
export function BuildingDetail({ building, onClose }: { building: Building; onClose: () => void }) {
  const { saved } = useUserData();
  const ref = placeRef(building);
  const starred = isSaved(saved, ref);
  const unnamed = building.name === UNNAMED_BUILDING; // tapped on the map, not in our list
  return (
    <DetailCard title={building.name} onClose={onClose}>
      <p className="mt-0.5 text-[13px] text-secondary">
        {unnamed
          ? 'ยังไม่มีชื่อใน OpenStreetMap · นำทางและบันทึกได้'
          : [building.nameEn, KIND_LABELS[building.kind], building.levels && `${building.levels} ชั้น`].filter(Boolean).join(' · ')}
      </p>
      {building.code && (
        <span className="mt-2 inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[13px] font-semibold text-link">
          {building.code}
        </span>
      )}
      <div className="mt-3 flex gap-2">
        <PillLink href={navigateHref(building)} className="flex-auto">
          <RouteIcon size={17} />
          นำทาง
        </PillLink>
        <PillButton
          variant="tinted"
          aria-pressed={starred}
          onClick={() => updateUserData((d) => ({ ...d, saved: toggleSaved(d.saved, ref) }))}
          className="flex-auto"
        >
          <StarIcon size={17} filled={starred} />
          {starred ? 'บันทึกแล้ว' : 'บันทึก'}
        </PillButton>
      </div>
      {!unnamed && (
        <Link href={`/timetable?place=${building.id}`} className="mt-2.5 flex items-center justify-center gap-1.5 text-[14px] font-semibold text-link">
          <CalendarIcon size={15} />
          เพิ่มในตารางเรียน
        </Link>
      )}
    </DetailCard>
  );
}
