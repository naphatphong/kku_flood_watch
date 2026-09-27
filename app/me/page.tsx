import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronIcon } from '@/components/ui/icons';
import { PillLink } from '@/components/ui/Pill';
import { getViewer } from '@/lib/auth';
import { WATER_LEVELS, zoneLevel, type WaterLevel } from '@/lib/config';
import type { ReportStatus } from '@/lib/domain/types';
import { timeAgo } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'โพสต์ของฉัน' };

const STATUS: Record<ReportStatus, { label: string; className: string }> = {
  approved: { label: 'ขึ้นแผนที่แล้ว', className: 'bg-[#E4F6E9] text-[#1B7A35]' },
  pending: { label: 'รอแอดมินตรวจ', className: 'bg-[#FFF1CC] text-[#7A5200]' },
  rejected: { label: 'ไม่ผ่าน', className: 'bg-[#FDECEA] text-danger' },
  hidden: { label: 'ถูกซ่อน', className: 'bg-[#FDECEA] text-danger' },
  deleted: { label: 'ถูกลบ', className: 'bg-fill text-secondary' },
};

export default async function MyPostsPage() {
  if (!isSupabaseConfigured) redirect('/login');
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/me');

  const { data: posts } = await (await createClient())
    .from('reports')
    .select('id, kind, water_level, status, created_at, still_votes, receded_votes')
    .eq('user_id', viewer.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 p-4 pb-10">
      <header className="flex items-center gap-2">
        <Link href="/" aria-label="กลับไปที่แผนที่" className="grid size-9 place-items-center rounded-full bg-fill hover:bg-fill-strong">
          <ChevronIcon size={16} className="rotate-180" />
        </Link>
        <h1 className="grow text-[19px] font-bold tracking-tight">โพสต์ของฉัน</h1>
        <PillLink href="/report" className="h-9 px-3.5 text-[14px]">
          โพสต์ใหม่
        </PillLink>
      </header>

      {!posts?.length ? (
        <p className="rounded-3xl bg-white/85 p-6 text-center text-[15px] text-secondary shadow-sm">ยังไม่มีโพสต์</p>
      ) : (
        <ul className="rounded-3xl bg-white/85 px-4 shadow-sm">
          {posts.map((p) => {
            const water = WATER_LEVELS[p.water_level as WaterLevel];
            const status = STATUS[p.status as ReportStatus];
            return (
              <li key={p.id} className="border-b border-separator last:border-0">
                <Link href={`/post/${p.id}`} className="flex items-center gap-3 py-3.5">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: zoneLevel(water.score).color }} />
                  <span className="min-w-0 grow">
                    <span className="block text-[15px] font-semibold">
                      {water.label} · {p.kind === 'road' ? 'ถนน' : 'พื้นที่'}
                    </span>
                    <span className="block text-[13px] text-secondary">
                      {timeAgo(p.created_at)} · ยังท่วม {p.still_votes} · ลดแล้ว {p.receded_votes}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
