'use client';
import { Button, useToast } from '@/components/ui';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, UserMinus, UserCheck, UserX, Clock, Loader2 } from 'lucide-react';
import { socialSuccessToast, emitSocialUpdate } from '@/lib/social-actions';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: PROFILE CONNECT BUTTONS (LinkedIn-style)
// One Connect action replaces the old Follow + Add Friend pair:
//   Connect → pending ("you follow them" until they respond; cancel withdraws)
//   They connect back / accept → Connected (friends)
//   Connected → hover reveals Disconnect
// The follow edge is created/withdrawn server-side as part of the connect
// lifecycle — there is no standalone follow control anymore.
// ──────────────────────────────────────────────────────────

interface SocialButtonsProps {
  targetUserId: number;
  initialStatus: string;
  viewerId: number | null;
}

export default function SocialButtons({
  targetUserId,
  initialStatus,
  viewerId,
}: SocialButtonsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<string>(initialStatus);
  const [loading, setLoading] = useState<boolean>(false);

  // Live: the OTHER side acting on our relationship (accepting our pending
  // request, cancelling theirs, disconnecting) arrives over the SSE channel —
  // flip the button state in place, no refresh. Local echoes are skipped:
  // handleAction already set the state optimistically.
  useEffect(() => {
    const onSocial = (e: Event) => {
      const { action, from_user_id, local } = (e as CustomEvent).detail || {};
      if (local || from_user_id !== targetUserId) return;
      if (action === 'connection_accepted') setStatus('friends');
      else if (action === 'request_received') setStatus('friend_pending_in');
      else if (action === 'request_cancelled') setStatus((s) => (s === 'friend_pending_in' ? 'none' : s));
      else if (action === 'unfriended') setStatus('none');
    };
    window.addEventListener('zz-social-update', onSocial);
    return () => window.removeEventListener('zz-social-update', onSocial);
  }, [targetUserId]);

  if (!viewerId) {
    return (
      <Button variant="unstyled"
        onClick={() => router.push('/sign')}
        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl px-6 py-3 shadow-md shadow-primary-500/20 transition-all text-xs uppercase tracking-wider cursor-pointer"
      >
        <UserPlus className="w-4 h-4" />
        Sign in to Connect
      </Button>
    );
  }

  const handleAction = async (action: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          user_id: targetUserId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (action === 'friend_request') {
          // If they had already sent us a request, the server auto-accepts.
          setStatus(data.message === 'You are now connected' ? 'friends' : 'friend_pending_out');
        } else if (action === 'friend_cancel' || action === 'friend_decline' || action === 'unfriend') {
          setStatus('none');
        } else if (action === 'friend_accept') {
          setStatus('friends');
        }
        // Echo locally so the shell (Active-now rail, suggestion cards,
        // community pages) reflects the change without waiting on anything.
        emitSocialUpdate(action, targetUserId);
        const successMsg = socialSuccessToast(action);
        if (successMsg) toast({ variant: 'success', description: successMsg });
      } else {
        toast({ variant: 'error', description: data.message || 'Operation failed' });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'error', description: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 w-full sm:w-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Connect — the single entry point into the relationship */}
        {status === 'none' && (
          <Button variant="unstyled"
            onClick={() => handleAction('friend_request')}
            disabled={loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-400 text-white font-bold rounded-xl px-6 py-3.5 transition-all text-xs uppercase tracking-wider cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Connect
          </Button>
        )}

        {/* Pending (sent) — you follow them until they respond; hover to cancel */}
        {status === 'friend_pending_out' && (
          <Button variant="unstyled"
            onClick={() => handleAction('friend_cancel')}
            disabled={loading}
            title="You follow them until they accept — click to withdraw"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-slate-200 font-bold rounded-xl px-6 py-3.5 transition-all text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] group"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Clock className="w-4 h-4 group-hover:hidden" />
                <UserX className="w-4 h-4 hidden group-hover:block" />
              </>
            )}
            <span className="group-hover:hidden">Pending</span>
            <span className="hidden group-hover:inline">Withdraw</span>
          </Button>
        )}

        {/* Incoming request — accept completes the connection */}
        {status === 'friend_pending_in' && (
          <div className="flex gap-2 flex-grow sm:flex-grow-0">
            <Button variant="unstyled"
              onClick={() => handleAction('friend_accept')}
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white font-bold rounded-xl px-5 py-3.5 transition-all text-xs uppercase tracking-wider cursor-pointer shadow-md active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Accept
            </Button>
            <Button variant="unstyled"
              onClick={() => handleAction('friend_decline')}
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-500 font-bold rounded-xl px-5 py-3.5 transition-all text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
              Decline
            </Button>
          </div>
        )}

        {/* Connected — hover reveals Disconnect */}
        {status === 'friends' && (
          <Button variant="unstyled"
            onClick={() => handleAction('unfriend')}
            disabled={loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-red-500/10 hover:text-red-500 border border-emerald-500/20 hover:border-red-500/20 text-emerald-500 font-bold rounded-xl px-6 py-3.5 transition-all text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] group"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <UserCheck className="w-4 h-4 group-hover:hidden" />
                <UserMinus className="w-4 h-4 hidden group-hover:block" />
              </>
            )}
            <span className="group-hover:hidden">Connected</span>
            <span className="hidden group-hover:inline">Disconnect</span>
          </Button>
        )}
      </div>
    </div>
  );
}
