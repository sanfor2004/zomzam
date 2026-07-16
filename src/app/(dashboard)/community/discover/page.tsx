'use client';
import { Button, ListGroup, Spinner, useToast } from '@/components/ui';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, Sparkles, UserPlus } from 'lucide-react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { cn } from '@/lib/utils';
import { socialSuccessToast, emitSocialUpdate } from '@/lib/social-actions';

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

const fullName = (u: SocialUser) =>
  (u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username);

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: SUGGESTION ROW
// Contacts-app row: circular avatar + live status dot, name + a single
// contextual line (matching tags, then bio, then mutual count), trailing
// primary Connect pill. One clear call to action per row (HIG: hierarchy).
// ──────────────────────────────────────────────────────────
function SuggestionRow({
  user, onProfile, onConnect,
}: {
  user: SocialUser;
  onProfile: () => void;
  onConnect: () => void;
}) {
  const secondaryLine = user.matching_tags && user.matching_tags.length > 0
    ? { icon: true, text: `Matches: ${user.matching_tags.join(', ')}` }
    : user.bio
      ? { icon: false, text: `“${user.bio}”` }
      : { icon: false, text: `${user.friend_count || 0} mutual connections` };

  return (
    <div
      data-entrance="list-item"
      className="flex items-center gap-3 px-2.5 sm:px-3 py-2.5 min-h-[64px] hover:bg-white/[0.03] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
    >
      <button onClick={onProfile} className="flex items-center gap-3 min-w-0 flex-1 text-left group">
        <div className="relative flex-shrink-0">
          <Image
            src={user.avatar || '/Assets/Img/default-avatar.png'}
            alt={fullName(user)}
            width={44}
            height={44}
            className="w-11 h-11 rounded-full object-cover border border-slate-800"
          />
          {user.is_online && (
            <span className={cn(
              'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1A1D24]',
              user.is_idle ? 'bg-amber-400' : 'bg-green-500 dot-pulse',
            )} />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-slate-100 truncate group-hover:text-white transition-colors">
            {fullName(user)}
          </p>
          <p className={cn('text-[13px] truncate flex items-center gap-1', secondaryLine.icon ? 'text-emerald-400' : 'text-slate-400')}>
            {secondaryLine.icon && <Sparkles className="w-3 h-3 flex-shrink-0" />}
            <span className="truncate">{secondaryLine.text}</span>
          </p>
        </div>
      </button>

      <Button
        variant="unstyled"
        onClick={onConnect}
        className="flex-shrink-0 h-9 px-4 flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-full text-[13px] font-semibold transition-colors active:scale-95 shadow-apple-sm"
      >
        <UserPlus className="w-3.5 h-3.5" />
        Connect
      </Button>
    </div>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [discoverUsers, setDiscoverUsers] = useState<SocialUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [loading]);

  // `silent` skips the spinner — live re-syncs must never blank the list.
  const fetchDiscover = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/social?action=discover');
      const data = await res.json();
      if (data.success) setDiscoverUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load discover list:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscover();
  }, [fetchDiscover]);

  // Live: a social-graph change (someone connected with me, a request landed)
  // re-syncs the recommendations so already-related people drop out.
  useEffect(() => {
    const onSocial = () => { fetchDiscover(true); };
    window.addEventListener('zz-social-update', onSocial);
    return () => window.removeEventListener('zz-social-update', onSocial);
  }, [fetchDiscover]);

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
        // Echo locally — updates the Active-now rail and suggestion cards in
        // the shell immediately (see emitSocialUpdate).
        emitSocialUpdate(action, targetId);
        fetchDiscover(true);
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

  const total = discoverUsers.length;
  const subtitle = total === 0
    ? 'No new recommendations right now.'
    : `${total} suggested ${total === 1 ? 'person' : 'people'}`;

  return (
    <div ref={pageRef} className="max-w-2xl mx-auto pb-20">

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: LARGE-TITLE HEADER
          Contains: page title, live count subtitle
          ────────────────────────────────────────────────────────── */}
      <header className="mb-6">
        <h1 data-entrance="title" className="text-[28px] sm:text-4xl font-bold tracking-tight text-white leading-tight">
          Discover
        </h1>
        <p className="text-sm text-slate-400 mt-1.5">{subtitle}</p>
      </header>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: SEARCH FIELD
          Contains: username autocomplete input + results popover (Connect action)
          ────────────────────────────────────────────────────────── */}
      <div className="relative mb-8">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder="Search people by username…"
          aria-label="Search people to connect with"
          value={searchQuery}
          onChange={handleSearchChange}
          aria-label="Search people"
          className="w-full h-11 pl-10 pr-4 surface-card border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all shadow-apple-sm"
        />

        {/* Results popover — hairline-divided rows, circular Connect button */}
        {isSearching && searchQuery.trim().length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-2 surface-card border border-slate-800 rounded-2xl shadow-glass divide-y divide-slate-800/60 z-40 max-h-80 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="text-center text-sm text-slate-450 py-6 italic">No people found.</p>
            ) : (
              searchResults.map((usr) => (
                <div
                  key={usr.id}
                  className="min-h-[56px] flex items-center justify-between gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors"
                >
                  <button
                    onClick={() => router.push(`/u/${usr.username}`)}
                    className="flex items-center gap-3 text-left group min-w-0 flex-1"
                  >
                    <Image
                      src={usr.avatar || '/Assets/Img/default-avatar.png'}
                      alt=""
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-full object-cover border border-slate-800 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-white group-hover:text-primary-500 transition-colors truncate">
                        {fullName(usr)}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">@{usr.username}</p>
                    </div>
                  </button>

                  <Button
                    variant="unstyled"
                    onClick={() => executeSocialAction('friend_request', usr.id)}
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-primary-500/10 hover:bg-primary-500/20 text-primary-500 rounded-full transition-colors active:scale-95"
                    title="Connect"
                    aria-label={`Connect with ${usr.username}`}
                  >
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: CONTENT — SUGGESTED PEOPLE
          Contains: presence-aware suggestion list with the Connect action
          ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Spinner size="lg" />
        </div>
      ) : total === 0 ? (
        <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-2xl p-12 sm:p-16 text-center shadow-apple">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <p className="text-[15px] font-semibold text-slate-200">No recommendations yet</p>
          <p className="text-sm text-slate-500 mt-1">Check back soon, or search for people by username above.</p>
        </div>
      ) : (
        <ListGroup title="Suggested for you" count={total}>
          {discoverUsers.map((usr) => (
            <SuggestionRow
              key={usr.id}
              user={usr}
              onProfile={() => router.push(`/u/${usr.username}`)}
              onConnect={() => executeSocialAction('friend_request', usr.id)}
            />
          ))}
        </ListGroup>
      )}
    </div>
  );
}
