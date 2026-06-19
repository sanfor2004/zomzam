'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { gsap, useGSAP, ScrollTrigger, getScrollParent } from '@/lib/gsap';
import {
  Bold, Italic, Underline, List, Smile, Image as ImageIcon,
  AtSign, Hash, Send, Loader2, Heart, MessageCircle, Trash2,
  UserPlus, Check, Users, ArrowBigUp, MoreHorizontal, Pencil,
} from 'lucide-react';
import { Button, AudienceSwitch, Tooltip, ConfirmDialog, Dropdown, DropdownItem, ShareButton, DeleteButton, type PostVisibility } from '@/components/ui';

interface CurrentUser {
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
}

interface MentionUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  is_online?: boolean;
  online_label?: string;
  bio?: string | null;
}

interface SuggestedUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  bio?: string | null;
  matching_tags?: string[];
}

interface Post {
  id: number;
  user_id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  content_html: string;
  visibility?: PostVisibility;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

interface Comment {
  id: number;
  post_id: number;
  parent_id: number | null;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
  content: string;
  created_at: string;
  upvote_count: number;
  upvoted_by_me: boolean;
  replies?: Comment[];
}

// Highest-voted first; ties fall back to oldest-first so order stays stable.
function byUpvotes(a: Comment, b: Comment): number {
  return b.upvote_count - a.upvote_count
    || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

// Sort a level and every nested reply level the same way (recursive).
function sortByUpvotes(nodes: Comment[]): Comment[] {
  nodes.sort(byUpvotes);
  for (const n of nodes) if (n.replies?.length) sortByUpvotes(n.replies);
  return nodes;
}

function buildTree(flat: Comment[]): Comment[] {
  const map = new Map<number, Comment>();
  const roots: Comment[] = [];
  for (const c of flat) map.set(c.id, { ...c, replies: [] });
  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parent_id != null && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }
  return sortByUpvotes(roots);
}

type Trigger = '@' | '#';

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function displayName(u: { first_name: string | null; last_name: string | null; username: string }) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
}

// Maximum visible characters allowed per post. Mention (@) and tag (#) pills
// count toward this via innerText, so the limit reflects what the reader sees.
const MAX_POST_CHARS = 500;

// How many top-level comments to reveal before the "Load more" button.
const COMMENTS_PAGE_SIZE = 6;
const REPLIES_PAGE_SIZE = 4;

const POST_LAYER_CONFIGS = [
  { translateY: 4,  scale: 0.97, opacity: 0.35, blur: 1 },
  { translateY: 8,  scale: 0.94, opacity: 0.20, blur: 2 },
  { translateY: 12, scale: 0.91, opacity: 0.10, blur: 3 },
] as const;

