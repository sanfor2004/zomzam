'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import { gsap, useGSAP, ScrollTrigger, getScrollParent } from '@/lib/gsap';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import {
  Bold, Italic, Underline, List, Smile, Image as ImageIcon,
  AtSign, Hash, Send, Loader2, Heart, MessageCircle, Trash2,
  UserPlus, Check, Users, ArrowBigUp, MoreHorizontal, Pencil, X,
} from 'lucide-react';
import { Button, AudienceSwitch, Tooltip, ConfirmDialog, Dropdown, DropdownItem, ShareButton, ToastProvider, useToast, type PostVisibility } from '@/components/ui';

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
  image_path?: string | null;
  visibility?: PostVisibility;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  top_comments?: Comment[];
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

// Post image attachment — mirrors the server allowlist/cap (api/posts) so the
// user gets instant feedback; the server still re-validates (never trust client).
const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const POST_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const POST_IMAGE_ACCEPT = POST_IMAGE_TYPES.join(',');

// Curated, dependency-free emoji palette grouped by intent. OS emoji input still
// works for everything else — this is a quick-pick affordance, not a full keyboard.
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Smileys', emojis: ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤩', '🥳', '😇', '🙃', '😉', '😌', '😴', '🤔', '🫡', '🤫', '😬', '🙄', '😢', '😭', '😤', '😡', '🥺', '😱', '🤯', '🤗'] },
  { label: 'Gestures', emojis: ['👍', '👎', '👏', '🙌', '🤝', '👌', '🤙', '✌️', '🤞', '🫶', '💪', '🙏', '👋', '🤟', '👊', '✊'] },
  { label: 'Hearts', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💗', '💘', '💝', '💯', '✨', '🔥', '⭐'] },
  { label: 'Objects', emojis: ['🎉', '🎊', '🚀', '🏆', '🎯', '💡', '📌', '📈', '💰', '⏰', '☕', '🍕', '🎁', '📷', '🎵', '✅'] },
  { label: 'Nature', emojis: ['🌟', '🌈', '☀️', '🌙', '⚡', '🌊', '🌸', '🌹', '🍀', '🐶', '🐱', '🦄', '🐝', '🦋', '🌍', '🌿'] },
];

// How many top-level comments to reveal before the "Load more" button.
const COMMENTS_PAGE_SIZE = 6;
const REPLIES_PAGE_SIZE = 4;

