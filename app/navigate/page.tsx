import type { Metadata } from 'next';
import { NavigateView } from '@/components/navigate/NavigateView';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata: Metadata = {
  title: 'นำทางหลบน้ำ',
  description: 'เส้นทางเลี่ยงจุดน้ำท่วมรอบ มข. แยกตามประเภทรถ ใช้ได้โดยไม่ต้องล็อกอิน',
};

export default function NavigatePage() {
  return <NavigateView demo={!isSupabaseConfigured} />;
}
