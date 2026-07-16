'use client';
import { Button, ListGroup, Spinner, useToast } from '@/components/ui';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, UserPlus, UserRoundCheck } from 'lucide-react';
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
// DEVELOPMENT NAVIGATOR: REQUEST ROW
// Contacts-app row: circular avatar + live status dot, name + intent line
// ("Wants to connect" / "Waiting for acceptance"), trailing action pill(s).
// Incoming gets two calm pills (Accept/Decline); outgoing gets one (Cancel).
// ──────────────────────────────────────────────────────────
function RequestRow({
  user, onProfile, kind, onAccept, onDecline, onCancel,
}: {
  user: SocialUser;
  onProfile: () => void;
  kind: 'incoming' | 'outgoing';
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}) {
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
          <p className="text-[13px] text-slate-400 truncate">
            {kind === 'incoming' ? 'Wants to connect' : 'Waiting for acceptance'}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-2 flex-shrink-0">
        {kind === 'incoming' ? (
          <>
            <Button
              variant="unstyled"
              onClick={onAccept}
              className="h-9 px-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-[13px] font-semibold transition-colors active:scale-95 shadow-apple-sm"
            >
              Accept
            </Button>
            <Button
              variant="unstyled"
              onClick={onDecline}
              className="h-9 px-3.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-rose-400 rounded-full text-[13px] font-semibold transition-colors"
            >
              Decline
            </Button>
          </>
        ) : (
          <Button
            variant="unstyled"
            onClick={onCancel}
            className="h-9 px-3.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-rose-400 rounded-full text-[13px] font-semibold transition-colors"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

export default function RequestsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [incomingRequests, setIncomingRequests] = useState<SocialUser[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<SocialUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [loading]);

  // `silent` skips the spinner — used by live re-syncs so an SSE-driven refresh
  // never blanks a page the user is already looking at.
  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Live: any social-graph change (new incoming request, a cancel, an accept
  // from another tab/user) re-syncs both columns over the SSE channel.
  useEffect(() => {
    const onSocial = () => { fetchRequests(true); };
    window.addEventListener('zz-social-update', onSocial);
    return () => window.removeEventListener('zz-social-update', onSocial);
  }, [fetchRequests]);

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
        // Echo locally so the rest of the shell (Active-now rail, suggestion
        // cards) updates without waiting for anything — see emitSocialUpdate.
        emitSocialUpdate(action, targetId);
        fetchRequests(true);
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

  const totalIncoming = incomingRequests.length;
  const totalOutgoing = outgoingRequests.length;
  const subtitle = totalIncoming === 0 && totalOutgoing === 0
    ? 'No pending requests.'
    : [
        totalIncoming ? `${totalIncoming} incoming` : null,
        totalOutgoing ? `${totalOutgoing} outgoing` : null,
      ].filter(Boolean).join(' · ');

  return (
    <div ref={pageRef} className="max-w-2xl mx-auto pb-20">

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: LARGE-TITLE HEADER
          Contains: page title, live count subtitle
          ────────────────────────────────────────────────────────── */}
      <header className="mb-6">
        <h1 data-entrance="title" className="text-[28px] sm:text-4xl font-bold tracking-tight text-white leading-tight">
          Requests
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
          aria-label="Search connection requests"
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
          DEVELOPMENT NAVIGATOR: CONTENT — FRIEND REQUESTS
          Contains: incoming requests (accept/decline), outgoing requests (cancel), or empty state
          ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Spinner size="lg" />
        </div>
      ) : totalIncoming === 0 && totalOutgoing === 0 ? (
        <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-2xl p-12 sm:p-16 text-center shadow-apple">
          <UserRoundCheck className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <p className="text-[15px] font-semibold text-slate-200">No pending requests</p>
          <p className="text-sm text-slate-500 mt-1">Connect with people to see requests here.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {totalIncoming > 0 && (
            <ListGroup title="Incoming" count={totalIncoming}>
              {incomingRequests.map((r) => (
                <RequestRow
                  key={r.id}
                  user={r}
                  kind="incoming"
                  onProfile={() => router.push(`/u/${r.username}`)}
                  onAccept={() => executeSocialAction('friend_accept', r.id)}
                  onDecline={() => executeSocialAction('friend_decline', r.id)}
                />
              ))}
            </ListGroup>
          )}

          {totalOutgoing > 0 && (
            <ListGroup title="Outgoing" count={totalOutgoing}>
              {outgoingRequests.map((r) => (
                <RequestRow
                  key={r.id}
                  user={r}
                  kind="outgoing"
                  onProfile={() => router.push(`/u/${r.username}`)}
                  onCancel={() => executeSocialAction('friend_cancel', r.id)}
                />
              ))}
            </ListGroup>
          )}
        </div>
      )}
    </div>
  );
}