export default function HomePage() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [friends, setFriends] = useState<MentionUser[]>([]);
  const [peopleSuggestions, setPeopleSuggestions] = useState<SuggestedUser[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<number>>(new Set());

  // Editor refs / state
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

  // Emoji picker + image attachment
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiGroupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  // Stable handler so memo(PostCard) isn't invalidated every render. setPosts is
  // referentially stable, so this callback never needs to change.
  const handleDeletePost = useCallback((id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingFeedRef = useRef(false);
  const composerCardRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  // pageRef reuses containerRef (same DOM node, usePageEntrance uses it as animation scope)
  usePageEntrance(containerRef, [posts.length]);

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

  useGSAP(() => {
    if (initialLoading || posts.length === 0) return;
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.post-item', {
        y: 20,
        opacity: 0,
        stagger: 0.07,
        ease: 'power2.out',
        duration: 0.4,
        scrollTrigger: {
          trigger: '.post-item',
          start: 'top 88%',
          toggleActions: 'play none none none',
          scroller: getScrollParent(feedRef.current ?? null),
        },
      });
    });
  }, { scope: feedRef, dependencies: [initialLoading] });

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

  // ── Image attachment ────────────────────────────────────────
  // Revoke the previous object URL whenever the preview changes or the page
  // unmounts — the cleanup runs with the *old* value, so no URL leaks.
  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview); };
  }, [imagePreview]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-picking the same file still fires onChange
    if (!file) return;
    if (!POST_IMAGE_TYPES.includes(file.type)) {
      toast({ variant: 'error', title: 'Unsupported image', description: 'Use a JPG, PNG, or WebP image.' });
      return;
    }
    if (file.size > POST_IMAGE_MAX_BYTES) {
      toast({ variant: 'error', title: 'Image too large', description: 'Maximum image size is 5 MB.' });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file)); // effect revokes any prior URL
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // ── Emoji picker dismissal (outside-click / Escape) ─────────
  useEffect(() => {
    if (!showEmoji) return;
    const onDown = (e: PointerEvent) => {
      if (emojiGroupRef.current && !emojiGroupRef.current.contains(e.target as Node)) setShowEmoji(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowEmoji(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showEmoji]);

  // ── Post ────────────────────────────────────────────────────
  const handlePost = async () => {
    // A post is valid with text, an image, or both.
    const canPost = charCount > 0 || !!imageFile;
    if (!editorRef.current || !canPost || charCount > MAX_POST_CHARS || postingLoading) return;
    const content_html = editorRef.current.innerHTML;
    setPostingLoading(true);
    try {
      const formData = new FormData();
      formData.append('content_html', content_html);
      formData.append('visibility', visibility);
      if (imageFile) formData.append('image', imageFile);
      // No Content-Type header — the browser sets the multipart boundary itself.
      const res = await fetch('/api/posts', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        editorRef.current.innerHTML = '';
        setCharCount(0);
        setPopoverActive(false);
        setShowEmoji(false);
        removeImage();
        setPosts((prev) => [data.post, ...prev]);
        toast({ variant: 'success', title: 'Post shared', description: 'Your post is now live in the feed.' });
      } else {
        toast({ variant: 'error', title: "Couldn't post", description: data.message || 'Something went wrong. Please try again.' });
      }
    } catch {
      toast({ variant: 'error', title: "Couldn't post", description: 'Something went wrong. Please try again.' });
    }
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
        <div ref={feedRef} className="lg:col-span-2 space-y-4">

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
                    div[contenteditable] :global(ul) {
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

            {/* ──────────────────────────────────────────────────────────
                DEVELOPMENT NAVIGATOR: COMPOSER IMAGE PREVIEW
                Contains: attached image thumbnail + remove (×) control
                ────────────────────────────────────────────────────────── */}
            {imagePreview && (
              <div className="relative mt-3 inline-block">
                <img
                  src={imagePreview}
                  alt="Attached preview"
                  className="max-h-56 max-w-full rounded-2xl border border-white/[0.07] object-cover"
                />
                <Button
                  variant="unstyled"
                  onClick={removeImage}
                  aria-label="Remove image"
                  title="Remove image"
                  className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

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
                <div ref={emojiGroupRef} className="relative">
                  <ToolbarButton label="Emoji" active={showEmoji} onClick={() => setShowEmoji((v) => !v)}>
                    <Smile className="w-4 h-4" />
                  </ToolbarButton>
                  {showEmoji && <EmojiPicker onPick={(emoji) => insertChar(emoji)} />}
                </div>
                <ToolbarButton label="Add a photo" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="w-4 h-4" />
                </ToolbarButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={POST_IMAGE_ACCEPT}
                  onChange={handleImageSelect}
                  className="hidden"
                  aria-hidden
                  tabIndex={-1}
                />
              </div>

              <div className="flex items-center gap-3">
                {/* Audience switch — friends / public (exclusive hidden in composer) */}
                <AudienceSwitch value={visibility} onChange={setVisibility} />

                <Button
                  size="none"
                  shape="rounded"
                  onClick={handlePost}
                  disabled={(charCount === 0 && !imageFile) || charCount > MAX_POST_CHARS || postingLoading}
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
                  onDelete={handleDeletePost}
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
                <div className="flex flex-wrap gap-2 py-1">
                  {friends.slice(0, 7).map((f) => (
                    <Tooltip key={f.id} content={`${displayName(f)} · ${f.online_label || 'Offline'}`}>
                      <Link href={`/u/${f.username}`} className="relative flex-shrink-0">
                        <img
                          src={f.avatar}
                          alt={displayName(f)}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-800 hover:border-primary-500/40 transition-colors"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111318] ${
                            f.is_online ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        />
                      </Link>
                    </Tooltip>
                  ))}
                  {friends.length > 7 && (
                    <Link
                      href="/community/friends"
                      className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors flex-shrink-0"
                    >
                      +{friends.length - 7}
                    </Link>
                  )}
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
// memo'd so composer keystrokes (and other HomePage state churn) don't re-render
// every mounted card — only cards whose own props actually change re-render.
// Relies on `onDelete` being a stable useCallback in HomePage.
const PostCard = memo(function PostCard({ post, isOwn, viewerUsername, onDelete }: { post: Post; isOwn: boolean; viewerUsername?: string | null; onDelete: (id: number) => void }) {
  const name = displayName(post);
  const { toast } = useToast();

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
  const topStackRef = useRef<HTMLDivElement>(null);
  const commentsWrapRef = useRef<HTMLDivElement>(null);
  const commentsInnerRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [postDeleting, setPostDeleting] = useState(false);
  // Trails `commentsOpen`: stays true through the collapse tween so the close
  // animation can play out before React unmounts the thread.
  const [commentsMounted, setCommentsMounted] = useState(false);

  // Top-2 rated root comments ship inline with the feed payload (api/posts feed
  // action) and render as an always-visible static stack beneath the card — no
  // hover, no per-card fetch. Animated out only while the full thread is open.
  const topComments = post.top_comments ?? [];

  // ── Comment reveal (accordion height + content fade) ──────────
  // Sequenced against the static top-2 stack so the two never co-exist at full
  // height (no mid-transition bulge): opening collapses the stack, then expands
  // the thread; closing reverses. Height is the one layout-bound property we
  // animate — justified because no transform can make sibling content reflow,
  // and it's a one-shot, single-card interaction. `will-change` is scoped to the
  // tween's lifetime, never left on. Reduced-motion users get an instant swap.
  useGSAP(() => {
    const wrap = commentsWrapRef.current;
    if (!wrap) return; // closed + unmounted — nothing to animate
    const stack = topStackRef.current;
    const inner = commentsInnerRef.current;
    // Cancel any in-flight tweens so a fast open→close→open never overlaps.
    gsap.killTweensOf([wrap, inner, stack].filter(Boolean) as Element[]);

    gsap.matchMedia().add('(prefers-reduced-motion: reduce)', () => {
      if (commentsOpen) {
        if (stack) gsap.set(stack, { height: 0, autoAlpha: 0 });
        gsap.set(wrap, { height: 'auto' });
        if (inner) gsap.set(inner, { autoAlpha: 1, y: 0 });
      } else {
        gsap.set(wrap, { height: 0 });
        if (stack) gsap.set(stack, { height: 'auto', autoAlpha: 1 });
        setCommentsMounted(false);
      }
    });

    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      if (commentsOpen) {
        if (stack) tl.to(stack, { height: 0, autoAlpha: 0, duration: 0.18, ease: 'power2.in' });
        tl.set(wrap, { willChange: 'height' })
          .fromTo(wrap, { height: 0 }, { height: 'auto', duration: 0.3 });
        if (inner) tl.fromTo(inner, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.26 }, '<0.04');
        tl.set(wrap, { willChange: 'auto' });
      } else {
        tl.set(wrap, { willChange: 'height' });
        if (inner) tl.to(inner, { autoAlpha: 0, y: 8, duration: 0.16, ease: 'power2.in' });
        tl.to(wrap, { height: 0, duration: 0.24, ease: 'power2.in' }, inner ? '<0.04' : 0)
          .set(wrap, { willChange: 'auto' });
        if (stack) tl.fromTo(stack, { height: 0, autoAlpha: 0 }, { height: 'auto', autoAlpha: 1, duration: 0.22 });
        tl.call(() => setCommentsMounted(false)); // unmount once fully collapsed
      }
    });
  }, { dependencies: [commentsOpen], scope: cardRef });

  // First open fetches comments async, so the thread expands to the loader's
  // height first; when the real comments land we settle from that height to the
  // content's. Subsequent opens already have the data, so this no-ops.
  useGSAP(() => {
    const wrap = commentsWrapRef.current;
    const finishedLoading = wasLoadingRef.current && !loadingComments;
    wasLoadingRef.current = loadingComments;
    if (!wrap || !commentsOpen || !finishedLoading) return;
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.killTweensOf(wrap);
      const fromHeight = wrap.offsetHeight; // loader height
      gsap.set(wrap, { height: 'auto' });
      const toHeight = wrap.offsetHeight;   // settled content height
      gsap.fromTo(wrap, { height: fromHeight }, {
        height: toHeight, duration: 0.28, willChange: 'height',
        onComplete: () => gsap.set(wrap, { height: 'auto', willChange: 'auto' }),
      });
    });
  }, { dependencies: [loadingComments], scope: cardRef });

  // Disarm the armed delete wedge on outside-click or Escape — the cross-device
  // replacement for the old pointer-leave disarm (touch never had a "leave").
  // This card's own wedge is excluded so its second click can still confirm.
  useEffect(() => {
    if (!deleteConfirming) return;
    const disarm = () => setDeleteConfirming(false);
    const onPointerDown = (e: PointerEvent) => {
      const wedge = (e.target as Element)?.closest?.('[data-delete-wedge]');
      if (wedge && cardRef.current?.contains(wedge)) return;
      disarm();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') disarm(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [deleteConfirming]);

  // Throws on failure so the caller (handleWedgeDelete) can keep the confirm armed.
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

  // Two-step inline confirm for the quarter-circle delete wedge: first click
  // arms it (wedge fills red, trash icon → checkmark), the second runs the
  // delete; pointer-leave/blur disarms. Icon-only — the colour+icon swap is the
  // signifier (never colour alone, per HIG/accessibility).
  const handleWedgeDelete = async () => {
    if (!deleteConfirming) { setDeleteConfirming(true); return; }
    setPostDeleting(true);
    try {
      await handleDelete(); // on success the row unmounts via onDelete
      toast({ variant: 'success', title: 'Post deleted', description: 'Your post has been removed from the feed.' });
    } catch {
      setDeleteConfirming(false);
    } finally {
      setPostDeleting(false);
    }
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

  const toggleComments = async () => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening) {
      setCommentsMounted(true); // mount the thread so the open tween has a target
      if (comments.length === 0) {
        setLoadingComments(true);
        try {
          const res = await fetch(`/api/posts?action=comments&post_id=${post.id}`);
          const data = await res.json();
          if (data.success) setComments(data.comments);
        } catch { /* non-blocking */ }
        setLoadingComments(false);
      }
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
    >
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: POST CARD — MAIN GLASS CARD
          Contains: owner quarter-circle (own posts), header, content
          ────────────────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        className="relative z-[3] bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] rounded-3xl shadow-apple-lg"
      >
        {/* Top-edge highlight */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
        />

        {/* ─── Owner quarter-circle: Edit (top wedge) + Delete (right wedge) ─── */}
        {isOwn && (
          <OwnerWedge
            deleteConfirming={deleteConfirming}
            postDeleting={postDeleting}
            onDelete={handleWedgeDelete}
            onDisarm={() => setDeleteConfirming(false)}
          />
        )}

        <div className="p-5">
          {/* ── Header + content ── */}
          <div className="flex gap-3">
            <Link href={`/u/${post.username}`} className="flex-shrink-0">
              <img
                src={post.avatar}
                alt={name}
                className="w-10 h-10 rounded-xl object-cover border border-slate-800 hover:border-primary-500/30 transition-colors"
              />
            </Link>
            {/* On own posts the corner wedge occupies the top-right, so reserve
                space (pr-12) and fold the timestamp inline beside the username. */}
            <div className={`flex-1 min-w-0 ${isOwn ? 'pr-12' : ''}`}>
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
                {isOwn ? (
                  <span className="text-xs text-slate-600 flex-shrink-0">· {relativeTime(post.created_at)}</span>
                ) : (
                  <span className="text-xs text-slate-600 ml-auto flex-shrink-0">{relativeTime(post.created_at)}</span>
                )}
              </div>
              <div
                className="mt-2 text-sm text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]"
                dangerouslySetInnerHTML={{ __html: post.content_html }}
              />
              {post.image_path && (
                <img
                  src={post.image_path}
                  alt=""
                  loading="lazy"
                  className="mt-3 w-full max-h-[28rem] object-cover rounded-2xl border border-white/[0.06]"
                />
              )}
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: POST ACTION BAR — ALWAYS-ON FOOTER
            Contains: Like + Comments (left group), Share (right)
            ──────────────────────────────────────────────────────────
            Full-bleed solid shelf pinned to the card's base. Always
            visible (no hover reveal): a real toolbar, not a floating
            pill. Opaque `surface-dark` fill — no backdrop-blur, since a
            blur behind an opaque layer is invisible work (perf). */}
        <div className="relative flex items-center justify-between rounded-b-3xl border-t border-white/[0.07] bg-surface-dark px-4 py-2.5">
          {/* Top-edge highlight — light from above on the solid shelf */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />

          {/* Left group: Like + Comments */}
          <div className="flex items-center gap-4">
            <Tooltip content={liked ? 'Unlike' : 'Like'}>
              <Button
                variant="unstyled"
                onClick={handleLike}
                aria-label={liked ? 'Unlike post' : 'Like post'}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                  liked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                <Heart ref={heartIconRef} className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} />
                {likeCount > 0 && <span>{likeCount}</span>}
              </Button>
            </Tooltip>

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
          </div>

          {/* Right: Share */}
          <ShareButton
            url={`/p/${post.id}`}
            shareTitle={`${name} on Zomzam`}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          />
        </div>
      </div>

      {/* ─── Static top-2 comment layers — "imported" as a stepped/inset stack
           descending from the card. Always mounted (so GSAP can collapse/expand
           its height); animated out while the full thread is open, which shows
           these same two ranked at its top. overflow-hidden keeps the collapse
           crisp; the pt-2 lives inside so the gap collapses with it. ─── */}
      {topComments.length > 0 && (
        <div ref={topStackRef} className="relative z-[1] overflow-hidden" aria-label="Top comments">
          <div className="pt-2">
            {topComments.slice(0, 2).map((c, i, arr) => (
              <ThreadChild key={c.id} isLast={i === arr.length - 1}>
                <CommentCard
                  comment={c}
                  actions={c.upvote_count > 0 ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary-500/80">
                      <ArrowBigUp className="w-3 h-3" fill="currentColor" />
                      {c.upvote_count}
                    </span>
                  ) : null}
                />
              </ThreadChild>
            ))}
          </div>
        </div>
      )}

      {/* ─── Expanded comments section — accordion wrapper animates height,
           inner fades/slides up. Kept mounted via `commentsMounted` so the
           collapse tween can finish before React unmounts the thread. ─── */}
      {commentsMounted && (
        <div
          ref={commentsWrapRef}
          className="overflow-hidden"
          style={{ height: 0 }}
          aria-hidden={!commentsOpen}
        >
          <div ref={commentsInnerRef} className="mt-3 px-1">
          {loadingComments ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            </div>
          ) : tree.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-2">No comments yet — be the first!</p>
          ) : (
            <>
              {tree.slice(0, visibleComments).map((c, i, arr) => (
                <ThreadChild key={c.id} isLast={i === arr.length - 1}>
                  <CommentRow
                    comment={c}
                    onReply={addComment}
                    onVote={voteComment}
                    onEdit={editComment}
                    onCommentDelete={deleteComment}
                    viewerUsername={viewerUsername}
                    depth={0}
                  />
                </ThreadChild>
              ))}
              {tree.length > visibleComments && (
                <Button
                  variant="unstyled"
                  onClick={() => setVisibleComments((v) => v + COMMENTS_PAGE_SIZE)}
                  className="w-full text-center text-xs font-semibold text-slate-500 hover:text-sky-400 transition-colors py-1.5 mt-1"
                >
                  Show {Math.min(COMMENTS_PAGE_SIZE, tree.length - visibleComments)} more comments
                </Button>
              )}
            </>
          )}

          {/* Comment input */}
          <div className="flex gap-2 mt-3 pt-1">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitTopComment(); } }}
              placeholder="Write a comment…"
              maxLength={1000}
              className="flex-1 bg-white/[0.03] rounded-xl px-3 py-2 text-xs text-slate-200 border border-white/[0.06] outline-none focus:border-primary-500/40 transition-colors placeholder:text-slate-600"
            />
            <Button
              variant="primary"
              size="none"
              onClick={submitTopComment}
              disabled={!commentText.trim() || submittingComment}
              className="p-2 disabled:opacity-40 flex-shrink-0"
            >
              {submittingComment
                ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                : <Send className="w-3.5 h-3.5 text-white" />}
            </Button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Owner quarter-circle control ──────────────────────────────
// A 90° corner wedge pinned to the card's top-right, split by a 45° bisector
// into two icon-only buttons: Edit (upper wedge — placeholder) and Delete
// (right wedge — two-step confirm). Static, no hover reveal. The quarter-disc
// arc is approximated with clip-path polygons whose apex is the top-right
// corner (the disc centre); the container's rounded-tr-3xl + overflow-hidden
// makes the outer corner sit flush with the card.
const WEDGE_EDIT_CLIP = 'polygon(100% 0, 0 0, 3.4% 25.9%, 13.4% 50%, 29.3% 70.7%)';
const WEDGE_DELETE_CLIP = 'polygon(100% 0, 29.3% 70.7%, 50% 86.6%, 74.1% 96.6%, 100% 100%)';

function OwnerWedge({
  deleteConfirming,
  postDeleting,
  onDelete,
  onDisarm,
}: {
  deleteConfirming: boolean;
  postDeleting: boolean;
  onDelete: () => void;
  onDisarm: () => void;
}) {
  return (
    <div className="absolute top-0 right-0 z-[4] w-[60px] h-[60px] rounded-tr-3xl overflow-hidden pointer-events-none">
      {/* Edit — upper wedge (inline editing ships in a later pass) */}
      <Button
        variant="unstyled"
        onClick={() => { /* placeholder — inline post editing ships in a later pass */ }}
        title="Editing coming soon"
        aria-label="Edit post (coming soon)"
        className="group absolute inset-0 pointer-events-auto bg-white/[0.04] hover:bg-primary-500/20 transition-colors"
        style={{ clipPath: WEDGE_EDIT_CLIP }}
      >
        <Pencil className="absolute right-[26px] top-[8px] w-3.5 h-3.5 text-slate-400 group-hover:text-primary-400 transition-colors" />
      </Button>

      {/* Delete — right wedge: first click arms (red fill + checkmark), second deletes */}
      <Button
        variant="unstyled"
        data-delete-wedge
        onClick={onDelete}
        onBlur={onDisarm}
        disabled={postDeleting}
        aria-label={deleteConfirming ? 'Confirm delete post' : 'Delete post'}
        title={deleteConfirming ? 'Click again to confirm' : 'Delete post'}
        className={`group absolute inset-0 pointer-events-auto transition-colors disabled:opacity-60 ${
          deleteConfirming ? 'bg-red-600' : 'bg-white/[0.04] hover:bg-red-600/30'
        }`}
        style={{ clipPath: WEDGE_DELETE_CLIP }}
      >
        {postDeleting ? (
          <Loader2 className="absolute right-[10px] top-[26px] w-3.5 h-3.5 text-white animate-spin" />
        ) : deleteConfirming ? (
          <Check className="absolute right-[10px] top-[26px] w-3.5 h-3.5 text-white" />
        ) : (
          <Trash2 className="absolute right-[10px] top-[26px] w-3.5 h-3.5 text-slate-400 group-hover:text-red-300 transition-colors" />
        )}
      </Button>

      {/* 45° bisector hairline — signifies the two distinct halves */}
      <span
        aria-hidden
        className="absolute top-0 right-0 w-px h-[60px] bg-white/10 pointer-events-none"
        style={{ transformOrigin: 'top', transform: 'rotate(45deg)' }}
      />
    </div>
  );
}

// ── Thread connector ──────────────────────────────────────────
// Wraps a comment so a thin rail descends from the parent (post or comment)
// with a short elbow into each child card. The rail runs full height for
// every child except the last, where it stops at the elbow — giving a clean
// branch that links a post to its comments and a comment to its replies.
function ThreadChild({ isLast, children }: { isLast?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative pl-5 pb-2 last:pb-0">
      {/* vertical rail */}
      <span
        aria-hidden
        className={`absolute left-1.5 top-0 w-px bg-slate-800/60 ${isLast ? 'h-[18px]' : 'bottom-0'}`}
      />
      {/* elbow into the card */}
      <span aria-hidden className="absolute left-1.5 top-[18px] h-px w-3 bg-slate-800/60" />
      {children}
    </div>
  );
}

// ── Uniform comment card ──────────────────────────────────────
// One design for every comment in the feed — the static top-2 previews under a
// post AND the rows in the expanded thread. Deliberately distinct from the post
// card (solid dark surface, hairline border, tighter radius, no glass blur or
// drop shadow) so a comment never reads as a post. Callers slot header controls
// via `actions` and may override the body via `children` (e.g. an edit box).
function CommentCard({
  comment,
  actions,
  children,
  className,
}: {
  comment: Comment;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const name = displayName(comment);
  return (
    <div className={`flex gap-2 ${className ?? ''}`}>
      <img
        src={comment.avatar}
        alt=""
        className="w-7 h-7 rounded-lg object-cover border border-slate-800 flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0 bg-[#111318] rounded-2xl border border-white/[0.05] px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-white truncate">{name}</span>
          <span className="text-[10px] text-slate-600 flex-shrink-0">{relativeTime(comment.created_at)}</span>
          {actions && <div className="ml-auto flex items-center gap-3">{actions}</div>}
        </div>
        {children ?? (
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed break-words [overflow-wrap:anywhere]">
            {comment.content}
          </p>
        )}
      </div>
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

  // Replies mirror the post's comment toggle: one reply shows statically, the
  // rest reveal on a "View replies" button — no hover, no push-down animation.
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [visibleReplies, setVisibleReplies] = useState(REPLIES_PAGE_SIZE);
  const replies = comment.replies ?? [];
  const replyCount = replies.length;
  const shownReplies = repliesExpanded ? replies.slice(0, visibleReplies) : replies.slice(0, 1);

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
    <div>

      <CommentCard
        comment={comment}
        actions={
          <>
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
                <DropdownItem leading={<Pencil className="w-4 h-4" />} onClick={startEdit}>Edit</DropdownItem>
                <DropdownItem
                  leading={<Trash2 className="w-4 h-4" />}
                  onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                  className="text-rose-400 hover:bg-rose-500/10"
                >
                  Delete
                </DropdownItem>
              </Dropdown>
            )}
          </>
        }
      >
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
              <Button variant="primary" size="xs" onClick={saveEdit} loading={savingEdit} disabled={!editText.trim() || editText.trim() === comment.content}>Save</Button>
              <Button variant="ghost" size="xs" onClick={() => setEditing(false)} disabled={savingEdit}>Cancel</Button>
            </div>
          </div>
        ) : undefined}
      </CommentCard>

      {/* Reply input */}
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
          <Button variant="primary" size="none" shape="lg" onClick={submitReply} disabled={!replyText.trim() || submitting} className="p-1.5 disabled:opacity-40 flex-shrink-0">
            {submitting ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Send className="w-3 h-3 text-white" />}
          </Button>
        </div>
      )}

      {/* Nested replies — one shows statically; the rest reveal on the toggle,
          mirroring the post's comment button. */}
      {replyCount > 0 && (
        <div className="mt-2">
          {shownReplies.map((reply, i, arr) => (
            <ThreadChild key={reply.id} isLast={i === arr.length - 1}>
              <CommentRow
                comment={reply}
                onReply={onReply}
                onVote={onVote}
                onEdit={onEdit}
                onCommentDelete={onCommentDelete}
                viewerUsername={viewerUsername}
                depth={depth + 1}
              />
            </ThreadChild>
          ))}

          {/* View / hide the remaining replies */}
          {replyCount > 1 && (
            <Button
              variant="unstyled"
              onClick={() => setRepliesExpanded((v) => !v)}
              aria-expanded={repliesExpanded}
              className="ml-5 mt-1 text-[10px] font-semibold text-slate-500 hover:text-sky-400 transition-colors py-1"
            >
              {repliesExpanded
                ? 'Hide replies'
                : `View ${replyCount - 1} ${replyCount - 1 === 1 ? 'reply' : 'replies'}`}
            </Button>
          )}

          {/* Pager within the expanded list, for long reply chains */}
          {repliesExpanded && replyCount > visibleReplies && (
            <Button
              variant="unstyled"
              onClick={() => setVisibleReplies((v) => v + REPLIES_PAGE_SIZE)}
              className="ml-5 text-[10px] font-semibold text-slate-500 hover:text-sky-400 transition-colors py-1"
            >
              Show {Math.min(REPLIES_PAGE_SIZE, replyCount - visibleReplies)} more replies
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={confirmAndDelete}
        loading={deleting}
        title="Delete this comment?"
        description={
          comment.replies && comment.replies.length > 0
            ? 'This also removes all replies underneath it. This can\'t be undone.'
            : 'This permanently removes your comment. This can\'t be undone.'
        }
        confirmLabel="Delete"
      />
    </div>
  );
}

// ── Toolbar button ────────────────────────────────────────────
// ── Emoji quick-pick popover ──────────────────────────────────
// Dependency-free palette anchored above the composer's emoji button. mousedown
// is suppressed so clicking a glyph never blurs the editor — insertChar then
// drops it at the live caret. Dismissal (outside-click / Escape) is owned by the
// parent via emojiGroupRef.
function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div
      role="dialog"
      aria-label="Choose an emoji"
      className="absolute bottom-full left-0 mb-2 z-50 w-72 max-h-72 overflow-y-auto rounded-2xl border border-slate-700/60 bg-[#1A1D24]/95 backdrop-blur-xl shadow-2xl shadow-black/50 ring-1 ring-white/5 p-2 origin-bottom animate-in"
    >
      {EMOJI_GROUPS.map((group) => (
        <div key={group.label} className="mb-1.5 last:mb-0">
          <p className="px-1.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            {group.label}
          </p>
          <div className="grid grid-cols-8 gap-0.5">
            {group.emojis.map((emoji) => (
              <Button
                key={emoji}
                variant="unstyled"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(emoji)}
                aria-label={`Insert ${emoji} emoji`}
                className="flex items-center justify-center h-8 w-8 rounded-lg text-lg leading-none hover:bg-slate-800/70 transition-colors"
              >
                {emoji}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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
