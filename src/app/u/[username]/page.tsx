import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getUserByUsername, getOnlineStatus } from '@/lib/models/user';
import { getSessionUser } from '@/lib/api-auth';
import { query } from '@/lib/db';
import SocialButtons from './SocialButtons';
import PublicUserStatus from './PublicUserStatus';
import ProfileAnimationKit from './ProfileAnimationKit';
import { Sparkles, MapPin, Calendar, Clock, Heart, Award, Shield, Check, LogIn, Laptop, Globe, MessageCircle, Users, Lock, Repeat2 } from 'lucide-react';

interface PageProps {
  params: Promise<{ username: string }>;
}

// Generate Dynamic SEO Metadata for search engines
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await getUserByUsername(username);

  if (!user) {
    return {
      title: 'User Not Found | Zomzam',
      description: 'The requested user profile does not exist.',
    };
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  return {
    title: `${fullName} (@${user.username}) | Zomzam Profile`,
    description: user.bio || `${fullName}'s public developer workspace on Zomzam.`,
  };
}

interface ConnectionRow {
  requester_id: number;
  addressee_id: number;
  type: string;
  status: string;
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const profileUser = await getUserByUsername(username);

  if (!profileUser) {
    return notFound();
  }

  const profileUserId = profileUser.id as number;

  // Fetch online status metrics
  const onlineStatus = await getOnlineStatus(profileUserId);

  // Authenticate the current viewer (anonymous viewers are allowed → null)
  const viewer = await getSessionUser();
  const viewerId = viewer ? viewer.id : null;

  // Query friendship and follow relations if viewer is authenticated
  let initialStatus = 'none';
  let initialIsFollowing = false;

  if (viewerId && viewerId !== profileUserId) {
    const connectionRows = await query<ConnectionRow>(
      `SELECT requester_id, addressee_id, type, status 
       FROM user_connections 
       WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)) 
       ORDER BY type ASC, created_at DESC`,
      [viewerId, profileUserId, profileUserId, viewerId]
    );

    for (const row of connectionRows) {
      if (row.status === 'blocked') {
        initialStatus = row.requester_id === viewerId ? 'blocked_by_me' : 'blocked_by_them';
        break;
      }
      if (row.type === 'friend') {
        if (row.status === 'accepted') {
          initialStatus = 'friends';
          break;
        }
        if (row.status === 'pending') {
          initialStatus = row.requester_id === viewerId ? 'friend_pending_out' : 'friend_pending_in';
        }
      }
      if (row.type === 'follow' && row.status === 'accepted' && row.requester_id === viewerId) {
        initialIsFollowing = true;
      }
    }
  }

  // Viewer may see private (friends/exclusive) posts only on their own profile
  // or when they're an accepted friend; otherwise just public ones.
  const canSeePrivate = viewerId === profileUserId || initialStatus === 'friends';

  // ── This user's posts + reposts (visibility-aware) ──────────
  // A PLAIN repost (empty pointer: no text, no image) renders Twitter-style — as
  // the ORIGINAL post with a "reposted" label, linking to the original, showing
  // the ORIGINAL's numbers. Quote reposts and normal posts render as themselves.
  type ProfilePost = {
    id: number;            // the post the card links to (original for a plain repost)
    content_html: string;  // what to preview (original's text for a plain repost)
    visibility: string;
    created_at: string;
    like_count: number;
    comment_count: number;
    reposted: boolean;     // show the "reposted" attribution line
  };
  let posts: ProfilePost[] = [];
  try {
    const rows = await query<any>(
      `SELECT p.id, p.content_html, p.image_path, p.visibility, p.created_at, p.repost_of,
              (SELECT COUNT(*) FROM post_likes    WHERE post_id = p.id) AS like_count,
              (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count,
              orig.id AS orig_id, orig.content_html AS orig_content_html, orig.visibility AS orig_visibility,
              (SELECT COUNT(*) FROM post_likes    WHERE post_id = orig.id) AS orig_like_count,
              (SELECT COUNT(*) FROM post_comments WHERE post_id = orig.id) AS orig_comment_count
       FROM posts p
       LEFT JOIN posts orig ON orig.id = p.repost_of
       WHERE p.user_id = ? AND (p.visibility = 'public' OR ? = 1)
       ORDER BY p.created_at DESC
       LIMIT 20`,
      [profileUserId, canSeePrivate ? 1 : 0]
    );
    posts = rows
      .map((p): ProfilePost | null => {
        const isPlainRepost = p.repost_of != null && !(p.content_html || '').trim() && !p.image_path;
        if (isPlainRepost) {
          // Original gone ⇒ drop the dangling pointer (no tombstone on a profile).
          if (!p.orig_id) return null;
          return {
            id: Number(p.orig_id),
            content_html: p.orig_content_html,
            visibility: p.orig_visibility || 'public', // reposts are public-only
            created_at: p.created_at,
            like_count: parseInt(p.orig_like_count || 0),
            comment_count: parseInt(p.orig_comment_count || 0),
            reposted: true,
          };
        }
        return {
          id: Number(p.id),
          content_html: p.content_html,
          visibility: p.visibility,
          created_at: p.created_at,
          like_count: parseInt(p.like_count || 0),
          comment_count: parseInt(p.comment_count || 0),
          reposted: false,
        };
      })
      .filter((p): p is ProfilePost => p !== null);
  } catch { /* posts table may not exist yet */ }

