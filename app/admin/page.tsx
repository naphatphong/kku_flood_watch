import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ActionButton } from '@/components/admin/ActionButton';
import { PostCard } from '@/components/admin/PostCard';
import { ChevronIcon, SearchIcon, UserIcon } from '@/components/ui/icons';
import { getViewer } from '@/lib/auth';
import { getFlaggedQueue, getLogs, getQueueCounts, getReviewQueue, getUserHistory, getUsers, type AdminUser } from '@/lib/data/admin';
import { clock, timeAgo } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'แอดมิน', robots: { index: false } };

type Props = { searchParams: Promise<{ tab?: string; user?: string; q?: string }> };

const ACTION_LABELS: Record<string, string> = {
  approve: 'อนุมัติโพสต์',
  reject: 'ปฏิเสธโพสต์',
  delete: 'ลบโพสต์',
  restore: 'คืนสถานะโพสต์',
  ban: 'แบนผู้ใช้',
  unban: 'ปลดแบนผู้ใช้',
};

const COUNT_LABELS = [
  ['approved', 'อนุมัติ'],
  ['pending', 'รอตรวจ'],
  ['rejected', 'ไม่ผ่าน'],
  ['hidden', 'ถูกซ่อน'],
  ['deleted', 'ลบ'],
] as const;

function Empty({ children }: { children: string }) {
  return <p className="rounded-2xl bg-white/70 p-6 text-center text-[14px] text-secondary ring-1 ring-separator">{children}</p>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="px-1 text-[13px] font-semibold text-secondary">{title}</h2>
      {children}
    </section>
  );
}

function UserSummary({ user, link }: { user: AdminUser; link: boolean }) {
  const c = user.counts;
  const name = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-fill">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <UserIcon size={18} />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold">
          {user.name}
          {user.role === 'admin' && <span className="ml-1.5 text-[12px] font-semibold text-link">แอดมิน</span>}
          {user.banned && <span className="ml-1.5 text-[12px] font-semibold text-danger">ถูกแบน</span>}
        </span>
        <span className="block text-[12px] text-secondary">
          สมัคร {timeAgo(user.createdAt)} ·{' '}
          {COUNT_LABELS.filter(([k]) => c[k])
            .map(([k, label]) => `${label} ${c[k]}`)
            .join(' · ') || 'ยังไม่มีโพสต์'}
        </span>
      </span>
    </span>
  );
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/85 p-3.5 shadow-sm ring-1 ring-separator">
      {link ? (
        <Link href={`/admin?tab=users&user=${user.id}`} className="min-w-0 grow">
          {name}
        </Link>
      ) : (
        <span className="min-w-0 grow">{name}</span>
      )}
      {user.role !== 'admin' &&
        (user.banned ? (
          <ActionButton endpoint={`/api/admin/users/${user.id}`} action="unban" label="ปลดแบน" />
        ) : (
          <ActionButton endpoint={`/api/admin/users/${user.id}`} action="ban" label="แบน" tone="danger" confirm="ยืนยันแบน" />
        ))}
    </div>
  );
}

