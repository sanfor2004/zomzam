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
  /** True while the peer is actively typing — drives the three-dot bubble. Auto-expires. */
  peerTyping?: boolean;
}

interface MessagesContextType {
  contacts: ChatContact[];
  unreadTotal: number;
  windows: ChatWindow[];
  /** Ids of peers currently typing a message TO me — drives the "typing…"
   *  indicator everywhere their presence surfaces, not just an open window. */
  typingContacts: Set<number>;
  loadContacts: () => Promise<void>;
  openChat: (user: ChatUser, conversationId?: number | null) => void;
  closeChat: (otherId: number) => void;
  toggleMinimize: (otherId: number) => void;
  setDraft: (otherId: number, text: string) => void;
  sendMessage: (otherId: number) => Promise<void>;
  /** Unsend one of my own messages (optimistic; rolls back on failure). */
  deleteMessage: (otherId: number, messageId: number) => Promise<void>;
  markConversationRead: (otherId: number) => void;
  /** Tell the peer we're typing — throttled, fire-and-forget. */
  notifyTyping: (otherId: number) => void;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const me = useCurrentUser();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [windows, setWindows] = useState<ChatWindow[]>([]);
  const [typingContacts, setTypingContacts] = useState<Set<number>>(new Set());

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

  // ── Outgoing typing pings ───────────────────────────────────
  // Throttle to at most one POST per peer every 2.5s. The recipient's indicator
  // auto-expires ~4s after the last ping (see the zz-typing listener below), so a
  // steady stream of keystrokes keeps it alive and a pause lets it fade — no
  // explicit "stopped typing" message is needed.
  const typingThrottleRef = useRef<Map<number, number>>(new Map());
  const notifyTyping = useCallback((otherId: number) => {
    const now = Date.now();
    const last = typingThrottleRef.current.get(otherId) || 0;
    if (now - last < 2500) return;
    typingThrottleRef.current.set(otherId, now);
    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'typing', recipient_id: otherId }),
    }).catch(() => {});
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

  // Unsend my own message. Optimistically drop the bubble, then hard-delete it
  // server-side; on failure re-hydrate the thread (peek, so it doesn't disturb
  // read state) to restore the true history. A still-optimistic (negative-id)
  // message has no server row yet, so it's just removed locally.
  const deleteMessage = useCallback(async (otherId: number, messageId: number) => {
    setWindows((prev) => prev.map((w) =>
      w.otherUser.id === otherId
        ? { ...w, messages: w.messages.filter((m) => m.id !== messageId) }
        : w
    ));
    if (messageId < 0) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', message_id: messageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        hydrateWindow(otherId, true);
        return;
      }
      loadContacts();
    } catch {
      hydrateWindow(otherId, true);
    }
  }, [hydrateWindow, loadContacts]);

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
          // A delivered message ends any "typing" state from that peer.
          // Window open & expanded → user is looking, mark read. Minimized → flag unread.
          if (!w.minimized) {
            markConversationReadApi(conversation_id);
            return { ...w, messages, conversationId: conversation_id, unread: false, peerTyping: false };
          }
          return { ...w, messages, conversationId: conversation_id, unread: true, peerTyping: false };
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

  // ── Incoming typing indicator ───────────────────────────────
  // A `typing` ping (delivered live via the SSE/heartbeat sync channel) drives
  // two things, each (re)armed on a ~4s auto-expire so a steady stream of
  // keystrokes keeps it alive and a pause lets it fade:
  //   • the in-window three-dot bubble (`peerTyping`), only for an OPEN window —
  //     a ping never pops a new window (that would be noisy; the message will);
  //   • the global `typingContacts` set, which surfaces "typing…" ON THE
  //     PRESENCE ICON everywhere that peer appears (Active-now rail, dock
  //     header, messages list) whether or not their window is open.
  const typingTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = typingTimersRef.current;
    const onTyping = (e: Event) => {
      const { sender_id } = (e as CustomEvent).detail || {};
      if (!sender_id) return;

      setTypingContacts((prev) => {
        if (prev.has(sender_id)) return prev;
        const next = new Set(prev);
        next.add(sender_id);
        return next;
      });

      setWindows((prev) => {
        if (!prev.some((w) => w.otherUser.id === sender_id)) return prev;
        return prev.map((w) => (w.otherUser.id === sender_id ? { ...w, peerTyping: true } : w));
      });

      const existing = timers.get(sender_id);
      if (existing) clearTimeout(existing);
      timers.set(sender_id, setTimeout(() => {
        setTypingContacts((prev) => {
          if (!prev.has(sender_id)) return prev;
          const next = new Set(prev);
          next.delete(sender_id);
          return next;
        });
        setWindows((prev) => prev.map((w) => (w.otherUser.id === sender_id ? { ...w, peerTyping: false } : w)));
        timers.delete(sender_id);
      }, 4000));
    };
    window.addEventListener('zz-typing', onTyping);
    return () => {
      window.removeEventListener('zz-typing', onTyping);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // ── Incoming read receipts ──────────────────────────────────
  // The peer read our messages: stamp read_at on our own still-unread sent
  // messages in that window so the dock can render the "Seen" marker live.
  useEffect(() => {
    const onRead = (e: Event) => {
      const { reader_id } = (e as CustomEvent).detail || {};
      if (!reader_id) return;
      const readAt = new Date().toISOString();
      setWindows((prev) => prev.map((w) => {
        if (w.otherUser.id !== reader_id) return w;
        return {
          ...w,
          messages: w.messages.map((m) =>
            m.sender_id === me.id && !m.read_at ? { ...m, read_at: readAt } : m
          ),
        };
      }));
    };
    window.addEventListener('zz-message-read', onRead);
    return () => window.removeEventListener('zz-message-read', onRead);
  }, [me.id]);

  // ── Incoming unsends ────────────────────────────────────────
  // The peer deleted one of their messages: drop it from any open window on this
  // conversation so both sides converge, and refresh the contacts preview (the
  // deleted line may have been the "last message").
  useEffect(() => {
    const onDeleted = (e: Event) => {
      const { conversation_id, message_id } = (e as CustomEvent).detail || {};
      if (!message_id) return;
      setWindows((prev) => prev.map((w) =>
        w.conversationId === conversation_id
          ? { ...w, messages: w.messages.filter((m) => m.id !== message_id) }
          : w
      ));
      loadContacts();
    };
    window.addEventListener('zz-message-deleted', onDeleted);
    return () => window.removeEventListener('zz-message-deleted', onDeleted);
  }, [loadContacts]);

  // ── Live presence dots ──────────────────────────────────────
  // The unified live channel (SSE while active, heartbeat while AFK) pushes a
  // throttled friends-presence snapshot (~every 20s) as `zz-contacts-presence`.
  // Merge it into the contacts model in place — this replaced the old dedicated
  // 20s contacts poll, so messaging adds ZERO extra recurring connections.
  useEffect(() => {
    const onPresence = (e: Event) => {
      const snapshot = (e as CustomEvent).detail;
      if (!Array.isArray(snapshot)) return;
      const byId = new Map<number, any>(snapshot.map((p: any) => [p.user_id, p]));
      setContacts((prev) => prev.map((c) => {
        const p = byId.get(c.other_id);
        return p
          ? { ...c, is_online: !!p.is_online, is_idle: !!p.is_idle, online_label: p.online_label }
          : c;
      }));
    };
    window.addEventListener('zz-contacts-presence', onPresence);
    return () => window.removeEventListener('zz-contacts-presence', onPresence);
  }, []);

  // ── Live social graph changes ───────────────────────────────
  // A `social_update` (connect accepted, disconnected, request cancelled — via
  // SSE from the other side, or echoed locally by our own action) changes WHO
  // is in the contacts roster, not just their presence. Reload it so a new
  // connection appears in "Active now" (and a severed one disappears) live.
  useEffect(() => {
    const onSocial = () => { loadContacts(); };
    window.addEventListener('zz-social-update', onSocial);
    return () => window.removeEventListener('zz-social-update', onSocial);
  }, [loadContacts]);

  // ── Bootstrap ───────────────────────────────────────────────
  // One initial load; message deltas arrive live and presence drift is merged
  // from the zz-contacts-presence snapshots above.
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const unreadTotal = useMemo(
    () => contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [contacts]
  );

  const value = useMemo<MessagesContextType>(() => ({
    contacts, unreadTotal, windows, typingContacts,
    loadContacts, openChat, closeChat, toggleMinimize, setDraft, sendMessage, deleteMessage, markConversationRead, notifyTyping,
  }), [contacts, unreadTotal, windows, typingContacts, loadContacts, openChat, closeChat, toggleMinimize, setDraft, sendMessage, deleteMessage, markConversationRead, notifyTyping]);

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
