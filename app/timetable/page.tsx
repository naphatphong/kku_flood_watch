import type { Metadata } from 'next';
import { TimetableView } from '@/components/timetable/TimetableView';
import { imageImportEnabled } from '@/lib/data/timetable-image';

export const metadata: Metadata = {
  title: 'ตารางเรียน',
  description: 'ใส่ตารางเรียนหรือนำเข้าจากระบบทะเบียน แล้วดูตึกที่มีเรียนแต่ละวันบนแผนที่ 3 มิติ พร้อมนำทางไปคาบถัดไป',
};

export default function TimetablePage() {
  return <TimetableView imageImport={imageImportEnabled()} />;
}
