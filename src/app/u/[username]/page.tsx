import React, { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getUserByUsername, getUserById } from '@/lib/models/user';
import { getSessionUser } from '@/lib/api-auth';
import { query } from '@/lib/db';
import SocialButtons from './SocialButtons';
import ProfileAnimationKit from './ProfileAnimationKit';
import { PublicPageShell } from '@/components/PublicPageShell';
import { Calendar, Clock, Heart, Globe, MessageCircle, Users, Lock, Repeat2, Pencil } from 'lucide-react';

interface PageProps {
  params: Promise<{ username: string }>;
}

// Request-scoped dedupe: generateMetadata and the page body both need the
// profile row — cache() collapses them into ONE query per request.
const getProfileUser = cache(getUserByUsername);

// Generate Dynamic SEO Metadata for search engines
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await getProfileUser(username);

  if (!user) {
    return {
      title: 'User Not Found | Zomzam',
      description: 'The requested user profile does not exist.',
    };
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  const title = `${fullName} (@${user.username}) | Zomzam Profile`;
  const description = user.bio || `${fullName}'s public developer workspace on Zomzam.`;
  const url = `/u/${user.username}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'profile',
      title,
      description,
      url,
      images: [{ url: user.avatar || '/Assets/Img/default-avatar.png' }],
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
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
  const profileUser = await getProfileUser(username);

  if (!profileUser) {
    return notFound();
  }

  const profileUserId = profileUser.id as number;

  // Authenticate the current viewer (anonymous viewers are allowed → null).
  const viewer = await getSessionUser();
  const viewerId = viewer ? viewer.id : null;

  // Resolve the connect status if the viewer is authenticated (pending-out
  // already implies "following" — the follow edge rides the connect request).
  let initialStatus = 'none';

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
    public_id: string;     // opaque id the permalink is keyed on (original's for a plain repost)
    content_html: string;  // what to preview (original's text for a plain repost)
    visibility: string;
    created_at: string;
    like_count: number;
    comment_count: number;
    reposted: boolean;     // show the "reposted" attribution line
  };
  type PostRow = {
    id: number; public_id: string; content_html: string | null; image_path: string | null;
    visibility: string; created_at: string; repost_of: number | null;
    like_count: number | string | null; comment_count: number | string | null;
    orig_id: number | null; orig_public_id: string | null; orig_content_html: string | null;
    orig_visibility: string | null; orig_like_count: number | string | null; orig_comment_count: number | string | null;
  };
  const loadPosts = async (): Promise<ProfilePost[]> => {
    try {
      const rows = await query<PostRow>(
        `SELECT p.id, p.public_id, p.content_html, p.image_path, p.visibility, p.created_at, p.repost_of,
                (SELECT COUNT(*) FROM post_likes    WHERE post_id = p.id) AS like_count,
                (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count,
                orig.id AS orig_id, orig.public_id AS orig_public_id, orig.content_html AS orig_content_html, orig.visibility AS orig_visibility,
                (SELECT COUNT(*) FROM post_likes    WHERE post_id = orig.id) AS orig_like_count,
                (SELECT COUNT(*) FROM post_comments WHERE post_id = orig.id) AS orig_comment_count
         FROM posts p
         LEFT JOIN posts orig ON orig.id = p.repost_of
         WHERE p.user_id = ? AND (p.visibility = 'public' OR ? = 1)
         ORDER BY p.created_at DESC
         LIMIT 20`,
        [profileUserId, canSeePrivate ? 1 : 0]
      );
      return rows
        .map((p): ProfilePost | null => {
          const isPlainRepost = p.repost_of != null && !(p.content_html || '').trim() && !p.image_path;
          if (isPlainRepost) {
            // Original gone ⇒ drop the dangling pointer (no tombstone on a profile).
            if (!p.orig_id) return null;
            return {
              id: Number(p.orig_id),
              public_id: p.orig_public_id || '',
              content_html: p.orig_content_html || '',
              visibility: p.orig_visibility || 'public', // reposts are public-only
              created_at: p.created_at,
              like_count: Number(p.orig_like_count || 0),
              comment_count: Number(p.orig_comment_count || 0),
              reposted: true,
            };
          }
          return {
            id: Number(p.id),
            public_id: p.public_id,
            content_html: p.content_html || '',
            visibility: p.visibility,
            created_at: p.created_at,
            like_count: Number(p.like_count || 0),
            comment_count: Number(p.comment_count || 0),
            reposted: false,
          };
        })
        .filter((p): p is ProfilePost => p !== null);
    } catch { /* posts table may not exist yet */ return []; }
  };

  // ── Mutual friends (viewer ∩ profile) ───────────────────────
  type MutualFriend = { id: number; username: string; first_name: string | null; last_name: string | null; avatar: string | null };
  const loadMutuals = async (): Promise<{ count: number; friends: MutualFriend[] }> => {
    if (!viewerId || viewerId === profileUserId) return { count: 0, friends: [] };
    // Inlined (viewerId/profileUserId are integers from the session/DB — no
    // injection surface) to keep the self-referencing subquery readable.
    const friendsOf = (id: number) =>
      `SELECT IF(requester_id = ${id}, addressee_id, requester_id) FROM user_connections
         WHERE (requester_id = ${id} OR addressee_id = ${id}) AND type = 'friend' AND status = 'accepted'`;
    const mutualWhere = `u.id IN (${friendsOf(viewerId)}) AND u.id IN (${friendsOf(profileUserId)})`;
    try {
      const countRow = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM users u WHERE ${mutualWhere}`);
      const count = countRow[0] ? Number(countRow[0].c) : 0;
      if (count === 0) return { count: 0, friends: [] };
      const friends = await query<MutualFriend>(
        `SELECT u.id, u.username, u.first_name, u.last_name, u.avatar
         FROM users u WHERE ${mutualWhere} ORDER BY u.username ASC LIMIT 8`
      );
      return { count, friends };
    } catch { /* non-blocking */ return { count: 0, friends: [] }; }
  };

  // Posts, mutuals, and the full authed-viewer (for the app-shell chrome) don't
  // depend on each other — run the remote reads concurrently.
  const [posts, { count: mutualCount, friends: mutualFriends }, authedUser] = await Promise.all([
    loadPosts(),
    loadMutuals(),
    viewer ? getUserById(viewer.id) : Promise.resolve(null),
  ]);

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
  const isOwnProfile = viewerId === profileUserId;
  const isBlocked = initialStatus.startsWith('blocked');

  // Calm, sentence-case section label — the iOS grouped-list rhythm shared with
  // Settings / Connections (hierarchy via weight + spacing, not shouty caps).
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-[13px] font-semibold tracking-tight text-slate-400 px-1 mb-2">{children}</h2>
  );

  return (
    // Signed-in → full app shell (top nav + side rails); anonymous → public chrome.
    <PublicPageShell authedUser={authedUser}>
      <div className="max-w-2xl mx-auto w-full">
        <ProfileAnimationKit>

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: PROFILE HERO
              Contains: gradient banner, overlapping circular avatar, name +
              @handle + role, meta (timezone · joined), primary action
              ────────────────────────────────────────────────────────── */}
          <div data-entrance="card" className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-apple-lg">
            {/* Ambient banner — a soft Zomzam-orange wash, not a loud cover photo */}
            <div aria-hidden className="h-24 sm:h-28 w-full bg-gradient-to-br from-primary-500/25 via-primary-500/[0.08] to-transparent" />
            <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

            <div className="px-5 sm:px-8 pb-6">
              {/* Avatar overlaps the banner (Apple/native profile header) */}
              <div className="flex items-end gap-4 -mt-12 sm:-mt-14">
                <Image
                  src={profileUser.avatar || '/Assets/Img/default-avatar.png'}
                  alt={`${fullName || profileUser.username}'s avatar`}
                  width={112}
                  height={112}
                  priority
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-[#15171d] shadow-xl bg-slate-900 flex-shrink-0"
                />
                {/* Primary action sits on the banner edge, aligned to the avatar */}
                <div className="flex-1 flex justify-end pb-1">
                  {isOwnProfile ? (
                    <Link
                      href="/me"
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-sm font-semibold text-slate-200 active:scale-95 transition-all"
                    >
                      <Pencil className="w-4 h-4" /> Edit profile
                    </Link>
                  ) : !isBlocked ? (
                    <SocialButtons targetUserId={profileUserId} initialStatus={initialStatus} viewerId={viewerId} />
                  ) : null}
                </div>
              </div>

              {/* Identity */}
              <div className="mt-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 data-entrance="title" className="text-2xl sm:text-[28px] font-bold tracking-tight text-white leading-tight">
                    {fullName || profileUser.username}
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    {profileUser.role}
                  </span>
                </div>
                <p className="text-sm text-primary-400 font-semibold mt-0.5">@{profileUser.username}</p>

                {/* Meta */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> {profileUser.timezone || 'UTC'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Joined {new Date(profileUser.created_at!).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {/* Contextual connect hint (anonymous / blocked only) */}
                {!isOwnProfile && (isBlocked || !viewerId) && (
                  <p className="mt-3 text-[13px] text-slate-500">
                    {isBlocked ? 'Connections are unavailable for this profile.' : `Sign in to connect with @${profileUser.username}.`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── About ── */}
          {profileUser.bio && (
            <section data-entrance="card" className="mt-5">
              <SectionLabel>About</SectionLabel>
              <div className="surface-card rounded-2xl border border-slate-800/60 shadow-apple p-5">
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{profileUser.bio}</p>
              </div>
            </section>
          )}

          {/* ── Interests ── */}
          {tags.length > 0 && (
            <section data-entrance="card" className="mt-5">
              <SectionLabel>Interests</SectionLabel>
              <div className="surface-card rounded-2xl border border-slate-800/60 shadow-apple p-5">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      data-entrance="list-item"
                      className="px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.06] text-xs font-medium text-slate-300 hover:border-primary-500/30 transition-colors"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Mutual friends ── */}
          {viewerId && !isOwnProfile && mutualCount > 0 && (
            <section data-entrance="card" className="mt-5">
              <SectionLabel>{mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}</SectionLabel>
              <div className="surface-card rounded-2xl border border-slate-800/60 shadow-apple p-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  {mutualFriends.map((f) => (
                    <Link
                      key={f.id}
                      href={`/u/${f.username}`}
                      data-entrance="list-item"
                      className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-full pl-1.5 pr-3 py-1 hover:border-primary-500/30 hover:bg-white/[0.07] transition-colors group"
                    >
                      <Image
                        src={f.avatar || '/Assets/Img/default-avatar.png'}
                        alt=""
                        width={26}
                        height={26}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                        {[f.first_name, f.last_name].filter(Boolean).join(' ') || f.username}
                      </span>
                    </Link>
                  ))}
                  {mutualCount > mutualFriends.length && (
                    <span className="text-xs font-semibold text-slate-500">+{mutualCount - mutualFriends.length} more</span>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: PROFILE POSTS
              Contains: this user's posts (public always; private only to friends/self)
              ────────────────────────────────────────────────────────── */}
          <section data-entrance="card" className="mt-5 pb-4">
            <div className="flex items-center justify-between px-1 mb-2">
              <SectionLabel>{isOwnProfile ? 'Your posts' : 'Posts'}</SectionLabel>
              {posts.length > 0 && (
                <span className="text-[11px] font-bold tabular-nums text-slate-500">{posts.length}</span>
              )}
            </div>

            {posts.length === 0 ? (
              <div className="surface-card rounded-2xl border border-slate-800/60 shadow-apple p-10 text-center">
                <MessageCircle className="w-8 h-8 mx-auto mb-2.5 text-slate-700" />
                <p className="text-sm font-semibold text-slate-300">
                  {canSeePrivate ? 'No posts yet' : 'No public posts yet'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isOwnProfile ? 'Share something from your feed.' : `@${profileUser.username} hasn’t posted here yet.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => {
                  const Aud = p.visibility === 'public' ? Globe : p.visibility === 'exclusive' ? Lock : Users;
                  const audLabel = p.visibility === 'public' ? 'Public' : p.visibility === 'exclusive' ? 'Exclusive' : 'Friends';
                  return (
                    <Link
                      key={`${p.reposted ? 'r' : 'p'}${p.id}`}
                      href={`/p/${p.public_id}`}
                      data-entrance="list-item"
                      className="block rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.12] transition-colors p-4 card-lift"
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
                        className="text-sm text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere] line-clamp-4"
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
          </section>

        </ProfileAnimationKit>
      </div>
    </PublicPageShell>
  );
}
export const dynamic = 'force-dynamic';
