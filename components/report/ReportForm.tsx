'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { ChevronIcon, PinIcon } from '@/components/ui/icons';
import { Panel } from '@/components/ui/Panel';
import { PillButton, PillLink } from '@/components/ui/Pill';
import { Segmented } from '@/components/ui/Segmented';
import {
  POST,
  STATUS_TAGS,
  WATER_LEVELS,
  zoneLevel,
  type Passability,
  type StatusTag,
  type Vehicle,
  type WaterLevel,
} from '@/lib/config';
import type { LngLat } from '@/lib/domain/geo';
import { insideArea } from '@/lib/domain/report-input';
import { chainLengthM, toggleSegment, type ChainSegment } from '@/lib/domain/road-chain';
import type { ReportKind } from '@/lib/domain/types';
import { PassabilityPicker } from './PassabilityPicker';
import { PhotoInput } from './PhotoInput';
import { ReportDone } from './ReportDone';

const PickerMap = dynamic(() => import('./PickerMap'), { ssr: false });

const KINDS = [
  { id: 'area' as const, label: 'พื้นที่' },
  { id: 'road' as const, label: 'ถนน' },
];

interface SegmentFeature {
  properties: { id: number; source: number; target: number; length_m: number };
  geometry: { coordinates: LngLat[] };
}
const toChainSegment = (f: SegmentFeature): ChainSegment => ({
  id: f.properties.id,
  source: f.properties.source,
  target: f.properties.target,
  lengthM: f.properties.length_m,
  coords: f.geometry.coordinates,
});

