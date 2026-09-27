import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ReportForm } from '@/components/report/ReportForm';
import { getViewer } from '@/lib/auth';
import { INCIDENTS, type Category } from '@/lib/config';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'รายงานน้ำท่วมและเหตุบนถนน' };

/** `/report` for floods, `/report?type=accident` (or another incident category) for road incidents. */
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const category: Category = type && Object.hasOwn(INCIDENTS, type) ? (type as Category) : 'flood';
  const here = category === 'flood' ? '/report' : `/report?type=${category}`;
  if (isSupabaseConfigured && !(await getViewer())) redirect(`/login?next=${encodeURIComponent(here)}`);
  return <ReportForm demo={!isSupabaseConfigured} initialCategory={category} />;
}