  // ── Mutual friends (viewer ∩ profile) ───────────────────────
  let mutualFriends: Array<{ id: number; username: string; first_name: string | null; last_name: string | null; avatar: string | null }> = [];
  let mutualCount = 0;
  if (viewerId && viewerId !== profileUserId) {
    // Inlined (viewerId/profileUserId are integers from the session/DB — no
    // injection surface) to keep the self-referencing subquery readable.
    const friendsOf = (id: number) =>
      `SELECT IF(requester_id = ${id}, addressee_id, requester_id) FROM user_connections
         WHERE (requester_id = ${id} OR addressee_id = ${id}) AND type = 'friend' AND status = 'accepted'`;
    const mutualWhere = `u.id IN (${friendsOf(viewerId)}) AND u.id IN (${friendsOf(profileUserId)})`;
    try {
      const countRow = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM users u WHERE ${mutualWhere}`);
      mutualCount = countRow[0] ? Number(countRow[0].c) : 0;
      if (mutualCount > 0) {
        mutualFriends = await query<any>(
          `SELECT u.id, u.username, u.first_name, u.last_name, u.avatar
           FROM users u WHERE ${mutualWhere} ORDER BY u.username ASC LIMIT 8`
        );
      }
    } catch { /* non-blocking */ }
  }

  // Parse tags JSON safely
  let tags: string[] = [];
  if (profileUser.tags) {
    try {
      tags = typeof profileUser.tags === 'string'
        ? JSON.parse(profileUser.tags)
        : profileUser.tags;
    } catch {}
  }

  const fullName = [profileUser.first_name, profileUser.last_name].filter(Boolean).join(' ') || null;

  return (
    <div className="min-h-screen bg-[#111318] text-slate-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: TOP NAVIGATION HEADER
          Contains: Brand logo, viewer-aware Dashboard / Sign In action
          ────────────────────────────────────────────────────────── */}
      <nav className="fixed w-full top-0 z-50 glass-nav transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-[75px]">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <img src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam" className="h-8 hidden" />
              <img src="/Assets/Img/logo-word-horizontal-white.svg" alt="zomzam" className="h-8 block" />
            </Link>

            {/* Right Action Menu */}
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
          DEVELOPMENT NAVIGATOR: PUBLIC PROFILE CARD
          Contains: Avatar + name/role/meta header, online status, biography,
          interest tags, social interaction buttons (friend/follow)
          ────────────────────────────────────────────────────────── */}
      <main className="flex-grow pt-32 pb-24 px-6 max-w-4xl mx-auto w-full">
        <ProfileAnimationKit>

        {/* Profile Card */}
        <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-8 shadow-apple relative overflow-hidden space-y-8">
          
          {/* Accent Glow Background */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary-500/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>

          {/* Upper Profile Section */}
          <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left justify-between gap-6 pb-6 border-b border-slate-850/60">
            
            <div className="flex flex-col md:flex-row items-center md:items-start gap-5">
              
              {/* Avatar Container */}
              <div className="relative w-28 h-28 rounded-3xl overflow-hidden border-2 border-slate-850 shadow-md bg-slate-900 flex-shrink-0">
                <Image
                  src={profileUser.avatar || '/Assets/Img/default-avatar.png'}
                  alt="Profile Avatar"
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>

              {/* Name Details */}
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white">
                    {fullName || profileUser.username}
                  </h1>
                  <span className="px-2.5 py-0.5 bg-slate-800 text-slate-400 font-bold rounded-full text-[9px] uppercase tracking-wider">
                    {profileUser.role}
                  </span>
                </div>
                <p className="text-sm text-primary-500 font-bold">
                  @{profileUser.username}
                </p>
                
                {/* Meta details */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 text-xs text-slate-400 font-semibold pt-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{profileUser.timezone || 'UTC'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Joined {new Date(profileUser.created_at!).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Online Status Label */}
            <div className="flex-shrink-0">
              <PublicUserStatus userId={profileUserId} initialStatus={onlineStatus} />
            </div>

          </div>

          {/* Biography */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Biography
            </h3>
            {profileUser.bio ? (
              <p className="text-sm text-slate-350 leading-relaxed whitespace-pre-wrap">
                {profileUser.bio}
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">
                This developer hasn&apos;t added a biography yet.
              </p>
            )}
          </div>

          {/* Interests Tags */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Interests & Focus tags
            </h3>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    data-entrance="list-item"
                    className="px-3 py-1 bg-slate-900 border border-slate-800/80 text-slate-350 font-bold text-xs rounded-xl transition-colors hover:border-primary-500/30"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">
                No tags added yet.
              </p>
            )}
          </div>

          {/* Mutual Friends */}
          {viewerId && viewerId !== profileUserId && mutualCount > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}
              </h3>
              <div className="flex flex-wrap items-center gap-2.5">
                {mutualFriends.map((f) => (
                  <Link
                    key={f.id}
                    href={`/u/${f.username}`}
                    data-entrance="list-item"
                    className="flex items-center gap-2 bg-slate-900 border border-slate-800/80 rounded-xl pl-1.5 pr-3 py-1.5 hover:border-primary-500/30 transition-colors group"
                  >
                    <Image
                      src={f.avatar || '/Assets/Img/default-avatar.png'}
                      alt=""
                      width={28}
                      height={28}
                      className="w-7 h-7 rounded-lg object-cover border border-slate-800"
                    />
                    <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                      {[f.first_name, f.last_name].filter(Boolean).join(' ') || f.username}
                    </span>
                  </Link>
                ))}
                {mutualCount > mutualFriends.length && (
                  <span className="text-xs font-semibold text-slate-500">
                    +{mutualCount - mutualFriends.length} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Social Interactions */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-850/60">
            {viewerId === profileUserId ? (
              <div className="w-full flex items-center justify-between text-xs font-bold text-slate-400">
                <span>This is your public developer profile.</span>
                <Link
                  href="/me"
                  className="text-primary-500 hover:text-primary-600 uppercase tracking-wider font-black"
                >
                  Edit Profile
                </Link>
              </div>
            ) : (
              <>
                <div className="text-xs text-slate-400 font-semibold text-center sm:text-left">
                  {viewerId ? (
                    <span>Connect with @{profileUser.username} to collaborate.</span>
                  ) : (
                    <span>Sign in to follow or add @{profileUser.username} as a friend.</span>
                  )}
                </div>
                <SocialButtons
                  targetUserId={profileUserId}
                  initialStatus={initialStatus}
                  initialIsFollowing={initialIsFollowing}
                  viewerId={viewerId}
                />
              </>
            )}
          </div>

        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: PROFILE POSTS
            Contains: this user's posts (public always; private only to friends/self)
            ────────────────────────────────────────────────────────── */}
        <div data-entrance="card" className="mt-6 bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-8 shadow-apple space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Posts{posts.length > 0 ? ` · ${posts.length}` : ''}
            </h3>
          </div>

          {posts.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              {canSeePrivate
                ? `@${profileUser.username} hasn't posted anything yet.`
                : `No public posts from @${profileUser.username} yet.`}
            </p>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => {
                const Aud = p.visibility === 'public' ? Globe : p.visibility === 'exclusive' ? Lock : Users;
                const audLabel = p.visibility === 'public' ? 'Public' : p.visibility === 'exclusive' ? 'Exclusive' : 'Friends';
                return (
                  <Link
                    key={`${p.reposted ? 'r' : 'p'}${p.id}`}
                    href={`/p/${p.id}`}
                    data-entrance="list-item"
                    className="block bg-[#111318] border border-slate-800/60 rounded-2xl p-4 hover:border-primary-500/30 transition-colors"
                  >
                    {p.reposted && (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-2">
                        <Repeat2 className="w-3.5 h-3.5" />
                        <span>{fullName || profileUser.username} reposted</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 mb-2">
                      <span>{new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="inline-flex items-center" title={audLabel} aria-label={`Audience: ${audLabel}`}>
                        <Aud className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div
                      className="text-sm text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]"
                      dangerouslySetInnerHTML={{ __html: p.content_html }}
                    />
                    <div className="flex items-center gap-4 mt-3 text-xs font-semibold text-slate-500">
                      <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {p.like_count}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {p.comment_count}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        </ProfileAnimationKit>
      </main>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: FOOTER
          Contains: Brand logo + name, copyright line
          ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 bg-surface-dark/50 backdrop-blur-sm py-12 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/Assets/Img/Icon-orange.svg" alt="Zomzam Icon" className="w-6 h-6 hidden" />
            <img src="/Assets/Img/Icon-white.svg" alt="Zomzam Icon" className="w-6 h-6 block" />
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
