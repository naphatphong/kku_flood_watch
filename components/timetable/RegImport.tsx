'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BuildingSearch } from '@/components/home/BuildingSearch';
import { BuildingIcon, CalendarIcon, PinIcon } from '@/components/ui/icons';
import { PillButton, PillLink } from '@/components/ui/Pill';
import { REG_IMPORT } from '@/lib/config';
import type { Building } from '@/lib/domain/buildings';
import { codeKey, parseRegTables, placeForCode, type CodeMap, type RegClass } from '@/lib/domain/reg-import';
import { DAY_NAMES, validateEntry, WEEK, type ClassEntry } from '@/lib/domain/timetable';
import { placeRef, type PlaceRef } from '@/lib/domain/user-data';
import { htmlTables } from './reg-html';

type Row = RegClass & { key: number; include: boolean };

/**
 * Import from reg.kku.ac.th: paste the copied timetable (or let Claude read a screenshot), review
 * the classes, and place building codes the app does not know yet. A placed code is saved for
 * everyone (signed-in visitors), so the next student gets it automatically.
 */
export function RegImport({
  buildings,
  imageImport,
  existing,
  picking,
  onPickOnMap,
  mapPick,
  onPreview,
  onImport,
  onCancel,
}: {
  buildings: Building[];
  imageImport: boolean; // the server can read screenshots (ANTHROPIC_API_KEY set)
  existing: number; // classes already in the timetable
  picking: boolean;
  onPickOnMap: (on: boolean) => void;
  mapPick: PlaceRef | null;
  onPreview: (places: PlaceRef[]) => void; // highlighted on the map
  onImport: (entries: ClassEntry[], replace: boolean) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [codes, setCodes] = useState<CodeMap>({});
  const [picked, setPicked] = useState<CodeMap>({}); // this visitor's answers, until the server confirms
  const [pickFor, setPickFor] = useState<string | null>(null); // code being placed
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; login?: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/building-codes')
      .then((r) => (r.ok ? r.json() : {}))
      .then(setCodes)
      .catch(() => {});
  }, []);

  const placeOf = (r: RegClass) => {
    const key = codeKey(r.building);
    return (key && picked[key]) || placeForCode(r.building, buildings, codes);
  };
  const unknown = (r: RegClass) => !!codeKey(r.building) && !placeOf(r);

  const places = useMemo(
    () => (rows ?? []).filter((r) => r.include).flatMap((r) => placeOf(r) ?? []),
    [rows, picked, codes, buildings], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => onPreview(places), [places]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = (list: RegClass[], empty: string) => {
    if (!list.length) return setError({ text: empty });
    setError(null);
    const order = (d: number) => WEEK.indexOf(d);
    setRows(
      list
        .slice()
        .sort((a, b) => order(a.day) - order(b.day) || a.start.localeCompare(b.start))
        .map((c, key) => ({ ...c, key, include: true })),
    );
  };

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    if (!html) return setError({ text: 'ไม่พบตารางในสิ่งที่วาง ลากคลุมทั้งตารางบนเว็บทะเบียนแล้วคัดลอกใหม่' });
    load(parseRegTables(htmlTables(html)), 'ไม่พบวิชาในตารางที่วาง ลากคลุมให้ถึงแถวหัวตารางที่มีเวลาด้วย');
  };

  async function readImage(f: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('image', await shrink(f).catch(() => f), 'timetable.jpg');
      const res = await fetch('/api/timetable/image', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError({ text: json.error ?? 'อ่านภาพไม่สำเร็จ ลองใหม่อีกครั้ง', login: res.status === 401 });
      load(json.classes ?? [], 'ไม่พบวิชาในภาพนี้ ใช้ภาพหน้าตารางเรียนที่เห็นทั้งตาราง');
    } catch {
      setError({ text: 'ส่งภาพไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่' });
    } finally {
      setBusy(false);
    }
  }

  async function place(code: string, p: PlaceRef) {
    const named = p.id ? p : { ...p, name: `อาคาร ${code}` };
    setPicked((m) => ({ ...m, [code]: named }));
    setPickFor(null);
    onPickOnMap(false);
    const res = await fetch('/api/building-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p.id ? { code, buildingId: p.id } : { code, center: p.center }),
    }).catch(() => null);
    if (res?.ok) {
      // The first answer stays shared; this visitor's own pick still goes into their timetable.
      const saved: PlaceRef = await res.json();
      setCodes((m) => ({ ...m, [code]: saved }));
      setNote(saved.name === named.name ? `บันทึก ${code} ให้ทุกคนแล้ว ขอบคุณ` : `ใช้ตึกที่คุณเลือกในตารางของคุณแล้ว`);
    } else setNote(res?.status === 401 ? `ใช้ตึกนี้ในตารางของคุณแล้ว ล็อกอินเพื่อบันทึก ${code} ให้ทุกคน` : null);
  }

  // A tap on the map while placing a code.
  useEffect(() => {
    if (picking && mapPick && pickFor) void place(pickFor, mapPick);
  }, [mapPick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pickFor)
    return (
      <section className="flex flex-col gap-3 rounded-2xl bg-white/90 p-4 shadow-sm">
        <h2 className="text-[15px] font-bold">ตึก {pickFor} คือตึกไหน</h2>
        <p className="text-[13px] text-secondary">เลือกครั้งเดียว ระบบจะจำให้ทุกคนที่มีเรียนตึกนี้</p>
        <BuildingSearch buildings={buildings} onPick={(b) => place(pickFor, placeRef(b))} />
        <PillButton variant="plain" aria-pressed={picking} onClick={() => onPickOnMap(!picking)} className="w-full">
          {picking ? 'แตะตึกบนแผนที่…' : 'ไม่มีในรายการ? แตะตึกบนแผนที่'}
        </PillButton>
        <PillButton variant="plain" onClick={() => (setPickFor(null), onPickOnMap(false))} className="w-full">
          ยกเลิก
        </PillButton>
      </section>
    );

  if (!rows)
    return (
      <section className="flex flex-col gap-3">
        <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
          <h2 className="mb-2 text-[15px] font-bold">นำเข้าจากระบบทะเบียน</h2>
          <ol className="list-decimal space-y-1 pl-5 text-[14px] text-secondary">
            <li>
              เปิด{' '}
              <a href="https://reg.kku.ac.th" target="_blank" rel="noreferrer" className="text-link">
                reg.kku.ac.th
              </a>{' '}
              หน้าตารางเรียน
            </li>
            <li>ลากคลุมทั้งตาราง ตั้งแต่แถวเวลาจนถึงวันสุดท้าย แล้วคัดลอก</li>
            <li>แตะช่องด้านล่างแล้ววาง</li>
          </ol>
        </div>
        <textarea
          aria-label="วางตารางเรียนที่นี่"
          placeholder="วางตารางที่นี่ (Ctrl+V หรือกดค้างแล้วเลือกวาง)"
          value=""
          onChange={() => {}}
          onPaste={onPaste}
          rows={3}
          className="w-full resize-none rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 p-4 text-center text-[15px] outline-none placeholder:text-link focus:border-accent"
        />
        {imageImport && (
          <>
            <p className="text-center text-[13px] text-secondary">หรือ</p>
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void readImage(f);
              }}
            />
            <PillButton variant="tinted" disabled={busy} onClick={() => file.current?.click()} className="w-full">
              <CalendarIcon size={16} />
              {busy ? 'กำลังอ่านภาพ… อาจใช้เวลาครึ่งนาที' : 'อ่านจากภาพหน้าจอ'}
            </PillButton>
            <p className="px-1 text-[12px] text-secondary">AI อ่านภาพตารางเรียนให้ ต้องล็อกอิน และตรวจผลก่อนนำเข้า</p>
          </>
        )}
        {error && <ErrorNote error={error} />}
        <PillButton variant="plain" onClick={onCancel} className="w-full">
          ยกเลิก
        </PillButton>
      </section>
    );

  const chosen = rows.filter((r) => r.include);
  const unknownCodes = new Set(chosen.filter(unknown).map((r) => codeKey(r.building)));
  const toggle = (key: number) => setRows(rows.map((r) => (r.key === key ? { ...r, include: !r.include } : r)));

  return (
    <section className="flex flex-col gap-3">
      <div className="px-1">
        <h2 className="text-[15px] font-bold">พบ {rows.length} วิชา · ตรวจก่อนนำเข้า</h2>
        <p className="text-[13px] text-secondary">เวลาหรือห้องผิด แก้ได้หลังนำเข้าโดยแตะวิชานั้น</p>
      </div>
      {unknownCodes.size > 0 && (
        <p className="rounded-2xl bg-[#FFF4E0] px-3.5 py-2.5 text-[13px] text-[#8A5300]">
          มี {unknownCodes.size} ตึกที่ระบบยังไม่รู้จัก แตะ “เลือกตึก” ครั้งเดียว ระบบจะจำให้ทุกคน
        </p>
      )}
      {note && <p className="px-1 text-[13px] text-link">{note}</p>}
      {WEEK.filter((d) => rows.some((r) => r.day === d)).map((d) => (
        <div key={d}>
          <h3 className="mb-1.5 px-1 text-[13px] font-semibold text-secondary">วัน{DAY_NAMES[d]}</h3>
          <ul className="rounded-2xl bg-card px-3 shadow-sm">
            {rows
              .filter((r) => r.day === d)
              .map((r) => {
                const p = placeOf(r);
                const code = codeKey(r.building);
                return (
                  <li
                    key={r.key}
                    className={`flex min-h-[58px] items-center gap-3 border-b border-separator py-2 last:border-0 ${r.include ? '' : 'opacity-45'}`}
                  >
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={() => toggle(r.key)}
                      aria-label={`นำเข้า ${r.course}`}
                      className="size-5 shrink-0 accent-accent"
                    />
                    <span className="min-w-0 grow">
                      <span className="block truncate text-[15px] font-semibold">
                        {r.start}–{r.end} · {r.course}
                        {r.section && <span className="font-normal text-secondary"> ตอน {r.section}</span>}
                      </span>
                      <span className="flex items-center gap-1 truncate text-xs text-secondary">
                        {p ? (
                          <>
                            <BuildingIcon size={12} className="shrink-0 text-link" />
                            <span className="truncate text-link">{p.name}</span>
                          </>
                        ) : code ? (
                          <span>ไม่รู้จักตึก {r.building}</span>
                        ) : (
                          <span>ไม่ระบุห้อง</span>
                        )}
                        {r.room && <span className="shrink-0">· ห้อง {r.room}</span>}
                      </span>
                    </span>
                    {code && r.include && (
                      <button
                        type="button"
                        onClick={() => setPickFor(code)}
                        className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold ${
                          p ? 'text-link hover:bg-fill' : 'bg-[#FFF4E0] text-[#8A5300]'
                        }`}
                      >
                        {p ? (
                          'เปลี่ยน'
                        ) : (
                          <>
                            <PinIcon size={13} />
                            เลือกตึก
                          </>
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      {existing > 0 && (
        <label className="flex items-center gap-2.5 px-1 text-[14px]">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="size-5 accent-accent"
          />
          ลบ {existing} วิชาเดิมก่อนนำเข้า (เช่น ตารางเทอมที่แล้ว)
        </label>
      )}
      {error && <ErrorNote error={error} />}
      <div className="flex gap-2">
        <PillButton
          disabled={!chosen.length}
          onClick={() => {
            const entries = chosen.flatMap((r) => {
              const v = validateEntry({
                course: r.course,
                title: null,
                day: r.day,
                start: r.start,
                end: r.end,
                place: placeOf(r),
                room: r.room,
              });
              return v.ok ? [v.entry] : [];
            });
            if (!entries.length) return setError({ text: 'ไม่มีวิชาที่นำเข้าได้' });
            onPickOnMap(false);
            onImport(entries, replace);
          }}
          className="flex-auto"
        >
          นำเข้า {chosen.length} วิชา
        </PillButton>
        <PillButton variant="plain" onClick={() => (onPickOnMap(false), setRows(null))} className="flex-none">
          วางใหม่
        </PillButton>
      </div>
    </section>
  );
}

function ErrorNote({ error }: { error: { text: string; login?: boolean } }) {
  return (
    <div role="alert" className="flex flex-col gap-2 px-1 text-[13px] text-danger">
      {error.text}
      {error.login && (
        <PillLink href="/login?next=/timetable" variant="tinted" className="w-full">
          เข้าสู่ระบบ
        </PillLink>
      )}
    </div>
  );
}

/** Screenshot → JPEG no larger than the model reads, so uploads stay small. */
async function shrink(f: File): Promise<Blob> {
  const img = await createImageBitmap(f);
  const k = Math.min(1, REG_IMPORT.imageEdgePx / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * k);
  canvas.height = Math.round(img.height * k);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('encode'))), 'image/jpeg', 0.9));
}