const REPLY_LAYER_CONFIGS = [
  { translateY: 3, scale: 0.97, opacity: 0.30, blur: 1 },
  { translateY: 6, scale: 0.94, opacity: 0.18, blur: 2 },
] as const;

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [friends, setFriends] = useState<MentionUser[]>([]);
  const [peopleSuggestions, setPeopleSuggestions] = useState<SuggestedUser[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<number>>(new Set());

  // Editor refs / state
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

  // Autocomplete dropdown state
  const [popoverActive, setPopoverActive] = useState(false);
  const [triggerType, setTriggerType] = useState<Trigger>('@');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // Feed state
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [postingLoading, setPostingLoading] = useState(false);
  const [visibility, setVisibility] = useState<PostVisibility>('friends');
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingFeedRef = useRef(false);
  const composerCardRef = useRef<HTMLDivElement>(null);

  // ── Data bootstrap ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth?action=check');
        const data = await res.json();
        if (data.success && data.authenticated) setCurrentUser(data.user);
      } catch { /* non-blocking */ }
    })();

    (async () => {
      try {
        const res = await fetch('/api/social?action=friends');
        const data = await res.json();
        if (data.success) setFriends(data.friends || []);
      } catch { /* non-blocking */ }
    })();

    (async () => {
      try {
        const res = await fetch('/api/social?action=discover');
        const data = await res.json();
        if (data.success) setPeopleSuggestions((data.users || []).slice(0, 5));
      } catch { /* non-blocking */ }
    })();
  }, []);

  const handleAddFriend = async (userId: number) => {
    setSentRequests((prev) => new Set(prev).add(userId));
    try {
      await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'friend_request', user_id: userId }),
      });
    } catch { /* non-blocking */ }
  };

  // ── Feed loading ────────────────────────────────────────────
  const loadFeed = useCallback(async (offset = 0) => {
    if (loadingFeedRef.current) return;
    loadingFeedRef.current = true;
    setLoadingFeed(true);
    try {
      const res = await fetch(`/api/posts?action=feed&offset=${offset}`);
      const data = await res.json();
      if (data.success) {
        setPosts((prev) => {
          if (!offset) return data.posts;
          // Dedupe in case a locally-prepended post shifts the server offset.
          const seen = new Set(prev.map((p: Post) => p.id));
          return [...prev, ...data.posts.filter((p: Post) => !seen.has(p.id))];
        });
        setHasMore(data.has_more);
      }
    } catch { /* non-blocking */ }
    setLoadingFeed(false);
    setInitialLoading(false);
    loadingFeedRef.current = false;
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // ── Infinite scroll sentinel ────────────────────────────────
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingFeedRef.current) {
          loadFeed(posts.length);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [posts, hasMore, loadFeed]);

  // ── Sync which formats are active at the caret/selection ────
  const FORMAT_COMMANDS = ['bold', 'italic', 'underline', 'insertUnorderedList'];
  const syncFormats = () => {
    if (!editorRef.current) return;
    const next: Record<string, boolean> = {};
    for (const cmd of FORMAT_COMMANDS) {
      try { next[cmd] = document.queryCommandState(cmd); } catch { next[cmd] = false; }
    }
    setActiveFormats(next);
  };

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (sel?.anchorNode && editorRef.current?.contains(sel.anchorNode)) {
        syncFormats();
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  // ── Hard-cap typing/pasting at MAX_POST_CHARS ───────────────
  // Counted from innerText so mention/tag pills count toward the limit.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const INSERTIONS = [
      'insertText', 'insertReplacementText', 'insertCompositionText',
      'insertFromPaste', 'insertFromDrop', 'insertLineBreak', 'insertParagraph',
    ];

    const onBeforeInput = (e: InputEvent) => {
      if (!INSERTIONS.includes(e.inputType)) return; // allow deletes & formatting

      // Replacing a selection frees up room — let it through.
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;

      const current = (el.innerText || '').trim().length;

      let addLen = (e.data || '').length;
      if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
        addLen = e.dataTransfer?.getData('text')?.length ?? addLen;
      } else if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
        addLen = 1;
      }

      if (current + addLen > MAX_POST_CHARS) {
        e.preventDefault();
      }
    };

    el.addEventListener('beforeinput', onBeforeInput);
    return () => el.removeEventListener('beforeinput', onBeforeInput);
  }, []);

  // ── Char count ──────────────────────────────────────────────
  const updateCharCount = () => {
    if (!editorRef.current) return;
    const text = (editorRef.current.innerText || '').trim();
    if (text.length === 0 && editorRef.current.innerHTML !== '') {
      editorRef.current.innerHTML = '';
    }
    setCharCount(text.length);
  };

  // ── Text formatting ─────────────────────────────────────────
  const applyFormat = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
    updateCharCount();
    syncFormats();
  };

  // ── Detect @ / # trigger as the user types ──────────────────
  const handleInput = () => {
    updateCharCount();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return setPopoverActive(false);

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return setPopoverActive(false);

    const textBeforeCaret = node.textContent?.substring(0, range.startOffset) || '';
    const match = textBeforeCaret.match(/([@#])(\w*)$/);
    if (!match) return setPopoverActive(false);

    const trigger = match[1] as Trigger;
    const q = match[2].toLowerCase();
    setTriggerType(trigger);
    setQuery(q);
    setSelectedIndex(0);
    setPopoverActive(true);

    if (trigger === '@') {
      const pool = q
        ? friends.filter((f) =>
            f.username.toLowerCase().includes(q) ||
            displayName(f).toLowerCase().includes(q))
        : friends;
      setSuggestions(pool.slice(0, 8));
    } else {
      setSuggestions([]);
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      setPopoverPos({
        top: rect.bottom - containerRect.top + 8,
        left: rect.left - containerRect.left,
      });
    }
  };

  // ── Keyboard nav ────────────────────────────────────────────
  const optionsCount = triggerType === '@' ? suggestions.length : (query ? 1 : 0);

  const isPill = (node: Node | null): boolean => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node as HTMLElement;
    return el.hasAttribute('data-mention') || el.hasAttribute('data-tag');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Popover navigation
    if (popoverActive && optionsCount > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((p) => (p + 1) % optionsCount);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((p) => (p - 1 + optionsCount) % optionsCount);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (triggerType === '@') insertPill('@', suggestions[selectedIndex]);
        else insertPill('#');
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setPopoverActive(false);
        return;
      }
    }

    // Delete key: remove pill immediately after the caret
    if (e.key === 'Delete' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const sel = window.getSelection();
      if (sel?.isCollapsed && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        let candidate: Node | null = null;
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
          if (range.startOffset === (range.startContainer as Text).length)
            candidate = range.startContainer.nextSibling;
        } else {
          candidate = (range.startContainer as Element).childNodes[range.startOffset] ?? null;
        }
        if (isPill(candidate)) {
          e.preventDefault();
          candidate!.parentNode?.removeChild(candidate!);
          updateCharCount();
        }
      }
    }

    // Ctrl/Cmd+Left (with or without Shift): prevent caret entering pill
    if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
      const sel = window.getSelection();
      if (sel?.rangeCount) {
        const focusNode = sel.focusNode;
        const focusOffset = sel.focusOffset;
        let candidate: Node | null = null;
        if (focusNode?.nodeType === Node.TEXT_NODE) {
          const txt = focusNode as Text;
          if (focusOffset === 0 || (focusOffset === 1 && txt.textContent?.[0] === ' '))
            candidate = txt.previousSibling;
        }
        if (isPill(candidate)) {
          e.preventDefault();
          const before = candidate!.previousSibling;
          if (e.shiftKey) {
            if (before?.nodeType === Node.TEXT_NODE) {
              sel.extend(before, (before as Text).length);
            } else {
              const parent = candidate!.parentNode!;
              sel.extend(parent, Array.from(parent.childNodes).indexOf(candidate as ChildNode));
            }
          } else {
            const newRange = document.createRange();
            if (before?.nodeType === Node.TEXT_NODE) {
              newRange.setStart(before, (before as Text).length);
            } else {
              newRange.setStartBefore(candidate!);
            }
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
        }
      }
    }
  };

  // ── Insert pill ─────────────────────────────────────────────
  const insertPill = (trigger: Trigger, user?: MentionUser) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent || '';
    const triggerOffset = text.substring(0, range.startOffset).lastIndexOf(trigger);
    if (triggerOffset === -1) return;

    const textBefore = text.substring(0, triggerOffset);
    const textAfter = text.substring(triggerOffset + 1 + query.length);

    let pillHtml = '';
    if (trigger === '@' && user) {
      pillHtml = `<span contenteditable="false" data-mention-id="${user.id}" data-mention="${user.username}" class="inline-flex items-center px-0.5 mx-0.5 text-sm font-bold cursor-text text-primary-500">@${user.username}</span>`;
    } else if (trigger === '#') {
      const tag = query;
      if (!tag) return;
      pillHtml = `<span contenteditable="false" data-tag="${tag}" class="inline-flex items-center px-0.5 mx-0.5 text-sm font-bold cursor-text text-sky-400">#${tag}</span>`;
    }
    if (!pillHtml) return;

    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(textBefore));
    const temp = document.createElement('div');
    temp.innerHTML = pillHtml;
    frag.appendChild(temp.firstChild!);
    const spaceNode = document.createTextNode(' ' + textAfter);
    frag.appendChild(spaceNode);

    node.parentNode!.replaceChild(frag, node);

    const newRange = document.createRange();
    newRange.setStart(spaceNode, 1);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    setPopoverActive(false);
    editorRef.current.focus();
    updateCharCount();
  };

  // ── Post ────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!editorRef.current || charCount === 0 || charCount > MAX_POST_CHARS || postingLoading) return;
    const content_html = editorRef.current.innerHTML;
    setPostingLoading(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', content_html, visibility }),
      });
      const data = await res.json();
      if (data.success) {
        editorRef.current.innerHTML = '';
        setCharCount(0);
        setPopoverActive(false);
        setPosts((prev) => [data.post, ...prev]);
      }
    } catch { /* non-blocking */ }
    setPostingLoading(false);
  };

  function insertChar(char: string) {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertText', false, char);
    handleInput();
  }

  return (
    /* ──────────────────────────────────────────────────────────
        DEVELOPMENT NAVIGATOR: HOME / COMMUNITY FEED
        Contains: Post composer, infinite-scroll feed, right sidebar
        ────────────────────────────────────────────────────────── */
    <div ref={containerRef} className="max-w-6xl mx-auto relative animate-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: MAIN FEED COLUMN
            Contains: Composer card, post feed with infinite scroll
            ────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: POST COMPOSER
              Contains: Row 1 (avatar + editor + char counter),
                        Row 2 (text settings toolbar + audience switch + Post button)
              ────────────────────────────────────────────────────────── */}
          <div
            ref={composerCardRef}
            className="relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] rounded-3xl p-5 shadow-apple-lg"
            onFocusCapture={() => {
              gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
                gsap.to(composerCardRef.current, {
                  boxShadow: '0 0 40px rgba(238,87,18,0.12), 0 25px 50px rgba(0,0,0,0.5)',
                  duration: 0.4,
                  ease: 'power2.out',
                });
              });
            }}
            onBlurCapture={() => {
              gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
                gsap.to(composerCardRef.current, {
                  boxShadow: '0 0 0px rgba(238,87,18,0), 0 25px 50px rgba(0,0,0,0.5)',
                  duration: 0.3,
                  ease: 'power2.in',
                });
              });
            }}
          >
            {/* Top-edge highlight */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
            />

            {/* Row 1 — avatar, text area, character amount */}
            <div className="flex gap-3">
              <img
                src={currentUser?.avatar || '/Assets/Img/default-avatar.png'}
                alt="You"
                className="w-10 h-10 rounded-xl object-cover border border-slate-800 flex-shrink-0"
              />

              <div className="flex-1 min-w-0">
                <div className="relative">
                  <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    data-placeholder={`What's on your mind${currentUser ? `, ${displayName(currentUser)}` : ''}? Use @ to mention, # to tag.`}
                    className="w-full min-h-[44px] max-w-full bg-[#111318] rounded-2xl px-4 py-2.5 border border-slate-800/60 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] overflow-x-hidden outline-none focus:border-primary-500/40 transition-colors"
                  />
                  <style jsx>{`
                    div[contenteditable]:empty:before {
                      content: attr(data-placeholder);
                      color: #64748b;
                      pointer-events: none;
                    }
                    div[contenteditable] :global(ul) {flex items-center gap-1.5 text-xs font-semibold transition-colors text-slate-500 hover:text-emerald-400
                      list-style: disc;
                      padding-left: 1.5rem;
                      margin: 0.25rem 0;
                    }
                    div[contenteditable] :global(ol) {
                      list-style: decimal;
                      padding-left: 1.5rem;
                      margin: 0.25rem 0;
                    }
                    div[contenteditable] :global(li) {
                      margin: 0.125rem 0;
                    }
                  `}</style>
                </div>

                {/* Character counter — amber near limit, rose when over */}
                <div className="flex justify-end mt-2">
                  <span
                    aria-live="polite"
                    title={`${MAX_POST_CHARS - charCount} characters remaining`}
                    className={`text-[11px] font-bold tabular-nums transition-colors ${
                      charCount > MAX_POST_CHARS
                        ? 'text-rose-500'
                        : charCount >= MAX_POST_CHARS * 0.9
                        ? 'text-amber-400'
                        : 'text-slate-600'
                    }`}
                  >
                    {charCount}/{MAX_POST_CHARS}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2 — text settings (left) + audience switch & Post button (right) */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-800/60">
              {/* Text settings */}
              <div className="flex items-center gap-1">
                <ToolbarButton label="Bold" active={activeFormats.bold} onClick={() => applyFormat('bold')}>
                  <Bold className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Italic" active={activeFormats.italic} onClick={() => applyFormat('italic')}>
                  <Italic className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Underline" active={activeFormats.underline} onClick={() => applyFormat('underline')}>
                  <Underline className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Bullet list" active={activeFormats.insertUnorderedList} onClick={() => applyFormat('insertUnorderedList')}>
                  <List className="w-4 h-4" />
                </ToolbarButton>
                <span className="w-px h-5 bg-slate-800 mx-1" />
                <ToolbarButton label="Mention someone (@)" onClick={() => insertChar('@')}>
                  <AtSign className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Add a tag (#)" onClick={() => insertChar('#')}>
                  <Hash className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Emoji (soon)" onClick={() => {}} disabled>
                  <Smile className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton label="Photo (soon)" onClick={() => {}} disabled>
                  <ImageIcon className="w-4 h-4" />
                </ToolbarButton>
              </div>

              <div className="flex items-center gap-3">
                {/* Audience switch — friends / public (exclusive hidden in composer) */}
                <AudienceSwitch value={visibility} onChange={setVisibility} />

                <Button
                  size="none"
                  shape="rounded"
                  onClick={handlePost}
                  disabled={charCount === 0 || charCount > MAX_POST_CHARS || postingLoading}
                  loading={postingLoading}
                  leftIcon={!postingLoading && <Send className="w-4 h-4" fill="currentColor" strokeWidth={0} />}
                  className="h-[34px] px-4 text-xs font-bold gap-1.5 disabled:opacity-40"
                >
                  Post
                </Button>
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────
                DEVELOPMENT NAVIGATOR: AUTOCOMPLETE POPOVER
                Contains: @-mention friend list, #-tag creator, keyboard nav hints
                ────────────────────────────────────────────────────────── */}
            {popoverActive && (
              <div
                role="listbox"
                aria-label={triggerType === '@' ? 'Mention a friend' : 'Create a tag'}
                className="absolute z-50 w-80 overflow-hidden rounded-2xl border border-slate-700/60 bg-[#1A1D24]/95 backdrop-blur-xl shadow-2xl shadow-black/50 ring-1 ring-white/5 origin-top animate-in"
                style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
              >
                {/* Header */}
                <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-900/40">
                  {triggerType === '@' ? (
                    <AtSign className="w-3.5 h-3.5 text-primary-500" />
                  ) : (
                    <Hash className="w-3.5 h-3.5 text-sky-400" />
                  )}
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {triggerType === '@' ? 'Mention a friend' : 'Create a tag'}
                  </span>
                  {triggerType === '@' && suggestions.length > 0 && (
                    <span className="ml-auto text-[10px] font-bold text-slate-600 tabular-nums">
                      {suggestions.length}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {triggerType === '@' ? (
                    suggestions.length > 0 ? (
                      suggestions.map((u, idx) => (
                        <Button
                          key={u.id}
                          variant="unstyled"
                          role="option"
                          aria-selected={idx === selectedIndex}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          onClick={() => insertPill('@', u)}
                          className={`group w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-all duration-150 ${
                            idx === selectedIndex
                              ? 'bg-primary-500/15 ring-1 ring-primary-500/30'
                              : 'hover:bg-slate-800/60'
                          }`}
                        >
                          <span className="relative flex-shrink-0">
                            <img
                              src={u.avatar}
                              alt=""
                              className="w-8 h-8 rounded-lg object-cover border border-slate-800"
                            />
                            {u.is_online && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#1A1D24]" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-xs font-bold truncate transition-colors ${
                              idx === selectedIndex ? 'text-white' : 'text-slate-200'
                            }`}>
                              {displayName(u)}
                            </span>
                            <span className="block text-[10px] text-slate-500 truncate">@{u.username}</span>
                          </span>
                        </Button>
                      ))
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
                        <Users className="w-5 h-5 text-slate-700" />
                        <p className="text-xs font-semibold text-slate-500">No matching friends</p>
                        <p className="text-[10px] text-slate-600">Try a different name.</p>
                      </div>
                    )
                  ) : query ? (
                    <Button
                      variant="unstyled"
                      role="option"
                      aria-selected
                      onClick={() => insertPill('#')}
                      className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left bg-sky-500/10 ring-1 ring-sky-500/25 transition-all"
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-500/15 flex-shrink-0">
                        <Hash className="w-4 h-4 text-sky-400" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Create tag</span>
                        <span className="block text-xs font-bold text-sky-400 truncate">#{query}</span>
                      </span>
                      <kbd className="flex-shrink-0 text-[9px] font-bold text-sky-400/80 bg-sky-500/10 px-1.5 py-0.5 rounded">↵</kbd>
                    </Button>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
                      <Hash className="w-5 h-5 text-slate-700" />
                      <p className="text-xs font-semibold text-slate-500">Keep typing…</p>
                      <p className="text-[10px] text-slate-600">Type a word to create a tag.</p>
                    </div>
                  )}
                </div>

                {/* Keyboard hint footer */}
                {((triggerType === '@' && suggestions.length > 0) || (triggerType === '#' && query)) && (
                  <div className="flex items-center gap-3 px-3.5 py-2 border-t border-slate-800/80 bg-slate-900/40 text-[9px] font-semibold text-slate-500">
                    {triggerType === '@' && (
                      <span className="flex items-center gap-1">
                        <kbd className="bg-slate-800 text-slate-400 px-1 py-0.5 rounded">↑↓</kbd>
                        navigate
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <kbd className="bg-slate-800 text-slate-400 px-1 py-0.5 rounded">↵</kbd>
                      select
                    </span>
                    <span className="flex items-center gap-1 ml-auto">
                      <kbd className="bg-slate-800 text-slate-400 px-1 py-0.5 rounded">esc</kbd>
                      dismiss
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: FEED
              Contains: Post cards, infinite scroll sentinel, empty state
              ────────────────────────────────────────────────────────── */}
          {initialLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-[#1A1D24] border border-dashed border-slate-800/60 rounded-3xl p-10 text-center">
              <p className="text-sm font-semibold text-slate-400">No posts yet</p>
              <p className="text-xs text-slate-500 mt-1">Be the first to share something with the community.</p>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isOwn={currentUser?.username === post.username}
                  viewerUsername={currentUser?.username ?? null}
                  onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                />
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={bottomRef} className="h-1" />

              {loadingFeed && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                </div>
              )}

              {!hasMore && (
                <p className="text-center text-xs text-slate-600 py-4">You're all caught up</p>
              )}
            </>
          )}
        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: RIGHT SIDEBAR
            Contains: My Friends list, People You May Know suggestions
            ────────────────────────────────────────────────────────── */}
        <aside className="hidden lg:block self-start lg:sticky lg:top-0">
          <div className="space-y-4">

            {/* My Friends */}
            <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-5 shadow-apple">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    My Friends
                  </h3>
                  {friends.length > 0 && (
                    <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                      {friends.length}
                    </span>
                  )}
                </div>
                <Link
                  href="/community/friends"
                  className="text-[10px] font-bold uppercase tracking-wider text-primary-500 hover:text-primary-400 transition-colors"
                >
                  View All
                </Link>
              </div>

              {friends.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-4">
                  No friends yet — discover people below.
                </p>
              ) : (
                <div className="space-y-1">
                  {friends.slice(0, 7).map((f) => (
                    <Link
                      key={f.id}
                      href={`/u/${f.username}`}
                      className="flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={f.avatar}
                          alt=""
                          className="w-8 h-8 rounded-xl object-cover border border-slate-800 group-hover:border-primary-500/30 transition-colors"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1A1D24] ${
                            f.is_online ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition-colors">
                          {displayName(f)}
                        </p>
                        <p className="text-[10px] text-slate-600 truncate">{f.online_label || 'Offline'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* People You May Know */}
            {peopleSuggestions.length > 0 && (
              <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-5 shadow-apple">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    People You May Know
                  </h3>
                  <Link
                    href="/community/discover"
                    className="text-[10px] font-bold uppercase tracking-wider text-primary-500 hover:text-primary-400 transition-colors"
                  >
                    See More
                  </Link>
                </div>

                <div className="space-y-3">
                  {peopleSuggestions.map((u) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <Link href={`/u/${u.username}`} className="flex-shrink-0">
                        <img
                          src={u.avatar}
                          alt=""
                          className="w-9 h-9 rounded-xl object-cover border border-slate-800 hover:border-primary-500/30 transition-colors"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/u/${u.username}`}>
                          <p className="text-xs font-bold text-slate-200 truncate hover:text-white transition-colors">
                            {displayName(u)}
                          </p>
                        </Link>
                        <p className="text-[10px] text-slate-600 truncate">@{u.username}</p>
                      </div>
                      <Button
                        variant="unstyled"
                        onClick={() => handleAddFriend(u.id)}
                        disabled={sentRequests.has(u.id)}
                        title={sentRequests.has(u.id) ? 'Request sent' : 'Add friend'}
                        className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all disabled:cursor-default ${
                          sentRequests.has(u.id)
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-primary-500/10 text-primary-500 hover:bg-primary-500/20'
                        }`}
                      >
                        {sentRequests.has(u.id)
                          ? <><Check className="w-3 h-3" /> Sent</>
                          : <><UserPlus className="w-3 h-3" /> Add</>}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </aside>

      </div>
    </div>
  );
}

// ── Post card ─────────────────────────────────────────────────
function PostCard({ post, isOwn, viewerUsername, onDelete }: { post: Post; isOwn: boolean; viewerUsername?: string | null; onDelete: (id: number) => void }) {
  const name = displayName(post);

  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [visibleComments, setVisibleComments] = useState(COMMENTS_PAGE_SIZE);

  const cardRef = useRef<HTMLDivElement>(null);
  const heartIconRef = useRef<SVGSVGElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(hover: none)').matches);
  }, []);

  useGSAP(() => {
    if (!pillRef.current || isTouchDevice) return;
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      if (isHovered) {
        gsap.to(pillRef.current, { y: 0, opacity: 1, duration: 0.2, ease: 'power2.out', pointerEvents: 'auto' });
      } else {
        gsap.to(pillRef.current, { y: 8, opacity: 0, duration: 0.15, ease: 'power2.in', pointerEvents: 'none' });
      }
    });
    gsap.matchMedia().add('(prefers-reduced-motion: reduce)', () => {
      if (!pillRef.current) return;
      pillRef.current.style.opacity = isHovered ? '1' : '0';
      pillRef.current.style.pointerEvents = isHovered ? 'auto' : 'none';
    });
  }, { dependencies: [isHovered, isTouchDevice], scope: cardRef });

  // Throws on failure so the DeleteButton keeps its confirm dialog open.
  const handleDelete = async () => {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', post_id: post.id }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to delete post');
    onDelete(post.id);
  };

  const toggleLike = async () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => liked ? prev - 1 : prev + 1);
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', post_id: post.id }),
      });
    } catch { /* non-blocking */ }
  };

  const handleLike = () => {
    toggleLike();
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      if (!heartIconRef.current) return;
      const tl = gsap.timeline();
      tl.to(heartIconRef.current, { scale: 1.5, duration: 0.12, ease: 'power2.out' })
        .to(heartIconRef.current, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    });
  };

  // Temporary stubs — replaced with full implementations in Task 6.
  const handleCardMouseEnter = () => setIsHovered(true);
  const handleCardMouseLeave = () => setIsHovered(false);

  const toggleComments = async () => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && comments.length === 0) {
      setLoadingComments(true);
      try {
        const res = await fetch(`/api/posts?action=comments&post_id=${post.id}`);
        const data = await res.json();
        if (data.success) setComments(data.comments);
      } catch { /* non-blocking */ }
      setLoadingComments(false);
    }
  };

  // Shared by PostCard (top-level) and CommentRow (replies)
  const addComment = async (text: string, parentId?: number): Promise<boolean> => {
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', post_id: post.id, content: text, parent_id: parentId ?? null }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => [...prev, data.comment]);
        setCommentCount((prev) => prev + 1);
        // Keep a freshly posted top-level comment visible past the page limit.
        if (!parentId) setVisibleComments((v) => v + 1);
        return true;
      }
    } catch { /* non-blocking */ }
    return false;
  };

  // Toggle an upvote on a comment. State lives here (not in CommentRow) so the
  // tree re-sorts by vote count the moment a vote lands — that's the reordering.
  const voteComment = async (commentId: number) => {
    const target = comments.find((c) => c.id === commentId);
    if (!target) return;
    const nextUp = !target.upvoted_by_me;

    const apply = (up: boolean) => setComments((prev) => prev.map((c) =>
      c.id === commentId
        ? { ...c, upvoted_by_me: up, upvote_count: c.upvote_count + (up ? 1 : -1) }
        : c
    ));

    apply(nextUp); // optimistic
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment_vote', comment_id: commentId }),
      });
      const data = await res.json();
      if (!data.success) apply(!nextUp); // revert on server rejection
    } catch {
      apply(!nextUp); // revert on network failure
    }
  };

  // Edit a comment's text in place. Returns false so the row can stay in edit
  // mode (keeping the user's draft) if the save fails.
  const editComment = async (commentId: number, text: string): Promise<boolean> => {
    const content = text.trim().slice(0, 1000);
    if (!content) return false;
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment_edit', comment_id: commentId, content }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: data.content } : c)));
        return true;
      }
    } catch { /* non-blocking */ }
    return false;
  };

  // Delete a comment and its whole reply thread (the server returns every id it
  // removed so the count and list stay in sync).
  const deleteComment = async (commentId: number): Promise<boolean> => {
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment_delete', comment_id: commentId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.deleted_ids)) {
        const removed = new Set<number>(data.deleted_ids.map((id: number) => Number(id)));
        setComments((prev) => prev.filter((c) => !removed.has(c.id)));
        setCommentCount((prev) => Math.max(0, prev - removed.size));
        return true;
      }
    } catch { /* non-blocking */ }
    return false;
  };

  const submitTopComment = async () => {
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    const ok = await addComment(commentText);
    if (ok) setCommentText('');
    setSubmittingComment(false);
  };

  const tree = buildTree(comments);

  return (
    <div
      id={`post-${post.id}`}
      data-entrance="card"
      className="post-item relative"
      style={{ zIndex: isHovered ? 10 : 0, isolation: 'isolate' }}
      onClick={isTouchDevice ? () => {
        if (isHovered) { setIsHovered(false); }
        else { setIsHovered(true); }
      } : undefined}
      onMouseEnter={!isTouchDevice ? handleCardMouseEnter : undefined}
      onMouseLeave={!isTouchDevice ? handleCardMouseLeave : undefined}
    >
      {/* ─── Silhouette layers behind card ─── */}
      {(() => {
        const layerCount = Math.min(post.comment_count, 3);
        if (layerCount === 0) return null;
        return [...POST_LAYER_CONFIGS].slice(0, layerCount).reverse().map((cfg, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-3xl bg-white/[0.03] border border-white/[0.05] pointer-events-none"
            style={{
              transform: `translateY(${cfg.translateY}px) scale(${cfg.scale})`,
              opacity: cfg.opacity,
              filter: `blur(${cfg.blur}px)`,
              zIndex: 0,
            }}
          />
        ));
      })()}

      {/* ─── Main glass card ─── */}
      <div
        ref={cardRef}
        className="relative z-[1] bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] rounded-3xl shadow-apple-lg transition-transform duration-300 ease-out"
        style={{ transform: isHovered ? 'translateY(-4px)' : 'translateY(0)' }}
      >
        {/* Top-edge highlight */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
        />

        <div className="p-5">
          {/* ── Header + content (unchanged from original) ── */}
          <div className="flex gap-3">
            <Link href={`/u/${post.username}`} className="flex-shrink-0">
              <img
                src={post.avatar}
                alt={name}
                className="w-10 h-10 rounded-xl object-cover border border-slate-800 hover:border-primary-500/30 transition-colors"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <Link
                  href={`/u/${post.username}`}
                  className="text-sm font-bold text-white hover:text-primary-400 hover:underline transition-colors"
                >
                  {name}
                </Link>
                <Link href={`/u/${post.username}`} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  @{post.username}
                </Link>
                <span className="text-xs text-slate-600 ml-auto flex-shrink-0">{relativeTime(post.created_at)}</span>
                {isOwn && (
                  <DeleteButton onConfirm={handleDelete} tooltip="Delete post" ariaLabel="Delete post" />
                )}
              </div>
              <div
                className="mt-2 text-sm text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]"
                dangerouslySetInnerHTML={{ __html: post.content_html }}
              />
            </div>
          </div>

          {/* ── Always-visible like strip ── */}
          <div className="flex items-center mt-4 pt-3 border-t border-white/[0.06]">
            <Tooltip content={liked ? 'Unlike' : 'Like'}>
              <Button
                variant="unstyled"
                onClick={handleLike}
                aria-label={liked ? 'Unlike post' : 'Like post'}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                  liked ? 'text-rose-500' : 'text-slate-500 hover:text-rose-400'
                }`}
              >
                <Heart ref={heartIconRef} className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} />
                {likeCount > 0 && <span>{likeCount}</span>}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ─── Hover pill ─── */}
      <div
        ref={pillRef}
        className="absolute left-1/2 z-[3] flex items-center gap-4 rounded-full border border-white/[0.08] bg-white/[0.06] px-5 py-2.5 backdrop-blur-xl shadow-apple"
        style={{
          top: 'calc(100% + 8px)',
          transform: 'translateX(-50%) translateY(8px)',
          opacity: isTouchDevice ? 1 : 0,
          pointerEvents: (isHovered || isTouchDevice) ? 'auto' : 'none',
        }}
        aria-hidden={!isHovered && !isTouchDevice}
      >
        <Tooltip content={commentsOpen ? 'Hide comments' : 'View comments'}>
          <Button
            variant="unstyled"
            onClick={toggleComments}
            aria-label={commentsOpen ? 'Hide comments' : 'View comments on post'}
            className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              commentsOpen ? 'text-sky-400' : 'text-slate-400 hover:text-sky-400'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            {commentCount > 0 && <span>{commentCount}</span>}
          </Button>
        </Tooltip>

        <ShareButton
          url={`/p/${post.id}`}
          shareTitle={`${name} on Zomzam`}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        />
      </div>

      {/* ─── Comment push-down previews (Task 6) ─── */}
      {/* PLACEHOLDER — filled in Task 6 */}

      {/* ─── Expanded comments section (Task 7) ─── */}
      {/* PLACEHOLDER — filled in Task 7 */}
    </div>
  );
}

// ── Comment row (recursive — supports reply threads) ──────────
function CommentRow({
  comment,
  onReply,
  onVote,
  onEdit,
  onCommentDelete,
  viewerUsername,
  depth,
}: {
  comment: Comment;
  onReply: (text: string, parentId?: number) => Promise<boolean>;
  onVote: (commentId: number) => void;
  onEdit: (commentId: number, text: string) => Promise<boolean>;
  onCommentDelete: (commentId: number) => Promise<boolean>;
  viewerUsername?: string | null;
  depth: number;
}) {
  const name = displayName(comment);
  const isMine = !!viewerUsername && comment.username === viewerUsername;
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const submitReply = async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onReply(replyText, comment.id);
    if (ok) { setReplyText(''); setReplyOpen(false); }
    setSubmitting(false);
  };

  const startEdit = () => {
    setEditText(comment.content);
    setEditing(true);
    setMenuOpen(false);
  };

  const saveEdit = async () => {
    if (!editText.trim() || savingEdit) return;
    setSavingEdit(true);
    const ok = await onEdit(comment.id, editText);
    if (ok) setEditing(false);
    setSavingEdit(false);
  };

  const confirmAndDelete = async () => {
    setDeleting(true);
    const ok = await onCommentDelete(comment.id);
    // On success the row unmounts; on failure, drop back out of the dialog.
    if (!ok) { setDeleting(false); setConfirmDelete(false); }
  };

  return (
    <div className={depth > 0 ? 'ml-8 border-l border-slate-800/50 pl-3' : ''}>
      <div className="flex gap-2">
        <img
          src={comment.avatar}
          alt=""
          className="w-7 h-7 rounded-lg object-cover border border-slate-800 flex-shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0 bg-[#111318] rounded-2xl px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white">{name}</span>
            <span className="text-[10px] text-slate-600">{relativeTime(comment.created_at)}</span>
            <div className="ml-auto flex items-center gap-3">
              <Tooltip content={comment.upvoted_by_me ? 'Remove upvote' : 'Upvote'}>
                <Button
                  variant="unstyled"
                  onClick={() => onVote(comment.id)}
                  aria-label={comment.upvoted_by_me ? 'Remove upvote' : 'Upvote comment'}
                  className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${
                    comment.upvoted_by_me ? 'text-primary-500' : 'text-slate-500 hover:text-primary-400'
                  }`}
                >
                  <ArrowBigUp className="w-3.5 h-3.5" fill={comment.upvoted_by_me ? 'currentColor' : 'none'} />
                  {comment.upvote_count > 0 && <span>{comment.upvote_count}</span>}
                </Button>
              </Tooltip>
              {depth < 2 && (
                <Button
                  variant="unstyled"
                  onClick={() => setReplyOpen((p) => !p)}
                  className={`text-[10px] font-semibold transition-colors ${
                    replyOpen ? 'text-sky-400' : 'text-slate-500 hover:text-sky-400'
                  }`}
                >
                  Reply
                </Button>
              )}
              {isMine && (
                <Dropdown
                  mode="menu"
                  open={menuOpen}
                  onClose={() => setMenuOpen(false)}
                  align="right"
                  dropdownClassName="min-w-[10rem] p-1.5 space-y-0.5"
                  trigger={
                    <Button
                      variant="unstyled"
                      onClick={() => setMenuOpen((p) => !p)}
                      aria-label="Comment options"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      className="flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </Button>
                  }
                >
                  <DropdownItem leading={<Pencil className="w-4 h-4" />} onClick={startEdit}>
                    Edit
                  </DropdownItem>
                  <DropdownItem
                    leading={<Trash2 className="w-4 h-4" />}
                    onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                    className="text-rose-400 hover:bg-rose-500/10"
                  >
                    Delete
                  </DropdownItem>
                </Dropdown>
              )}
            </div>
          </div>
          {editing ? (
            <div className="mt-1.5">
              <textarea
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                  if (e.key === 'Escape') { setEditing(false); }
                }}
                rows={2}
                maxLength={1000}
                className="w-full bg-[#0E1015] rounded-xl px-3 py-2 text-xs text-slate-200 border border-slate-800/60 outline-none focus:border-primary-500/40 transition-colors resize-none"
              />
              <div className="flex items-center gap-2 mt-1.5">
                <Button
                  variant="primary"
                  size="xs"
                  onClick={saveEdit}
                  loading={savingEdit}
                  disabled={!editText.trim() || editText.trim() === comment.content}
                >
                  Save
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setEditing(false)} disabled={savingEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed break-words [overflow-wrap:anywhere]">{comment.content}</p>
          )}
        </div>
      </div>

      {/* Inline reply input */}
      {replyOpen && (
        <div className="flex gap-2 mt-2 ml-9">
          <input
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
            placeholder={`Reply to ${name}…`}
            maxLength={1000}
            className="flex-1 bg-[#111318] rounded-xl px-3 py-1.5 text-xs text-slate-200 border border-slate-800/60 outline-none focus:border-primary-500/40 transition-colors placeholder:text-slate-600"
          />
          <Button
            variant="primary"
            size="none"
            shape="lg"
            onClick={submitReply}
            disabled={!replyText.trim() || submitting}
            className="p-1.5 disabled:opacity-40 flex-shrink-0"
          >
            {submitting
              ? <Loader2 className="w-3 h-3 text-white animate-spin" />
              : <Send className="w-3 h-3 text-white" />}
          </Button>
        </div>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onVote={onVote}
              onEdit={onEdit}
              onCommentDelete={onCommentDelete}
              viewerUsername={viewerUsername}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={confirmAndDelete}
        loading={deleting}
        title="Delete this comment?"
        description={
          comment.replies && comment.replies.length > 0
            ? 'This also removes all replies underneath it. This can’t be undone.'
            : 'This permanently removes your comment. This can’t be undone.'
        }
        confirmLabel="Delete"
      />
    </div>
  );
}

// ── Toolbar button ────────────────────────────────────────────
function ToolbarButton({
  children, onClick, label, disabled, active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip content={label} position="bottom">
      <Button
        variant="unstyled"
        aria-label={label}
        aria-pressed={active}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        disabled={disabled}
        className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 ${
          active
            ? 'text-primary-500 bg-primary-500/15'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
        }`}
      >
        {children}
      </Button>
    </Tooltip>
  );
}
