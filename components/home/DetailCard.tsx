import type { ReactNode } from 'react';
import { CloseIcon } from '@/components/ui/icons';

export function DetailCard({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-2xl bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] leading-snug font-bold">{title}</h2>
        <button
          type="button"
          aria-label="ปิด"
          onClick={onClose}
          className="grid size-7 shrink-0 place-items-center rounded-full bg-fill text-secondary hover:bg-fill-strong"
        >
          <CloseIcon size={13} />
        </button>
      </div>
      {children}
    </section>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
