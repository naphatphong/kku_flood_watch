'use client';

import { useEffect, useState } from 'react';
import type { Building } from '@/lib/domain/buildings';

let cache: Promise<Building[]> | null = null;
const load = () =>
  (cache ??= fetch('/data/kku-buildings.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .catch(() => {
      cache = null; // try again next time
      return [];
    }));

/** Campus buildings and places (public/data/kku-buildings.json), loaded once per page. */
export function useBuildings(): Building[] {
  const [list, setList] = useState<Building[]>([]);
  useEffect(() => {
    let live = true;
    load().then((b) => live && setList(b));
    return () => {
      live = false;
    };
  }, []);
  return list;
}
