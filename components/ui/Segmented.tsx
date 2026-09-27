'use client';

/** macOS-style segmented control. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 rounded-[10px] bg-fill p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className="h-10 flex-1 rounded-lg text-[13px] transition-colors aria-pressed:bg-white aria-pressed:font-semibold aria-pressed:shadow-sm md:h-8"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
