import type { ReportStatus } from '@/lib/domain/types';

const STATUS: Record<ReportStatus, { label: string; className: string }> = {
  approved: { label: 'ขึ้นแผนที่แล้ว', className: 'bg-[#E4F6E9] text-[#1B7A35]' },
  pending: { label: 'รอแอดมินตรวจ', className: 'bg-[#FFF1CC] text-[#7A5200]' },
  rejected: { label: 'ไม่ผ่าน', className: 'bg-[#FDECEA] text-danger' },
  hidden: { label: 'ถูกซ่อน', className: 'bg-[#FDECEA] text-danger' },
  deleted: { label: 'ถูกลบ', className: 'bg-fill text-secondary' },
};

/** Review status of a post. */
export function StatusChip({ status }: { status: ReportStatus }) {
  const s = STATUS[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s.className}`}>{s.label}</span>;
}
