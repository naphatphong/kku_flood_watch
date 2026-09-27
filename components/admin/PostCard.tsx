import Link from 'next/link';
import { StatusChip } from '@/components/ui/StatusChip';
import { FLAG_REASONS, WATER_LEVELS, zoneLevel } from '@/lib/config';
import { allowedActions, type AdminPost, type ReportAction } from '@/lib/data/admin';
import { SPAM_REASON_LABELS } from '@/lib/domain/spam';
import { clock, timeAgo } from '@/lib/format';
import { ActionButton } from './ActionButton';

const ACTION_UI: Record<ReportAction, { label: string; tone: 'primary' | 'plain' | 'danger'; confirm?: string }> = {
  approve: { label: 'อนุมัติ', tone: 'primary' },
  restore: { label: 'คืนสถานะ', tone: 'primary' },
  reject: { label: 'ปฏิเสธ', tone: 'plain' },
  delete: { label: 'ลบ', tone: 'danger', confirm: 'ยืนยันลบ' },
};

/** A post in a review queue: what was posted, why it's here, and the allowed actions. */
export function PostCard({ post, showUser = true }: { post: AdminPost; showUser?: boolean }) {
  const water = WATER_LEVELS[post.waterLevel];
  const level = zoneLevel(water.score);
  const reasons = post.spamReasons.filter((r) => r !== 'trusted');
  return (
    <article className="flex gap-4 rounded-2xl bg-white/85 p-4 shadow-sm ring-1 ring-separator">
      <div className="flex min-w-0 grow flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-2.5 py-0.5 text-[13px] font-bold" style={{ color: level.text, background: `${level.color}1F` }}>
            {water.label}
          </span>
          <span className="text-[13px] text-secondary">{post.kind === 'road' ? 'ถนน' : 'พื้นที่'}</span>
          <StatusChip status={post.status} />
          <Link href={`/post/${post.id}`} className="ml-auto text-[13px] font-semibold text-link">
            #{post.id}
          </Link>
        </div>
        <p className="text-[13px] text-secondary">
          {showUser && (
            <>
              <Link href={`/admin?tab=users&user=${post.user.id}`} className="font-semibold text-label hover:underline">
                {post.user.name}
              </Link>
              {post.user.banned && <span className="text-danger"> (ถูกแบน)</span>}
              {' · '}
            </>
          )}
          {timeAgo(post.createdAt)} ({clock(post.createdAt)} น.) ·{' '}
          {post.posterDistanceM == null ? 'ไม่มี GPS' : `ผู้โพสต์อยู่ห่าง ${Math.round(post.posterDistanceM)} ม.`}
        </p>
        {(reasons.length > 0 || post.spamScore !== 0) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="font-semibold">สแปม {post.spamScore}</span>
            {reasons.map((r) => (
              <span key={r} className="rounded-full bg-[#FFF1CC] px-2 py-0.5 text-[#7A5200]">
                {SPAM_REASON_LABELS[r]}
              </span>
            ))}
            {post.spamReasons.includes('trusted') && (
              <span className="rounded-full bg-[#E4F6E9] px-2 py-0.5 text-[#1B7A35]">{SPAM_REASON_LABELS.trusted}</span>
            )}
          </div>
        )}
        {post.flagCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="font-semibold text-danger">รีพอร์ต {post.flagCount}</span>
            {Object.entries(post.flags).map(([r, n]) => (
              <span key={r} className="rounded-full bg-[#FDECEA] px-2 py-0.5 text-danger">
                {FLAG_REASONS[r as keyof typeof FLAG_REASONS]} {n}
              </span>
            ))}
          </div>
        )}
        {post.note && <p className="text-[14px] leading-relaxed whitespace-pre-line">{post.note}</p>}
        <div className="mt-1 flex flex-wrap gap-2">
          {allowedActions(post.status).map((a) => (
            <ActionButton key={a} endpoint={`/api/admin/reports/${post.id}`} action={a} {...ACTION_UI[a]} />
          ))}
        </div>
      </div>
      {post.photoUrl && (
        <a href={post.photoUrl} target="_blank" rel="noopener" className="shrink-0">
          <img src={post.photoUrl} alt="รูปจากผู้รายงาน" className="size-24 rounded-xl object-cover" />
        </a>
      )}
    </article>
  );
}
