'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Bold, Italic, Underline, List, Smile, Image as ImageIcon,
  AtSign, Hash, Send, Users, X,
  MessageSquare, HelpCircle, Trophy, type LucideIcon,
} from 'lucide-react';
// Sibling Kit primitives — imported directly (not via the './index' barrel) so
// this component, which the barrel itself re-exports, never imports the barrel.
import { Button } from './Button';
import { AudienceSwitch, type PostVisibility } from './AudienceSwitch';
import { Input } from './Input';
import { Tooltip } from './Tooltip';
import { useToast } from './Toast';
import { gsap } from '@/lib/gsap';
import { cn } from '@/lib/utils';
import { postImages } from './PostImageGrid';
// Feature-owned domain types still live with the home feed; the composer is a
// data-coupled Kit member (it talks to /api/posts) by design — see README §Kit.
import { displayName, type CurrentUser, type MentionUser, type Post } from '@/app/(dashboard)/home/shared';

type Trigger = '@' | '#';
type PostType = 'status' | 'ask' | 'win';

// One attached image in the composer: a freshly-picked `file` (with a blob
// preview URL), or an existing server image kept from edit mode (`file: null`,
// `url` is its server path).
interface ComposerImage {
  url: string;
  file: File | null;
}

// Maximum visible characters allowed per post. Mention (@) and tag (#) pills
// count toward this via innerText, so the limit reflects what the reader sees.
const MAX_POST_CHARS = 500;

// Product cap: a post carries at most 3 images. Mirrors the server cap in
// `createPost`/`editPost` so the user gets instant feedback (server re-validates).
const MAX_POST_IMAGES = 3;

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

