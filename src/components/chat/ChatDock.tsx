'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, Send, X, Minus, ChevronUp, Smile } from 'lucide-react';
import { useMessages, useMyId, type ChatWindow } from '@/context/MessagesContext';
import { displayName, relativeTime } from '@/app/(dashboard)/home/shared';
import { TypingDots, TypingBadge } from './TypingDots';

// A compact, curated emoji set for the quick-insert picker — no external lib
// (none installed; see CLAUDE.md §5). Covers the common reactions people reach
// for in a chat without the weight of a full emoji-mart dependency.
const QUICK_EMOJIS = [
  '😀', '😂', '🙂', '😉', '😍', '😎', '🤩', '😘',
  '🤔', '😴', '😅', '😭', '😡', '🥳', '😱', '🤯',
  '👍', '👎', '👏', '🙏', '💪', '🤝', '👋', '🔥',
  '❤️', '🧡', '💯', '✨', '🎉', '🚀', '☕', '✅',
];

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: GLOBAL CHAT DOCK
// Facebook-style chat windows docked at the bottom-right, available on every
// dashboard route. Pure view over MessagesContext — open/close/minimize/send all
// flow through context methods. Auto-pops when a message arrives (see context).
// ──────────────────────────────────────────────────────────
export function ChatDock() {
  const { windows } = useMessages();
  if (windows.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-4 z-[90] flex items-end gap-3 pointer-events-none">
      {windows.map((w) => (
        <ChatWindowCard key={w.otherUser.id} win={w} />
      ))}
    </div>
  );
}

