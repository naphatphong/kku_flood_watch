'use client';

import { StarIcon } from '@/components/ui/icons';
import type { PlaceRef } from '@/lib/domain/user-data';

/** Places the visitor starred, as quick chips. */
export function SavedPlaces({ saved, onPick }: { saved: PlaceRef[]; onPick: (p: PlaceRef) => void }) {
  if (!saved.length) return null;
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-secondary">ที่บันทึกไว้</h2>
      <div className="flex flex-wrap gap-2">
        {saved.map((p) => (
          <button
            key={p.id ?? `${p.name}${p.center.join()}`}
            type="button"
            onClick={() => onPick(p)}
            className="flex min-h-10 max-w-full items-center gap-1.5 rounded-full bg-card px-3.5 text-[14px] font-medium shadow-sm"
          >
            <StarIcon size={15} filled className="shrink-0 text-[#FF9F0A]" />
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
