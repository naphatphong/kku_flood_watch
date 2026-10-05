import type { Metadata } from 'next';
import { NavigateView } from '@/components/navigate/NavigateView';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata: Metadata = {
  title: 'นำทาง',
  description: 'นำทางไปตึกและสถานที่ใน มข. หลายเส้นทาง เลี่ยงน้ำท่วมและรถติด แยกตามประเภทรถ ใช้ได้โดยไม่ต้องล็อกอิน',
};

export default function NavigatePage() {
  return <NavigateView demo={!isSupabaseConfigured} />;
}
