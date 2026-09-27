// Road incident symbols, shared by user posts (map symbol layer) and TomTom incidents (pins):
// a colored disc with a white border and a white glyph drawn on a 24-unit grid.
import type { Map as MapLibreMap } from 'maplibre-gl';
import { INCIDENTS, type IncidentCategory } from '@/lib/config';

export type IconKind = IncidentCategory | 'water';

const GLYPHS: Record<IconKind, string[]> = {
  accident: ['M12 6.5v7', 'M12 17.5h.01'], // "!"
  closure: ['M7 12h10'], // no entry
  obstacle: ['M12 6.5l6 11h-12z'], // warning triangle
  roadworks: ['M12 5.5l5.5 12.5h-11z', 'M8.4 13.5h7.2'], // cone
  water: ['M5 10c2-2 3-2 5 0s3 2 5 0 3-2 4 0', 'M5 15c2-2 3-2 5 0s3 2 5 0 3-2 4 0'],
};
export const iconColor = (kind: IconKind) => (kind === 'water' ? '#0A84FF' : INCIDENTS[kind].color);

/** TomTom iconCategory → our symbol. */
export const tomtomIcon = (category: number): IconKind =>
  category === 7 || category === 8
    ? 'closure'
    : category === 9
      ? 'roadworks'
      : category === 14
        ? 'obstacle'
        : category === 4 || category === 11
          ? 'water'
          : 'accident';

/** White glyph as inline SVG (for HTML pins). */
export const glyphSvg = (kind: IconKind, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[kind]
    .map((d) => `<path d="${d}"/>`)
    .join('')}</svg>`;

/** Registers `incident-<kind>` images on the map (drawn synchronously, so layers can use them at once). */
export function addIncidentIcons(map: MapLibreMap) {
  const px = 56; // 28 CSS px at 2x
  for (const kind of Object.keys(GLYPHS) as IconKind[]) {
    if (map.hasImage(`incident-${kind}`)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const g = canvas.getContext('2d')!;
    g.fillStyle = iconColor(kind);
    g.strokeStyle = '#fff';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(px / 2, px / 2, px / 2 - 3, 0, 2 * Math.PI);
    g.fill();
    g.stroke();
    g.translate(12, 12);
    g.scale(32 / 24, 32 / 24);
    g.lineWidth = 2.4;
    g.lineCap = g.lineJoin = 'round';
    for (const d of GLYPHS[kind]) g.stroke(new Path2D(d));
    map.addImage(`incident-${kind}`, g.getImageData(0, 0, px, px), { pixelRatio: 2 });
  }
}
