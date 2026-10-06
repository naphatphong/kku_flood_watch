'use client';

import { useRef } from 'react';
import { CloseIcon, PhoneIcon } from '@/components/ui/icons';
import { EMERGENCY_NUMBERS } from '@/lib/emergency-numbers';

const GROUPS = ['มข.', 'ทั่วประเทศ'] as const;

/** Red SOS button: opens the emergency numbers, each one a tap to call. */
export function EmergencyButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label="เบอร์โทรฉุกเฉิน"
        className="grid size-11 shrink-0 place-items-center rounded-full bg-danger text-[13px] font-extrabold tracking-wide text-white shadow-sm hover:brightness-110"
      >
        SOS
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="sos-title"
        // A tap on the backdrop lands on the dialog itself; taps inside land on its children.
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="glass m-0 mt-auto max-h-[86dvh] w-full overflow-y-auto max-w-none rounded-t-[30px] p-0 text-label backdrop:bg-black/35 md:m-auto md:max-w-[400px] md:rounded-[22px]"
      >
        <div className="flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <header className="flex items-center gap-2">
            <h2 id="sos-title" className="grow text-[19px] font-bold tracking-tight">
              เบอร์โทรฉุกเฉิน
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="ปิด"
              className="grid size-9 place-items-center rounded-full bg-fill hover:bg-fill-strong"
            >
              <CloseIcon size={15} />
            </button>
          </header>
          {GROUPS.map((g) => (
            <section key={g}>
              <h3 className="mb-1.5 px-1 text-[13px] font-semibold text-secondary">{g}</h3>
              <ul className="rounded-2xl bg-card px-3 shadow-sm">
                {EMERGENCY_NUMBERS.filter((n) => n.group === g).map((n) => (
                  <li key={n.tel} className="border-b border-separator last:border-0">
                    <a href={`tel:${n.tel}`} className="flex min-h-[56px] items-center gap-3 py-2">
                      <span className="min-w-0 grow">
                        <span className="block text-[17px] font-bold tabular-nums">{n.number}</span>
                        <span className="block text-[13px] text-secondary">{n.label}</span>
                      </span>
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#E8F7EE] text-[#1A7F45]">
                        <PhoneIcon size={18} />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="px-1 text-[13px] text-secondary">อุบัติเหตุหรือเจ็บป่วยฉุกเฉิน โทร 1669 ก่อน · แตะเบอร์เพื่อโทรออก</p>
        </div>
      </dialog>
    </>
  );
}
