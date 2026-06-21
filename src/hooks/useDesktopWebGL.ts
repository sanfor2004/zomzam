// src/hooks/useDesktopWebGL.ts
import { useEffect, useState } from 'react';

/**
 * Gate for expensive WebGL surfaces (three.js shaders). Returns `true` only when
 * BOTH conditions hold:
 *   1. The device is a real desktop pointer — `(min-width: 1024px) and
 *      (pointer: fine)`. Phones and touch tablets (incl. iPad in landscape, which
 *      reports `pointer: coarse`) never match, so the 177 KB three.js chunk is
 *      never even downloaded there — it's the single biggest mobile-TBT lever.
 *   2. The browser has gone idle after first paint (`requestIdleCallback`), so the
 *      one-time shader compilation / GPU buffer allocation never competes with the
 *      initial content render or the GSAP entrance timeline.
 *
 * Returns `false` during SSR and the first client render (matching the static
 * fallback the markup paints), then flips to `true` on desktop once idle — no
 * hydration mismatch, no layout shift (cards have fixed min-heights). Re-evaluates
 * on viewport/pointer change so a desktop window dragged below the breakpoint
 * tears the shader down.
 */
export function useDesktopWebGL(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (pointer: fine)');

    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const enableWhenIdle = () => {
      if (typeof w.requestIdleCallback === 'function') {
        idleId = w.requestIdleCallback(() => setReady(true), { timeout: 1500 });
      } else {
        timeoutId = setTimeout(() => setReady(true), 1000);
      }
    };

    const cancelPending = () => {
      if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      idleId = undefined;
      timeoutId = undefined;
    };

    // Only desktops ever schedule the shader; phones/tablets stay on the fallback.
    if (mq.matches) enableWhenIdle();

    const onChange = (e: MediaQueryListEvent) => {
      cancelPending();
      if (e.matches) enableWhenIdle();
      else setReady(false);
    };

    mq.addEventListener('change', onChange);
    return () => {
      cancelPending();
      mq.removeEventListener('change', onChange);
    };
  }, []);

  return ready;
}
