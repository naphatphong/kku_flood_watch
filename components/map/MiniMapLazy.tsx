'use client';

import dynamic from 'next/dynamic';

// MapLibre needs the browser; render the map on the client only.
export const MiniMapLazy = dynamic(() => import('./MiniMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-fill" />,
});
