'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Bold, Italic, Underline, List, Smile, Image as ImageIcon,
  AtSign, Hash, Send, Users, X,
  MessageSquare, HelpCircle, Trophy, type LucideIcon,
} from 'lucide-react';
import { Button, AudienceSwitch, Input, Tooltip, useToast, type PostVisibility } from '@/components/ui';
import { gsap } from '@/lib/gsap';
import { displayName, type CurrentUser, type MentionUser, type Post } from './shared';

type Trigger = '@' | '#';
type PostType = 'status' | 'ask' | 'win';

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

interface PostComposerProps {
  currentUser: CurrentUser | null;
  /** Friend pool for @-mention autocomplete. */
  friends: MentionUser[];
  /** Called with the freshly-created post so the parent can prepend it to the feed. */
  onPosted: (post: Post) => void;
  /** External seed (e.g. the win prompt): switches type + prefills the editor.
   *  `key` changes per nudge so re-firing the same draft re-applies it. */
  seed?: { type: PostType; text: string; key: number } | null;
}

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: POST COMPOSER (self-contained)
// Owns ALL of its own keystroke-frequency state (char count, mention/tag
// popover, formatting, emoji, image) so typing re-renders only this component,
// not the feed or sidebar. Emits onPosted(post) up to the parent on success.
// ──────────────────────────────────────────────────────────
export function PostComposer({ currentUser, friends, onPosted, seed }: PostComposerProps) {
  const { toast } = useToast();

  // Editor refs / state
  const editorRef = useRef<HTMLDivElement>(null);
  const composerCardRef = useRef<HTMLDivElement>(null);
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

  const [postingLoading, setPostingLoading] = useState(false);
  const [visibility, setVisibility] = useState<PostVisibility>('friends');

  // Favor economy: one composer, branch on type. Ask reveals a skill/topic tag
  // for routing/matching; Win posts share milestones (amount stays opt-in, body
  // text only — never a column).
  const [postType, setPostType] = useState<PostType>('status');
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
  // Revoke the previous object URL whenever the preview changes or the component
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

  // ── Apply an external seed (win prompt) ─────────────────────
  // Switches type and prefills the editor as plain text, caret at end. Keyed on
  // seed.key so each nudge re-applies even with the same draft.
  useEffect(() => {
    if (!seed) return;
    setPostType(seed.type);
    const el = editorRef.current;
    if (!el) return;
    el.innerText = seed.text;
    setCharCount(seed.text.trim().length);
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.key]);

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
      formData.append('type', postType);
      if (postType === 'ask' && skillTag.trim()) formData.append('skill_tag', skillTag.trim());
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
  const editorPlaceholder =
    postType === 'ask'
      ? 'What do you need help with? Be specific so the right people can answer.'
      : postType === 'win'
      ? 'Share a win worth celebrating — what did you just pull off?'
      : `What's on your mind${currentUser ? `, ${displayName(currentUser)}` : ''}? Use @ to mention, # to tag.`;
  const submitLabel = postType === 'ask' ? 'Ask' : postType === 'win' ? 'Share win' : 'Post';

  return (
    /* ──────────────────────────────────────────────────────────
        DEVELOPMENT NAVIGATOR: POST COMPOSER
        Contains: Top row (post type switch + audience switch),
                  Row 1 (avatar + editor + char counter),
                  Row 2 (text settings toolbar + Post button),
                  image preview, @/#-autocomplete popover
        ────────────────────────────────────────────────────────── */
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

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: POST TYPE + AUDIENCE ROW
          Contains: segmented post-type selector (+ Ask skill/topic field) on
          the left, audience switch (Friends / Public) on the right
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
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
        <AudienceSwitch value={visibility} onChange={setVisibility} />
      </div>

      {/* Row 1 — avatar, text area, character amount */}
      <div className="flex gap-3">
        <Image
          src={currentUser?.avatar || '/Assets/Img/default-avatar.png'}
          alt="You"
          width={40}
          height={40}
          className="w-10 h-10 rounded-xl object-cover border border-slate-800 flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="relative">
            <div
              ref={editorRef}
              contentEditable
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              data-placeholder={editorPlaceholder}
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
          {/* Blob object-URL preview — not server-optimizable, so a plain <img>. */}
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

      {/* Row 2 — text settings (left) + Post button (right) */}
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

        <Button
          size="none"
          shape="rounded"
          onClick={handlePost}
          disabled={(charCount === 0 && !imageFile) || charCount > MAX_POST_CHARS || postingLoading}
          loading={postingLoading}
          leftIcon={!postingLoading && <Send className="w-4 h-4" fill="currentColor" strokeWidth={0} />}
          className="h-[34px] px-4 text-xs font-bold gap-1.5 disabled:opacity-40"
        >
          {submitLabel}
        </Button>
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

// Segmented Status·Ask·Win selector. Mirrors the Kit AudienceSwitch styling but
// is a distinct domain (post type, not visibility); if a third segmented control
// appears, promote a generic primitive into the Kit (CLAUDE 2.0 one-off rule).
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
      className="flex items-center gap-0.5 bg-[#111318] border border-slate-800/60 rounded-xl p-0.5"
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
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.97] ${
              isActive
                ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
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
