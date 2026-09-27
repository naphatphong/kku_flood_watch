import type { ReactNode } from 'react';
import { DropIcon } from '@/components/ui/icons';
import { SITE } from '@/lib/config';
import { clock } from '@/lib/format';

export function PanelHeader({ updatedAt, demo, actions }: { updatedAt?: string; demo?: boolean; actions?: ReactNode }) {
  return (
    <header className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-accent text-white">
        <DropIcon size={22} />
      </span>
      <div className="min-w-0 grow">
        <h1 className="text-[19px] leading-tight font-bold tracking-tight">{SITE.name}</h1>
        <p className="truncate text-[13px] text-secondary">
          น้ำท่วมรอบ มข. · {updatedAt ? `อัปเดต ${clock(updatedAt)}` : 'กำลังโหลด…'}
        </p>
      </div>
      {demo && (
        <span
          title="ยังไม่ได้เชื่อมฐานข้อมูล ข้อมูลบนแผนที่เป็นตัวอย่าง"
          className="shrink-0 rounded-full bg-[#FFF1CC] px-2.5 py-1 text-xs font-semibold text-[#7A5200]"
        >
          ข้อมูลตัวอย่าง
        </span>
      )}
      {actions}
    </header>
  );
}
