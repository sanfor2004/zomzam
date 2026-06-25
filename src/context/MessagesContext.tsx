'use client';

import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useCurrentUser } from '@/context/CurrentUserContext';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: GLOBAL MESSAGING CONTEXT
// Single source of truth for direct messages across the whole dashboard shell.
// Owns: the contacts model (friends ⨝ conversations + presence), the unread
// total (drives the topbar red dot), and the Facebook-style docked chat windows.
// Consumed by: the topbar Messages button/dropdown, <ChatDock>, <PresenceRail>,
// the /messages page, and the /home Messages panel — so messaging behaves
// identically on every route and there's exactly one live `new_message` handler.
// ──────────────────────────────────────────────────────────

const MAX_OPEN_CHATS = 3;

export interface ThreadMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  read_at: string | null;
  created_at: string;
}

/** A friend, annotated with our shared conversation (if any) + live presence. */
export interface ChatContact {
  other_id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  is_online?: boolean;
  is_idle?: boolean;
  online_label?: string;
  conversation_id: number | null;
  last_message: string | null;
  last_sender_id: number | null;
  last_message_at: string | null;
  unread_count: number;
}

/** The minimal identity a chat window needs to render its header + send target. */
export interface ChatUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  online_label?: string;
  is_online?: boolean;
  is_idle?: boolean;
}

export interface ChatWindow {
  otherUser: ChatUser;
  conversationId: number | null;
  messages: ThreadMessage[];
  loading: boolean;
  text: string;
  sending: boolean;
  minimized: boolean;
  /** True while a peek-loaded window still has unread messages not yet marked read. */
  unread: boolean;
}

interface MessagesContextType {
  contacts: ChatContact[];
  unreadTotal: number;
  windows: ChatWindow[];
  loadContacts: () => Promise<void>;
  openChat: (user: ChatUser, conversationId?: number | null) => void;
  closeChat: (otherId: number) => void;
  toggleMinimize: (otherId: number) => void;
  setDraft: (otherId: number, text: string) => void;
  sendMessage: (otherId: number) => Promise<void>;
  markConversationRead: (otherId: number) => void;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const me = useCurrentUser();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [windows, setWindows] = useState<ChatWindow[]>([]);

