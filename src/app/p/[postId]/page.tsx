import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/api-auth';
import { getUserById } from '@/lib/models/user';
import { query, queryOne } from '@/lib/db';
import { PublicPageShell } from '@/components/PublicPageShell';
import PostDetail from './PostDetail';

interface PageProps {
  params: Promise<{ postId: string }>;
}

// The permalink is keyed on the opaque 32-char public_id, never the sequential
// numeric id — so /p/1, /p/2, … can't be walked to enumerate or count posts.
const PUBLIC_ID_RE = /^[a-f0-9]{32}$/;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { postId } = await params;
  if (!PUBLIC_ID_RE.test(postId)) return { title: 'Post Not Found | Zomzam' };

  const post = await queryOne<any>(
    `SELECT p.id, p.content_html, u.username, u.first_name, u.last_name
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.public_id = ?`,
    [postId]
  );
  if (!post) return { title: 'Post Not Found | Zomzam' };

  const authorName = [post.first_name, post.last_name].filter(Boolean).join(' ') || post.username;
  const snippet = (post.content_html as string).replace(/<[^>]*>/g, '').slice(0, 150).trim();

  return {
    title: `${authorName} on Zomzam`,
    description: snippet || `A post by ${authorName} on Zomzam`,
    openGraph: {
      title: `${authorName} on Zomzam`,
      description: snippet || `A post by ${authorName} on Zomzam`,
      type: 'article',
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { postId } = await params;
  if (!PUBLIC_ID_RE.test(postId)) return notFound();

  // Anonymous viewers are allowed → null
  const viewer = await getSessionUser();

  const vid = viewer?.id ?? 0;

  // Full viewer user (or null) — drives BOTH the app-shell chrome for signed-in
  // visitors (DashboardShell needs the full user) and the sticky composer avatar
  // / owner-Edit seed. One fetch, reused for both.
  const authedUser = viewer ? await getUserById(viewer.id) : null;
  const normalizedViewer = authedUser
    ? {
        id: authedUser.id as number,
        username: authedUser.username as string,
        first_name: (authedUser.first_name ?? null) as string | null,
        last_name: (authedUser.last_name ?? null) as string | null,
        avatar: (authedUser.avatar as string) || '/Assets/Img/default-avatar.png',
      }
    : null;
  const post = await queryOne<any>(
    `SELECT p.id, p.public_id, p.user_id, p.content_html, p.image_path, p.image_paths, p.created_at, p.visibility,
            p.type, p.skill_tag, p.accepted_answer_id, p.resolved_at, p.repost_of,
            u.username, u.first_name, u.last_name, u.avatar,
            (SELECT COUNT(*) FROM post_likes     WHERE post_id = p.id) AS like_count,
            (SELECT COUNT(*) FROM post_comments  WHERE post_id = p.id) AS comment_count,
            (SELECT COUNT(*) FROM post_likes     WHERE post_id = p.id AND user_id = ?) AS liked_by_me,
            (SELECT COUNT(*) FROM post_bookmarks WHERE post_id = p.id AND user_id = ?) AS bookmarked_by_me,
            (EXISTS(SELECT 1 FROM user_connections WHERE requester_id = ? AND addressee_id = p.user_id AND type = 'follow' AND status = 'accepted')) AS is_following,
            (EXISTS(SELECT 1 FROM user_connections WHERE type = 'friend' AND status = 'accepted' AND ((requester_id = ? AND addressee_id = p.user_id) OR (addressee_id = ? AND requester_id = p.user_id)))) AS is_friend,
            (SELECT COUNT(*) FROM posts r WHERE r.repost_of = p.id) AS repost_count,
            (EXISTS(SELECT 1 FROM posts r WHERE r.repost_of = p.id AND r.user_id = ? AND r.content_html = '' AND r.image_path IS NULL)) AS reposted_by_me
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.public_id = ?`,
    [vid, vid, vid, vid, vid, vid, postId]
  );

  if (!post) return notFound();

  const comments = await query<any>(
    `SELECT c.id, c.post_id, c.parent_id, c.user_id, c.content, c.created_at,
            u.username, u.first_name, u.last_name, u.avatar,
            (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id) AS upvote_count,
            (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND user_id = ?) AS upvoted_by_me
     FROM post_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC
     LIMIT 200`,
    [vid, post.id]
  );

  const normalizedPost = {
    ...post,
    avatar: post.avatar || '/Assets/Img/default-avatar.png',
    like_count: parseInt(post.like_count ?? 0),
    comment_count: parseInt(post.comment_count ?? 0),
    liked_by_me: parseInt(post.liked_by_me ?? 0) > 0,
    bookmarked_by_me: parseInt(post.bookmarked_by_me ?? 0) > 0,
    is_following: parseInt(post.is_following ?? 0) > 0,
    is_friend: parseInt(post.is_friend ?? 0) > 0,
    repost_count: parseInt(post.repost_count ?? 0),
    reposted_by_me: parseInt(post.reposted_by_me ?? 0) > 0,
  };

  const normalizedComments = comments.map((c: any) => ({
    ...c,
    avatar: c.avatar || '/Assets/Img/default-avatar.png',
    upvote_count: parseInt(c.upvote_count ?? 0),
    upvoted_by_me: parseInt(c.upvoted_by_me ?? 0) > 0,
  }));

  return (
    // Signed-in → full app shell (top nav + side rails); anonymous → public chrome.
    <PublicPageShell authedUser={authedUser}>
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: SINGLE POST VIEW
          Contains: Post card, author info, like/comment interactions
          ────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto w-full">
        <PostDetail
          post={normalizedPost}
          initialComments={normalizedComments}
          viewerId={viewer?.id ?? null}
          viewerUser={normalizedViewer}
        />
      </div>
    </PublicPageShell>
  );
}

export const dynamic = 'force-dynamic';
