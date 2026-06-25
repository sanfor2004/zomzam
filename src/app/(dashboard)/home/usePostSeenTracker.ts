'use client';

import { useCallback, useEffect, useRef } from 'react';

// ──────────────────────────────────────────────────────────
// Chat-style read receipts for the feed.
//
// A post counts as "seen" once its card has dwelled ≥50% visible for ~1s while
// the user scrolls past it — the same intent as a chat read receipt, not a
// fleeting glance. Seen ids are batched and flushed (debounced, on tab-hide,
// and on unmount) to POST /api/posts {action:'mark_seen'}, which upserts a
// post_views row so the unseen-first feed stops surfacing them.
//
// Exposes a single stable `observe(el, postId)` that a PostCard wires to its
// outer node via a ref callback (`ref={el => observe(el, post.id)}`). Passing
// null (React's unmount call) detaches that card cleanly so the
// IntersectionObserver never pins an unmounted node.
// ──────────────────────────────────────────────────────────

const DWELL_MS = 1000;   // how long a card must stay visible to count as seen
const FLUSH_MS = 2000;   // debounce window before a batch is sent
const MAX_BATCH = 50;    // mirrors the server-side cap in markPostsSeen

export function usePostSeenTracker() {
  const pendingRef = useRef<Set<number>>(new Set());   // seen, not yet flushed
  const flushedRef = useRef<Set<number>>(new Set());   // already sent (don't re-fire)
  const elToId = useRef<Map<Element, number>>(new Map());
  const idToEl = useRef<Map<number, Element>>(new Map());
  const dwellTimers = useRef<Map<Element, ReturnType<typeof setTimeout>>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const flush = useCallback(() => {
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    const ids = Array.from(pendingRef.current).slice(0, MAX_BATCH);
    if (ids.length === 0) return;
    ids.forEach((id) => { pendingRef.current.delete(id); flushedRef.current.add(id); });
    // Fire-and-forget; keepalive lets it survive a tab close. On failure, re-queue
    // so the next flush (or unmount) retries them.
    fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ action: 'mark_seen', post_ids: ids }),
    }).catch(() => {
      ids.forEach((id) => { flushedRef.current.delete(id); pendingRef.current.add(id); });
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => { flushTimer.current = null; flush(); }, FLUSH_MS);
  }, [flush]);

  // One observer for the whole feed, created once.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target;
          const id = elToId.current.get(el);
          if (id == null) continue;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Start the dwell timer; if the card leaves first, it's cleared below.
            if (!dwellTimers.current.has(el)) {
              const timer = setTimeout(() => {
                dwellTimers.current.delete(el);
                if (!flushedRef.current.has(id)) {
                  pendingRef.current.add(id);
                  scheduleFlush();
                }
                // This card is settled — stop watching it.
                obs.unobserve(el);
                elToId.current.delete(el);
                idToEl.current.delete(id);
              }, DWELL_MS);
              dwellTimers.current.set(el, timer);
            }
          } else {
            const timer = dwellTimers.current.get(el);
            if (timer) { clearTimeout(timer); dwellTimers.current.delete(el); }
          }
        }
      },
      { threshold: [0, 0.5, 1] }
    );
    observerRef.current = obs;

    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibility);

    // Capture the timer map so the cleanup doesn't read a possibly-changed ref.
    const timers = dwellTimers.current;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      obs.disconnect();
      observerRef.current = null;
      flush(); // don't lose a pending batch on unmount
    };
  }, [flush, scheduleFlush]);

  const observe = useCallback((el: HTMLElement | null, postId: number) => {
    const obs = observerRef.current;
    if (!obs) return;

    // Detach any previous node bound to this post id (handles ref(null) on unmount
    // and node swaps) so the observer never holds a stale element.
    const prev = idToEl.current.get(postId);
    if (prev && prev !== el) {
      obs.unobserve(prev);
      elToId.current.delete(prev);
      idToEl.current.delete(postId);
      const timer = dwellTimers.current.get(prev);
      if (timer) { clearTimeout(timer); dwellTimers.current.delete(prev); }
    }

    if (!el || flushedRef.current.has(postId)) return;
    idToEl.current.set(postId, el);
    elToId.current.set(el, postId);
    obs.observe(el);
  }, []);

  return { observe };
}
