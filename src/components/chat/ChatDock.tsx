'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Loader2, Send, X, Minus } from 'lucide-react';
import { useMessages, useMyId, type ChatWindow } from '@/context/MessagesContext';
import { displayName, relativeTime } from '@/app/(dashboard)/home/shared';

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
  const { closeChat, toggleMinimize, setDraft, sendMessage, markConversationRead } = useMessages();
  const myId = useMyId();
  const endRef = useRef<HTMLDivElement>(null);
  const otherId = win.otherUser.id;
  const name = displayName(win.otherUser);

  // Keep the newest message in view as the thread grows or the window expands.
  useEffect(() => {
    if (!win.minimized) endRef.current?.scrollIntoView({ block: 'end' });
  }, [win.messages, win.minimized]);

  const presence = win.otherUser.online_label || (win.otherUser.is_online ? 'Online' : 'Offline');

  return (
    <div className="pointer-events-auto w-[320px] max-w-[calc(100vw-2rem)] bg-[#1A1D24] border border-slate-800/70 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-900/60 border-b border-slate-800/60 cursor-pointer"
        onClick={() => toggleMinimize(otherId)}
      >
        <div className="relative flex-shrink-0">
          <Image
            src={win.otherUser.avatar || '/Assets/Img/default-avatar.png'}
            alt={name}
            width={32}
            height={32}
            className="w-8 h-8 rounded-lg object-cover border border-slate-800"
          />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1A1D24] ${
              win.otherUser.is_online ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
            {name}
            {win.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />}
          </p>
          <p className="text-[10px] text-slate-500 truncate">{presence}</p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleMinimize(otherId); }}
          aria-label={win.minimized ? 'Expand chat' : 'Minimize chat'}
          className="text-slate-500 hover:text-slate-200 transition-colors p-1"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); closeChat(otherId); }}
          aria-label="Close chat"
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
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 p-2.5 border-t border-slate-800/60">
            <input
              type="text"
              value={win.text}
              onChange={(e) => setDraft(otherId, e.target.value)}
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
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-default text-white flex items-center justify-center transition-colors"
            >
              {win.sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