/** /admin (PLAN §7, §10): review queue, flagged posts, users and the action log. Admins only. */
export default async function AdminPage({ searchParams }: Props) {
  if (!isSupabaseConfigured) redirect('/login');
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/admin');
  if (!viewer.isAdmin) notFound();

  const { tab = 'review', user: userId, q } = await searchParams;
  const counts = await getQueueCounts();
  const tabs = [
    { id: 'review', label: 'รออนุมัติ', badge: counts.pending },
    { id: 'flagged', label: 'ถูกรีพอร์ต', badge: counts.hidden },
    { id: 'users', label: 'ผู้ใช้' },
    { id: 'log', label: 'ประวัติ' },
  ];

  let body: ReactNode;
  if (tab === 'flagged') {
    const posts = await getFlaggedQueue();
    body = posts.length ? posts.map((p) => <PostCard key={p.id} post={p} />) : <Empty>ไม่มีโพสต์ถูกรีพอร์ต</Empty>;
  } else if (tab === 'users' && userId) {
    const history = /^[0-9a-f-]{36}$/i.test(userId) ? await getUserHistory(userId) : null;
    if (!history) notFound();
    body = (
      <>
        <Link href="/admin?tab=users" className="px-1 text-[14px] font-semibold text-link">
          ‹ ผู้ใช้ทั้งหมด
        </Link>
        <UserSummary user={history.user} link={false} />
        <Section title={`ประวัติโพสต์ (${history.posts.length})`}>
          {history.posts.length ? (
            history.posts.map((p) => <PostCard key={p.id} post={p} showUser={false} />)
          ) : (
            <Empty>ยังไม่มีโพสต์</Empty>
          )}
        </Section>
      </>
    );
  } else if (tab === 'users') {
    const users = await getUsers(q?.trim() || null);
    body = (
      <>
        <form className="flex h-11 items-center gap-2 rounded-xl bg-white/85 px-3 ring-1 ring-separator focus-within:ring-2 focus-within:ring-accent">
          <input type="hidden" name="tab" value="users" />
          <SearchIcon size={16} className="text-tertiary" />
          <input name="q" defaultValue={q} placeholder="ค้นหาชื่อผู้ใช้" className="h-full grow bg-transparent text-[15px] outline-none" />
        </form>
        {users.length ? users.map((u) => <UserSummary key={u.id} user={u} link />) : <Empty>ไม่พบผู้ใช้</Empty>}
      </>
    );
  } else if (tab === 'log') {
    const logs = await getLogs();
    body = logs.length ? (
      <ol className="rounded-2xl bg-white/85 px-4 shadow-sm ring-1 ring-separator">
        {logs.map((l) => (
          <li key={l.id} className="flex items-baseline gap-3 border-b border-separator py-3 text-[14px] last:border-0">
            <span className="grow">
              <span className="font-semibold">{l.admin}</span> {ACTION_LABELS[l.action] ?? l.action}{' '}
              {l.targetType === 'report' ? (
                <Link href={`/post/${l.targetId}`} className="text-link">
                  #{l.targetId}
                </Link>
              ) : (
                <Link href={`/admin?tab=users&user=${l.targetId}`} className="text-link">
                  ดูผู้ใช้
                </Link>
              )}
              {l.note && <span className="block text-[13px] text-secondary">{l.note}</span>}
            </span>
            <span className="shrink-0 text-[12px] text-secondary">
              {timeAgo(l.createdAt)} · {clock(l.createdAt)}
            </span>
          </li>
        ))}
      </ol>
    ) : (
      <Empty>ยังไม่มีการจัดการ</Empty>
    );
  } else {
    const { pending, rejected } = await getReviewQueue();
    body = (
      <>
        <Section title={`รอตรวจ (${pending.length}) · เก่าสุดก่อน`}>
          {pending.length ? pending.map((p) => <PostCard key={p.id} post={p} />) : <Empty>ไม่มีโพสต์รอตรวจ</Empty>}
        </Section>
        {rejected.length > 0 && (
          <Section title="ถูกปฏิเสธใน 7 วันที่ผ่านมา · ตรวจว่าระบบปฏิเสธผิดไหม">
            {rejected.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </Section>
        )}
      </>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4 pb-12">
      <header className="flex items-center gap-2">
        <Link href="/" aria-label="กลับไปที่แผนที่" className="grid size-9 shrink-0 place-items-center rounded-full bg-fill hover:bg-fill-strong">
          <ChevronIcon size={16} className="rotate-180" />
        </Link>
        <h1 className="grow text-[19px] font-bold tracking-tight">แอดมิน</h1>
        <span className="text-[13px] text-secondary">{viewer.displayName}</span>
      </header>
      <nav aria-label="หมวด" className="flex shrink-0 rounded-[10px] bg-fill p-0.5">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[14px] transition-colors aria-[current=page]:bg-white aria-[current=page]:font-semibold aria-[current=page]:shadow-sm"
          >
            {t.label}
            {!!t.badge && <span className="rounded-full bg-danger px-1.5 text-[11px] leading-[18px] font-bold text-white">{t.badge}</span>}
          </Link>
        ))}
      </nav>
      {body}
    </main>
  );
}
