import type { ReactNode } from 'react';

/** Labeled form section. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 px-1 text-[13px] font-semibold text-secondary">
        {label}
        {hint && <span className="font-normal"> · {hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}
