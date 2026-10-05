'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { BuildingIcon, CloseIcon, PinIcon, StarIcon } from '@/components/ui/icons';
import { KIND_LABELS, searchBuildings } from '@/lib/domain/buildings';
import type { LngLat } from '@/lib/domain/geo';
import { searchPlaces, type Place } from '@/lib/geocode';
import { useBuildings } from '@/lib/hooks/useBuildings';
import { useUserData } from '@/lib/hooks/useUserData';

export type Endpoint = { kind: 'gps' } | { kind: 'place'; label: string; position: LngLat };

const MY_LOCATION = 'ตำแหน่งของฉัน';
const label = (v: Endpoint | null) => (v ? (v.kind === 'gps' ? MY_LOCATION : v.label) : '');

type Option = { key: string; title: string; detail?: string; icon?: ReactNode; pick: () => void };

/** Origin/destination input: campus buildings and saved places first, then place search, "my location", or a point on the map. */
export function PlaceField({
  value,
  onChange,
  placeholder,
  marker,
  allowMyLocation = false,
  onPickOnMap,
}: {
  value: Endpoint | null;
  onChange: (v: Endpoint | null) => void;
  placeholder: string;
  marker: ReactNode;
  allowMyLocation?: boolean;
  onPickOnMap: () => void;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(label(value));
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [active, setActive] = useState(0);
  const buildings = useBuildings();
  const { saved } = useUserData();

  useEffect(() => {
    setText(label(value));
  }, [value]);

  // Search as the user types (debounced; stale requests aborted).
  const query = open && text !== label(value) ? text.trim() : '';
  useEffect(() => {
    if (query.length < 2) return setPlaces([]);
    setStatus('loading');
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(query, ctrl.signal)
        .then((p) => {
          setPlaces(p);
          setStatus('idle');
        })
        .catch((e) => e.name !== 'AbortError' && setStatus('error'));
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const typed = open && text !== label(value) ? text.trim() : '';
  const campus = typed ? searchBuildings(buildings, typed, 5) : [];
  const campusNames = new Set(campus.map((b) => b.name));

  const choose = (v: Endpoint | null) => {
    onChange(v);
    setOpen(false);
    input.current?.blur();
  };
  const options: Option[] = [
    ...(allowMyLocation ? [{ key: 'gps', title: MY_LOCATION, icon: <span className="origin-dot scale-75" />, pick: () => choose({ kind: 'gps' }) }] : []),
    {
      key: 'map',
      title: 'เลือกบนแผนที่',
      detail: 'แตะจุดบนแผนที่',
      icon: <PinIcon size={17} className="text-secondary" />,
      pick: () => {
        setOpen(false);
        onPickOnMap();
      },
    },
    ...(typed
      ? []
      : saved.map((p, i) => ({
          key: `s${i}`,
          title: p.name,
          detail: 'ที่บันทึกไว้',
          icon: <StarIcon size={16} filled className="text-[#FF9F0A]" />,
          pick: () => choose({ kind: 'place', label: p.name, position: p.center }),
        }))),
    ...campus.map((b) => ({
      key: b.id,
      title: b.name,
      detail: ['ใน มข.', b.code, KIND_LABELS[b.kind]].filter(Boolean).join(' · '),
      icon: <BuildingIcon size={16} className="text-link" />,
      pick: () => choose({ kind: 'place', label: b.name, position: b.center }),
    })),
    ...places.filter((p) => !campusNames.has(p.label)).map((p, i) => ({
      key: `p${i}`,
      title: p.label,
      detail: p.detail,
      pick: () => choose({ kind: 'place', label: p.label, position: p.position }),
    })),
  ];

  return (
    <div className="relative">
      <div className="flex h-11 items-center gap-2.5 rounded-xl bg-white/70 px-3 ring-1 ring-separator focus-within:ring-2 focus-within:ring-accent">
        <span className="grid w-4 shrink-0 place-items-center">{marker}</span>
        <input
          ref={input}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          aria-label={placeholder}
          value={text}
          placeholder={placeholder}
          onFocus={(e) => {
            setOpen(true);
            setActive(0);
            e.target.select();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, options.length - 1));
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            else if (e.key === 'Enter') options[active]?.pick();
            else if (e.key === 'Escape') {
              setText(label(value));
              setOpen(false);
            } else return;
            e.preventDefault();
          }}
          className="h-full min-w-0 grow bg-transparent text-[15px] outline-none placeholder:text-tertiary"
        />
        {value && (
          <button type="button" aria-label="ล้าง" onClick={() => choose(null)} className="text-tertiary hover:text-secondary">
            <CloseIcon size={14} />
          </button>
        )}
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-[0_12px_40px_rgb(0_0_0/0.16),0_1px_3px_rgb(0_0_0/0.1)] ring-1 ring-separator"
        >
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()} // keep focus until the click lands
              onClick={o.pick}
              onMouseEnter={() => setActive(i)}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 aria-selected:bg-fill"
            >
              <span className="grid w-5 shrink-0 place-items-center">{o.icon ?? <PinIcon size={16} className="text-tertiary" />}</span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium">{o.title}</span>
                {o.detail && <span className="block truncate text-[12px] text-secondary">{o.detail}</span>}
              </span>
            </li>
          ))}
          {query.length >= 2 && status !== 'idle' && (
            <li className="px-2.5 py-2 text-[13px] text-secondary">{status === 'loading' ? 'กำลังค้นหา…' : 'ค้นหาไม่สำเร็จ ลองใหม่'}</li>
          )}
          {query.length >= 2 && status === 'idle' && !places.length && !campus.length && (
            <li className="px-2.5 py-2 text-[13px] text-secondary">ไม่พบสถานที่ ลองแตะบนแผนที่แทน</li>
          )}
        </ul>
      )}
    </div>
  );
}