export function ReportForm({ demo }: { demo: boolean }) {
  const [kind, setKind] = useState<ReportKind>('area');
  const [pin, setPin] = useState<LngLat | null>(null);
  const [radius, setRadius] = useState(POST.radiusM.default);
  const [chain, setChain] = useState<ChainSegment[]>([]);
  const [candidates, setCandidates] = useState<ChainSegment[]>([]);
  const [roadHint, setRoadHint] = useState<string | null>(null);
  const [water, setWater] = useState<WaterLevel | null>(null);
  const [tags, setTags] = useState<StatusTag[]>([]);
  const [passability, setPassability] = useState<Partial<Record<Vehicle, Passability>>>({});
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [poster, setPoster] = useState<LngLat | null>(null);
  const [gps, setGps] = useState<'pending' | 'ok' | 'denied'>('pending');
  const [flyTo, setFlyTo] = useState<LngLat | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: number; status: string } | null>(null);

  // The poster's GPS: default pin position and the "near the spot" check (PLAN §7).
  useEffect(() => {
    if (!navigator.geolocation) return setGps('denied');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here: LngLat = [coords.longitude, coords.latitude];
        setPoster(here);
        setGps('ok');
        if (insideArea(here)) {
          setPin((p) => p ?? here);
          setFlyTo(here);
        }
      },
      () => setGps('denied'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  async function onRoadTap(p: LngLat) {
    if (demo) return setRoadHint('โหมดตัวอย่างยังเลือกถนนไม่ได้');
    const res = await fetch(`/api/road-segments?lng=${p[0]}&lat=${p[1]}`);
    const segs: ChainSegment[] = res.ok ? (await res.json()).features.map(toChainSegment) : [];
    setCandidates(segs);
    if (!segs.length) return setRoadHint('ไม่พบถนนใกล้จุดที่แตะ ลองแตะบนเส้นถนน');
    const next = toggleSegment(chain, segs[0]);
    if (chainLengthM(next) > POST.roadMaxLengthM) return setRoadHint(`เลือกรวมได้ไม่เกิน ${POST.roadMaxLengthM} ม.`);
    setChain(next);
    setRoadHint(null);
  }

  const placed = kind === 'area' ? pin !== null : chain.length > 0;
  const canSubmit = placed && water !== null && !sending && !demo;

  async function submit() {
    if (!canSubmit) return;
    setSending(true);
    setError(null);
    const form = new FormData();
    form.set('kind', kind);
    if (kind === 'area' && pin) {
      form.set('lng', String(pin[0]));
      form.set('lat', String(pin[1]));
      form.set('radius_m', String(radius));
    } else form.set('segment_ids', chain.map((s) => s.id).join(','));
    form.set('water_level', water!);
    form.set('status_tags', tags.join(','));
    form.set('passability', JSON.stringify(passability));
    form.set('note', note);
    if (poster) {
      form.set('poster_lng', String(poster[0]));
      form.set('poster_lat', String(poster[1]));
    }
    if (photo) form.set('photo', photo);
    try {
      const res = await fetch('/api/reports', { method: 'POST', body: form });
      const body = await res.json();
      if (res.ok) setDone(body);
      else setError(body.error ?? 'ส่งไม่สำเร็จ');
    } catch {
      setError('เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="relative h-dvh overflow-hidden">
      <PickerMap
        kind={kind}
        pin={pin}
        radiusM={radius}
        chain={chain}
        candidates={candidates}
        flyTo={flyTo}
        onPin={setPin}
        onRoadTap={onRoadTap}
      />
      <Panel
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        scrollKey={done}
        footer={
          done ? (
            <PillLink href="/" className="w-full">
              กลับไปที่แผนที่
            </PillLink>
          ) : (
            <div className="flex flex-col gap-1.5">
              {error && (
                <p role="alert" className="text-center text-[13px] text-danger">
                  {error}
                </p>
              )}
              <PillButton onClick={submit} disabled={!canSubmit} className="w-full">
                {sending ? 'กำลังส่ง…' : demo ? 'โหมดตัวอย่าง ส่งไม่ได้' : 'ส่งรายงาน'}
              </PillButton>
            </div>
          )
        }
      >
        <header className="flex items-center gap-2">
          <Link href="/" aria-label="กลับ" className="grid size-9 place-items-center rounded-full bg-fill hover:bg-fill-strong">
            <ChevronIcon size={16} className="rotate-180" />
          </Link>
          <h1 className="text-[19px] font-bold tracking-tight">รายงานน้ำท่วม</h1>
        </header>

        {done ? (
          <ReportDone id={done.id} status={done.status} />
        ) : (
          <>
            <Field label="ชนิดโพสต์">
              <Segmented label="ชนิดโพสต์" options={KINDS} value={kind} onChange={setKind} />
              <p className="flex items-start gap-1.5 px-1 text-[13px] text-secondary">
                <PinIcon size={15} className="mt-0.5 shrink-0" />
                {kind === 'area'
                  ? pin
                    ? 'แตะแผนที่หรือลากหมุดเพื่อย้ายตำแหน่ง'
                    : 'แตะแผนที่ตรงจุดที่น้ำท่วม'
                  : chain.length
                    ? `เลือกแล้ว ${chain.length} ท่อน · ${Math.round(chainLengthM(chain))} ม. — แตะท่อนที่ต่อกันเพื่อเพิ่ม แตะท่อนปลายเพื่อเอาออก`
                    : 'แตะบนถนนที่ท่วม แล้วแตะท่อนที่ต่อกันเพื่อเลือกช่วง'}
              </p>
              {roadHint && kind === 'road' && <p className="px-1 text-[13px] text-danger">{roadHint}</p>}
              {gps === 'denied' && (
                <p className="rounded-xl bg-[#FFF1CC] px-3 py-2 text-[13px] text-[#7A5200]">
                  ไม่ได้รับตำแหน่ง GPS โพสต์อาจต้องรอแอดมินตรวจก่อนขึ้นแผนที่
                </p>
              )}
            </Field>

            {kind === 'area' && (
              <Field label="รัศมี" hint={`${radius} ม.`}>
                <input
                  type="range"
                  min={POST.radiusM.min}
                  max={POST.radiusM.max}
                  step={10}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  aria-label="รัศมี (เมตร)"
                  className="w-full accent-[#0071E3]"
                />
              </Field>
            )}

            <Field label="ระดับน้ำ" hint="รายงานว่าแห้งก็ช่วยได้">
              <div className="flex flex-wrap gap-2">
                {(Object.entries(WATER_LEVELS) as [WaterLevel, (typeof WATER_LEVELS)[WaterLevel]][]).map(([id, w]) => (
                  <Chip key={id} pressed={water === id} onClick={() => setWater(id)} tone={zoneLevel(w.score).text}>
                    {w.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="สถานะ" hint="เลือกได้หลายอัน">
              <div className="flex flex-wrap gap-2">
                {(Object.entries(STATUS_TAGS) as [StatusTag, (typeof STATUS_TAGS)[StatusTag]][]).map(([id, t]) => (
                  <Chip
                    key={id}
                    pressed={tags.includes(id)}
                    onClick={() => setTags((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
                  >
                    {t.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="รถแต่ละแบบผ่านได้ไหม" hint="ไม่บังคับ แต่ช่วยให้สีถนนแม่นขึ้น">
              <PassabilityPicker value={passability} onChange={setPassability} />
            </Field>

            <Field label="รูปและข้อความ" hint="ไม่บังคับ ข้อความไม่นำไปคำนวณ">
              <PhotoInput value={photo} onChange={setPhoto} />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={POST.noteMaxLength}
                rows={3}
                placeholder="เช่น น้ำขึ้นเร็วหน้าร้านสะดวกซื้อ"
                className="w-full resize-none rounded-2xl bg-card p-3 text-[15px] shadow-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
            </Field>
          </>
        )}
      </Panel>
    </main>
  );
}
