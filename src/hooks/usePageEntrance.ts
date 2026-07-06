// src/hooks/usePageEntrance.ts
import { type RefObject } from 'react';
import { gsap, useGSAP, SplitText, ScrollTrigger, getScrollParent } from '@/lib/gsap';

/**
 * Standard page entrance animation. Attach to any page by:
 *   1. Adding `ref={pageRef}` to the root element
 *   2. Adding `data-entrance="title"` to the page's <h1> or <h2>
 *   3. Adding `data-entrance="card"` to card/section wrapper divs
 *   4. Adding `data-entrance="list-item"` to list row elements
 *   5. Calling `usePageEntrance(pageRef, [loading])` in the component body
 */
export function usePageEntrance(
  pageRef: RefObject<HTMLElement | null>,
  deps: readonly unknown[] = [],
) {
  useGSAP(() => {
    const root = pageRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const scroller = getScrollParent(root) ?? undefined;

      // ── Title reveal (SplitText chars slide up from mask) ──────────────
      const titleEl = root.querySelector<HTMLElement>('[data-entrance="title"]');
      if (titleEl) {
        const split = SplitText.create(titleEl, {
          type: 'chars,words',
          mask: 'chars',
          aria: 'auto',
        });
        gsap.from(split.chars, {
          yPercent: 110,
          duration: 0.45,
          stagger: { amount: 0.4, from: 'start' },
          ease: 'back.out(1.3)',
        });
      }

      // ── Card reveals (ScrollTrigger.batch — spring from center) ────────
      const cards = gsap.utils.toArray<HTMLElement>('[data-entrance="card"]', root);
      if (cards.length) {
        gsap.set(cards, { autoAlpha: 0, y: 24 });
        ScrollTrigger.batch(cards, {
          scroller,
          start: 'top 92%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              autoAlpha: 1,
              y: 0,
              duration: 0.55,
              ease: 'back.out(1.3)',
              stagger: { amount: 0.35, from: 'center' },
              overwrite: true,
              // Transform lingers inline after the tween completes, and any
              // non-"none" transform creates a new stacking context — that
              // traps z-indexed overlays (dropdowns, popovers) nested inside
              // the card, making them render under later siblings. Clear it
              // once settled so cards return to normal stacking.
              clearProps: 'transform',
            }),
        });
      }

      // ── List-item reveals (slide from left) ────────────────────────────
      const listItems = gsap.utils.toArray<HTMLElement>('[data-entrance="list-item"]', root);
      if (listItems.length) {
        gsap.set(listItems, { autoAlpha: 0, x: -12 });
        ScrollTrigger.batch(listItems, {
          scroller,
          start: 'top 94%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              autoAlpha: 1,
              x: 0,
              duration: 0.38,
              ease: 'power2.out',
              stagger: { amount: 0.3, from: 'start' },
              overwrite: true,
              // See the card batch above — clears the lingering stacking
              // context so nested dropdowns/popovers aren't trapped under it.
              clearProps: 'transform',
            }),
        });
      }
    });
  }, { scope: pageRef, dependencies: [...deps] });
}
