'use client';
import { Button, useToast } from '@/components/ui';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslation } from '@/context/TranslationContext';
import { Users, Search, UserPlus } from 'lucide-react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { socialSuccessToast } from '@/lib/social-actions';

interface SocialUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  bio: string | null;
  tags: string[];
  is_online: boolean;
  is_idle: boolean;
  online_label: string;
  matching_tags_count?: number;
  matching_tags?: string[];
  friend_count?: number;
}

export default function FollowingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();

  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [followers, setFollowers] = useState<SocialUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [loading]);

  const fetchFollowing = async () => {
    setLoading(true);
    try {
      const followRes = await fetch('/api/social?action=following');
      const followerRes = await fetch('/api/social?action=followers');
      const followData = await followRes.json();
      const followerData = await followerRes.json();
      if (followData.success) setFollowing(followData.following || []);
      if (followerData.success) setFollowers(followerData.followers || []);
    } catch (err) {
      console.error('Failed to load connections list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowing();
  }, []);

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);

    if (q.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/social?action=search&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.users || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const executeSocialAction = async (action: string, targetId: number) => {
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: targetId }),
      });
      const data = await res.json();
      if (data.success) {
        const successMsg = socialSuccessToast(action);
        if (successMsg) toast({ variant: 'success', description: successMsg });
        fetchFollowing();
        if (searchQuery.trim().length >= 2) {
          const sRes = await fetch(`/api/social?action=search&q=${encodeURIComponent(searchQuery)}`);
          const sData = await sRes.json();
          if (sData.success) setSearchResults(sData.users || []);
        }
      } else {
        toast({ variant: 'error', description: data.message || 'Action failed' });
      }
    } catch (err) {
      console.error('Action error:', err);
      toast({ variant: 'error', description: 'An error occurred. Please try again.' });
    }
  };

  return (
    <div ref={pageRef} className="max-w-6xl mx-auto space-y-8">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Icon badge, title + subtitle, global user-search autocomplete
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-md shadow-primary-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white">Community Hub</h1>
            <p className="text-xs text-slate-400">Manage your social grid, follows, and live interactions.</p>
          </div>
        </div>

        {/* Global Autocomplete Search Input */}
        <div className="relative w-full sm:w-80">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search users by username..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full h-11 pl-10 pr-4 bg-[#1A1D24] border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all shadow-apple-sm"
          />

          {/* Search Dropdown Panel */}
          {isSearching && searchQuery.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1D24] border border-slate-800 rounded-2xl shadow-glass py-2.5 z-40 max-h-80 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="text-center text-xs text-slate-450 py-6 italic">No users found.</p>
              ) : (
                searchResults.map((usr) => (
                  <div
                    key={usr.id}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-850/50 transition-colors"
                  >
                    <Button variant="unstyled"
                      onClick={() => router.push(`/u/${usr.username}`)}
                      className="flex items-center gap-3 text-left group min-w-0 flex-1"
                    >
                      <Image
                        src={usr.avatar || '/Assets/Img/default-avatar.png'}
                        alt=""
                        width={34}
                        height={34}
                        className="w-8.5 h-8.5 rounded-full object-cover border border-slate-800 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white group-hover:text-primary-500 transition-colors truncate">
                          {usr.username}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {usr.first_name ? `${usr.first_name} ${usr.last_name || ''}` : 'View profile'}
                        </p>
                      </div>
                    </Button>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <Button variant="unstyled"
                        onClick={() => executeSocialAction('friend_request', usr.id)}
                        className="p-1.5 bg-slate-900/40 hover:bg-primary-500/10 text-slate-500 hover:text-primary-500 rounded-xl transition-colors border border-slate-800"
                        title="Add Friend"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: CONTENT — FOLLOWING & FOLLOWERS
          Contains: "People I Follow" list and "Followers" list
          ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="animate-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* People I Follow */}
            <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple min-h-[300px] card-lift">
              <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-6 pb-3 border-b border-slate-850">
                People I Follow ({following.length})
              </h3>
              <div className="space-y-3">
                {following.length === 0 ? (
                  <p className="text-center py-12 text-slate-400 italic text-xs">You are not following anyone.</p>
                ) : (
                  following.map((usr) => (
                    <div
                      key={usr.id}
                      className="flex items-center justify-between p-3 bg-slate-900/10 border border-slate-850/20 rounded-2xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Image src={usr.avatar || '/Assets/Img/default-avatar.png'} alt="" width={34} height={34} className="w-8.5 h-8.5 rounded-full object-cover" />
                        <Button variant="unstyled"
                          onClick={() => router.push(`/u/${usr.username}`)}
                          className="text-xs font-bold text-white hover:underline truncate"
                        >
                          {usr.username}
                        </Button>
                      </div>
                      <Button variant="unstyled"
                        onClick={() => executeSocialAction('unfollow', usr.id)}
                        className="px-2.5 py-1.5 bg-slate-900/40 hover:bg-slate-100 text-slate-500 hover:text-slate-850 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        Unfollow
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Followers */}
            <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple min-h-[300px] card-lift">
              <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-6 pb-3 border-b border-slate-850">
                My Followers ({followers.length})
              </h3>
              <div className="space-y-3">
                {followers.length === 0 ? (
                  <p className="text-center py-12 text-slate-400 italic text-xs">No one is following you yet.</p>
                ) : (
                  followers.map((usr) => (
                    <div
                      key={usr.id}
                      className="flex items-center gap-3 p-3 bg-slate-900/10 border border-slate-850/20 rounded-2xl"
                    >
                      <Image src={usr.avatar || '/Assets/Img/default-avatar.png'} alt="" width={34} height={34} className="w-8.5 h-8.5 rounded-full object-cover" />
                      <Button variant="unstyled"
                        onClick={() => router.push(`/u/${usr.username}`)}
                        className="text-xs font-bold text-white hover:underline truncate"
                      >
                        {usr.username}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
