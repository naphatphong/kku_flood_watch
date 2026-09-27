'use client';

// Errors outside any page (router, root layout) land here. It replaces the whole document,
// so it carries its own <html> and inline styles. Shows the message so a screenshot is a bug report.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  console.error(error);
  return (
    <html lang="th">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#F5F3EE', fontFamily: 'system-ui, sans-serif', color: '#1D1D1F', padding: 16 }}>
        <div style={{ maxWidth: 380, width: '100%', background: '#fff', borderRadius: 28, padding: 28, textAlign: 'center', boxShadow: '0 12px 40px rgb(0 0 0 / 0.12)' }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>หน้านี้โหลดไม่สำเร็จ</h1>
          <p style={{ fontSize: 14, color: '#6E6E73' }}>ลองใหม่อีกครั้ง หรือกลับไปหน้าแผนที่</p>
          <a href="/" style={{ display: 'block', padding: '12px 0', borderRadius: 999, background: '#0071E3', color: '#fff', fontWeight: 600, textDecoration: 'none' }}>
            กลับหน้าแผนที่
          </a>
          <p style={{ marginTop: 20, textAlign: 'left', fontFamily: 'monospace', fontSize: 11, color: '#8E8E93', wordBreak: 'break-word' }}>
            {error.digest ? `server error ${error.digest}` : `${error.name}: ${error.message}`}
          </p>
        </div>
      </body>
    </html>
  );
}
