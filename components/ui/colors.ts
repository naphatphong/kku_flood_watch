import type { Passability } from '@/lib/config';

// Text colors that pass contrast on light backgrounds.
export const PASSABILITY_COLORS: Record<Passability, { label: string; text: string }> = {
  ok: { label: 'ผ่านได้', text: '#248A3D' },
  hard: { label: 'ผ่านยาก', text: '#9A6700' },
  blocked: { label: 'ผ่านไม่ได้', text: '#D70015' },
};
