// ──────────────────────────────────────────────────────────
// Home feed — client-side data services.
//
// Thin fetch wrappers over the existing /api/* routes (no DB, no React). The
// page/hook owns loading + error STATE; these own the call + response SHAPE so
// they're unit-testable without a render harness. Server-side domain logic
// stays in src/lib/services/posts/** — this only consumes its JSON.
// ──────────────────────────────────────────────────────────
import type { CurrentUser, MentionUser, Post } from './shared';

export type FeedFilter = 'all' | 'help' | 'help_matches';
export type FeedTier = 'unseen' | 'seen';

export interface FeedPage {
  posts: Post[];
  next_cursor: number | null;
  has_more: boolean;
}

// Non-blocking: the feed renders for anonymous viewers too, so a failed auth
// check just yields null rather than throwing.
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const res = await fetch('/api/auth?action=check');
    const data = await res.json();
    if (data.success && data.authenticated) return data.user as CurrentUser;
  } catch { /* non-blocking */ }
  return null;
}

// Friends power the composer's @mention autocomplete; absence is non-fatal.
export async function fetchFriends(): Promise<MentionUser[]> {
  try {
    const res = await fetch('/api/social?action=friends');
    const data = await res.json();
    if (data.success) return (data.friends || []) as MentionUser[];
  } catch { /* non-blocking */ }
  return [];
}

// Builds the ?action=feed query — cursor only when paginating, filter only when
// narrowed — and returns one page. Throws on a non-ok payload so the caller's
// state machine bails without advancing the cursor/tier.
export async function fetchFeedPage(opts: { tier: FeedTier; cursor: number | null; filter: FeedFilter }): Promise<FeedPage> {
  const params = new URLSearchParams({ action: 'feed', tier: opts.tier });
  if (opts.cursor) params.set('cursor', String(opts.cursor));
  if (opts.filter !== 'all') params.set('filter', opts.filter);

  const res = await fetch(`/api/posts?${params.toString()}`);
  const data = await res.json();
  if (!data.success) throw new Error('feed fetch failed');
  return {
    posts: data.posts as Post[],
    next_cursor: data.next_cursor ?? null,
    has_more: !!data.has_more,
  };
}

// The new-posts pill: pulls the freshest unseen page (always tier=unseen) to
// merge onto the top of the feed. Throws on a non-ok payload.
export async function fetchUnseenPosts(filter: FeedFilter): Promise<Post[]> {
  const params = new URLSearchParams({ action: 'feed', tier: 'unseen' });
  if (filter !== 'all') params.set('filter', filter);

  const res = await fetch(`/api/posts?${params.toString()}`);
  const data = await res.json();
  if (!data.success) throw new Error('unseen fetch failed');
  return data.posts as Post[];
}
