import type { Metadata } from 'next';
import { TimetableView } from '@/components/timetable/TimetableView';

export const metadata: Metadata = {
  title: 'ตารางเรียน',
  description: 'ใส่ตารางเรียนแล้วดูตึกที่มีเรียนแต่ละวันบนแผนที่ 3 มิติ พร้อมนำทางไปคาบถัดไป',
};

export default function TimetablePage() {
  return <TimetableView />;
}
