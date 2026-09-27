import Link from 'next/link';
import type { ComponentProps } from 'react';

const STYLES = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  tinted: 'bg-accent/12 text-link hover:bg-accent/18',
  plain: 'bg-fill text-label hover:bg-fill-strong',
};

type Variant = keyof typeof STYLES;
const base =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-semibold transition-colors disabled:opacity-50';

/** Pill-shaped link button. */
export function PillLink({ variant = 'primary', className = '', ...rest }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${STYLES[variant]} ${className}`} {...rest} />;
}

/** Pill-shaped button. */
export function PillButton({ variant = 'primary', className = '', ...rest }: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type="button" className={`${base} ${STYLES[variant]} ${className}`} {...rest} />;
}
