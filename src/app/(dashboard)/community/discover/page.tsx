'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { Users, Search, UserPlus, Sparkles } from 'lucide-react';

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

export default function DiscoverPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [discoverUsers, setDiscoverUsers] = useState<SocialUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDiscover = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/social?action=discover');
      const data = await res.json();
      if (data.success) setDiscoverUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load discover list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscover();
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
        fetchDiscover();
        if (searchQuery.trim().length >= 2) {
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

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="animate-in duration-300">
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
        </div>
      )}
    </div>
  );
}