  // Mirror windows into a ref so the stable `zz-new-message` listener can read
  // the current open set without re-subscribing on every window change.
  const windowsRef = useRef<ChatWindow[]>(windows);
  useEffect(() => { windowsRef.current = windows; }, [windows]);

  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/messages?action=contacts');
      const data = await res.json();
      if (data.success) setContacts(data.contacts || []);
    } catch { /* non-blocking */ }
  }, []);

  const markConversationReadApi = useCallback((conversationId: number | null) => {
    if (!conversationId) return;
    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', conversation_id: conversationId }),
    }).catch(() => {});
  }, []);

  // Load a thread's history into an existing window. `peek` loads without
  // clearing the unread badge (used when a window auto-pops on an incoming msg).
  const hydrateWindow = useCallback(async (otherId: number, peek: boolean) => {
    try {
      const res = await fetch(`/api/messages?action=thread&user_id=${otherId}${peek ? '&peek=1' : ''}`);
      const data = await res.json();
      if (!data.success) return;
      setWindows((prev) => prev.map((w) =>
        w.otherUser.id === otherId
          ? { ...w, messages: data.messages || [], conversationId: data.conversation_id, loading: false }
          : w
      ));
    } catch {
      setWindows((prev) => prev.map((w) => (w.otherUser.id === otherId ? { ...w, loading: false } : w)));
    }
  }, []);

  const openChat = useCallback((user: ChatUser, conversationId: number | null = null) => {
    setWindows((prev) => {
      const existing = prev.find((w) => w.otherUser.id === user.id);
      if (existing) {
        // Already open: surface it, un-minimize, and clear the unread badge.
        markConversationReadApi(existing.conversationId);
        return prev.map((w) =>
          w.otherUser.id === user.id ? { ...w, minimized: false, unread: false } : w
        );
      }
      const next: ChatWindow = {
        otherUser: user,
        conversationId,
        messages: [],
        loading: true,
        text: '',
        sending: false,
        minimized: false,
        unread: false,
      };
      const trimmed = prev.length >= MAX_OPEN_CHATS ? prev.slice(1) : prev;
      return [...trimmed, next];
    });
    // Explicit open marks read (peek=false).
    hydrateWindow(user.id, false);
    loadContacts();
  }, [hydrateWindow, loadContacts, markConversationReadApi]);

  const closeChat = useCallback((otherId: number) => {
    setWindows((prev) => prev.filter((w) => w.otherUser.id !== otherId));
  }, []);

  const toggleMinimize = useCallback((otherId: number) => {
    setWindows((prev) => prev.map((w) => {
      if (w.otherUser.id !== otherId) return w;
      const minimized = !w.minimized;
      // Expanding a window with unread messages marks them read.
      if (!minimized && w.unread) {
        markConversationReadApi(w.conversationId);
        loadContacts();
        return { ...w, minimized, unread: false };
      }
      return { ...w, minimized };
    }));
  }, [loadContacts, markConversationReadApi]);

  const setDraft = useCallback((otherId: number, text: string) => {
    setWindows((prev) => prev.map((w) => (w.otherUser.id === otherId ? { ...w, text } : w)));
  }, []);

  const markConversationRead = useCallback((otherId: number) => {
    setWindows((prev) => prev.map((w) => {
      if (w.otherUser.id !== otherId || !w.unread) return w;
      markConversationReadApi(w.conversationId);
      return { ...w, unread: false };
    }));
    loadContacts();
  }, [loadContacts, markConversationReadApi]);

  const sendMessage = useCallback(async (otherId: number) => {
    const win = windowsRef.current.find((w) => w.otherUser.id === otherId);
    const content = win?.text.trim();
    if (!win || !content) return;

    // Optimistic UI: render the bubble and clear the input IMMEDIATELY with a
    // temporary (negative) id, so the message never waits on the network round-trip.
    // The POST reconciles in the background — swap the temp for the real row on
    // success, or roll it back (and restore the text) on failure.
    const tempId = -Date.now();
    const optimistic: ThreadMessage = {
      id: tempId,
      conversation_id: win.conversationId ?? 0,
      sender_id: me.id,
      content,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setWindows((prev) => prev.map((w) =>
      w.otherUser.id === otherId ? { ...w, messages: [...w.messages, optimistic], text: '' } : w
    ));

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', recipient_id: otherId, content }),
      });
      const data = await res.json();
      if (data.success) {
        setWindows((prev) => prev.map((w) =>
          w.otherUser.id === otherId
            ? {
                ...w,
                conversationId: data.conversation_id,
                messages: w.messages.map((m) => (m.id === tempId ? data.message : m)),
              }
            : w
        ));
        loadContacts();
      } else {
        // Roll back: drop the optimistic bubble and put the text back to retry.
        setWindows((prev) => prev.map((w) =>
          w.otherUser.id === otherId
            ? { ...w, messages: w.messages.filter((m) => m.id !== tempId), text: w.text || content }
            : w
        ));
      }
    } catch {
      setWindows((prev) => prev.map((w) =>
        w.otherUser.id === otherId
          ? { ...w, messages: w.messages.filter((m) => m.id !== tempId), text: w.text || content }
          : w
      ));
    }
  }, [loadContacts, me.id]);

  // ── Live delivery ───────────────────────────────────────────
  // A single global handler for the SSE-driven `zz-new-message` event: append to
  // an open thread (and mark read if focused), or auto-pop a new window from the
  // bottom — Facebook style — loaded via peek so the red dot persists until read.
  useEffect(() => {
    const onNewMessage = (e: Event) => {
      const { conversation_id, message, sender } = (e as CustomEvent).detail || {};
      if (!conversation_id || !message) return;
      const senderId: number = message.sender_id;

      const open = windowsRef.current.find((w) => w.otherUser.id === senderId);
      if (open) {
        setWindows((prev) => prev.map((w) => {
          if (w.otherUser.id !== senderId) return w;
          const messages = [...w.messages, message];
          // Window open & expanded → user is looking, mark read. Minimized → flag unread.
          if (!w.minimized) {
            markConversationReadApi(conversation_id);
            return { ...w, messages, conversationId: conversation_id, unread: false };
          }
          return { ...w, messages, conversationId: conversation_id, unread: true };
        }));
      } else if (sender) {
        // Auto-pop a fresh window for the sender, loaded WITHOUT marking read.
        const user: ChatUser = {
          id: sender.id ?? senderId,
          username: sender.username,
          first_name: sender.first_name ?? null,
          last_name: sender.last_name ?? null,
          avatar: sender.avatar || '/Assets/Img/default-avatar.png',
        };
        setWindows((prev) => {
          if (prev.some((w) => w.otherUser.id === user.id)) return prev;
          const win: ChatWindow = {
            otherUser: user,
            conversationId: conversation_id,
            messages: [],
            loading: true,
            text: '',
            sending: false,
            minimized: false,
            unread: true,
          };
          const trimmed = prev.length >= MAX_OPEN_CHATS ? prev.slice(1) : prev;
          return [...trimmed, win];
        });
        hydrateWindow(user.id, true);
      }

      loadContacts();
    };
    window.addEventListener('zz-new-message', onNewMessage);
    return () => window.removeEventListener('zz-new-message', onNewMessage);
  }, [hydrateWindow, loadContacts, markConversationReadApi]);

  // ── Bootstrap + presence freshness ──────────────────────────
  // Initial load, then a light poll every 20s keeps presence dots and the
  // last-chatted ordering fresh (SSE delivers messages instantly; this is just
  // for online/offline drift, which is not latency-sensitive).
  useEffect(() => {
    loadContacts();
    const timer = setInterval(loadContacts, 20000);
    return () => clearInterval(timer);
  }, [loadContacts]);

  const unreadTotal = useMemo(
    () => contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [contacts]
  );

  const value = useMemo<MessagesContextType>(() => ({
    contacts, unreadTotal, windows,
    loadContacts, openChat, closeChat, toggleMinimize, setDraft, sendMessage, markConversationRead,
  }), [contacts, unreadTotal, windows, loadContacts, openChat, closeChat, toggleMinimize, setDraft, sendMessage, markConversationRead]);

  // Expose the current user id to consumers that render message bubbles.
  return (
    <MessagesContext.Provider value={value}>
      <MeIdContext.Provider value={me.id}>{children}</MeIdContext.Provider>
    </MessagesContext.Provider>
  );
}

// The authenticated user's id, surfaced here so chat-bubble renderers don't each
// have to reach into CurrentUserContext.
const MeIdContext = createContext<number>(0);
export function useMyId() { return useContext(MeIdContext); }

export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessages must be used within a MessagesProvider');
  return ctx;
}
