import Link from 'next/link';
import { UserIcon } from '@/components/ui/icons';
import type { Viewer } from '@/lib/auth';

/** Account button: sign-in link, or a native <details> menu for signed-in users. */
export function UserMenu({ viewer, next = '/' }: { viewer: Viewer | null; next?: string }) {
  if (!viewer)
    return (
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className="shrink-0 rounded-full bg-fill px-3 py-1.5 text-[13px] font-semibold hover:bg-fill-strong"
      >
        เข้าสู่ระบบ
      </Link>
    );

  return (
    <details className="relative shrink-0">
      <summary
        aria-label={`บัญชี ${viewer.displayName}`}
        className="grid size-9 cursor-pointer list-none place-items-center overflow-hidden rounded-full bg-fill [&::-webkit-details-marker]:hidden"
      >
        {viewer.avatarUrl ? (
          // Provider avatar (Google/LINE CDN); plain img avoids remote image config.
          <img src={viewer.avatarUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <UserIcon size={18} />
        )}
      </summary>
      <div className="glass absolute right-0 z-10 mt-2 w-52 rounded-2xl p-1.5 text-[14px]">
        <p className="truncate px-3 py-2 text-[13px] text-secondary">{viewer.displayName}</p>
        <Link href="/me" className="block rounded-xl px-3 py-2 hover:bg-fill">
          โพสต์ของฉัน
        </Link>
        {viewer.isAdmin && (
          <Link href="/admin" className="block rounded-xl px-3 py-2 hover:bg-fill">
            แอดมิน
          </Link>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-danger hover:bg-fill">
            ออกจากระบบ
          </button>
        </form>
      </div>
    </details>
  );
}
