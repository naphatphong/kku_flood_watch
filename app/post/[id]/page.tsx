import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MiniMapLazy } from '@/components/map/MiniMapLazy';
import { FlagButton } from '@/components/post/FlagButton';
import { ShareButton } from '@/components/post/ShareButton';
import { VoteButtons } from '@/components/post/VoteButtons';
import { ChevronIcon } from '@/components/ui/icons';
import { PassabilityGrid } from '@/components/ui/PassabilityGrid';
import { getViewer } from '@/lib/auth';
import { STATUS_TAGS } from '@/lib/config';
import { getPost } from '@/lib/data/post';
import { postLabel } from '@/lib/domain/post';
import { clock, timeAgo } from '@/lib/format';

type Props = { params: Promise<{ id: string }> };

const STATUS_NOTE: Record<string, string> = {
  pending: 'รอแอดมินตรวจ ยังไม่ขึ้นแผนที่',
  rejected: 'ระบบไม่รับโพสต์นี้',
  hidden: 'ถูกซ่อนจากการรีพอร์ต รอแอดมินตรวจ',
  deleted: 'ถูกลบแล้ว',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(Number((await params).id), null);
  if (!post) return { title: 'ไม่พบโพสต์' };
  const title = `${postLabel(post).label}${post.placeName ? ` · ใกล้ ${post.placeName}` : ''}`;
  const what = post.category === 'flood' ? 'รายงานน้ำท่วม' : 'แจ้งเหตุบนถนน';
  return { title, description: `${what}รอบ มข. เมื่อ ${clock(post.createdAt)} น.` };
}

export default async function PostPage({ params }: Props) {
  const viewer = await getViewer();
  const post = await getPost(Number((await params).id), viewer);
  if (!post) notFound();

  const head = postLabel(post);
  const flood = post.category === 'flood';
  const title = post.placeName
    ? `ใกล้ ${post.placeName}`
    : !flood
      ? 'แจ้งเหตุบนถนน'
      : post.kind === 'road'
        ? 'รายงานสภาพถนน'
        : 'รายงานน้ำท่วม';

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 p-4 pb-10">
      <header className="flex items-center gap-2">
        <Link href="/" aria-label="กลับไปที่แผนที่" className="grid size-9 place-items-center rounded-full bg-fill hover:bg-fill-strong">
          <ChevronIcon size={16} className="rotate-180" />
        </Link>
        <h1 className="min-w-0 grow truncate text-[19px] font-bold tracking-tight">{title}</h1>
        {post.status === 'approved' && <ShareButton title={`${head.label} · ${title}`} />}
      </header>

      <div className="relative h-56 overflow-hidden rounded-3xl shadow-sm">
        <MiniMapLazy lng={post.lng} lat={post.lat} radiusM={post.radiusM} lines={post.roadLines} color={head.color} />
      </div>

      {post.status !== 'approved' && (
        <p className="rounded-2xl bg-[#FFF1CC] px-4 py-3 text-[14px] text-[#7A5200]">{STATUS_NOTE[post.status]}</p>
      )}
      {post.status === 'approved' && !post.active && (
        <p className="rounded-2xl bg-fill px-4 py-3 text-[14px] text-secondary">โพสต์นี้หมดอายุแล้ว ไม่นับในแผนที่</p>
      )}

      <section className="flex flex-col gap-3 rounded-3xl bg-white/85 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full px-3 py-1 text-[15px] font-bold" style={{ color: head.text, background: `${head.color}1F` }}>
            {head.label}
          </span>
          {post.statusTags.map((t) => (
            <span key={t} className="rounded-full bg-fill px-3 py-1 text-[14px]">
              {STATUS_TAGS[t].label}
            </span>
          ))}
        </div>
        <p className="text-[14px] text-secondary">
          {timeAgo(post.createdAt)} · {clock(post.createdAt)} น.
          {post.radiusM ? ` · รัศมี ${post.radiusM} ม.` : ''}
          {post.roadLengthM ? ` · ถนนยาว ${post.roadLengthM} ม.` : ''}
        </p>
        {flood && <PassabilityGrid value={post.passability} />}
        {post.photoUrl && <img src={post.photoUrl} alt="รูปจากผู้รายงาน" className="w-full rounded-2xl object-cover" />}
        {post.note && <p className="text-[15px] leading-relaxed whitespace-pre-line">{post.note}</p>}
      </section>

      {post.status === 'approved' && post.active && (
        <VoteButtons id={post.id} still={post.stillVotes} receded={post.recededVotes} myVote={post.myVote} signedIn={!!viewer} category={post.category} />
      )}
      {viewer && !post.isOwn && post.status === 'approved' && <FlagButton id={post.id} flagged={post.myFlag} />}
    </main>
  );
}
