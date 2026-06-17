// src/lib/gsap.ts
// Single source of truth for GSAP. Importing this module registers every plugin
// exactly once (guarded to the browser), so components never double-register
// across Fast Refresh. Plugins are all free and bundled in the `gsap` package.
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
}

/**
 * Walks up from `el` to find the nearest scrollable ancestor, for use as
 * ScrollTrigger's `scroller`. Returns `undefined` (→ the window, ScrollTrigger's
 * default) when nothing scrolls between `el` and the root. This is required
 * because some shells (e.g. the dashboard layout) scroll content inside a nested
 * `<main overflow-y-auto>` instead of the window — without it, ScrollTrigger
 * listens to a scroller that never moves and entrance reveals never fire.
 */
export function getScrollParent(el: HTMLElement | null): HTMLElement | undefined {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return undefined;
}

export { gsap, useGSAP, ScrollTrigger, SplitText };
