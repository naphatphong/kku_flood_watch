import type { GridCell } from '@/lib/domain/reg-import';

/**
 * Tables in pasted HTML as rows of cells. DOMParser builds an inert document: no scripts run and
 * nothing loads. Line breaks inside a cell become spaces so "course<br>room" stays two words.
 */
export function htmlTables(html: string): GridCell[][][] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  return [...doc.querySelectorAll('table')].map((t) =>
    [...t.rows].map((r) =>
      [...r.cells].map((c) => ({ text: c.textContent ?? '', span: c.colSpan || 1, rowSpan: c.rowSpan || 1 })),
    ),
  );
}
