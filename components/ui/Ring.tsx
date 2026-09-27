/** Activity-ring style progress (0–100). */
export function Ring({ pct, color, size = 30 }: { pct: number; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <circle cx="16" cy="16" r="12" fill="none" stroke={color} strokeOpacity={0.2} strokeWidth="5" />
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${Math.max(1, Math.min(100, pct))} 100`}
        transform="rotate(-90 16 16)"
      />
    </svg>
  );
}
