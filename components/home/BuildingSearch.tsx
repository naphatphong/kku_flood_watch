'use client';

import { useMemo, useState } from 'react';
import { BuildingIcon, SearchIcon } from '@/components/ui/icons';
import { KIND_LABELS, searchBuildings, type Building } from '@/lib/domain/buildings';

/** Search box for campus buildings and places; picking one selects it on the map. */
export function BuildingSearch({ buildings, onPick }: { buildings: Building[]; onPick: (b: Building) => void }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => searchBuildings(buildings, q), [buildings, q]);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-fill px-3 text-secondary focus-within:ring-2 focus-within:ring-accent/40">
        <SearchIcon size={16} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาตึก คณะ หอพัก เช่น SC09"
          aria-label="ค้นหาตึกใน มข."
          className="h-full min-w-0 grow bg-transparent text-[16px] text-label outline-none placeholder:text-secondary"
        />
      </label>
      {q.trim() &&
        (results.length ? (
          <ul className="rounded-2xl bg-card px-3 shadow-sm">
            {results.map((b) => (
              <li key={b.id} className="border-b border-separator last:border-0">
                <button
                  type="button"
                  onClick={() => {
                    onPick(b);
                    setQ('');
                  }}
                  className="flex min-h-[52px] w-full items-center gap-3 py-1.5 text-left"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 text-link">
                    <BuildingIcon size={17} />
                  </span>
                  <span className="min-w-0 grow">
                    <span className="block truncate text-[15px] font-semibold">{b.name}</span>
                    <span className="block truncate text-xs text-secondary">
                      {[b.code, KIND_LABELS[b.kind], b.nameEn].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-[13px] text-secondary">
            ไม่พบใน มข. ลองชื่ออื่นหรือรหัสตึก (ที่นอก มข. ค้นได้ในหน้านำทาง)
          </p>
        ))}
    </div>
  );
}
