import Link from 'next/link';

const COPY: Record<string, { title: string; body: string }> = {
  approved: { title: 'ขอบคุณ! โพสต์ขึ้นแผนที่แล้ว', body: 'รายงานของคุณช่วยคำนวณจุดเสี่ยงและสีถนนทันที' },
  pending: { title: 'ส่งแล้ว รอแอดมินตรวจ', body: 'ระบบขอให้แอดมินตรวจโพสต์นี้ก่อนขึ้นแผนที่ ดูสถานะได้ที่โพสต์ของฉัน' },
  rejected: { title: 'ระบบไม่รับโพสต์นี้', body: 'โพสต์นี้เข้าเกณฑ์สแปม หากคิดว่าผิดพลาด ติดต่อแอดมิน' },
};

export function ReportDone({ id, status }: { id: number; status: string }) {
  const copy = COPY[status] ?? COPY.pending;
  return (
    <section className="rounded-2xl bg-card p-5 text-center shadow-sm">
      <p className="text-[20px] font-bold">{copy.title}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-secondary">{copy.body}</p>
      <div className="mt-4 flex justify-center gap-4 text-[14px] font-semibold text-link">
        {status === 'approved' && <Link href={`/post/${id}`}>ดูโพสต์</Link>}
        <Link href="/me">โพสต์ของฉัน</Link>
      </div>
    </section>
  );
}
