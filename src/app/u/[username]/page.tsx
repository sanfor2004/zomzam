import React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getUserByUsername, getOnlineStatus } from '@/lib/models/user';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import SocialButtons from './SocialButtons';
import PublicUserStatus from './PublicUserStatus';
import { Sparkles, MapPin, Calendar, Clock, Heart, Award, Shield, Check, LogIn, Laptop, Globe } from 'lucide-react';

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

  // Authenticate the current viewer
  const cookieStore = await cookies();
  const session = cookieStore.get('ZOMZAM_SESSION')?.value;
  const viewer = session ? verifyToken(session) : null;
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
      
      {/* Navigation Header (Glassmorphic) */}
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

      {/* Main Profile Layout */}
      <main className="flex-grow pt-32 pb-24 px-6 max-w-4xl mx-auto w-full">
        
        {/* Profile Card */}
        <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-8 shadow-apple relative overflow-hidden space-y-8">
          
          {/* Accent Glow Background */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary-500/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>

          {/* Upper Profile Section */}
          <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left justify-between gap-6 pb-6 border-b border-slate-850/60">
            
            <div className="flex flex-col md:flex-row items-center md:items-start gap-5">
              
              {/* Avatar Container */}
              <div className="relative w-28 h-28 rounded-3xl overflow-hidden border-2 border-slate-850 shadow-md bg-slate-900 flex-shrink-0">
                <img
                  src={profileUser.avatar || '/Assets/Img/default-avatar.png'}
                  alt="Profile Avatar"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Name Details */}
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <h1 className="text-2xl font-black tracking-tight text-white">
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
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
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

      </main>

      {/* Footer */}
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
