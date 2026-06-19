'use client';

import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { cn } from '@/lib/utils';

/**
 * Copy text to the clipboard, degrading gracefully. The async Clipboard API is
 * only available in secure contexts (https / localhost), so a LAN dev IP or
 * plain http would otherwise throw and leave the button doing nothing — here we
 * fall back to a hidden-textarea + execCommand copy.
 * @returns true if the copy succeeded.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fall through to legacy path */ }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export interface ShareButtonProps {
  /** URL to share — relative (resolved against the page origin) or absolute. */
  url: string;
  /** Title offered to the native share sheet on mobile. */
  shareTitle?: string;
  /** Tooltip label in the idle state. */
  label?: string;
  /** Tooltip label shown briefly after a successful copy. */
  copiedLabel?: string;
  /** Applied to the wrapper so callers can position it (e.g. "ml-auto"). */
  className?: string;
}

/**
 * A share affordance: uses the native share sheet on mobile and falls back to
 * copying the link (with a transient "Copied!" confirmation) everywhere else.
 * Self-contained — pass it a URL and it handles the rest.
 */
export function ShareButton({
  url,
  shareTitle,
  label = 'Share',
  copiedLabel = 'Link copied',
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const href = new URL(url, window.location.href).href;
    // Native share sheet on mobile; otherwise copy. A dismissed sheet
    // (AbortError) is left alone — anything else falls through to a clipboard
    // copy so the button never silently no-ops.
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try {
        await navigator.share(shareTitle ? { title: shareTitle, url: href } : { url: href });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        /* fall through to copy */
      }
    }
    if (await copyToClipboard(href)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <span className={cn('inline-flex', className)}>
      <Tooltip content={copied ? copiedLabel : label}>
        <Button
          variant="unstyled"
          onClick={handleShare}
          aria-label={label}
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold transition-colors',
            copied ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400',
          )}
        >
          <Share2 className="w-4 h-4" />
          {copied && <span>Copied!</span>}
        </Button>
      </Tooltip>
    </span>
  );
}
