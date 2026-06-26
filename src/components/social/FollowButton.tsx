'use client';

import React, { useState } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: FOLLOW BUTTON (shared)
// Used on the feed/saved PostCard and the public post-detail page. Optimistic
// toggle: Follow → Following (click again unfollows). On the public pages an
// anonymous viewer (viewerId == null) is routed to onRequireSignIn instead of
// hitting the API. Undo > hide — the button never vanishes after following.
// ──────────────────────────────────────────────────────────
export function FollowButton({
  targetUserId,
  initialIsFollowing,
  viewerId,
  onRequireSignIn,
  size = 'sm',
}: {
  targetUserId: number;
  initialIsFollowing: boolean;
  /** null ⇒ anonymous viewer (public page) → onRequireSignIn instead of the API. */
  viewerId: number | null;
  onRequireSignIn?: () => void;
  size?: 'sm' | 'md';
}) {
  const [following, setFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (viewerId == null) { onRequireSignIn?.(); return; }
    const next = !following;
    setFollowing(next); // optimistic
    setLoading(true);
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: next ? 'follow' : 'unfollow', user_id: targetUserId }),
      });
      const data = await res.json();
      if (!data.success) setFollowing(!next); // revert on server rejection
    } catch {
      setFollowing(!next);
    } finally {
      setLoading(false);
    }
  };

  const pad = size === 'md' ? 'px-3.5 py-1.5 text-xs' : 'px-2.5 py-1 text-[11px]';
  const Icon = loading ? Loader2 : following ? UserCheck : UserPlus;

  return (
    <Button
      variant="unstyled"
      onClick={toggle}
      aria-label={following ? 'Unfollow' : 'Follow'}
      aria-pressed={following}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-bold transition-colors border',
        pad,
        following
          ? 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20'
          : 'bg-primary-500/10 border-primary-500/30 text-primary-400 hover:bg-primary-500/20',
      )}
    >
      <Icon className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
