import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ReportForm } from '@/components/report/ReportForm';
import { getViewer } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'รายงานน้ำท่วม' };

export default async function ReportPage() {
  if (isSupabaseConfigured && !(await getViewer())) redirect('/login?next=/report');
  return <ReportForm demo={!isSupabaseConfigured} />;
}
