'use client';

import type { FeatureCollection } from 'geojson';
import { useCallback, useEffect, useState } from 'react';
import type { ReportsResponse, ZonesResponse } from '@/lib/data/types';
import { createClient } from '@/lib/supabase/browser';
import { isSupabaseConfigured } from '@/lib/supabase/env';

const POLL_MS = 5 * 60_000; // safety net if realtime drops
const DEBOUNCE_MS = 1500; // a refresh rewrites many rows; reload once

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

/** Map data from the public API, reloaded live when Supabase Realtime reports a change. */
export function useMapData() {
  const [zones, setZones] = useState<ZonesResponse | null>(null);
  const [reports, setReports] = useState<ReportsResponse | null>(null);
  const [segments, setSegments] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [z, r, s] = await Promise.all([
        getJson<ZonesResponse>('/api/zones'),
        getJson<ReportsResponse>('/api/reports'),
        getJson<FeatureCollection>('/api/segments'),
      ]);
      setZones(z);
      setReports(r);
      setSegments(s);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    if (!isSupabaseConfigured) return () => clearInterval(poll);

    let timer: ReturnType<typeof setTimeout>;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(load, DEBOUNCE_MS);
    };
    const supabase = createClient();
    // Unique per mount: the previous page's channel may still be leaving, and supabase-js
    // would hand it back already subscribed (adding listeners then throws).
    const channel = supabase.channel(`map-changes-${Math.random().toString(36).slice(2)}`);
    for (const table of ['flood_clusters', 'reports', 'segment_status'])
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, reload);
    channel.subscribe();
    return () => {
      clearInterval(poll);
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { zones, reports, segments, error, reload: load };
}
