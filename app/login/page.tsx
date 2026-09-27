import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginButtons } from '@/components/auth/LoginButtons';
import { DropIcon } from '@/components/ui/icons';
import { getViewer } from '@/lib/auth';
import { SITE } from '@/lib/config';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'เข้าสู่ระบบ' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  if (await getViewer()) redirect(next);

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_30%_20%,#E8F1FB,transparent_55%),radial-gradient(circle_at_80%_80%,#EAF7EE,transparent_50%)] p-4">
      <div className="glass w-full max-w-[380px] rounded-[28px] p-7">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-white">
          <DropIcon size={30} />
        </span>
        <h1 className="mt-4 text-center text-[22px] font-bold tracking-tight">เข้าสู่ระบบ {SITE.name}</h1>
        <p className="mt-1.5 text-center text-[14px] leading-relaxed text-secondary">
          ต้องเข้าสู่ระบบเพื่อรายงานน้ำท่วม โหวต และรีพอร์ตโพสต์
          <br />
          ดูแผนที่และนำทางได้โดยไม่ต้องเข้าสู่ระบบ
        </p>
        <div className="mt-6">
          {isSupabaseConfigured ? (
            <LoginButtons next={next} />
          ) : (
            <p className="rounded-2xl bg-[#FFF1CC] p-4 text-[14px] leading-relaxed text-[#7A5200]">
              ยังไม่ได้เชื่อมระบบสมาชิก (Supabase) ตอนนี้เว็บแสดงข้อมูลตัวอย่างอยู่
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-center text-[13px] text-danger">
              เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง
            </p>
          )}
        </div>
        <Link href="/" className="mt-6 block text-center text-[14px] font-semibold text-link">
          กลับไปดูแผนที่
        </Link>
      </div>
    </main>
  );
}
