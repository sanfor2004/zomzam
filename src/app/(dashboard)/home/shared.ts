// Shared types + helpers for the home feed, used by both the page (feed/sidebar)
// and the extracted PostComposer. Kept in its own module so PostComposer and
// page.tsx don't import values from each other (which would create a cycle).
import type { PostVisibility } from '@/components/ui';

export interface CurrentUser {
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

export interface Post {
  id: number;
  user_id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  content_html: string;
  image_path?: string | null;
  visibility?: PostVisibility;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  top_comments?: Comment[];
}

export function displayName(u: { first_name: string | null; last_name: string | null; username: string }) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
}
