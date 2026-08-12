'use client';

import { useEffect, useState } from 'react';

/**
 * Google Material 3 Window Size Classes (developer.android.com/develop/ui/views/layout/use-window-size-classes):
 *   compact  — width < 600dp  → Navigation bar (bottom), single column
 *   medium   — 600–839dp      → Navigation rail, 2 columns
 *   expanded — ≥840dp         → Navigation drawer/rail, multi column
 *
 * On desktop dp == CSS px at 100% zoom; on Android WebView the viewport is
 * density-independent so window.innerWidth maps directly to dp.
 */
export type WindowSizeClass = 'compact' | 'medium' | 'expanded';

export function useWindowSizeClass(): WindowSizeClass {
  const [wc, setWc] = useState<WindowSizeClass>('expanded');

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setWc(w < 600 ? 'compact' : w < 840 ? 'medium' : 'expanded');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return wc;
}