interface PostComposerProps {
  currentUser: CurrentUser | null;
  /** Friend pool for @-mention autocomplete. */
  friends: MentionUser[];
  /** Called with the freshly-created post so the parent can prepend it to the feed. */
  onPosted: (post: Post) => void;
  /** Present ⇒ edit mode: seeds the editor/image/visibility from the post, hides
   *  the type + skill controls, and submits `post_edit` instead of creating. */
  editing?: { post: Post; onSaved: (post: Post) => void };
  /** Present ⇒ quote-repost mode: shows a read-only preview of `original` above
   *  the editor, hides type/skill/image + locks visibility to Public, requires
   *  text, and submits `create` with `repost_of = original.id`. Distinct config
   *  object (not an `isQuoting` flag) — mirrors `editing`. */
  quoting?: { original: Post; onPosted: (post: Post) => void };
  /** Showcase mode (the /ui-kit page). Skips the /api/posts network call on
   *  submit — just clears the editor + toasts — so the data-free reference page
   *  can render a fully interactive composer without ever writing a real post. */
  demo?: boolean;
  /** Render without the composer's own card chrome (border/bg/blur/shadow/padding)
   *  so a host Modal is the single surface. Also reveals the formatting toolbar
   *  immediately, shows an author-identity header (create mode), and renders a
   *  labeled primary submit instead of the bare send glyph. */
  bare?: boolean;
  /** Seed the post type (create mode only) — lets a banner quick-action open the
   *  composer already on Ask / Win. */
  initialType?: PostType;
  /** Fire the OS file picker on mount (the banner's "Photo" quick-action). */
  initialPhoto?: boolean;
  /** Reports whether the editor holds an unsaved draft (text or images) so a host
   *  modal can confirm before discarding it on close. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Bare create mode only: when provided, the composer renders its own close (X)
   *  inline in the identity header so the host Modal can drop its empty header
   *  (kills the dead space above the composer). Edit/quote keep the Modal title+X. */
  onClose?: () => void;
}

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: POST COMPOSER (self-contained)
// Owns ALL of its own keystroke-frequency state (char count, mention/tag
// popover, formatting, emoji, image) so typing re-renders only this component,
// not the feed or sidebar. Emits onPosted(post) up to the parent on success.
// ──────────────────────────────────────────────────────────
// `currentUser` is read again in `bare` (modal) create mode to render the author
// identity header; the inline/non-bare layout still omits it.
export function PostComposer({ currentUser, friends, onPosted, editing, quoting, demo, bare, initialType, initialPhoto, onDirtyChange, onClose }: PostComposerProps) {
  const { toast } = useToast();

  // Edit mode reuses this whole composer; the post it edits seeds the initial
  // image previews (server paths, not blobs) and visibility below.
  const initialImages: ComposerImage[] = editing
    ? postImages(editing.post).map((url) => ({ url, file: null }))
    : [];

  // Editor refs / state
  const editorRef = useRef<HTMLDivElement>(null);
  const composerCardRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  // The rich-text settings toolbar is revealed only once the user clicks into
  // the editor (kept hidden until then for a clean, distraction-free resting
  // state). In `bare` (modal) mode the user already committed to composing, so
  // it's shown from the start — no focus-to-reveal jump.
  const [showToolbar, setShowToolbar] = useState<boolean>(!!bare);

  // Emoji picker + image attachment
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiGroupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Up to MAX_POST_IMAGES attached images, in display order.
  const [images, setImages] = useState<ComposerImage[]>(initialImages);

  // Autocomplete dropdown state
  const [popoverActive, setPopoverActive] = useState(false);
  const [triggerType, setTriggerType] = useState<Trigger>('@');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const [postingLoading, setPostingLoading] = useState(false);
  const [visibility, setVisibility] = useState<PostVisibility>(quoting ? 'public' : editing?.post.visibility ?? 'friends');

  // Favor economy: one composer, branch on type. Ask reveals a skill/topic tag
  // for routing/matching; Win posts share milestones (amount stays opt-in, body
  // text only — never a column).
  const [postType, setPostType] = useState<PostType>(initialType ?? 'status');
  const [skillTag, setSkillTag] = useState('');

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

    // Position the popover relative to the composer card (its positioned
    // ancestor — the card is `relative` and the popover renders inside it).
    const rect = range.getBoundingClientRect();
    const cardRect = composerCardRef.current?.getBoundingClientRect();
    if (cardRect) {
      setPopoverPos({
        top: rect.bottom - cardRect.top + 8,
        left: rect.left - cardRect.left,
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
  // Revoke every blob preview URL on unmount so no object URL leaks. Kept in a
  // ref (not the effect dep list) so adding/removing images mid-session doesn't
  // re-run cleanup and revoke URLs still on screen — only blob: URLs are object
  // URLs (edit-mode seeds are server paths, left untouched).
  const imagesRef = useRef(images);
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => {
    return () => {
      for (const img of imagesRef.current) {
        if (img.file && img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
      }
    };
  }, []);

  // Edit mode: seed the editor from the post's HTML once on mount (image +
  // visibility are seeded via initial state above).
  useEffect(() => {
    if (!editing || !editorRef.current) return;
    editorRef.current.innerHTML = editing.post.content_html;
    setCharCount((editorRef.current.innerText || '').trim().length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Banner "Photo" quick-action: open the OS file picker as the modal mounts.
  // ponytail: a programmatic file-input click one render after the originating
  // user gesture is honored in Chrome but may be ignored by stricter browsers;
  // the toolbar's always-visible Photo button is the guaranteed fallback.
  useEffect(() => {
    if (initialPhoto) fileInputRef.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surface draft-dirty state (text or images) so a host modal can confirm
  // before discarding the draft on close.
  useEffect(() => {
    onDirtyChange?.(charCount > 0 || images.length > 0);
  }, [charCount, images.length, onDirtyChange]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ''; // reset so re-picking the same file still fires onChange
    if (picked.length === 0) return;

    const room = MAX_POST_IMAGES - images.length;
    if (room <= 0) {
      toast({ variant: 'error', title: 'Image limit reached', description: `You can attach up to ${MAX_POST_IMAGES} images.` });
      return;
    }

    const accepted: ComposerImage[] = [];
    for (const file of picked) {
      if (accepted.length >= room) {
        toast({ variant: 'info', title: 'Image limit reached', description: `Only the first ${MAX_POST_IMAGES} images were added.` });
        break;
      }
      if (!POST_IMAGE_TYPES.includes(file.type)) {
        toast({ variant: 'error', title: 'Unsupported image', description: 'Use a JPG, PNG, or WebP image.' });
        continue;
      }
      if (file.size > POST_IMAGE_MAX_BYTES) {
        toast({ variant: 'error', title: 'Image too large', description: 'Maximum image size is 5 MB.' });
        continue;
      }
      accepted.push({ url: URL.createObjectURL(file), file });
    }
    if (accepted.length) setImages((prev) => [...prev, ...accepted]);
  };

  // Drop one image; revoke its blob preview immediately (only freshly-picked
  // files carry a blob URL — existing edit-mode images are server paths).
  const removeImageAt = (index: number) => {
    setImages((prev) => {
      const img = prev[index];
      if (img?.file && img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Drop every image (post-submit reset). Revoke all blob previews first.
  const clearImages = () => {
    setImages((prev) => {
      for (const img of prev) {
        if (img.file && img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
      }
      return [];
    });
  };

  // ── Toolbar reveal dismissal (click outside the whole card) ──
  // The settings toolbar appears on editor focus and stays up while the user
  // works anywhere inside the card; a click outside the composer retires it.
  useEffect(() => {
    // In bare (modal) mode the toolbar is permanent — never retire it on an
    // outside click (the emoji picker keeps its own separate dismissal below).
    if (bare || !showToolbar) return;
    const onDown = (e: PointerEvent) => {
      if (composerCardRef.current && !composerCardRef.current.contains(e.target as Node)) {
        setShowToolbar(false);
        setShowEmoji(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [showToolbar, bare]);

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

  // ── Post / Save ─────────────────────────────────────────────
  // Valid with text, at least one image (new or kept), or both — never over the cap.
  const hasImageContent = images.length > 0;
  // A quote needs text OR an image (an empty, image-less quote is just a plain
  // repost, handled by the menu's instant action) — same rule as a normal post.
  const canSubmit = (charCount > 0 || hasImageContent) && charCount <= MAX_POST_CHARS && !postingLoading;

  // Append every freshly-picked image File (skipping kept existing ones, which
  // carry file: null) as repeated `image` parts the server reads via getAll.
  const appendNewImages = (fd: FormData) => {
    for (const img of images) if (img.file) fd.append('image', img.file);
  };

  const createPostSubmit = async (content_html: string) => {
    try {
      const formData = new FormData();
      formData.append('content_html', content_html);
      formData.append('visibility', visibility);
      formData.append('type', postType);
      if (postType === 'ask' && skillTag.trim()) formData.append('skill_tag', skillTag.trim());
      appendNewImages(formData);
      // No Content-Type header — the browser sets the multipart boundary itself.
      const res = await fetch('/api/posts', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        editorRef.current!.innerHTML = '';
        setCharCount(0);
        setPopoverActive(false);
        setShowEmoji(false);
        clearImages();
        setPostType('status');
        setSkillTag('');
        onPosted(data.post);
        toast({ variant: 'success', title: 'Post shared', description: 'Your post is now live in the feed.' });
      } else {
        toast({ variant: 'error', title: "Couldn't post", description: data.message || 'Something went wrong. Please try again.' });
      }
    } catch {
      toast({ variant: 'error', title: "Couldn't post", description: 'Something went wrong. Please try again.' });
    }
  };

  const submitQuote = async (content_html: string) => {
    if (!quoting) return;
    try {
      const fd = new FormData();
      fd.append('content_html', content_html);
      fd.append('visibility', 'public'); // a quote republishes public content
      fd.append('repost_of', String(quoting.original.id));
      appendNewImages(fd); // the quote's OWN image(s) (optional)
      const res = await fetch('/api/posts', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        editorRef.current!.innerHTML = '';
        setCharCount(0);
        setPopoverActive(false);
        setShowEmoji(false);
        clearImages();
        quoting.onPosted(data.post);
        toast({ variant: 'success', title: 'Reposted', description: 'Your quote is now live in the feed.' });
      } else {
        toast({ variant: 'error', title: "Couldn't repost", description: data.message || 'Something went wrong. Please try again.' });
      }
    } catch {
      toast({ variant: 'error', title: "Couldn't repost", description: 'Something went wrong. Please try again.' });
    }
  };

  const saveEdit = async (content_html: string) => {
    if (!editing) return;
    // Declarative image intent: send the existing URLs the editor kept + any new
    // files. The server drops any prior image not in kept_paths.
    const keptPaths = images.filter((img) => !img.file).map((img) => img.url);
    try {
      const fd = new FormData();
      fd.append('action', 'post_edit');
      fd.append('post_id', String(editing.post.id));
      fd.append('content_html', content_html);
      fd.append('visibility', visibility);
      fd.append('kept_paths', JSON.stringify(keptPaths));
      appendNewImages(fd);
      const res = await fetch('/api/posts', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        editing.onSaved({
          ...editing.post,
          content_html: data.content_html,
          image_path: data.image_path ?? null,
          image_paths: data.image_paths ?? null,
          visibility: data.visibility ?? editing.post.visibility,
        });
        toast({ variant: 'success', title: 'Post updated', description: 'Your changes are saved.' });
      } else {
        // Keep the modal open with the draft so the edit isn't lost.
        toast({ variant: 'error', title: "Couldn't save", description: data.message || 'Something went wrong. Please try again.' });
      }
    } catch {
      toast({ variant: 'error', title: "Couldn't save", description: 'Something went wrong. Please try again.' });
    }
  };

  const handlePost = async () => {
    if (!editorRef.current || !canSubmit) return;
    const content_html = editorRef.current.innerHTML;

    // Showcase mode (/ui-kit): never touch the network or mutate real data —
    // just reset the editor and acknowledge, mirroring the success path's UX.
    if (demo) {
      editorRef.current.innerHTML = '';
      setCharCount(0);
      setPopoverActive(false);
      setShowEmoji(false);
      clearImages();
      setPostType('status');
      setSkillTag('');
      toast({ variant: 'info', title: 'Demo composer', description: 'Showcase only — nothing was actually posted.' });
      return;
    }

    setPostingLoading(true);
    if (quoting) await submitQuote(content_html);
    else if (editing) await saveEdit(content_html);
    else await createPostSubmit(content_html);
    setPostingLoading(false);
  };

  function insertChar(char: string) {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertText', false, char);
    handleInput();
  }

  // Placeholder + submit label adapt to the post type so the composer reads like
  // the action it performs (discoverability, HIG).
  const editorPlaceholder = quoting
    ? 'Add a comment to your repost…'
    : postType === 'ask'
      ? 'What do you need help with? Be specific so the right people can answer.'
      : postType === 'win'
      ? 'Share a win worth celebrating — what did you just pull off?'
      : "What's on your mind?";
  const submitLabel = quoting ? 'Repost' : editing ? 'Save' : postType === 'ask' ? 'Ask' : postType === 'win' ? 'Share win' : 'Post';

  // Author-identity header: only in bare (modal) create mode. Edit/quote carry
  // their own modal titles and a fixed audience, so they skip it. When shown it
  // owns the audience switch, so the type row below doesn't repeat it.
  const showIdentityHeader = bare && !editing && !quoting && !!currentUser;

  // The formatting / insert controls, factored out so they can sit in the
  // bottom action bar (bare/modal — X-style) OR in the on-focus top toolbar
  // (inline/non-modal). The hidden file input rides along so it mounts once.
  const toolbarControls = (
    <>
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
      <div ref={emojiGroupRef} className="relative inline-flex items-center">
        <ToolbarButton label="Emoji" active={showEmoji} onClick={() => setShowEmoji((v) => !v)}>
          <Smile className="w-4 h-4" />
        </ToolbarButton>
        {showEmoji && <EmojiPicker onPick={(emoji) => insertChar(emoji)} />}
      </div>
      <ToolbarButton
        label={images.length >= MAX_POST_IMAGES ? `Up to ${MAX_POST_IMAGES} images` : 'Add a photo'}
        disabled={images.length >= MAX_POST_IMAGES}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageIcon className="w-4 h-4" />
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept={POST_IMAGE_ACCEPT}
        multiple
        onChange={handleImageSelect}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
    </>
  );

  return (
    /* ──────────────────────────────────────────────────────────
        DEVELOPMENT NAVIGATOR: POST COMPOSER
        Contains: Top row (post type switch + audience switch),
                  Editor + settings toolbar (revealed on focus),
                  image preview, action bar (char counter + icon send),
                  @/#-autocomplete popover
        ────────────────────────────────────────────────────────── */
    <div
      ref={composerCardRef}
      className={cn(
        'relative',
        // Card chrome only outside a modal. In bare mode the host Modal is the
        // single surface, so we shed border/bg/blur/shadow/padding.
        !bare && 'bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-apple-lg',
      )}
      onFocusCapture={() => {
        if (bare) return; // no card shadow to bloom in bare mode
        gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
          gsap.to(composerCardRef.current, {
            boxShadow: '0 0 40px rgba(238,87,18,0.12), 0 25px 50px rgba(0,0,0,0.5)',
            duration: 0.4,
            ease: 'power2.out',
          });
        });
      }}
      onBlurCapture={() => {
        if (bare) return;
        gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
          gsap.to(composerCardRef.current, {
            boxShadow: '0 0 0px rgba(238,87,18,0), 0 25px 50px rgba(0,0,0,0.5)',
            duration: 0.3,
            ease: 'power2.in',
          });
        });
      }}
    >
      {/* Top-edge highlight — a card-chrome detail; the Modal owns the surface in bare mode. */}
      {!bare && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px rounded-t-2xl sm:rounded-t-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
        />
      )}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: AUTHOR IDENTITY HEADER (bare create mode)
          Contains: author avatar + name + handle, the audience chip (under the
          handle), and the self-rendered close (X) on the right
          ────────────────────────────────────────────────────────── */}
      {showIdentityHeader && (
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-start gap-3 min-w-0">
            <Image
              src={currentUser!.avatar || '/Assets/Img/default-avatar.png'}
              alt=""
              width={44}
              height={44}
              className="w-11 h-11 rounded-full object-cover border border-slate-800"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate leading-tight">{displayName(currentUser!)}</p>
              <p className="text-[11px] text-slate-500 truncate">@{currentUser!.username}</p>
              <div className="mt-1.5">
                <AudienceSwitch value={visibility} onChange={setVisibility} align="left" />
              </div>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-1 p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: POST TYPE + AUDIENCE ROW
          Contains: segmented post-type selector (+ Ask skill/topic field) on
          the left; audience switch on the right unless the identity header
          above already owns it
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        {/* Type + skill are fixed in edit/quote mode (only the comment changes). */}
        {!editing && !quoting && (
          <div className="flex flex-wrap items-center gap-2">
            <PostTypeSwitch value={postType} onChange={setPostType} />
            {postType === 'ask' && (
              <Input
                value={skillTag}
                onChange={(e) => setSkillTag(e.target.value)}
                placeholder="Skill / topic (e.g. react, seo)"
                aria-label="Skill or topic for this help request"
                leftIcon={<Hash className="w-3.5 h-3.5" />}
                className="h-[34px] max-w-[220px] text-xs"
              />
            )}
          </div>
        )}
        {/* A quote is always public (it republishes already-public content), so the
            audience is locked and shown as a static note instead of a switch.
            Otherwise show the switch here — unless the identity header has it. */}
        {quoting ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 bg-[#111318] border border-slate-800/60 rounded-xl px-2.5 py-1.5">
            <Users className="w-3.5 h-3.5" /> Public repost
          </span>
        ) : showIdentityHeader ? null : (
          <AudienceSwitch value={visibility} onChange={setVisibility} />
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: QUOTE PREVIEW (quote-repost mode)
          Contains: read-only embedded preview of the original being quoted
          ────────────────────────────────────────────────────────── */}
      {quoting && (
        <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
          <div className="flex items-center gap-2">
            <Image
              src={quoting.original.avatar || '/Assets/Img/default-avatar.png'}
              alt={displayName(quoting.original)}
              width={28}
              height={28}
              className="w-7 h-7 rounded-lg object-cover border border-slate-800"
            />
            <span className="text-xs font-bold text-white truncate">{displayName(quoting.original)}</span>
            <span className="text-[11px] text-slate-500 truncate">@{quoting.original.username}</span>
          </div>
          <div
            className="mt-2 text-sm text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere] line-clamp-4"
            dangerouslySetInnerHTML={{ __html: quoting.original.content_html }}
          />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: EDITOR + SETTINGS TOOLBAR
          Contains: rich-text settings toolbar (revealed on focus —
          Bold/Italic/Underline/List, @, #, emoji, image), and the
          contenteditable editor ("What's on your mind?")
          ────────────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Inline (non-modal) only: the boxed settings toolbar, revealed on focus.
            In bare/modal mode the same controls live in the bottom action bar. */}
        {!bare && showToolbar && (
          <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 mb-2 p-1 rounded-xl bg-[#111318] border border-slate-800/60 origin-top animate-in">
            {toolbarControls}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowToolbar(true)}
          data-placeholder={editorPlaceholder}
          className={cn(
            'w-full max-w-full text-slate-200 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] overflow-x-hidden outline-none',
            bare
              // Airy modal editor: borderless, flush on the modal surface, larger type.
              ? 'min-h-[140px] bg-transparent px-0 py-1 text-base'
              // Inline editor: boxed, focus-ring border.
              : 'min-h-[88px] bg-[#111318] rounded-2xl px-4 py-3 border border-slate-800/60 text-sm focus:border-primary-500/40 transition-colors',
          )}
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

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: COMPOSER IMAGE PREVIEWS (up to 3)
          Contains: attached image thumbnails + per-image remove (×) control
          ────────────────────────────────────────────────────────── */}
      {images.length > 0 && (
        <div className={`mt-3 grid gap-2 ${images.length === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-3'}`}>
          {images.map((img, i) => (
            <div key={img.url} className="relative group">
              {/* Blob object-URL (or kept server path) preview — a plain <img>
                  since blob URLs aren't server-optimizable. */}
              <img
                src={img.url}
                alt={`Attached preview ${i + 1}`}
                className={`w-full rounded-2xl border border-white/[0.07] object-cover ${
                  images.length === 1 ? 'max-h-56' : 'aspect-square'
                }`}
              />
              <Button
                variant="unstyled"
                onClick={() => removeImageAt(i)}
                aria-label={`Remove image ${i + 1}`}
                title="Remove image"
                className="absolute top-1.5 right-1.5 flex items-center justify-center w-7 h-7 rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: COMPOSER ACTION BAR
          Contains: in bare/modal mode — the borderless formatting + insert
          controls (left) and the char counter + labeled Post (right); inline —
          just the counter + bare send glyph
          ────────────────────────────────────────────────────────── */}
      <div className={cn('flex items-center gap-3 mt-4 pt-3 border-t border-slate-800/60', bare ? 'justify-between' : 'justify-end')}>
        {/* Borderless toolbar — bare/modal only (inline keeps the on-focus top bar). */}
        {bare && (
          <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 min-w-0">
            {toolbarControls}
          </div>
        )}

        <div className="flex items-center gap-3 shrink-0">
          {/* Character counter — amber near limit, rose when over */}
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

          {/* Submit. In the roomy modal (bare) a labeled primary button reads as
              the clear, intentional primary action; inline it's the bare
              orange-filled glyph (no chrome at rest). */}
          {bare ? (
            <Button
              variant="primary"
              size="md"
              shape="pill"
              onClick={handlePost}
              disabled={!canSubmit}
              loading={postingLoading}
              rightIcon={!postingLoading && <Send className="w-4 h-4" fill="currentColor" strokeWidth={0} />}
            >
              {submitLabel}
            </Button>
          ) : (
            <Button
              variant="unstyled"
              onClick={handlePost}
              disabled={!canSubmit}
              loading={postingLoading}
              aria-label={submitLabel}
              title={submitLabel}
              leftIcon={!postingLoading && <Send className="w-5 h-5" fill="currentColor" strokeWidth={0} />}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-primary-500 transition-all duration-150 hover:bg-primary-500/10 hover:text-primary-600 hover:-translate-y-px active:scale-95 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:bg-transparent"
            />
          )}
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
          className="absolute z-50 w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-slate-700/60 bg-[#1A1D24]/95 backdrop-blur-xl shadow-2xl shadow-black/50 ring-1 ring-white/5 origin-top animate-in"
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
                      <Image
                        src={u.avatar || '/Assets/Img/default-avatar.png'}
                        alt=""
                        width={32}
                        height={32}
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
  );
}

// ── Emoji picker ──────────────────────────────────────────────
// Rendered above the emoji toolbar button. mousedown default is suppressed on
// each glyph so clicking never blurs the editor — insertChar then drops it at
// the live caret. Dismissal (outside-click / Escape) is owned by the composer
// via emojiGroupRef.
function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div
      role="dialog"
      aria-label="Choose an emoji"
      className="absolute bottom-full left-0 mb-2 z-50 w-72 max-w-[calc(100vw-2.5rem)] max-h-72 overflow-y-auto rounded-2xl border border-slate-700/60 bg-[#1A1D24]/95 backdrop-blur-xl shadow-2xl shadow-black/50 ring-1 ring-white/5 p-2 origin-bottom animate-in"
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

// Status·Ask·Win selector — soft ghost pills (active = tinted primary, no heavy
// fill or boxed container), part of the airy composer redesign. Distinct domain
// from the Kit AudienceSwitch; promote a generic primitive only if a third
// caller appears (CLAUDE 2.0 one-off rule).
const POST_TYPE_OPTIONS: { value: PostType; label: string; icon: LucideIcon; hint: string }[] = [
  { value: 'status', label: 'Status', icon: MessageSquare, hint: 'Share an update' },
  { value: 'ask', label: 'Ask', icon: HelpCircle, hint: 'Ask for help — get unblocked' },
  { value: 'win', label: 'Win', icon: Trophy, hint: 'Celebrate a milestone' },
];

function PostTypeSwitch({ value, onChange }: { value: PostType; onChange: (v: PostType) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Post type"
      className="flex items-center gap-1"
    >
      {POST_TYPE_OPTIONS.map(({ value: optionValue, label, icon: Icon, hint }) => {
        const isActive = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={hint}
            onClick={() => onChange(optionValue)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-[0.97]',
              isActive
                ? 'bg-primary-500/10 text-primary-500 ring-1 ring-primary-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
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
