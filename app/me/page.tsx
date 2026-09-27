import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronIcon } from '@/components/ui/icons';
import { PillLink } from '@/components/ui/Pill';
import { StatusChip } from '@/components/ui/StatusChip';
import { getViewer } from '@/lib/auth';
import type { Category, WaterLevel } from '@/lib/config';
import { postLabel, voteLabels } from '@/lib/domain/post';
import type { ReportStatus } from '@/lib/domain/types';
import { timeAgo } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'โพสต์ของฉัน' };


export default async function MyPostsPage() {
  if (!isSupabaseConfigured) redirect('/login');
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/me');

  const { data: posts } = await (await createClient())
    .from('reports')
    .select('id, kind, category, water_level, status, created_at, still_votes, receded_votes')
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
            const category = p.category as Category;
            const head = postLabel({ category, waterLevel: p.water_level as WaterLevel | null });
            const votes = voteLabels(category);
            return (
              <li key={p.id} className="border-b border-separator last:border-0">
                <Link href={`/post/${p.id}`} className="flex items-center gap-3 py-3.5">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: head.color }} />
                  <span className="min-w-0 grow">
                    <span className="block text-[15px] font-semibold">
                      {head.label} · {p.kind === 'road' ? 'ถนน' : 'พื้นที่'}
                    </span>
                    <span className="block text-[13px] text-secondary">
                      {timeAgo(p.created_at)} · {votes.still} {p.still_votes} · {votes.receded} {p.receded_votes}
                    </span>
                  </span>
                  <StatusChip status={p.status as ReportStatus} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
