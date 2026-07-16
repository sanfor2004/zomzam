'use client';
import { Button, ListGroup, Spinner, useToast } from '@/components/ui';
import { DropdownMenu } from '@/components/ui/Dropdown';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Users, Search, UserPlus, ShieldAlert, UserX, MoreHorizontal, UserRound } from 'lucide-react';
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

// ── Presence model: three buckets ranked online → away → offline, mirroring the
//    right-rail's "Active now" ordering so the whole app reads presence the same. ──
type Bucket = 'online' | 'away' | 'offline';
const RANK: Record<Bucket, number> = { online: 0, away: 1, offline: 2 };
const DOT: Record<Bucket, string> = {
  online: 'bg-green-500 dot-pulse',
  away: 'bg-amber-400',
  offline: 'bg-slate-400',
};

const bucketOf = (u: SocialUser): Bucket => (u.is_online ? (u.is_idle ? 'away' : 'online') : 'offline');
const fullName = (u: SocialUser) =>
  (u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username);

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: MENU ROW (context-menu item)
// One action inside a row's ••• menu. Destructive items go rose; the standard
// item stays neutral. Rendered as bespoke markup (not the Kit DropdownItem)
// because cn() is plain clsx — it can't reliably override DropdownItem's fixed
// text colour, and these rows need a true destructive tint.
// ──────────────────────────────────────────────────────────
function MenuRow({
  icon, children, onClick, destructive = false,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors [&>svg]:w-4 [&>svg]:h-4 [&>svg]:shrink-0',
        destructive ? 'text-rose-400 hover:bg-rose-500/10' : 'text-slate-200 hover:bg-white/[0.06]',
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: CONNECTION ROW
// Contacts-app row: circular avatar + live status dot, name + presence line,
// trailing ••• menu (View profile / Remove connection / Block). Tapping the
// left region opens the profile; destructive actions are tucked in the menu so
// the row stays calm (HIG: hierarchy via layout, not competing buttons).
// ──────────────────────────────────────────────────────────
function ConnectionRow({
  user, onProfile, onAction,
}: {
  user: SocialUser;
  onProfile: () => void;
  onAction: (action: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const bucket = bucketOf(user);
  const presence =
    bucket === 'online' ? 'Active now' : bucket === 'away' ? 'Away' : user.online_label || 'Offline';
  const presenceColor =
    bucket === 'online' ? 'text-emerald-400' : bucket === 'away' ? 'text-amber-400' : 'text-slate-500';

  return (
    <div
      data-entrance="list-item"
      className="flex items-center gap-3 px-2.5 sm:px-3 py-2.5 min-h-[64px] hover:bg-white/[0.03] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
    >
      {/* Left region → profile */}
      <button onClick={onProfile} className="flex items-center gap-3 min-w-0 flex-1 text-left group">
        <div className="relative flex-shrink-0">
          <Image
            src={user.avatar || '/Assets/Img/default-avatar.png'}
            alt={fullName(user)}
            width={44}
            height={44}
            className="w-11 h-11 rounded-full object-cover border border-slate-800"
          />
          <span className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1A1D24]', DOT[bucket])} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-slate-100 truncate group-hover:text-white transition-colors">
            {fullName(user)}
          </p>
          <p className={cn('text-[13px] truncate', presenceColor)}>{presence}</p>
        </div>
      </button>

      {/* Trailing ••• context menu */}
      <DropdownMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        align="right"
        dropdownClassName="w-56 p-1.5"
        trigger={
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More options"
            aria-expanded={menuOpen}
            className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors active:scale-95"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        }
      >
        <MenuRow icon={<UserRound />} onClick={() => { setMenuOpen(false); onProfile(); }}>
          View profile
        </MenuRow>
        <div className="my-1 h-px bg-slate-800/70" />
        <MenuRow icon={<UserX />} destructive onClick={() => { setMenuOpen(false); onAction('unfriend'); }}>
          Remove connection
        </MenuRow>
        <MenuRow icon={<ShieldAlert />} destructive onClick={() => { setMenuOpen(false); onAction('block'); }}>
          Block
        </MenuRow>
      </DropdownMenu>
    </div>
  );
}

export default function ConnectionsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [loading]);

  // `silent` skips the spinner — live re-syncs must never blank the list.
  const fetchFriends = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/social?action=friends');
      const data = await res.json();
      if (data.success) setFriends(data.friends || []);
    } catch (err) {
      console.error('Failed to load connections list:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Live: a connection accepted / severed anywhere (SSE from the other side,
  // or a local echo) re-syncs the list without a reload.
  useEffect(() => {
    const onSocial = () => { fetchFriends(true); };
    window.addEventListener('zz-social-update', onSocial);
    return () => window.removeEventListener('zz-social-update', onSocial);
  }, [fetchFriends]);

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
        // Echo locally — the Active-now rail drops/adds the person immediately.
        emitSocialUpdate(action, targetId);
        fetchFriends(true);
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

  // Presence-sectioned + name-sorted once per roster change: online people
  // (incl. away) surface first, the rest fall to "Offline".
  const { active, offline, activeCount } = useMemo(() => {
    const sorted = [...friends].sort((a, b) => {
      const r = RANK[bucketOf(a)] - RANK[bucketOf(b)];
      return r !== 0 ? r : fullName(a).localeCompare(fullName(b));
    });
    return {
      active: sorted.filter((f) => f.is_online),
      offline: sorted.filter((f) => !f.is_online),
      activeCount: sorted.filter((f) => f.is_online).length,
    };
  }, [friends]);

  const total = friends.length;
  const subtitle =
    total === 0
      ? 'Find people to connect with.'
      : `${total} ${total === 1 ? 'connection' : 'connections'}${activeCount ? ` · ${activeCount} active now` : ''}`;

  return (
    <div ref={pageRef} className="max-w-2xl mx-auto pb-20">

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: LARGE-TITLE HEADER
          Contains: page title, live count subtitle
          ────────────────────────────────────────────────────────── */}
      <header className="mb-6">
        <h1 data-entrance="title" className="text-[28px] sm:text-4xl font-bold tracking-tight text-white leading-tight">
          Connections
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
          aria-label="Search your connections"
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
          DEVELOPMENT NAVIGATOR: CONTENT — CONNECTIONS LIST
          Contains: presence-grouped rows (Active now / Offline) or empty state
          ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Spinner size="lg" />
        </div>
      ) : total === 0 ? (
        <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-2xl p-12 sm:p-16 text-center shadow-apple">
          <Users className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <p className="text-[15px] font-semibold text-slate-200">No connections yet</p>
          <p className="text-sm text-slate-500 mt-1">Discover people who match your interests.</p>
          <Button
            variant="unstyled"
            onClick={() => router.push('/community/discover')}
            className="mt-6 inline-flex items-center gap-2 px-5 h-11 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] shadow-apple-sm"
          >
            <UserPlus className="w-4 h-4" />
            Discover people
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <ListGroup title="Active now" count={activeCount}>
              {active.map((f) => (
                <ConnectionRow
                  key={f.id}
                  user={f}
                  onProfile={() => router.push(`/u/${f.username}`)}
                  onAction={(action) => executeSocialAction(action, f.id)}
                />
              ))}
            </ListGroup>
          )}

          {offline.length > 0 && (
            <ListGroup title="Offline">
              {offline.map((f) => (
                <ConnectionRow
                  key={f.id}
                  user={f}
                  onProfile={() => router.push(`/u/${f.username}`)}
                  onAction={(action) => executeSocialAction(action, f.id)}
                />
              ))}
            </ListGroup>
          )}
        </div>
      )}
    </div>
  );
}
