'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { Users, Search, UserPlus } from 'lucide-react';

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

export default function RequestsPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [incomingRequests, setIncomingRequests] = useState<SocialUser[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<SocialUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const inRes = await fetch('/api/social?action=requests_in');
      const outRes = await fetch('/api/social?action=requests_out');
      const inData = await inRes.json();
      const outData = await outRes.json();
      if (inData.success) setIncomingRequests(inData.requests || []);
      if (outData.success) setOutgoingRequests(outData.requests || []);
    } catch (err) {
      console.error('Failed to load requests list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
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
        fetchRequests();
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
            <h1 className="text-2xl font-black tracking-tight text-white">Community Hub</h1>
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
                    <button
                      onClick={() => router.push(`/u/${usr.username}`)}
                      className="flex items-center gap-3 text-left group min-w-0 flex-1"
                    >
                      <img
                        src={usr.avatar}
                        alt=""
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
                    </button>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <button
                        onClick={() => executeSocialAction('friend_request', usr.id)}
                        className="p-1.5 bg-slate-900/40 hover:bg-primary-500/10 text-slate-500 hover:text-primary-500 rounded-xl transition-colors border border-slate-800"
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

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: CONTENT — FRIEND REQUESTS
          Contains: Incoming requests (accept/decline) and outgoing requests (cancel)
          ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="animate-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Incoming Requests */}
            <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col justify-between min-h-[300px]">
              <div>
                <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-6 pb-3 border-b border-slate-850">
                  Incoming Requests ({incomingRequests.length})
                </h3>
                <div className="space-y-3">
                  {incomingRequests.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 italic text-xs">No pending incoming requests.</p>
                  ) : (
                    incomingRequests.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-3.5 bg-slate-900/10 border border-slate-850/20 rounded-2xl"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={r.avatar} alt="" className="w-9 h-9 rounded-xl object-cover" />
                          <div className="min-w-0">
                            <button
                              onClick={() => router.push(`/u/${r.username}`)}
                              className="text-xs font-bold text-white hover:underline truncate"
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
                            className="px-3 py-1.5 bg-slate-900/65 text-slate-500 hover:text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-slate-800"
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
            <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col justify-between min-h-[300px]">
              <div>
                <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest mb-6 pb-3 border-b border-slate-850">
                  Outgoing Requests ({outgoingRequests.length})
                </h3>
                <div className="space-y-3">
                  {outgoingRequests.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 italic text-xs">No pending outgoing requests.</p>
                  ) : (
                    outgoingRequests.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-3.5 bg-slate-900/10 border border-slate-850/20 rounded-2xl"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={r.avatar} alt="" className="w-9 h-9 rounded-xl object-cover" />
                          <div className="min-w-0">
                            <button
                              onClick={() => router.push(`/u/${r.username}`)}
                              className="text-xs font-bold text-white hover:underline truncate"
                            >
                              {r.username}
                            </button>
                            <span className="block text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Waiting for acceptance</span>
                          </div>
                        </div>

                        <button
                          onClick={() => executeSocialAction('friend_cancel', r.id)}
                          className="px-3 py-1.5 bg-slate-900/40 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
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
        </div>
      )}
    </div>
  );
}
