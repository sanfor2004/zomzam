// Shared types + helpers for the home feed, used by both the page (feed/sidebar)
// and the extracted PostComposer. Kept in its own module so PostComposer and
// page.tsx don't import values from each other (which would create a cycle).
import type { PostVisibility } from '@/components/ui';

export interface CurrentUser {
  id?: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
}

export interface MentionUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  is_online?: boolean;
  online_label?: string;
  bio?: string | null;
}

export interface Comment {
  id: number;
  post_id: number;
  parent_id: number | null;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  content: string;
  created_at: string;
  upvote_count: number;
  upvoted_by_me: boolean;
  replies?: Comment[];
}

export type PostType = 'status' | 'ask' | 'win';

export interface Post {
  id: number;
  // Opaque MD5 identifier used in the public /p/ permalink (hides the sequential
  // numeric id). Internal mutations still key on the numeric `id`.
  public_id: string;
  user_id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  content_html: string;
  // First attached image (back-compat). `image_paths` is the full ordered list of
  // up to 3 images; readers should prefer it and fall back to [image_path].
  image_path?: string | null;
  image_paths?: string[] | null;
  visibility?: PostVisibility;
  // Favor economy (ask/win). Absent on legacy rows → treated as 'status'.
  type?: PostType;
  skill_tag?: string | null;
  accepted_answer_id?: number | null;
  resolved_at?: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  top_comments?: Comment[];
  // ── Engagement (follow / repost / bookmark) ──────────────────
  // Private bookmark state for the viewer (drives the Bookmark icon fill).
  bookmarked_by_me?: boolean;
  // Repost pointer model: when this row IS a repost, repost_of carries the live
  // original (or null when the original was deleted → tombstone). repost_count is
  // how many times the post has been reposted; reposted_by_me is the viewer's
  // plain-repost toggle state.
  repost_of?: Post | null;
  repost_count?: number;
  reposted_by_me?: boolean;
  // Twitter-style boost attribution. When present, THIS card is an original post
  // surfaced into the feed because one or more users plain-reposted it (a plain
  // repost never renders as its own empty card — only quote reposts do). The card
  // shows a "<name> [and N others] reposted" label; like/comment/bookmark target
  // this original. Built by the feed's collapse pass, never stored. `users` is
  // capped (first few reposters) for the label; `total` is the full count.
  reposted_by?: { users: { username: string; first_name: string | null; last_name: string | null }[]; total: number };
  // Plain-repost pointer ids this card absorbed during collapse — marked seen
  // alongside this post's id so a boosted original stops re-surfacing once viewed.
  repost_seen_ids?: number[];
  // Server-computed viewer↔author relationship (drives the Follow button).
  is_following?: boolean;
  is_friend?: boolean;
  // Reserved presentational flag — not yet populated by the API. When true the
  // card renders a verified check beside the author name (Instagram-style).
  is_verified?: boolean;
}

export function displayName(u: { first_name: string | null; last_name: string | null; username: string }) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
}

export function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
