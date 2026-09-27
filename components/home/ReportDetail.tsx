import Link from 'next/link';
import { PassabilityGrid } from '@/components/ui/PassabilityGrid';
import { STATUS_TAGS } from '@/lib/config';
import type { ReportPin } from '@/lib/data/types';
import { postLabel, voteLabels } from '@/lib/domain/post';
import { timeAgo } from '@/lib/format';
import { DetailCard } from './DetailCard';

export function ReportDetail({ report, onClose }: { report: ReportPin; onClose: () => void }) {
  const head = postLabel(report);
  const votes = voteLabels(report.category);
  const flood = report.category === 'flood';
  return (
    <DetailCard title={flood ? (report.kind === 'road' ? 'รายงานสภาพถนน' : 'รายงานน้ำท่วม') : 'แจ้งเหตุบนถนน'} onClose={onClose}>
      <p className="text-[13px] text-secondary">
        {timeAgo(report.createdAt)}
        {flood && report.radiusM ? ` · รัศมี ${report.radiusM} ม.` : ''}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold" style={{ color: head.text, background: `${head.color}1F` }}>
          {head.label}
        </span>
        {report.statusTags.map((t) => (
          <span key={t} className="rounded-full bg-fill px-2.5 py-0.5 text-[13px]">
            {STATUS_TAGS[t].label}
          </span>
        ))}
      </div>
      {flood && (
        <div className="mt-3">
          <PassabilityGrid value={report.passability} />
        </div>
      )}
      {report.photoUrl && (
        <img src={report.photoUrl} alt="รูปจากผู้รายงาน" className="mt-3 max-h-52 w-full rounded-xl object-cover" />
      )}
      {report.note && <p className="mt-3 text-[14px] leading-relaxed whitespace-pre-line">{report.note}</p>}
      <div className="mt-3 flex items-center justify-between text-[13px]">
        <span className="text-secondary">
          {votes.still} {report.stillVotes} · {votes.receded} {report.recededVotes}
        </span>
        <Link href={`/post/${report.id}`} className="font-semibold text-link">
          ดูโพสต์และโหวต
        </Link>
      </div>
    </DetailCard>
  );
}
