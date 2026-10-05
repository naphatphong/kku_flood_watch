import maplibregl, { type MapOptions } from 'maplibre-gl';

const FALLBACK = `<div style="height:100%;display:grid;place-items:start center;padding:12% 24px 24px;text-align:center;font:14px/1.5 system-ui;color:#6E6E73;background:#F2F2F0">
  <div><b style="color:#1D1D1F">แผนที่เปิดไม่ได้ในเบราว์เซอร์นี้</b><br>ปิดเบราว์เซอร์ทั้งหมดแล้วเปิดใหม่ หรือเปิด &ldquo;ใช้การเร่งฮาร์ดแวร์&rdquo; (hardware acceleration) ในการตั้งค่า</div>
</div>`;

/**
 * A MapLibre map, or null when the browser gives no WebGL (turned off, or blocked after a GPU
 * crash: Chrome's "Web page caused context loss and was blocked"). Then the container shows a
 * note instead and the rest of the page keeps working.
 * Pixel ratio is capped at 2: 3x phones would otherwise use 2.25x the GPU memory for no visible gain.
 */
export function createMap(options: MapOptions & { container: HTMLElement }): maplibregl.Map | null {
  try {
    return new maplibregl.Map({ pixelRatio: Math.min(window.devicePixelRatio || 1, 2), ...options });
  } catch (e) {
    console.error(e);
    options.container.innerHTML = FALLBACK;
    return null;
  }
}

export const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

/** Map padding that keeps fitted content clear of the panel: sidebar on desktop, bottom sheet on mobile. */
export const panelPadding = () =>
  isDesktop() ? { left: 420, right: 70, top: 70, bottom: 70 } : { left: 30, right: 30, top: 70, bottom: window.innerHeight * 0.5 };
