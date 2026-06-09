'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { useStreamWaiter } from '@/context/StreamWaiterContext';
import { Users, Search, UserPlus, UserCheck, UserX, Clock, Globe, ArrowRight, ShieldAlert, Sparkles, MessageSquare } from 'lucide-react';

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

export default function CommunityHubPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'friends' | 'discover' | 'requests' | 'following'>('friends');

  // Lists
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<SocialUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<SocialUser[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [followers, setFollowers] = useState<SocialUser[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Loading
  const [loading, setLoading] = useState(true);

  // Load social data
  const fetchTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'friends') {
        const res = await fetch('/api/social?action=friends');
        const data = await res.json();
        if (data.success) setFriends(data.friends || []);
      } else if (activeTab === 'discover') {
        const res = await fetch('/api/social?action=discover');
        const data = await res.json();
        if (data.success) setDiscoverUsers(data.users || []);
      } else if (activeTab === 'requests') {
        const inRes = await fetch('/api/social?action=requests_in');
        const outRes = await fetch('/api/social?action=requests_out');
        const inData = await inRes.json();
        const outData = await outRes.json();
        if (inData.success) setIncomingRequests(inData.requests || []);
        if (outData.success) setOutgoingRequests(outData.requests || []);
      } else if (activeTab === 'following') {
        const followRes = await fetch('/api/social?action=following');
        const followerRes = await fetch('/api/social?action=followers');
        const followData = await followRes.json();
        const followerData = await followerRes.json();
        if (followData.success) setFollowing(followData.following || []);
        if (followerData.success) setFollowers(followerData.followers || []);
      }
    } catch (err) {
      console.error('Failed to load social tab data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabData();
  }, [activeTab]);

  // Autocomplete Search Handler
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

  // Execute social actions
  const executeSocialAction = async (action: string, targetId: number) => {
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: targetId }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh active list or search results
        fetchTabData();
        if (searchQuery.trim().length >= 2) {
          // Re-trigger search
          const sRes = await fetch(`/api/social?action=search&q=${encodeURIComponent(searchQuery)}`);
          const sData = await sRes.json();
          if (sData.success) setSearchResults(sData.users || []);
        }
      } else {
        alert(data.message || 'Action failed');
      }
    } catch (err) {
      console.error('Action error:', err);
    }
  };

  // Helper connection check (returns connection status between user and target)
  const getConnectionStatus = async (targetId: number): Promise<{ status: string; is_following: boolean }> => {
    try {
      const res = await fetch(`/api/social?action=status&user_id=${targetId}`);
      const data = await res.json();
      if (data.success) {
        return { status: data.status, is_following: data.is_following };
      }
    } catch {}
    return { status: 'none', is_following: false };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-md shadow-primary-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Community Hub</h1>
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
            className="w-full h-11 pl-10 pr-4 bg-white dark:bg-[#1A1D24] border border-slate-150 dark:border-slate-800 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all shadow-apple-sm"
          />

          {/* Search Dropdown Panel */}
          {isSearching && searchQuery.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-glass py-2.5 z-40 max-h-80 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="text-center text-xs text-slate-450 py-6 italic">No users found.</p>
              ) : (
                searchResults.map((usr) => (
                  <div
                    key={usr.id}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors"
                  >
                    <button
                      onClick={() => router.push(`/u/${usr.username}`)}
                      className="flex items-center gap-3 text-left group min-w-0 flex-1"
                    >
                      <img
                        src={usr.avatar}
                        alt=""
                        className="w-8.5 h-8.5 rounded-full object-cover border border-slate-200 dark:border-slate-800 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-primary-500 transition-colors truncate">
                          {usr.username}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {usr.first_name ? `${usr.first_name} ${usr.last_name || ''}` : 'View profile'}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <button
                        onClick={() => executeSocialAction('friend_request', usr.id)}
                        className="p-1.5 bg-slate-50 hover:bg-primary-500/10 text-slate-500 hover:text-primary-500 rounded-xl transition-colors border border-slate-100 dark:bg-slate-900/40 dark:border-slate-800"
                        title="Add Friend"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-slate-200/50 dark:border-slate-850 pb-px gap-6">
        {(['friends', 'discover', 'requests', 'following'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'friends' ? 'Friends Grid' : tab === 'discover' ? 'Discover' : tab === 'requests' ? 'Friend Requests' : 'Following';
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-xs font-bold uppercase tracking-widest relative transition-colors ${
                isActive ? 'text-primary-500' : 'text-slate-400 hover:text-slate-650'
              }`}
            >
              {label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="animate-in duration-300">
          
          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {friends.length === 0 ? (
                <div className="col-span-full bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-16 text-center shadow-apple text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-25" />
                  <p className="text-sm font-semibold">Your friend circle is currently empty.</p>
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-xl text-xs font-bold hover:bg-primary-600 transition-colors shadow-sm"
                  >
                    Discover People
                  </button>
                </div>
              ) : (
                friends.map((f) => (
                  <div
                    key={f.id}
                    className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple hover:shadow-apple-lg transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar with Status badge */}
                      <div className="relative flex-shrink-0">
                        <img
                          src={f.avatar}
                          alt={f.username}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-100 dark:border-slate-850"
                        />
                        <span className={`absolute bottom-[-2px] right-[-2px] w-3 h-3 rounded-full border-2 border-white dark:border-[#1A1D24] ${
                          f.is_online
                            ? (f.is_idle ? 'bg-amber-400' : 'bg-green-500 animate-pulse')
                            : 'bg-slate-400'
                        }`} />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => router.push(`/u/${f.username}`)}
                            className="font-bold text-sm text-slate-900 dark:text-white hover:text-primary-500 transition-colors truncate"
                          >
                            {f.username}
                          </button>
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                            {f.online_label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {f.first_name ? `${f.first_name} ${f.last_name || ''}` : 'No bio set'}
                        </p>
                      </div>
                    </div>

                    {/* Tags */}
                    {f.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-4">
                        {f.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900/60 text-[9px] font-bold text-slate-500 border border-slate-150/40 dark:border-slate-800 rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions Footer */}
                    <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-850 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => executeSocialAction('unfriend', f.id)}
                        className="flex-1 py-2 bg-slate-50 dark:bg-slate-900/30 text-rose-500 hover:bg-rose-500/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-transparent hover:border-rose-500/20"
                      >
                        Unfriend
                      </button>
                      <button
                        onClick={() => executeSocialAction('block', f.id)}
                        className="p-2 text-slate-450 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all"
                        title="Block User"
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Discover Tab */}
          {activeTab === 'discover' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {discoverUsers.length === 0 ? (
                <p className="col-span-full text-center py-16 text-slate-400 italic text-sm">No new recommendations found at this time.</p>
              ) : (
                discoverUsers.map((usr) => (
                  <div
                    key={usr.id}
                    className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple hover:shadow-apple-lg transition-all group flex flex-col justify-between"
                  >
                    <div className="flex items-start gap-4">
                      <img
                        src={usr.avatar}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover border border-slate-100 dark:border-slate-850 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => router.push(`/u/${usr.username}`)}
                          className="font-bold text-sm text-slate-900 dark:text-white hover:text-primary-500 transition-colors truncate"
                        >
                          {usr.username}
                        </button>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {usr.friend_count || 0} mutual connections
                        </p>
                      </div>
                    </div>

                    {/* Common Tags Match alert */}
                    {usr.matching_tags && usr.matching_tags.length > 0 ? (
                      <div className="mt-4 p-3 bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/10 dark:border-emerald-900/20 rounded-xl flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                          Matches tags: {usr.matching_tags.join(', ')}
                        </p>
                      </div>
                    ) : (
                      usr.bio && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 line-clamp-2 italic">
                          &quot;{usr.bio}&quot;
                        </p>
                      )
                    )}

                    <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-850">
                      <button
                        onClick={() => executeSocialAction('friend_request', usr.id)}
                        className="flex-grow h-10 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-sm"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Add Friend
                      </button>
                      <button
                        onClick={() => executeSocialAction('follow', usr.id)}
                        className="h-10 px-4 bg-slate-50 dark:bg-slate-900/30 text-slate-700 dark:text-slate-350 hover:bg-slate-100 border border-slate-150/40 dark:border-slate-800 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                      >
                        Follow
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Incoming Requests */}
              <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col justify-between min-h-[300px]">
                <div>
                  <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-6 pb-3 border-b border-slate-100 dark:border-slate-850">
                    Incoming Requests ({incomingRequests.length})
                  </h3>
                  <div className="space-y-3">
                    {incomingRequests.length === 0 ? (
                      <p className="text-center py-12 text-slate-400 italic text-xs">No pending incoming requests.</p>
                    ) : (
                      incomingRequests.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100/30 dark:border-slate-850/20 rounded-2xl"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={r.avatar} alt="" className="w-9 h-9 rounded-xl object-cover" />
                            <div className="min-w-0">
                              <button
                                onClick={() => router.push(`/u/${r.username}`)}
                                className="text-xs font-bold text-slate-900 dark:text-white hover:underline truncate"
                              >
                                {r.username}
                              </button>
                              <span className="block text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Friend request received</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <button
                              onClick={() => executeSocialAction('friend_accept', r.id)}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => executeSocialAction('friend_decline', r.id)}
                              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900/65 text-slate-500 hover:text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-slate-150/40 dark:border-slate-800"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Outgoing Requests */}
              <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col justify-between min-h-[300px]">
                <div>
                  <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-6 pb-3 border-b border-slate-100 dark:border-slate-850">
                    Outgoing Requests ({outgoingRequests.length})
                  </h3>
                  <div className="space-y-3">
                    {outgoingRequests.length === 0 ? (
                      <p className="text-center py-12 text-slate-400 italic text-xs">No pending outgoing requests.</p>
                    ) : (
                      outgoingRequests.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100/30 dark:border-slate-850/20 rounded-2xl"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={r.avatar} alt="" className="w-9 h-9 rounded-xl object-cover" />
                            <div className="min-w-0">
                              <button
                                onClick={() => router.push(`/u/${r.username}`)}
                                className="text-xs font-bold text-slate-900 dark:text-white hover:underline truncate"
                              >
                                {r.username}
                              </button>
                              <span className="block text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Waiting for acceptance</span>
                            </div>
                          </div>

                          <button
                            onClick={() => executeSocialAction('friend_cancel', r.id)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 border border-slate-150/40 dark:bg-slate-900/40 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Following / Followers Tab */}
          {activeTab === 'following' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* People I Follow */}
              <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple min-h-[300px]">
                <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-6 pb-3 border-b border-slate-100 dark:border-slate-850">
                  People I Follow ({following.length})
                </h3>
                <div className="space-y-3">
                  {following.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 italic text-xs">You are not following anyone.</p>
                  ) : (
                    following.map((usr) => (
                      <div
                        key={usr.id}
                        className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100/30 dark:border-slate-850/20 rounded-2xl"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={usr.avatar} alt="" className="w-8.5 h-8.5 rounded-full object-cover" />
                          <button
                            onClick={() => router.push(`/u/${usr.username}`)}
                            className="text-xs font-bold text-slate-905 dark:text-white hover:underline truncate"
                          >
                            {usr.username}
                          </button>
                        </div>
                        <button
                          onClick={() => executeSocialAction('unfollow', usr.id)}
                          className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 dark:bg-slate-900/40 dark:border-slate-800 border border-slate-150/40 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          Unfollow
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Followers */}
              <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple min-h-[300px]">
                <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-6 pb-3 border-b border-slate-100 dark:border-slate-850">
                  My Followers ({followers.length})
                </h3>
                <div className="space-y-3">
                  {followers.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 italic text-xs">No one is following you yet.</p>
                  ) : (
                    followers.map((usr) => (
                      <div
                        key={usr.id}
                        className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100/30 dark:border-slate-850/20 rounded-2xl"
                      >
                        <img src={usr.avatar} alt="" className="w-8.5 h-8.5 rounded-full object-cover" />
                        <button
                          onClick={() => router.push(`/u/${usr.username}`)}
                          className="text-xs font-bold text-slate-905 dark:text-white hover:underline truncate"
                        >
                          {usr.username}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
export const dynamic = 'force-dynamic';
