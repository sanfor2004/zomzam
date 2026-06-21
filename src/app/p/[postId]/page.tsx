import React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { verifyToken } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { LogIn } from 'lucide-react';
import PostDetail from './PostDetail';

interface PageProps {
  params: Promise<{ postId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { postId } = await params;
  const postIdNum = parseInt(postId);
  if (isNaN(postIdNum)) return { title: 'Post Not Found | Zomzam' };

  const post = await queryOne<any>(
    `SELECT p.id, p.content_html, u.username, u.first_name, u.last_name
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`,
    [postIdNum]
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
  const postIdNum = parseInt(postId);
  if (isNaN(postIdNum)) return notFound();

  const cookieStore = await cookies();
  const session = cookieStore.get('ZOMZAM_SESSION')?.value;
  const viewer = session ? verifyToken(session) : null;

  const post = await queryOne<any>(
    `SELECT p.id, p.user_id, p.content_html, p.image_path, p.created_at,
            u.username, u.first_name, u.last_name, u.avatar,
            (SELECT COUNT(*) FROM post_likes    WHERE post_id = p.id) AS like_count,
            (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count,
            (SELECT COUNT(*) FROM post_likes    WHERE post_id = p.id AND user_id = ?) AS liked_by_me
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`,
    [viewer?.id ?? 0, postIdNum]
  );

  if (!post) return notFound();

  const comments = await query<any>(
    `SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at,
            u.username, u.first_name, u.last_name, u.avatar
     FROM post_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC
     LIMIT 200`,
    [postIdNum]
  );

  const normalizedPost = {
    ...post,
    avatar: post.avatar || '/Assets/Img/default-avatar.png',
    like_count: parseInt(post.like_count ?? 0),
    comment_count: parseInt(post.comment_count ?? 0),
    liked_by_me: parseInt(post.liked_by_me ?? 0) > 0,
  };

  const normalizedComments = comments.map((c: any) => ({
    ...c,
    avatar: c.avatar || '/Assets/Img/default-avatar.png',
  }));

  return (
    <div className="min-h-screen bg-[#111318] text-slate-100 flex flex-col font-sans">

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: TOP NAVIGATION HEADER
          Contains: Brand logo, viewer-aware Dashboard / Sign In action
          ────────────────────────────────────────────────────────── */}
      <nav className="fixed w-full top-0 z-50 glass-nav transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-[75px]">
            <Link href="/" className="flex items-center gap-3">
              <img src="/Assets/Img/logo-word-horizontal-white.svg" alt="zomzam" className="h-8" />
            </Link>
            <div className="flex items-center gap-4">
              {viewer ? (
                <Link
                  href="/dashboard"
                  className="text-xs font-bold uppercase tracking-wider text-white bg-primary-500 hover:bg-primary-600 px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-[0.98]"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/sign"
                  className="text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-primary-500 border border-slate-800 hover:border-primary-500/30 px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: SINGLE POST VIEW
          Contains: Post card, author info, like/comment interactions
          ────────────────────────────────────────────────────────── */}
      <main className="flex-grow pt-32 pb-24 px-4 max-w-3xl mx-auto w-full">
        <PostDetail
          post={normalizedPost}
          initialComments={normalizedComments}
          viewerId={viewer?.id ?? null}
        />
      </main>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: FOOTER
          Contains: Brand logo, copyright
          ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 bg-surface-dark/50 backdrop-blur-sm py-12 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/Assets/Img/Icon-white.svg" alt="Zomzam Icon" className="w-6 h-6" />
            <span className="text-white font-semibold text-sm">zomzam.com</span>
          </div>
          <p className="text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} All rights reserved. Built with precision.
          </p>
        </div>
      </footer>
    </div>
  );
}

export const dynamic = 'force-dynamic';
