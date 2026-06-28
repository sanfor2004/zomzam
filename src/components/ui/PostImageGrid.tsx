'use client';

import React from 'react';
import Image from 'next/image';

// ── Post image grid ───────────────────────────────────────────
// One renderer for a post's attached media across every surface (feed card,
// permalink detail, future profile grid). Posts carry up to 3 images; the
// layout mirrors Instagram/Threads: a single image goes full-width, two split
// the row evenly, three sit in a tight 3-up strip. Shared so the multi-image
// rules can never drift between the card and the detail page.

/**
 * Resolve a post's ordered image list. Prefers the `image_paths` array (new
 * multi-image rows) and falls back to a single `[image_path]` for legacy rows
 * created before multi-image existed. Capped at 3 — the product limit.
 */
export function postImages(post: { image_path?: string | null; image_paths?: string[] | null }): string[] {
  const list = Array.isArray(post.image_paths) ? post.image_paths.filter(Boolean) : [];
  if (list.length > 0) return list.slice(0, 3);
  return post.image_path ? [post.image_path] : [];
}

interface PostImageGridProps {
  images: string[];
  /** How to present a SINGLE image: 'bleed' (edge-to-edge, no radius — the
   *  feed-card look) or 'rounded' (radius + hairline border — the detail look).
   *  Multi-image grids are always rounded + clipped regardless. */
  single?: 'bleed' | 'rounded';
  className?: string;
}

export function PostImageGrid({ images, single = 'bleed', className }: PostImageGridProps) {
  if (images.length === 0) return null;

  // Single image — honor the caller's bleed/rounded preference.
  if (images.length === 1) {
    return (
      <Image
        src={images[0]}
        alt=""
        width={1200}
        height={1200}
        sizes="(max-width: 1024px) 100vw, 600px"
        className={`w-full max-h-[34rem] object-cover ${
          single === 'rounded' ? 'rounded-2xl border border-white/[0.06]' : ''
        } ${className ?? ''}`}
      />
    );
  }

  // Two or three images — an even strip, each cell a square crop, hairline gaps,
  // the whole block clipped to one rounded rectangle.
  return (
    <div
      className={`grid gap-0.5 rounded-2xl overflow-hidden border border-white/[0.06] ${
        images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
      } ${className ?? ''}`}
    >
      {images.map((src, i) => (
        <div key={i} className="relative aspect-square">
          <Image
            src={src}
            alt=""
            fill
            sizes="(max-width: 1024px) 50vw, 200px"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
