'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, UserMinus, UserCheck, UserX, Heart, HeartOff, Loader2 } from 'lucide-react';

interface SocialButtonsProps {
  targetUserId: number;
  initialStatus: string;
  initialIsFollowing: boolean;
  viewerId: number | null;
}

export default function SocialButtons({
  targetUserId,
  initialStatus,
  initialIsFollowing,
  viewerId,
}: SocialButtonsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(initialStatus);
  const [isFollowing, setIsFollowing] = useState<boolean>(initialIsFollowing);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!viewerId) {
    return (
      <button
        onClick={() => router.push('/sign')}
        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl px-6 py-3 shadow-md shadow-primary-500/20 transition-all text-xs uppercase tracking-wider cursor-pointer"
      >
        <UserPlus className="w-4 h-4" />
        Sign in to Connect
      </button>
    );
  }

  const handleAction = async (action: string) => {
    setLoading(true);
    setErrorMsg(null);
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
        // Update state based on action
        if (action === 'friend_request') {
          setStatus('friend_pending_out');
        } else if (action === 'friend_cancel' || action === 'friend_decline' || action === 'unfriend') {
          setStatus('none');
        } else if (action === 'friend_accept') {
          setStatus('friends');
        } else if (action === 'follow') {
          setIsFollowing(true);
        } else if (action === 'unfollow') {
          setIsFollowing(false);
        }
      } else {
        setErrorMsg(data.message || 'Operation failed');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 w-full sm:w-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Friend Connection Button */}
        {status === 'none' && (
          <button
            onClick={() => handleAction('friend_request')}
            disabled={loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-400 text-white font-bold rounded-xl px-6 py-3.5 transition-all text-xs uppercase tracking-wider cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Add Friend
          </button>
        )}

        {status === 'friend_pending_out' && (
          <button
            onClick={() => handleAction('friend_cancel')}
            disabled={loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-slate-200 font-bold rounded-xl px-6 py-3.5 transition-all text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
            Cancel Request
          </button>
        )}

        {status === 'friend_pending_in' && (
          <div className="flex gap-2 flex-grow sm:flex-grow-0">
            <button
              onClick={() => handleAction('friend_accept')}
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white font-bold rounded-xl px-5 py-3.5 transition-all text-xs uppercase tracking-wider cursor-pointer shadow-md active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Accept
            </button>
            <button
              onClick={() => handleAction('friend_decline')}
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-500 font-bold rounded-xl px-5 py-3.5 transition-all text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
              Decline
            </button>
          </div>
        )}

        {status === 'friends' && (
          <button
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
            <span className="group-hover:hidden">Friends</span>
            <span className="hidden group-hover:inline">Unfriend</span>
          </button>
        )}

        {/* Follow Button */}
        {status !== 'blocked_by_me' && status !== 'blocked_by_them' && (
          <button
            onClick={() => handleAction(isFollowing ? 'unfollow' : 'follow')}
            disabled={loading}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 font-bold rounded-xl px-6 py-3.5 transition-all text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] border${
              isFollowing
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20'
                : 'bg-transparent border-slate-700 text-slate-350 hover:bg-slate-800'
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isFollowing ? (
              <HeartOff className="w-4 h-4" />
            ) : (
              <Heart className="w-4 h-4" />
            )}
            {isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        )}
      </div>

      {errorMsg && (
        <p className="text-[10px] text-red-500 font-bold text-center sm:text-left">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