function ChatWindowCard({ win }: { win: ChatWindow }) {
  const { contacts, typingContacts, closeChat, toggleMinimize, setDraft, sendMessage, markConversationRead, notifyTyping } = useMessages();
  const myId = useMyId();
  const endRef = useRef<HTMLDivElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const otherId = win.otherUser.id;
  const name = displayName(win.otherUser);

  // Keep the newest message in view as the thread grows, the window expands, or
  // the peer's typing bubble appears.
  useEffect(() => {
    if (!win.minimized) endRef.current?.scrollIntoView({ block: 'end' });
  }, [win.messages, win.minimized, win.peerTyping]);

  // Live presence: the window's `otherUser` is a snapshot from when the chat was
  // opened and never refreshes on its own. Overlay the matching contact, which
  // the 20s contacts poll + heartbeat keep fresh, so the dot/label track reality.
  const live = contacts.find((c) => c.other_id === otherId);
  const isOnline = live?.is_online ?? win.otherUser.is_online ?? false;
  const isIdle = Boolean(isOnline && (live?.is_idle ?? win.otherUser.is_idle));
  const onlineLabel = live?.online_label ?? win.otherUser.online_label;
  // online & idle → amber, online & active → emerald, offline → slate.
  const dotColor = isOnline ? (isIdle ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-600';
  // Typing wins over every presence state: while the peer composes, their icon
  // and subtitle both flip to a live "typing…" signal.
  const isTyping = typingContacts.has(otherId);
  const presence = isTyping ? 'typing…' : isIdle ? 'Away' : (onlineLabel || (isOnline ? 'Active now' : 'Offline'));

  const insertEmoji = (emoji: string) => {
    setDraft(otherId, win.text + emoji);
    setEmojiOpen(false);
  };

  // "Seen" marker: show under the thread when my most recent message has been
  // read by the peer (read_at set live via the zz-message-read receipt). If the
  // peer has since replied, the last message is theirs — no marker needed.
  const lastMsg = win.messages[win.messages.length - 1];
  const showSeen = !win.loading && !!lastMsg && lastMsg.sender_id === myId && !!lastMsg.read_at;

  return (
    <div className="pointer-events-auto w-[320px] max-w-[calc(100vw-2rem)] bg-[#1A1D24] border border-slate-800/70 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* ── Header (not click-to-minimize: use the explicit control on the right) ── */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-900/60 border-b border-slate-800/60">
        <div className="relative flex-shrink-0">
          <Image
            src={win.otherUser.avatar || '/Assets/Img/default-avatar.png'}
            alt={name}
            width={32}
            height={32}
            className="w-8 h-8 rounded-lg object-cover border border-slate-800"
          />
          {isTyping ? (
            <TypingBadge borderClass="border-[#1A1D24]" />
          ) : (
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1A1D24] ${dotColor}`}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
            <Link
              href={`/u/${win.otherUser.username}`}
              className="truncate hover:text-primary-400 hover:underline underline-offset-2 transition-colors"
              title={`View ${name}'s profile`}
            >
              {name}
            </Link>
            {win.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse flex-shrink-0" />}
          </p>
          <p className={`text-[10px] truncate ${isTyping ? 'text-primary-400 font-semibold' : 'text-slate-500'}`}>{presence}</p>
        </div>
        <button
          type="button"
          onClick={() => toggleMinimize(otherId)}
          aria-label={win.minimized ? 'Expand chat' : 'Minimize chat'}
          title={win.minimized ? 'Expand' : 'Minimize'}
          className="text-slate-500 hover:text-slate-200 transition-colors p-1"
        >
          {win.minimized ? <ChevronUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => closeChat(otherId)}
          aria-label="Close chat"
          title="Close"
          className="text-slate-500 hover:text-red-400 transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Body + composer (hidden while minimized) ── */}
      {!win.minimized && (
        <>
          <div
            className="h-[340px] max-h-[55vh] overflow-y-auto px-3 py-3 space-y-2.5"
            onClick={() => markConversationRead(otherId)}
          >
            {win.loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
              </div>
            ) : win.messages.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-10">Say hello to {name} 👋</p>
            ) : (
              win.messages.map((m) => {
                const isMine = m.sender_id === myId;
                return (
                  <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-3 py-1.5 text-sm ${
                        isMine
                          ? 'bg-primary-500 text-white rounded-br-md'
                          : 'bg-slate-800/70 text-slate-200 rounded-bl-md'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p className={`text-[10px] mt-0.5 ${isMine ? 'text-white/70' : 'text-slate-500'}`}>
                        {relativeTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}

            {/* ── "Seen" receipt ── */}
            {showSeen && (
              <p className="text-[10px] text-slate-500 text-right pr-1">Seen</p>
            )}

            {/* ── Typing indicator (peer is composing) ── */}
            {win.peerTyping && (
              <div className="flex justify-start" aria-label={`${name} is typing`}>
                <div className="bg-slate-800/70 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          <div className="relative flex items-center gap-2 p-2.5 border-t border-slate-800/60">
            {/* ── Emoji picker ── */}
            {emojiOpen && (
              <>
                {/* Click-away scrim — closes the picker on any outside tap. */}
                <button
                  type="button"
                  aria-label="Close emoji picker"
                  className="fixed inset-0 z-[1] cursor-default"
                  onClick={() => setEmojiOpen(false)}
                />
                <div className="absolute bottom-full left-2.5 mb-2 z-[2] w-[232px] bg-[#1A1D24] border border-slate-800/70 rounded-2xl shadow-2xl p-2 grid grid-cols-8 gap-0.5">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-base hover:bg-white/[0.06] transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              aria-label="Insert emoji"
              aria-expanded={emojiOpen}
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                emojiOpen ? 'text-primary-400 bg-primary-500/10' : 'text-slate-400 hover:text-primary-400 hover:bg-white/[0.05]'
              }`}
            >
              <Smile className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={win.text}
              onChange={(e) => {
                setDraft(otherId, e.target.value);
                if (e.target.value.trim()) notifyTyping(otherId);
              }}
              onFocus={() => markConversationRead(otherId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(otherId); }
              }}
              placeholder="Write a message..."
              disabled={win.sending}
              className="flex-1 min-w-0 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500/60 transition-colors disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => sendMessage(otherId)}
              disabled={!win.text.trim() || win.sending}
              aria-label="Send"
              className="flex-shrink-0 w-9 h-9 rounded-full text-primary-500 hover:text-primary-400 hover:bg-primary-500/10 disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent flex items-center justify-center transition-colors"
            >
              {win.sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
